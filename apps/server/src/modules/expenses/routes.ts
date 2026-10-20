/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import { z } from "zod";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requirePermission, requireTenant } from "../../middleware/auth.js";
import { AppError, notFound } from "../../utils/errors.js";
import { dateRange, escapeRegex, oid, pageQuery, paginate } from "../../utils/pagination.js";
import { idParam, send } from "../../utils/http.js";
import { periodBounds, startOfDay } from "../../utils/time.js";
import { FORMATS, sendTable } from "../../utils/export.js";
import { audit } from "../audit/service.js";
import { runTx, type Tx } from "../../db/tx.js";
import { getSettings } from "../stock/service.js";
import { CashEntry, CashSession } from "../cash/models.js";
import { cashSummary, openSessionFor } from "../cash/service.js";
import { Expense } from "./models.js";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const base = z.object({
  category: z.string().trim().min(1).max(60), description: z.string().trim().min(1).max(300),
  amount: z.number().int().min(1).max(1_000_000_000), date: dateStr, attachmentUploadId: oid.optional(),
});
const createBody = base.extend({ status: z.enum(["paid", "payable"]).default("paid"), method: z.string().trim().min(1).max(30).optional() })
  .refine((b) => b.status === "payable" || !!b.method, { message: "Moyen de paiement requis pour une depense payee", path: ["method"] });

/** Depense payee en especes : sortie de caisse sur la session ouverte (obligatoire). Credit : aucune sortie. */
async function cashOut(tx: Tx, businessId: any, userId: any, amount: number, reason: string) {
  const s = await openSessionFor(businessId, userId);
  if (!s) throw new AppError(409, "NO_OPEN_SESSION", "Ouvrez la caisse pour payer une depense en especes");
  const sum = await cashSummary(businessId, s._id, s.openingAmount);
  if (amount > sum.expected) throw new AppError(400, "INSUFFICIENT_CASH", "Le montant depasse le solde theorique de la caisse");
  return tx.create(CashEntry as any, { businessId, cashSessionId: s._id, type: "out", source: "expense", amount, reason, userId });
}

export function expensesRouter() {
  const r = Router();
  r.use(requireAuth, requireTenant);

  r.get("/", requirePermission("expenses.read"), ah(async (req, res) => {
    const f = pageQuery.merge(dateRange).extend({ category: z.string().max(60).optional(), status: z.enum(["paid", "payable"]).optional(), format: z.enum(FORMATS).default("json") }).parse(req.query);
    const businessId = req.tenant!.businessId; const filter: Record<string, any> = { businessId };
    if (f.category) filter.category = f.category; if (f.status) filter.status = f.status;
    if (f.q) filter.description = new RegExp(escapeRegex(f.q), "i");
    if (f.from || f.to) { const b = periodBounds(f.from, f.to ?? f.from, (await getSettings(businessId)).timezone ?? "Africa/Porto-Novo"); filter.date = { $gte: b.from, $lt: b.to }; }
    if (f.format !== "json") {
      const rows = await Expense.find(filter).sort({ date: -1 }).lean();
      await sendTable(res, f.format, { title: "Depenses", filename: "depenses", columns: [{ key: "day", label: "Date" }, { key: "category", label: "Categorie" }, { key: "description", label: "Description" }, { key: "amount", label: "Montant", align: "right" }, { key: "method", label: "Paiement" }, { key: "status", label: "Statut" }], rows: rows.map((e) => ({ ...e, day: e.date.toISOString().slice(0, 10), method: e.method ?? "" })) as never });
      return;
    }
    const { items, meta } = await paginate(Expense as any, filter, { page: f.page, limit: f.limit, sort: { date: -1, _id: -1 } });
    send(res, items, 200, meta);
  }));

  r.get("/categories", requirePermission("expenses.read"), ah(async (req, res) => {
    const cats = await Expense.distinct("category", { businessId: req.tenant!.businessId });
    send(res, [...new Set(["Loyer", "Electricite", "Transport", "Salaires", "Fournitures", "Autre", ...cats])].sort());
  }));

  r.post("/", requirePermission("expenses.create"), ah(async (req, res) => {
    const b = createBody.parse(req.body); const businessId = req.tenant!.businessId; const userId = req.auth!.userId;
    const methods = new Set(["cash", ...((await getSettings(businessId)).settings?.paymentMethods ?? [])]);
    if (b.method && !methods.has(b.method)) throw new AppError(400, "INVALID_PAYMENT_METHOD", "Moyen de paiement non configure");
    const e = await runTx(async (tx) => {
      const cash = b.status === "paid" && b.method === "cash" ? await cashOut(tx, businessId, userId, b.amount, `Depense : ${b.description}`) : null;
      return tx.create(Expense as any, { businessId, userId, category: b.category, description: b.description, amount: b.amount, date: startOfDay(b.date, "UTC"), method: b.method, status: b.status, paidAt: b.status === "paid" ? new Date() : undefined, attachmentUploadId: b.attachmentUploadId, cashEntryId: cash?._id });
    });
    send(res, e, 201);
  }));

  r.patch("/:id", requirePermission("expenses.update"), ah(async (req, res) => {
    const b = base.partial().parse(req.body); const businessId = req.tenant!.businessId; const userId = req.auth!.userId; const id = oid.parse(idParam(req));
    const before = await Expense.findOne({ _id: id, businessId }).lean();
    if (!before) throw notFound("Depense introuvable");
    if (b.amount !== undefined && b.amount !== before.amount && before.cashEntryId) {
      const entry = await CashEntry.findById(before.cashEntryId).lean();
      const sess = entry && (await CashSession.findById(entry.cashSessionId).lean());
      if (sess?.status === "closed") throw new AppError(409, "CASH_CLOSED", "Cette depense est rattachee a une caisse cloturee : montant non modifiable");
      await CashEntry.updateOne({ _id: before.cashEntryId, businessId }, { amount: b.amount });
    }
    const { date, ...rest } = b; const $set: Record<string, unknown> = { ...rest };
    if (date) $set.date = startOfDay(date, "UTC");
    const changes: Record<string, [unknown, unknown]> = {};
    for (const k of Object.keys($set)) if (String((before as any)[k]) !== String($set[k])) changes[k] = [(before as any)[k], $set[k]];
    const after = await Expense.findOneAndUpdate({ _id: id, businessId }, { $set, $push: { history: { date: new Date(), userId, changes } } }, { returnDocument: "after" }).lean();
    if (Object.keys(changes).length) await audit(req, { businessId, userId, action: "expense.updated", resourceType: "expense", resourceId: id, details: changes });
    send(res, after);
  }));

  r.post("/:id/pay", requirePermission("expenses.create"), ah(async (req, res) => {
    const b = z.object({ method: z.string().trim().min(1).max(30) }).parse(req.body);
    const businessId = req.tenant!.businessId; const userId = req.auth!.userId; const id = oid.parse(idParam(req));
    const e = await Expense.findOne({ _id: id, businessId, status: "payable" }).lean();
    if (!e) throw new AppError(409, "NOT_PAYABLE", "Depense introuvable ou deja payee");
    const methods = new Set(["cash", ...((await getSettings(businessId)).settings?.paymentMethods ?? [])]);
    if (!methods.has(b.method)) throw new AppError(400, "INVALID_PAYMENT_METHOD", "Moyen de paiement non configure");
    const u = await runTx(async (tx) => {
      const cash = b.method === "cash" ? await cashOut(tx, businessId, userId, e.amount, `Paiement depense : ${e.description}`) : null;
      return tx.update(Expense as any, { _id: id, businessId, status: "payable" }, { $set: { status: "paid", method: b.method, paidAt: new Date(), cashEntryId: cash?._id } }, { $set: { status: "payable" } });
    });
    if (!u) throw new AppError(409, "NOT_PAYABLE", "Depense deja payee");
    send(res, u);
  }));

  return r;
}
