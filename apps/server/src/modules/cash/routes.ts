/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import { z } from "zod";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requirePermission, requireTenant } from "../../middleware/auth.js";
import { AppError, notFound } from "../../utils/errors.js";
import { oid, pageQuery, paginate } from "../../utils/pagination.js";
import { idParam, send } from "../../utils/http.js";
import { audit } from "../audit/service.js";
import { User } from "../auth/models.js";
import { CashEntry, CashSession } from "./models.js";
import { cashSummary, openSessionFor } from "./service.js";

export function cashRouter() {
  const r = Router();
  r.use(requireAuth, requireTenant);

  r.get("/current", requirePermission("cash.manage"), ah(async (req, res) => {
    const s = await openSessionFor(req.tenant!.businessId, req.auth!.userId);
    if (!s) return send(res, null);
    send(res, { ...s, summary: await cashSummary(req.tenant!.businessId, s._id, s.openingAmount) });
  }));

  r.get("/", requirePermission("cash.manage"), ah(async (req, res) => {
    const f = pageQuery.parse(req.query);
    const { items, meta } = await paginate(CashSession as any, { businessId: req.tenant!.businessId }, { page: f.page, limit: f.limit, sort: { openedAt: -1, _id: -1 } });
    const users = new Map((await User.find({ _id: { $in: items.map((s) => s.openedBy) } }).select("fullName").lean()).map((u) => [String(u._id), u.fullName]));
    send(res, items.map((s) => ({ ...s, openedByName: users.get(String(s.openedBy)) })), 200, meta);
  }));

  r.post("/", requirePermission("cash.manage"), ah(async (req, res) => {
    const b = z.object({ openingAmount: z.number().int().min(0).max(1_000_000_000) }).parse(req.body);
    const businessId = req.tenant!.businessId; const userId = req.auth!.userId;
    if (await openSessionFor(businessId, userId)) throw new AppError(409, "SESSION_ALREADY_OPEN", "Vous avez deja une caisse ouverte");
    const s = await CashSession.create({ businessId, openedBy: userId, openingAmount: b.openingAmount });
    // Garde-fou contre une double ouverture simultanee : on ne garde que la plus ancienne.
    const open = await CashSession.find({ businessId, openedBy: userId, status: "open" }).sort({ _id: 1 }).lean();
    if (open.length > 1 && String(open[0]!._id) !== String(s._id)) { await CashSession.deleteOne({ _id: s._id }); throw new AppError(409, "SESSION_ALREADY_OPEN", "Vous avez deja une caisse ouverte"); }
    if (open.length > 1 && String(open[0]!._id) === String(s._id)) await CashSession.deleteMany({ businessId, openedBy: userId, status: "open", _id: { $ne: s._id } });
    send(res, s.toObject(), 201);
  }));

  r.get("/:id", requirePermission("cash.manage"), ah(async (req, res) => {
    const businessId = req.tenant!.businessId; const id = oid.parse(idParam(req));
    const s = await CashSession.findOne({ _id: id, businessId }).lean();
    if (!s) throw notFound("Session de caisse introuvable");
    const entries = await CashEntry.find({ businessId, cashSessionId: id }).sort({ createdAt: 1 }).lean();
    send(res, { ...s, summary: await cashSummary(businessId, id, s.openingAmount), entries });
  }));

  r.post("/current/entries", requirePermission("cash.manage"), ah(async (req, res) => {
    const b = z.object({ type: z.enum(["in", "out"]), amount: z.number().int().min(1).max(1_000_000_000), reason: z.string().trim().min(3).max(300) }).parse(req.body);
    const businessId = req.tenant!.businessId; const userId = req.auth!.userId;
    const s = await openSessionFor(businessId, userId);
    if (!s) throw new AppError(409, "NO_OPEN_SESSION", "Ouvrez d'abord la caisse");
    if (b.type === "out") {
      const sum = await cashSummary(businessId, s._id, s.openingAmount);
      if (b.amount > sum.expected) throw new AppError(400, "INSUFFICIENT_CASH", "Le montant depasse le solde theorique de la caisse");
    }
    send(res, await CashEntry.create({ businessId, cashSessionId: s._id, type: b.type, source: "manual", amount: b.amount, reason: b.reason, userId }), 201);
  }));

  r.post("/current/close", requirePermission("cash.manage"), ah(async (req, res) => {
    const b = z.object({ countedAmount: z.number().int().min(0).max(1_000_000_000), note: z.string().trim().max(300).optional() }).parse(req.body);
    const businessId = req.tenant!.businessId; const userId = req.auth!.userId;
    const s = await openSessionFor(businessId, userId);
    if (!s) throw new AppError(409, "NO_OPEN_SESSION", "Aucune caisse ouverte");
    const sum = await cashSummary(businessId, s._id, s.openingAmount);
    const closed = await CashSession.findOneAndUpdate({ _id: s._id, status: "open" }, { status: "closed", closedAt: new Date(), closedBy: userId, expectedAmount: sum.expected, countedAmount: b.countedAmount, difference: b.countedAmount - sum.expected, note: b.note }, { returnDocument: "after" }).lean();
    if (!closed) throw new AppError(409, "SESSION_CLOSED", "Caisse deja cloturee");
    await audit(req, { businessId, userId, action: "cash.close", resourceType: "cash_session", resourceId: s._id, details: { expected: sum.expected, counted: b.countedAmount, difference: closed.difference } });
    send(res, { ...closed, summary: sum });
  }));

  // Correction d'une caisse CLOTUREE : permission dediee + motif + trace d'audit.
  r.post("/:id/corrections", requirePermission("cash.correct"), ah(async (req, res) => {
    const b = z.object({ countedAmount: z.number().int().min(0).max(1_000_000_000), reason: z.string().trim().min(5).max(300) }).parse(req.body);
    const businessId = req.tenant!.businessId; const userId = req.auth!.userId; const id = oid.parse(idParam(req));
    const s = await CashSession.findOne({ _id: id, businessId, status: "closed" }).lean();
    if (!s) throw notFound("Session cloturee introuvable");
    const u = await CashSession.findOneAndUpdate({ _id: id, businessId, status: "closed", countedAmount: s.countedAmount }, { countedAmount: b.countedAmount, difference: b.countedAmount - s.expectedAmount, $push: { corrections: { date: new Date(), userId, reason: b.reason, before: s.countedAmount, after: b.countedAmount } } }, { returnDocument: "after" }).lean();
    if (!u) throw new AppError(409, "SESSION_CHANGED", "Session modifiee entre-temps, reessayez");
    await audit(req, { businessId, userId, action: "cash.correction", resourceType: "cash_session", resourceId: id, details: { before: s.countedAmount, after: b.countedAmount, reason: b.reason } });
    send(res, u);
  }));

  return r;
}
