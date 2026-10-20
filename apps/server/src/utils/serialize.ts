import { Types } from "mongoose";

/** _id -> id, ObjectId -> string, retire __v. Fonctionne sur documents lean ou objets simples. */
export function serialize<T = unknown>(value: unknown): T {
  const walk = (v: unknown): unknown => {
    if (v === null || v === undefined) return v;
    if (v instanceof Types.ObjectId) return v.toString();
    if (v instanceof Date) return v;
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (k === "__v" || k === "passwordHash" || k === "tokenHash" || k === "idempotencyKey") continue;
        out[k === "_id" ? "id" : k] = walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(typeof value === "object" && value && "toObject" in value ? (value as { toObject(): unknown }).toObject() : value) as T;
}
