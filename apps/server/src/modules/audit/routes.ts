import { Router } from "express";
import { z } from "zod";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requirePermission, requireTenant } from "../../middleware/auth.js";
import { dateRange, oid, pageQuery, paginate } from "../../utils/pagination.js";
import { send } from "../../utils/http.js";
import { periodBounds } from "../../utils/time.js";
import { getSettings } from "../stock/service.js";
import { User } from "../auth/models.js";
import { AuditLog } from "./models.js";

export function auditRouter() {
  const r = Router();
  r.use(requireAuth, requireTenant);
  r.get("/", requirePermission("audit.read"), ah(async (req, res) => {
    const f = pageQuery.merge(dateRange).extend({ action: z.string().max(60).optional(), userId: oid.optional() }).parse(req.query);
    const businessId = req.tenant!.businessId; const filter: Record<string, unknown> = { businessId };
    if (f.action) filter.action = f.action; if (f.userId) filter.userId = f.userId;
    if (f.from || f.to) { const b = periodBounds(f.from, f.to ?? f.from, (await getSettings(businessId)).timezone ?? "Africa/Porto-Novo"); filter.createdAt = { $gte: b.from, $lt: b.to }; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { items, meta } = await paginate(AuditLog as any, filter, { page: f.page, limit: f.limit, sort: { createdAt: -1, _id: -1 } });
    const users = new Map((await User.find({ _id: { $in: items.map((i) => i.userId).filter(Boolean) } }).select("fullName").lean()).map((u) => [String(u._id), u.fullName]));
    send(res, items.map((i) => ({ ...i, userName: i.userId ? users.get(String(i.userId)) : undefined })), 200, meta);
  }));
  return r;
}
