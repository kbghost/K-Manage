import nodemailer from "nodemailer";
import type { Env } from "../config/env.js";

/** Envoi reel uniquement si SMTP_URL est configure ; sinon aucun email n'est envoye (et on ne pretend jamais le contraire). */
export async function sendMail(env: Env, to: string, subject: string, text: string): Promise<boolean> {
  if (!env.SMTP_URL) return false;
  const t = nodemailer.createTransport(env.SMTP_URL);
  await t.sendMail({ from: env.MAIL_FROM, to, subject, text });
  return true;
}
