/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import { z } from "zod";
import { MoneyError, multiplyQty, toMilli } from "@k-manage/shared";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requirePermission, requireTenant } from "../../middleware/auth.js";
import { AppError, notFound } from "../../utils/errors.js";
import { dateRange, escapeRegex, oid, pageQuery, paginate } from "../../utils/pagination.js";
import { idParam, send } from "../../utils/http.js";
import { periodBounds } from "../../utils/time.js";
import { audit } from "../audit/service.js";
import { runTx } from "../../db/tx.js";
import { Product } from "../catalog/models.js";
import { Supplier } from "../parties/models.js";
import { applyStock, getSettings, nextNumber } from "../stock/service.js";
import { Payment } from "../sales/models.js";
import { recordPayment } from "../sales/service.js";
import { Purchase } from "./models.js";

const qty = z.number().gt(0).max(1_000_000).refine((n) => Math.abs(Math.round(n * 1000) / 1000 - n) < 1e-9, "3 decimales maximum");
const view = (p: any) => ({ ...p, remaining: p.status === "cancelled" ? 0 : p.total - p.paidAmount });
const wrap = <T>(fn: () => T): T => { try { return fn(); } catch (e) { if (e instanceof MoneyError) throw new AppError(400, "INVALID_AMOUNT", e.message); throw e; } };

export function purchasesRouter() {
  const r = Router();
  r.use(requireAuth, requireTenant);

  r.get("/", requirePermission("purchases.read"), ah(async (req, res) => {
    const f = pageQuery.merge(dateRange).extend({ status: z.enum(["ordered", "partial", "received", "cancelled"]).optional(), supplierId: oid.optional(), unpaid: z.enum(["true", "false"]).optional() }).parse(req.query);
    const businessId = req.tenant!.businessId; const filter: Record<string, any> = { businessId };
    if (f.status) filter.status = f.status; if (f.supplierId) filter.supplierId = f.supplierId;
    if (f.q) { const rx = new RegExp(escapeRegex(f.q), "i"); filter.$or = [{ number: rx }, { supplierName: rx }]; }
    if (f.from || f.to) { const b = periodBounds(f.from, f.to ?? f.from, (await getSettings(businessId)).timezone ?? "Africa/Porto-Novo"); filter.createdAt = { $gte: b.from, $lt: b.to }; }
    const { items, meta } = await paginate(Purchase as any, filter, { page: f.page, limit: f.limit, sort: { createdAt: -1, _id: -1 } });
    send(res, items.map((p) => ({ ...view(p), lines: undefined, lineCount: p.lines.length })), 200, meta);
  }));

  r.get("/:id", requirePermission("purchases.read"), ah(async (req, res) => {
    const businessId = req.tenant!.businessId; const id = oid.parse(idParam(req));
    const p = await Purchase.findOne({ _id: id, businessId }).lean();
    if (!p) throw notFound("Achat introuvable");
    send(res, { ...view(p), payments: await Payment.find({ businessId, purchaseId: id }).sort({ createdAt: 1 }).lean() });
  }));

  r.post("/", requirePermission("purchases.manage"), ah(async (req, res) => {
    const b = z.object({
      supplierId: oid, note: z.string().trim().max(300).optional(),
      lines: z.array(z.object({ productId: oid, quantity: qty, unitCost: z.number().int().min(0).max(1_000_000_000) })).min(1).max(200),
    }).parse(req.body);
    const businessId = req.tenant!.businessId; const userId = req.auth!.userId;
    const supplier = await Supplier.findOne({ _id: b.supplierId, businessId, status: "active" }).lean();
    if (!supplier) throw new AppError(400, "SUPPLIER_NOT_FOUND", "Fournisseur introuvable");
    const ids = [...new Set(b.lines.map((l) => l.productId))];
    const products = new Map((await Product.find({ _id: { $in: ids }, businessId, status: "active" }).lean()).map((p) => [String(p._id), p]));
    if (products.size !== ids.length) throw new AppError(400, "PRODUCT_NOT_FOUND", "Un produit est introuvable ou archive");
    const lines = b.lines.map((l) => { const p = products.get(l.productId)!; const q = wrap(() => toMilli(l.quantity)); return { productId: p._id, name: p.name, sku: p.sku, quantityMilli: q, receivedMilli: 0, unitCost: l.unitCost, total: wrap(() => multiplyQty(q, l.unitCost)) }; });
    const number = await nextNumber(businessId, "purchase", "A");
    const doc = await Purchase.create({ businessId, number, supplierId: supplier._id, supplierName: supplier.name, lines, total: lines.reduce((s, l) => s + l.total, 0), paidAmount: 0, userId, note: b.note });
    send(res, view(doc.toObject()), 201);
  }));

  r.post("/:id/receive", requirePermission("purchases.manage"), ah(async (req, res) => {
    const b = z.object({ lines: z.array(z.object({ lineIndex: z.number().int().min(0).max(199), quantity: qty })).min(1) }).parse(req.body);
    const businessId = req.tenant!.businessId; const userId = req.auth!.userId; const id = oid.parse(idParam(req));
    const purchase = await Purchase.findOne({ _id: id, businessId }).lean();
    if (!purchase) throw notFound("Achat introuvable");
    if (!["ordered", "partial"].includes(purchase.status)) throw new AppError(409, "NOT_RECEIVABLE", "Cet achat ne peut plus etre receptionne");
    if (new Set(b.lines.map((l) => l.lineIndex)).size !== b.lines.length) throw new AppError(400, "DUPLICATE_LINE", "Une ligne apparait plusieurs fois");
    const recv = b.lines.map((l) => {
      const line = purchase.lines[l.lineIndex]; if (!line) throw new AppError(400, "LINE_NOT_FOUND", "Ligne introuvable");
      const q = wrap(() => toMilli(l.quantity));
      if (q > line.quantityMilli - line.receivedMilli) throw new AppError(400, "OVER_RECEIPT", `Quantite recue superieure au reste a livrer pour « ${line.name} »`);
      return { idx: l.lineIndex, q, line };
    });
    const nowReceived = purchase.lines.map((l, i) => l.receivedMilli + (recv.find((x) => x.idx === i)?.q ?? 0));
    const complete = purchase.lines.every((l, i) => nowReceived[i] === l.quantityMilli);
    const filter: Record<string, unknown> = { _id: purchase._id, businessId, status: { $in: ["ordered", "partial"] } };
    const $inc: Record<string, number> = {}; const inv: Record<string, number> = {};
    for (const x of recv) { filter[`lines.${x.idx}.receivedMilli`] = x.line.receivedMilli; $inc[`lines.${x.idx}.receivedMilli`] = x.q; inv[`lines.${x.idx}.receivedMilli`] = -x.q; }
    await runTx(async (tx) => {
      const u = await tx.update(Purchase as any, filter, { $inc, $set: { status: complete ? "received" : "partial" }, $push: { receptions: { date: new Date(), userId, lines: recv.map((x) => ({ lineIndex: x.idx, quantityMilli: x.q })) } } }, { $inc: inv, $set: { status: purchase.status }, $pop: { receptions: 1 } });
      if (!u) throw new AppError(409, "PURCHASE_CHANGED", "L'achat a ete modifie entre-temps, reessayez.");
      for (const x of recv) {
        await applyStock(tx, { businessId, productId: x.line.productId, deltaMilli: x.q, allowNegative: true, type: "purchase_receipt", userId, refKind: "purchase", refId: purchase._id, unitCost: x.line.unitCost, reason: purchase.number });
        // Dernier prix d'achat connu ; l'historique reste dans les mouvements de stock.
        await tx.update(Product as any, { _id: x.line.productId, businessId }, { $set: { costPrice: x.line.unitCost } }, { $set: { costPrice: 0 } });
      }
    });
    await audit(req, { businessId, userId, action: "purchase.receive", resourceType: "purchase", resourceId: id });
    send(res, view((await Purchase.findById(id).lean())!));
  }));

  r.post("/:id/payments", requirePermission("purchases.manage"), ah(async (req, res) => {
    const b = z.object({ amount: z.number().int().min(1).max(1_000_000_000), method: z.string().trim().min(1).max(30), note: z.string().trim().max(300).optional() }).parse(req.body);
    const businessId = req.tenant!.businessId; const userId = req.auth!.userId; const id = oid.parse(idParam(req));
    const hdr = req.get("idempotency-key"); const key = hdr && hdr.length >= 8 ? hdr : crypto.randomUUID();
    const dup = await Payment.findOne({ businessId, idempotencyKey: key }).lean();
    if (dup) return send(res, { payment: dup, replay: true }, 200);
    const methods = new Set(["cash", ...((await getSettings(businessId)).settings?.paymentMethods ?? [])]);
    if (!methods.has(b.method)) throw new AppError(400, "INVALID_PAYMENT_METHOD", "Moyen de paiement non configure");
    const p = await Purchase.findOne({ _id: id, businessId }).lean();
    if (!p) throw notFound("Achat introuvable");
    if (p.status === "cancelled") throw new AppError(409, "PURCHASE_CANCELLED", "Achat annule");
    const remaining = p.total - p.paidAmount;
    if (remaining <= 0) throw new AppError(409, "ALREADY_PAID", "Cet achat est deja solde");
    if (b.amount > remaining) throw new AppError(400, "OVERPAYMENT", `Le paiement depasse le reste a payer (${remaining} FCFA)`);
    try {
      const payment = await runTx(async (tx) => {
        const u = await tx.update(Purchase as any, { _id: p._id, businessId, status: { $ne: "cancelled" }, paidAmount: p.paidAmount }, { $inc: { paidAmount: b.amount } }, { $inc: { paidAmount: -b.amount } });
        if (!u) throw new AppError(409, "PURCHASE_CHANGED", "L'achat a ete modifie entre-temps, reessayez.");
        return recordPayment(tx, { businessId, userId, kind: "supplier_payment", direction: "out", method: b.method, amount: b.amount, purchaseId: p._id, supplierId: p.supplierId, key, note: b.note });
      });
      send(res, { payment, replay: false }, 201);
    } catch (e) {
      if ((e as { code?: number }).code === 11000) { const again = await Payment.findOne({ businessId, idempotencyKey: key }).lean(); if (again) return send(res, { payment: again, replay: true }, 200); }
      throw e;
    }
  }));

  r.post("/:id/cancel", requirePermission("purchases.manage"), ah(async (req, res) => {
    const businessId = req.tenant!.businessId; const id = oid.parse(idParam(req));
    const u = await Purchase.findOneAndUpdate({ _id: id, businessId, status: "ordered", paidAmount: 0 }, { status: "cancelled" }, { returnDocument: "after" }).lean();
    if (!u) throw new AppError(409, "NOT_CANCELLABLE", "Seul un achat non receptionne et non paye peut etre annule");
    await audit(req, { businessId, userId: req.auth!.userId, action: "purchase.cancel", resourceType: "purchase", resourceId: id });
    send(res, view(u));
  }));

  return r;
}
