import { Schema, model } from "mongoose";
import { biz, money, ref, signedInt } from "../../db/schema-helpers.js";

const lineSchema = new Schema({
  productId: ref("Product", true),
  name: String, sku: String,
  quantityMilli: signedInt({ min: 1 }),
  receivedMilli: signedInt({ min: 0 }),
  unitCost: money(),
  total: money(),
});
const purchaseSchema = new Schema(
  {
    businessId: biz,
    number: { type: String, required: true },
    supplierId: ref("Supplier", true),
    supplierName: String,
    lines: { type: [lineSchema], validate: (v: unknown[]) => v.length > 0 },
    total: money(),
    paidAmount: money(),
    status: { type: String, enum: ["ordered", "partial", "received", "cancelled"], default: "ordered" },
    note: { type: String, maxlength: 300 },
    userId: ref("User", true),
    receptions: [{ date: Date, userId: Schema.Types.ObjectId, lines: [{ lineIndex: Number, quantityMilli: Number, _id: false }], _id: false }],
  },
  { timestamps: true },
);
purchaseSchema.index({ businessId: 1, number: 1 }, { unique: true });
purchaseSchema.index({ businessId: 1, supplierId: 1, createdAt: -1 });
export const Purchase = model("Purchase", purchaseSchema);
