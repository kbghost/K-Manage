import { Router, type RequestHandler } from "express";
import { ah } from "../../utils/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { forbidden } from "../../utils/errors.js";
import { send } from "../../utils/http.js";
import { User } from "../auth/models.js";
import { Business, Membership } from "../businesses/models.js";

const requirePlatformAdmin: RequestHandler = (req, _res, next) => (req.auth?.isPlatformAdmin ? next() : next(forbidden("Reserve aux administrateurs de la plateforme")));

/**
 * Administration de plateforme : volumes et etat des comptes UNIQUEMENT.
 * Aucune donnee commerciale privee (ventes, clients, stocks...) n'est exposee ici.
 */
export function adminRouter() {
  const r = Router();
  r.use(requireAuth, requirePlatformAdmin);
  r.get("/stats", ah(async (_req, res) => {
    const [users, businesses, memberships] = await Promise.all([User.countDocuments(), Business.countDocuments(), Membership.countDocuments()]);
    send(res, { users, businesses, memberships });
  }));
  r.get("/businesses", ah(async (_req, res) => {
    const list = await Business.find().select("name createdAt ownerId currency").sort({ createdAt: -1 }).limit(200).lean();
    const owners = new Map((await User.find({ _id: { $in: list.map((b) => b.ownerId) } }).select("email").lean()).map((u) => [String(u._id), u.email]));
    send(res, list.map((b) => ({ ...b, ownerEmail: owners.get(String(b.ownerId)) })));
  }));
  return r;
}
