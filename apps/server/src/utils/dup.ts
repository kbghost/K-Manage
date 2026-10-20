import { AppError } from "./errors.js";

/** Convertit une erreur d'index unique MongoDB en erreur metier lisible. */
export function mapDuplicate(e: unknown, messages: Record<string, [string, string]>): never {
  const err = e as { code?: number; message?: string; keyPattern?: Record<string, number> };
  if (err?.code === 11000) {
    const hay = JSON.stringify(err.keyPattern ?? {}) + (err.message ?? "");
    for (const [field, [code, msg]] of Object.entries(messages)) if (hay.includes(field)) throw new AppError(409, code, msg);
    throw new AppError(409, "DUPLICATE", "Cet enregistrement existe deja");
  }
  throw e;
}
