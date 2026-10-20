/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import { z } from "zod";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requirePermission, requireTenant } from "../../middleware/auth.js";
import { notFound } from "../../utils/errors.js";
import { dateRange, escapeRegex, oid, pageQuery, paginate } from "../../utils/pagination.js";
import { can, idParam, send } from "../../utils/http.js";
import { periodBounds } from "../../utils/time.js";
import { audit } from "../audit/service.js";
import { User } from "../auth/models.js";
import { Customer } from "../parties/models.js";
import { getSettings } from "../stock/service.js";
import { Business } from "../businesses/models.js";
import { Payment, Sale } from "./models.js";
import { createSale, paySale, reconcileSale, refundSale, saleView } from "./service.js";

const method = z.string().trim().min(1).max(30);
const qty = z.number().gt(0).max(1_000_000).refine((n) => Math.abs(Math.round(n * 1000) / 1000 - n) < 1e-9, "3 decimales maximum");
const createBody = z.object({
  customerId: oid.optional(),
  lines: z.array(z.object({ productId: oid, quantity: qty, discount: z.number().int().min(0).optional() })).min(1).max(200),
  discount: z.number().int().min(0).optional(),
  payments: z.array(z.object({ method, amount: z.number().int().min(1).max(1_000_000_000) })).max(5).default([]),
  note: z.string().trim().max(300).optional(),
});
const refundBody = z.object({
  lines: z.array(z.object({ lineIndex: z.number().int().min(0).max(199), quantity: qty })).min(1),
  restock: z.boolean().default(true), method: method.optional(), reason: z.string().trim().min(3, "Motif obligatoire").max(300),
});
const idemKey = (v: string | undefined) => (v && v.length >= 8 && v.length <= 100 ? v : crypto.randomUUID());

export function salesRouter() {
  const r = Router();
  r.use(requireAuth, requireTenant);

  r.get("/", requirePermission("sales.read"), ah(async (req, res) => {
    const f = pageQuery.merge(dateRange).extend({ status: z.enum(["completed", "cancelled"]).optional(), customerId: oid.optional(), userId: oid.optional() }).parse(req.query);
    const businessId = req.tenant!.businessId; const filter: Record<string, any> = { businessId };
    if (f.status) filter.status = f.status; if (f.customerId) filter.customerId = f.customerId; if (f.userId) filter.userId = f.userId;
    if (f.q) { const rx = new RegExp(escapeRegex(f.q), "i"); filter.$or = [{ number: rx }, { customerName: rx }]; }
    if (f.from || f.to) { const b = periodBounds(f.from, f.to ?? f.from, (await getSettings(businessId)).timezone ?? "Africa/Porto-Novo"); filter.createdAt = { $gte: b.from, $lt: b.to }; }
    const { items, meta } = await paginate(Sale as any, filter, { page: f.page, limit: f.limit, sort: { createdAt: -1, _id: -1 } });
    const users = new Map((await User.find({ _id: { $in: items.map((s) => s.userId) } }).select("fullName").lean()).map((u) => [String(u._id), u.fullName]));
    send(res, items.map((s) => ({ ...saleView(s), cashier: users.get(String(s.userId)), lines: undefined, lineCount: s.lines.length })), 200, meta);
  }));

  r.post("/", requirePermission("sales.create"), ah(async (req, res) => {
    const b = createBody.parse(req.body); const businessId = req.tenant!.businessId; const userId = req.auth!.userId;
    const out = await createSale({ businessId, userId, canDiscount: can(req, "sales.discount") }, b, idemKey(req.get("idempotency-key") ?? undefined));
    if (!out.replay && (out as { discounted?: boolean }).discounted) await audit(req, { businessId, userId, action: "sale.discount", resourceType: "sale", resourceId: out.sale._id, details: { discount: out.sale.discount } });
    const payments = await Payment.find({ businessId, saleId: out.sale._id }).sort({ createdAt: 1 }).lean();
    send(res, { ...saleView(out.sale), payments, replay: out.replay }, out.replay ? 200 : 201);
  }));

  r.get("/:id", requirePermission("sales.read"), ah(async (req, res) => {
    const businessId = req.tenant!.businessId; const id = oid.parse(idParam(req));
    const sale = await Sale.findOne({ _id: id, businessId }).lean();
    if (!sale) throw notFound("Vente introuvable");
    const [payments, cashier, customer, business, ledger] = await Promise.all([
      Payment.find({ businessId, saleId: id }).sort({ createdAt: 1 }).lean(),
      User.findById(sale.userId).select("fullName").lean(),
      sale.customerId ? Customer.findById(sale.customerId).select("name phone").lean() : null,
      Business.findById(businessId).select("name address phone email currency receipt").lean(),
      reconcileSale(businessId, id),
    ]);
    send(res, { ...saleView(sale), payments, cashier: cashier?.fullName, customer, business, ledger });
  }));

  r.post("/:id/payments", requirePermission("sales.create"), ah(async (req, res) => {
    const b = z.object({ amount: z.number().int().min(1).max(1_000_000_000), method, note: z.string().trim().max(300).optional() }).parse(req.body);
    const out = await paySale({ businessId: req.tenant!.businessId, userId: req.auth!.userId }, oid.parse(idParam(req)), b, idemKey(req.get("idempotency-key") ?? undefined));
    send(res, { payment: out.payment, sale: saleView(out.sale), replay: out.replay }, out.replay ? 200 : 201);
  }));

  r.post("/:id/refund", requirePermission("sales.refund"), ah(async (req, res) => {
    const b = refundBody.parse(req.body);
    const businessId = req.tenant!.businessId; const userId = req.auth!.userId;
    const out = await refundSale({ businessId, userId }, oid.parse(idParam(req)), b, "refund");
    await audit(req, { businessId, userId, action: "sale.refund", resourceType: "sale", resourceId: idParam(req), details: { value: out.valueTotal, cashRefund: out.cashRefund, reason: b.reason } });
    send(res, { ...out, sale: saleView(out.sale) });
  }));

  r.post("/:id/cancel", requirePermission("sales.cancel"), ah(async (req, res) => {
    const b = z.object({ restock: z.boolean().default(true), method: method.optional(), reason: z.string().trim().min(3, "Motif obligatoire").max(300) }).parse(req.body);
    const businessId = req.tenant!.businessId; const userId = req.auth!.userId;
    const out = await refundSale({ businessId, userId }, oid.parse(idParam(req)), b, "cancel");
    await audit(req, { businessId, userId, action: "sale.cancel", resourceType: "sale", resourceId: idParam(req), details: { reason: b.reason, cashRefund: out.cashRefund } });
    send(res, { ...out, sale: saleView(out.sale) });
  }));

  return r;
}
