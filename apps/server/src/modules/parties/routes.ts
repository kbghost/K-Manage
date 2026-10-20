/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, type Request, type Response } from "express";
import type { Model } from "mongoose";
import { z } from "zod";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requirePermission, requireTenant } from "../../middleware/auth.js";
import { notFound } from "../../utils/errors.js";
import { escapeRegex, oid, pageQuery, paginate } from "../../utils/pagination.js";
import { idParam, send } from "../../utils/http.js";
import { audit } from "../audit/service.js";
import { Customer, Supplier } from "./models.js";
import { customerBalances, saleRemaining, supplierBalances } from "./service.js";
import { Sale, Payment } from "../sales/models.js";
import { Purchase } from "../purchases/models.js";
import { getSettings } from "../stock/service.js";
import { settleCustomer } from "../sales/service.js";

const body = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.union([z.string().trim().email().max(200), z.literal("")]).optional(),
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
});

export function partiesRouter() {
  const r = Router();
  r.use(requireAuth, requireTenant);

  const list = (model: Model<any>, read: "customers.read" | "suppliers.read", balances: "c" | "s") =>
    [requirePermission(read), ah(async (req: Request, res: Response) => {
      const f = pageQuery.extend({ status: z.enum(["active", "archived", "all"]).default("active"), withDebt: z.enum(["true", "false"]).optional() }).parse(req.query);
      const businessId = req.tenant!.businessId;
      const filter: Record<string, any> = { businessId };
      if (f.status !== "all") filter.status = f.status;
      if (f.q) { const rx = new RegExp(escapeRegex(f.q), "i"); filter.$or = [{ name: rx }, { phone: rx }, { email: rx }]; }
      const bal = balances === "c" ? await customerBalances(businessId) : await supplierBalances(businessId);
      if (f.withDebt === "true") filter._id = { $in: [...bal.keys()] };
      const { items, meta } = await paginate(model, filter, { page: f.page, limit: f.limit, sort: { name: 1, _id: 1 } });
      send(res, items.map((c) => {
        const b = bal.get(String(c._id));
        return { ...c, balance: typeof b === "number" ? b : (b?.balance ?? 0) };
      }), 200, meta);
    })] as const;

  r.get("/customers", ...list(Customer as unknown as Model<any>, "customers.read", "c"));
  r.get("/suppliers", ...list(Supplier as unknown as Model<any>, "suppliers.read", "s"));

  for (const [path, model, read, manage] of [
    ["customers", Customer, "customers.read", "customers.manage"], ["suppliers", Supplier, "suppliers.read", "suppliers.manage"],
  ] as const) {
    r.post(`/${path}`, requirePermission(manage), ah(async (req, res) => {
      send(res, await (model as unknown as Model<any>).create({ ...body.parse(req.body), businessId: req.tenant!.businessId }), 201);
    }));
    r.patch(`/${path}/:id`, requirePermission(manage), ah(async (req, res) => {
      const patch = body.partial().extend({ status: z.enum(["active", "archived"]).optional() }).parse(req.body);
      const d = await (model as unknown as Model<any>).findOneAndUpdate({ _id: oid.parse(idParam(req)), businessId: req.tenant!.businessId }, patch, { returnDocument: "after" }).lean();
      if (!d) throw notFound();
      send(res, d);
    }));
    r.get(`/${path}/:id`, requirePermission(read), ah(async (req, res) => {
      const id = oid.parse(idParam(req)); const businessId = req.tenant!.businessId;
      const d = await (model as unknown as Model<any>).findOne({ _id: id, businessId }).lean();
      if (!d) throw notFound();
      const bal = path === "customers" ? (await customerBalances(businessId, id)).get(id)?.balance ?? 0 : (await supplierBalances(businessId, id)).get(id) ?? 0;
      send(res, { ...d, balance: bal });
    }));
  }

  // ---- Creances clients
  r.get("/customers/receivables/list", requirePermission("customers.read"), ah(async (req, res) => {
    const businessId = req.tenant!.businessId; const settings = await getSettings(businessId);
    const dueDays = settings.settings?.creditDueDays ?? 30;
    const bal = await customerBalances(businessId);
    const customers = await Customer.find({ _id: { $in: [...bal.keys()] }, businessId }).lean();
    const limit = Date.now() - dueDays * 86400_000;
    send(res, customers.map((c) => { const b = bal.get(String(c._id))!; return { ...c, balance: b.balance, openSales: b.count, oldest: b.oldest, overdue: !!b.oldest && b.oldest.getTime() < limit }; })
      .sort((a, b) => b.balance - a.balance));
  }));

  r.get("/customers/:id/sales", requirePermission("customers.read"), ah(async (req, res) => {
    const f = pageQuery.parse(req.query); const id = oid.parse(idParam(req));
    const { items, meta } = await paginate(Sale as any, { businessId: req.tenant!.businessId, customerId: id }, { page: f.page, limit: f.limit, sort: { createdAt: -1, _id: -1 } });
    send(res, items.map((s) => ({ ...s, remaining: saleRemaining(s) })), 200, meta);
  }));

  r.get("/customers/:id/payments", requirePermission("customers.read"), ah(async (req, res) => {
    const f = pageQuery.parse(req.query); const id = oid.parse(idParam(req));
    const { items, meta } = await paginate(Payment as any, { businessId: req.tenant!.businessId, customerId: id }, { page: f.page, limit: f.limit, sort: { createdAt: -1, _id: -1 } });
    send(res, items, 200, meta);
  }));

  r.post("/customers/:id/settlements", requirePermission("customers.manage"), ah(async (req, res) => {
    const id = oid.parse(idParam(req));
    const b = z.object({ amount: z.number().int().min(1).max(1_000_000_000), method: z.string().trim().min(1).max(30), note: z.string().trim().max(300).optional() }).parse(req.body);
    const key = req.get("idempotency-key") ?? crypto.randomUUID();
    const result = await settleCustomer({ businessId: req.tenant!.businessId, userId: req.auth!.userId }, id, b, key);
    if (!result.replay) await audit(req, { businessId: req.tenant!.businessId, userId: req.auth!.userId, action: "customer.settlement", resourceType: "customer", resourceId: id, details: { amount: b.amount } });
    send(res, result, result.replay ? 200 : 201);
  }));

  r.get("/suppliers/:id/purchases", requirePermission("suppliers.read"), ah(async (req, res) => {
    const f = pageQuery.parse(req.query);
    const { items, meta } = await paginate(Purchase as any, { businessId: req.tenant!.businessId, supplierId: oid.parse(idParam(req)) }, { page: f.page, limit: f.limit, sort: { createdAt: -1, _id: -1 } });
    send(res, items.map((p) => ({ ...p, remaining: p.status === "cancelled" ? 0 : p.total - p.paidAmount })), 200, meta);
  }));

  return r;
}
