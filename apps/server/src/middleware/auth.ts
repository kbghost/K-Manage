import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { roleHasPermission, type Permission, type Role } from "@k-manage/shared";
import { findActiveSession } from "../modules/auth/service.js";
import { User } from "../modules/auth/models.js";
import { Membership } from "../modules/businesses/models.js";
import { subscriptionForBusiness, subscriptionView } from "../modules/billing/service.js";
import { forbidden, unauthorized, AppError } from "../utils/errors.js";

export const SESSION_COOKIE = "km_session";
export const CSRF_COOKIE = "km_csrf";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: Types.ObjectId; sessionId: Types.ObjectId; isPlatformAdmin: boolean; csrfToken: string };
      tenant?: { businessId: Types.ObjectId; role: Role };
    }
  }
}

/** Authentifie la session (cookie HttpOnly) et applique la protection CSRF (double soumission) sur les ecritures. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) throw unauthorized();
    const session = await findActiveSession(token);
    if (!session) throw unauthorized("Session expiree, reconnectez-vous");

    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const header = req.get("x-csrf-token");
      if (!header || header !== session.csrfToken) {
        throw new AppError(403, "CSRF_INVALID", "Jeton de securite invalide, rechargez la page");
      }
    }
    const user = await User.findOne({ _id: session.userId, isActive: true }).select("isPlatformAdmin");
    if (!user) throw unauthorized();
    req.auth = { userId: user._id, sessionId: session._id, isPlatformAdmin: user.isPlatformAdmin, csrfToken: session.csrfToken };
    next();
  } catch (e) {
    next(e);
  }
};

/**
 * Resout le commerce COURANT cote serveur : l'en-tete x-business-id n'est qu'une demande,
 * validee contre une adhesion active. Le role vient de la base, jamais du client.
 * Un administrateur de plateforme n'obtient AUCUN acces automatique.
 */
export const requireTenant: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.auth) throw unauthorized();
    const raw = req.get("x-business-id");
    if (!raw || !Types.ObjectId.isValid(raw)) throw new AppError(400, "BUSINESS_REQUIRED", "Commerce actif manquant");
    const membership = await Membership.findOne({
      businessId: raw,
      userId: req.auth.userId,
      status: "active",
    });
    // 404 plutot que 403 : ne revele pas l'existence d'un commerce etranger.
    if (!membership) throw new AppError(404, "NOT_FOUND", "Commerce introuvable");
    req.tenant = { businessId: membership.businessId, role: membership.role as Role };
    if (!(req.baseUrl === "/api/v1/businesses" && req.path === "/current")) {
      const subscription = await subscriptionForBusiness(membership.businessId);
      if (!subscriptionView(subscription).access) {
        throw new AppError(402, "SUBSCRIPTION_REQUIRED", "La période d'essai est terminée. Activez votre abonnement pour continuer.");
      }
    }
    next();
  } catch (e) {
    next(e);
  }
};

export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!req.tenant) return next(unauthorized());
    if (!roleHasPermission(req.tenant.role, permission)) return next(forbidden("Permission insuffisante"));
    next();
  };
