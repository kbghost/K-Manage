import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { Types } from "mongoose";
import { Session, User } from "./models.js";
import { conflict, unauthorized } from "../../utils/errors.js";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const HASH_OPTS = { type: argon2.argon2id } as const;

export async function registerUser(input: { email: string; password: string; fullName: string; phone?: string }) {
  const exists = await User.exists({ email: input.email.toLowerCase() });
  if (exists) throw conflict("EMAIL_TAKEN", "Un compte existe deja avec cet email");
  const passwordHash = await argon2.hash(input.password, HASH_OPTS);
  return User.create({ email: input.email, passwordHash, fullName: input.fullName, phone: input.phone });
}

export async function verifyCredentials(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select("+passwordHash");
  // Meme message dans tous les cas : ne revele pas si l'email existe.
  if (!user || !(await argon2.verify(user.passwordHash, password))) {
    throw unauthorized("Email ou mot de passe incorrect");
  }
  return user;
}

export async function createSession(userId: Types.ObjectId, ttlHours: number, userAgent?: string) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  await Session.create({
    userId,
    tokenHash: sha256(token),
    csrfToken,
    userAgent: userAgent?.slice(0, 300),
    expiresAt: new Date(Date.now() + ttlHours * 3600_000),
  });
  return { token, csrfToken };
}

export async function findActiveSession(token: string) {
  return Session.findOne({ tokenHash: sha256(token), revokedAt: null, expiresAt: { $gt: new Date() } });
}

export async function changePassword(userId: Types.ObjectId, current: string, next: string, keepSessionId: Types.ObjectId) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || !(await argon2.verify(user.passwordHash, current))) throw unauthorized("Mot de passe actuel incorrect");
  user.passwordHash = await argon2.hash(next, HASH_OPTS);
  await user.save();
  await Session.updateMany({ userId, _id: { $ne: keepSessionId }, revokedAt: null }, { revokedAt: new Date() });
}
