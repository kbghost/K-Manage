import { Router } from "express";
import { z } from "zod";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requirePermission, requireTenant } from "../../middleware/auth.js";
import { ROLE_PERMISSIONS } from "@k-manage/shared";
import { Business, Membership } from "./models.js";
import { audit } from "../audit/service.js";
import { serialize } from "../../utils/serialize.js";
import { ensureSubscription } from "../billing/service.js";
import { Subscription } from "../billing/models.js";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(30).optional(),
  timezone: z.string().trim().max(60).default("Africa/Porto-Novo"),
});
const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.union([z.string().email().max(200), z.literal("")]).optional(),
  timezone: z.string().trim().max(60).refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Fuseau horaire invalide").optional(),
  logoUploadId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  receipt: z.object({
    header: z.string().max(300).optional(), footer: z.string().max(300).optional(),
    paperWidth: z.enum(["80mm", "58mm", "a4"]).optional(), showTaxId: z.string().max(60).optional(),
  }).optional(),
  settings: z.object({
    allowNegativeStock: z.boolean().optional(),
    allowAnonymousSales: z.boolean().optional(),
    lowStockDefault: z.number().int().min(0).max(100000).optional(),
    creditDueDays: z.number().int().min(1).max(365).optional(),
    paymentMethods: z.array(z.string().trim().min(1).max(30).regex(/^[a-z0-9_]+$/, "minuscules, chiffres et _")).min(1).max(10).optional(),
  }).optional(),
});

export function businessesRouter() {
  const r = Router();

  r.post("/", requireAuth, ah(async (req, res) => {
    const input = createSchema.parse(req.body);
    const business = await Business.create({ ...input, ownerId: req.auth!.userId });
    try {
      await Membership.create({ businessId: business._id, userId: req.auth!.userId, role: "owner" });
      await ensureSubscription(business._id, business.createdAt);
    } catch (e) {
      await Subscription.deleteOne({ businessId: business._id });
      await Membership.deleteOne({ businessId: business._id, userId: req.auth!.userId });
      await Business.deleteOne({ _id: business._id }); // pas de commerce orphelin
      throw e;
    }
    res.status(201).json({ data: { id: business.id, name: business.name, role: "owner" } });
  }));

  // Uniquement les commerces dont l'utilisateur est membre actif.
  r.get("/", requireAuth, ah(async (req, res) => {
    const memberships = await Membership.find({ userId: req.auth!.userId, status: "active" });
    const businesses = await Business.find({ _id: { $in: memberships.map((m) => m.businessId) } });
    const roleOf = new Map(memberships.map((m) => [m.businessId.toString(), m.role]));
    res.json({ data: businesses.map((b) => ({ id: b.id, name: b.name, currency: b.currency, role: roleOf.get(b.id) })) });
  }));

  r.get("/current", requireAuth, requireTenant, ah(async (req, res) => {
    const b = await Business.findById(req.tenant!.businessId);
    res.json({ data: { ...serialize<object>(b!.toObject()), role: req.tenant!.role, permissions: ROLE_PERMISSIONS[req.tenant!.role] } });
  }));

  r.patch("/current", requireAuth, requireTenant, requirePermission("settings.update"), ah(async (req, res) => {
    const { settings, receipt, ...rest } = settingsSchema.parse(req.body);
    const $set: Record<string, unknown> = { ...rest };
    for (const [k, v] of Object.entries(settings ?? {})) if (v !== undefined) $set[`settings.${k}`] = k === "paymentMethods" ? [...new Set(["cash", ...(v as string[])])] : v;
    for (const [k, v] of Object.entries(receipt ?? {})) if (v !== undefined) $set[`receipt.${k}`] = v;
    const b = await Business.findByIdAndUpdate(req.tenant!.businessId, { $set }, { returnDocument: "after" });
    await audit(req, { businessId: req.tenant!.businessId, userId: req.auth!.userId, action: "settings.updated", resourceType: "business", resourceId: req.tenant!.businessId, details: { fields: Object.keys($set) } });
    res.json({ data: serialize(b!.toObject()) });
  }));

  return r;
}
