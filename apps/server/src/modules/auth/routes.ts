import { Router, type CookieOptions } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { Types } from "mongoose";
import type { Env } from "../../config/env.js";
import { ah } from "../../utils/async-handler.js";
import { CSRF_COOKIE, requireAuth, SESSION_COOKIE } from "../../middleware/auth.js";
import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { changePassword, createSession, registerUser, verifyCredentials } from "./service.js";
import { sendMail } from "../../utils/mailer.js";
import { audit } from "../audit/service.js";
import { PasswordReset, Session, User } from "./models.js";
import { AppError, notFound } from "../../utils/errors.js";

const password = z.string().min(10, "10 caracteres minimum").max(200);
const registerSchema = z.object({
  email: z.string().email("Email invalide").max(200),
  password,
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional(),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });
const changePwdSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });
const profileSchema = z.object({ fullName: z.string().trim().min(2).max(120).optional(), phone: z.string().trim().max(30).optional() });

export function authRouter(env: Env) {
  const r = Router();
  const secure = env.NODE_ENV === "production";
  const base: CookieOptions = { sameSite: "lax", secure, path: "/", maxAge: env.SESSION_TTL_HOURS * 3600_000, ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}) };
  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: env.NODE_ENV === "test" ? 1000 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Trop de tentatives, reessayez plus tard" } },
  });

  const startSession = async (userId: Types.ObjectId, ua: string | undefined, res: import("express").Response) => {
    const { token, csrfToken } = await createSession(userId, env.SESSION_TTL_HOURS, ua);
    res.cookie(SESSION_COOKIE, token, { ...base, httpOnly: true });
    res.cookie(CSRF_COOKIE, csrfToken, { ...base, httpOnly: false }); // lisible par le front pour l'en-tete x-csrf-token
    return csrfToken;
  };

  r.post("/register", limiter, ah(async (req, res) => {
    const user = await registerUser(registerSchema.parse(req.body));
    const csrfToken = await startSession(user._id, req.get("user-agent"), res);
    res.status(201).json({ data: { id: user.id, email: user.email, fullName: user.fullName, csrfToken } });
  }));

  r.post("/login", limiter, ah(async (req, res) => {
    const { email, password: pwd } = loginSchema.parse(req.body);
    const user = await verifyCredentials(email, pwd);
    const csrfToken = await startSession(user._id, req.get("user-agent"), res);
    res.json({ data: { id: user.id, email: user.email, fullName: user.fullName, csrfToken } });
  }));

  // Reponse identique que le compte existe ou non (pas d'enumeration de comptes).
  r.post("/forgot-password", limiter, ah(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
    const out: { message: string; devResetToken?: string; emailSent?: boolean } = { message: "Si un compte existe, des instructions ont ete preparees." };
    if (user) {
      const token = randomBytes(32).toString("base64url");
      await PasswordReset.create({ userId: user._id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) });
      const link = `${env.CLIENT_ORIGIN}/reset-password?token=${token}`;
      const sent = await sendMail(env, user.email, "Reinitialisation de votre mot de passe K-Manage", `Ouvrez ce lien dans l'heure (usage unique) :\n${link}`).catch(() => false);
      if (!sent && env.NODE_ENV !== "production" && env.DEV_EXPOSE_RESET_TOKEN) out.devResetToken = token; // mode dev explicite uniquement
      await audit(req, { userId: user._id, action: "auth.password_reset_requested" });
    }
    res.json({ data: out });
  }));

  r.post("/reset-password", limiter, ah(async (req, res) => {
    const { token, password: pwd } = z.object({ token: z.string().min(20).max(200), password }).parse(req.body);
    const hash = createHash("sha256").update(token).digest("hex");
    const pr = await PasswordReset.findOneAndUpdate({ tokenHash: hash, usedAt: null, expiresAt: { $gt: new Date() } }, { usedAt: new Date() });
    if (!pr) throw new AppError(400, "INVALID_RESET_TOKEN", "Lien invalide ou expire. Refaites une demande.");
    await User.updateOne({ _id: pr.userId }, { passwordHash: await argon2.hash(pwd, { type: argon2.argon2id }) });
    await Session.updateMany({ userId: pr.userId, revokedAt: null }, { revokedAt: new Date() });
    await audit(req, { userId: pr.userId, action: "auth.password_reset_done" });
    res.status(204).end();
  }));

  r.post("/logout", requireAuth, ah(async (req, res) => {
    await Session.updateOne({ _id: req.auth!.sessionId }, { revokedAt: new Date() });
    const o = { path: "/", ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}) };
    res.clearCookie(SESSION_COOKIE, o).clearCookie(CSRF_COOKIE, o).status(204).end();
  }));

  r.get("/me", requireAuth, ah(async (req, res) => {
    const user = await User.findById(req.auth!.userId);
    if (!user) throw notFound();
    res.json({ data: { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, isPlatformAdmin: user.isPlatformAdmin, csrfToken: req.auth!.csrfToken } });
  }));

  r.patch("/me", requireAuth, ah(async (req, res) => {
    const patch = profileSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(req.auth!.userId, patch, { returnDocument: "after" });
    res.json({ data: { id: user!.id, email: user!.email, fullName: user!.fullName, phone: user!.phone } });
  }));

  r.post("/change-password", requireAuth, limiter, ah(async (req, res) => {
    const { currentPassword, newPassword } = changePwdSchema.parse(req.body);
    await changePassword(req.auth!.userId, currentPassword, newPassword, req.auth!.sessionId);
    res.status(204).end();
  }));

  r.get("/sessions", requireAuth, ah(async (req, res) => {
    const list = await Session.find({ userId: req.auth!.userId, revokedAt: null, expiresAt: { $gt: new Date() } })
      .select("userAgent createdAt expiresAt").sort({ createdAt: -1 });
    res.json({ data: list.map((s) => ({ id: s.id, userAgent: s.userAgent, createdAt: s.createdAt, current: s._id.equals(req.auth!.sessionId) })) });
  }));

  r.delete("/sessions/:id", requireAuth, ah(async (req, res) => {
    // Filtre par userId : on ne peut revoquer que ses propres sessions.
    const result = await Session.updateOne({ _id: req.params.id, userId: req.auth!.userId, revokedAt: null }, { revokedAt: new Date() });
    if (result.matchedCount === 0) throw notFound("Session introuvable");
    res.status(204).end();
  }));

  return r;
}
