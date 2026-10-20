import { Schema, model } from "mongoose";
import { biz, money, ref, signedInt } from "../../db/schema-helpers.js";

export const MOVEMENT_TYPES = ["initial", "entry", "exit", "adjustment", "sale", "refund", "purchase_receipt", "import"] as const;

const movementSchema = new Schema(
  {
    businessId: biz,
    productId: ref("Product", true),
    quantityMilli: signedInt(),
    stockAfterMilli: signedInt(),
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    reason: { type: String, trim: true, maxlength: 300 },
    unitCost: money(), // cout unitaire au moment du mouvement (historique)
    refKind: { type: String, maxlength: 30 },
    refId: { type: Schema.Types.ObjectId },
    userId: ref("User", true),
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
movementSchema.index({ businessId: 1, productId: 1, createdAt: -1 });
movementSchema.index({ businessId: 1, createdAt: -1 });
export const StockMovement = model("StockMovement", movementSchema);

const counterSchema = new Schema({ businessId: biz, key: { type: String, required: true }, seq: { type: Number, default: 0 } });
counterSchema.index({ businessId: 1, key: 1 }, { unique: true });
export const Counter = model("Counter", counterSchema);
