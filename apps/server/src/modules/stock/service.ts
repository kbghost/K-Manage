import type { Types } from "mongoose";
import { Business } from "../businesses/models.js";
import { Product } from "../catalog/models.js";
import { Counter, StockMovement, type MOVEMENT_TYPES } from "./models.js";
import type { Tx } from "../../db/tx.js";
import { AppError, notFound } from "../../utils/errors.js";

export async function getSettings(businessId: Types.ObjectId) {
  const b = await Business.findById(businessId).select("settings receipt timezone name address phone email currency").lean();
  if (!b) throw notFound("Commerce introuvable");
  return b;
}

/** Numerotation par commerce (V-000001...). Hors transaction : un echec peut laisser un trou, jamais un doublon. */
export async function nextNumber(businessId: Types.ObjectId, key: string, prefix: string): Promise<string> {
  for (let i = 0; i < 3; i++) {
    try {
      const c = await Counter.findOneAndUpdate({ businessId, key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
      return `${prefix}-${String(c!.seq).padStart(6, "0")}`;
    } catch (e) {
      if ((e as { code?: number }).code !== 11000 || i === 2) throw e;
    }
  }
  throw new Error("numerotation impossible");
}

export interface StockOp {
  businessId: Types.ObjectId;
  productId: Types.ObjectId | string;
  deltaMilli: number;
  allowNegative: boolean;
  type: (typeof MOVEMENT_TYPES)[number];
  userId: Types.ObjectId;
  reason?: string;
  refKind?: string;
  refId?: Types.ObjectId;
  unitCost?: number;
  /** Garde optimiste : n'applique que si le stock courant vaut exactement cette valeur (inventaire). */
  expectedStockMilli?: number;
}

/**
 * Modification de stock ATOMIQUE et TRACEE : mise a jour conditionnelle (jamais lire-puis-ecrire)
 * + mouvement de stock obligatoire.
 */
export async function applyStock(tx: Tx, op: StockOp) {
  const filter: Record<string, unknown> = { _id: op.productId, businessId: op.businessId };
  if (op.expectedStockMilli !== undefined) filter.stockMilli = op.expectedStockMilli;
  else if (op.deltaMilli < 0 && !op.allowNegative) filter.stockMilli = { $gte: -op.deltaMilli };
  const updated = await tx.update(Product, filter, { $inc: { stockMilli: op.deltaMilli } }, { $inc: { stockMilli: -op.deltaMilli } });
  if (!updated) {
    const p = await Product.findOne({ _id: op.productId, businessId: op.businessId }).select("name").lean();
    if (!p) throw notFound("Produit introuvable");
    if (op.expectedStockMilli !== undefined) throw new AppError(409, "STOCK_CHANGED", "Le stock a change entre-temps, reessayez.");
    throw new AppError(409, "INSUFFICIENT_STOCK", `Stock insuffisant pour « ${p.name} »`);
  }
  await tx.create(StockMovement, {
    businessId: op.businessId, productId: updated._id, quantityMilli: op.deltaMilli,
    stockAfterMilli: updated.stockMilli, type: op.type, reason: op.reason, unitCost: op.unitCost ?? updated.costPrice ?? 0,
    refKind: op.refKind, refId: op.refId, userId: op.userId,
  });
  return updated;
}

/** Alertes de stock : stock <= seuil (>0) = faible ; stock <= 0 = epuise. Source unique pour dashboard, rapports et notifications. */
export async function stockAlerts(businessId: Types.ObjectId) {
  const products = await Product.find({ businessId, status: "active" }).select("name sku unit stockMilli alertMilli").lean();
  const out = products.filter((p) => p.stockMilli <= 0);
  const low = products.filter((p) => p.stockMilli > 0 && p.alertMilli > 0 && p.stockMilli <= p.alertMilli);
  return { low, out };
}
