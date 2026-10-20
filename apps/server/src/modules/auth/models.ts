import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    isPlatformAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const User = model("User", userSchema);

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    csrfToken: { type: String, required: true },
    userAgent: { type: String, maxlength: 300 },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);
export const Session = model("Session", sessionSchema);

const resetSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date },
});
export const PasswordReset = model("PasswordReset", resetSchema);

/** Index TTL (purge automatique des sessions/jetons expires). Cree au demarrage du serveur (pas dans les tests sur bases partielles). */
export async function ensureTtlIndexes() {
  await Session.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await PasswordReset.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
