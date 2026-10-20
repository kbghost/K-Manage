import { Router } from "express";
import { z } from "zod";
import { ROLES, ROLE_PERMISSIONS } from "@k-manage/shared";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requirePermission, requireTenant } from "../../middleware/auth.js";
import { AppError, notFound } from "../../utils/errors.js";
import { oid } from "../../utils/pagination.js";
import { idParam, send } from "../../utils/http.js";
import { audit } from "../audit/service.js";
import { User } from "../auth/models.js";
import { Membership } from "../businesses/models.js";

const assignable = ["manager", "cashier", "storekeeper"] as const;

export function membersRouter() {
  const r = Router();
  r.use(requireAuth, requireTenant);

  r.get("/roles", ah(async (_req, res) => send(res, ROLES.map((role) => ({ role, permissions: ROLE_PERMISSIONS[role] })))));

  r.get("/", requirePermission("members.manage"), ah(async (req, res) => {
    const ms = await Membership.find({ businessId: req.tenant!.businessId }).sort({ createdAt: 1 }).lean();
    const users = new Map((await User.find({ _id: { $in: ms.map((m) => m.userId) } }).select("fullName email phone").lean()).map((u) => [String(u._id), u]));
    send(res, ms.map((m) => ({ ...m, user: users.get(String(m.userId)) })));
  }));

  // Invitation : le compte doit deja exister (inscription libre). Pas d'email envoye.
  r.post("/", requirePermission("members.manage"), ah(async (req, res) => {
    const b = z.object({ email: z.string().email(), role: z.enum(assignable) }).parse(req.body);
    const businessId = req.tenant!.businessId;
    const user = await User.findOne({ email: b.email.toLowerCase(), isActive: true }).select("fullName email").lean();
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "Aucun compte avec cet email : demandez a la personne de creer son compte d'abord.");
    if (await Membership.exists({ businessId, userId: user._id })) throw new AppError(409, "ALREADY_MEMBER", "Cette personne a deja acces a ce commerce");
    const m = await Membership.create({ businessId, userId: user._id, role: b.role });
    await audit(req, { businessId, userId: req.auth!.userId, action: "member.added", resourceType: "member", resourceId: m._id, details: { email: user.email, role: b.role } });
    send(res, { ...m.toObject(), user }, 201);
  }));

  r.patch("/:id", requirePermission("members.manage"), ah(async (req, res) => {
    const b = z.object({ role: z.enum(assignable).optional(), status: z.enum(["active", "disabled"]).optional() }).refine((x) => x.role || x.status, "Rien a modifier").parse(req.body);
    const businessId = req.tenant!.businessId; const id = oid.parse(idParam(req));
    const m = await Membership.findOne({ _id: id, businessId }).lean();
    if (!m) throw notFound("Membre introuvable");
    if (m.role === "owner") throw new AppError(403, "OWNER_PROTECTED", "Le proprietaire ne peut pas etre modifie");
    if (String(m.userId) === String(req.auth!.userId)) throw new AppError(403, "SELF_CHANGE", "Vous ne pouvez pas modifier votre propre acces");
    const u = await Membership.findOneAndUpdate({ _id: id, businessId }, b, { returnDocument: "after" }).lean();
    await audit(req, { businessId, userId: req.auth!.userId, action: "member.updated", resourceType: "member", resourceId: id, details: { from: { role: m.role, status: m.status }, to: b } });
    send(res, u);
  }));

  r.delete("/:id", requirePermission("members.manage"), ah(async (req, res) => {
    const businessId = req.tenant!.businessId; const id = oid.parse(idParam(req));
    const m = await Membership.findOne({ _id: id, businessId }).lean();
    if (!m) throw notFound("Membre introuvable");
    if (m.role === "owner") throw new AppError(403, "OWNER_PROTECTED", "Le proprietaire ne peut pas etre revoque");
    if (String(m.userId) === String(req.auth!.userId)) throw new AppError(403, "SELF_CHANGE", "Vous ne pouvez pas vous revoquer vous-meme");
    await Membership.deleteOne({ _id: id, businessId });
    await audit(req, { businessId, userId: req.auth!.userId, action: "member.revoked", resourceType: "member", resourceId: id, details: { role: m.role } });
    res.status(204).end();
  }));

  return r;
}
