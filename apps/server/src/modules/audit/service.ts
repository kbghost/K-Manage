import type { Request } from "express";
import type { Types } from "mongoose";
import { AuditLog } from "./models.js";

/** Journalise une action sensible. N'echoue jamais : un probleme d'audit ne doit pas casser l'operation. */
export async function audit(
  req: Pick<Request, "ip"> | undefined,
  a: { businessId?: Types.ObjectId; userId?: Types.ObjectId; action: string; resourceType?: string; resourceId?: unknown; details?: Record<string, unknown> },
) {
  try {
    await AuditLog.create({
      businessId: a.businessId, userId: a.userId, action: a.action, resourceType: a.resourceType,
      resourceId: a.resourceId ? String(a.resourceId) : undefined, details: a.details, ip: req?.ip,
    });
  } catch (e) {
    console.error("audit:", e instanceof Error ? e.message : "erreur");
  }
}
