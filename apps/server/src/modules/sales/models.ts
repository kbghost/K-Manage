import { Schema, model } from "mongoose";
import { biz, money, ref, signedInt } from "../../db/schema-helpers.js";

const lineSchema = new Schema({
  productId: ref("Product", true),
  name: { type: String, required: true },
  sku: { type: String, required: true },
  unit: { type: String },
  quantityMilli: signedInt({ min: 1 }),
  unitPrice: money(),
  unitCost: money(),
  discount: money(),
  total: money(),
  netTotal: money(), // total apres repartition de la remise globale
  refundedQtyMilli: signedInt({ min: 0 }),
  refundedValue: money(),
});

const refundEntry = new Schema({
  date: { type: Date, default: Date.now },
  userId: ref("User", true),
  reason: { type: String, maxlength: 300 },
  value: money(),
  cashRefund: money(),
  restocked: { type: Boolean, default: false },
  lines: [{ lineIndex: Number, quantityMilli: Number, value: Number, _id: false }],
}, { _id: false });

const saleSchema = new Schema(
  {
    businessId: biz,
    number: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    customerId: ref("Customer"),
    customerName: { type: String },
    lines: { type: [lineSchema], validate: (v: unknown[]) => v.length > 0 },
    subtotal: money(),
    discount: money(),
    total: money(),
    paidAmount: money(), // encaisse net des remboursements en especes
    refundedTotal: money(), // valeur des marchandises retournees
    status: { type: String, enum: ["completed", "cancelled"], default: "completed" },
    userId: ref("User", true),
    cashSessionId: ref("CashSession"),
    note: { type: String, maxlength: 300 },
    refunds: [refundEntry],
    cancelledAt: Date,
    cancelReason: String,
  },
  { timestamps: true },
);
saleSchema.index({ businessId: 1, number: 1 }, { unique: true });
saleSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true });
saleSchema.index({ businessId: 1, createdAt: -1 });
saleSchema.index({ businessId: 1, customerId: 1, status: 1, createdAt: 1 });
export const Sale = model("Sale", saleSchema);

export const PAYMENT_KINDS = ["sale_payment", "sale_refund", "supplier_payment"] as const;
const paymentSchema = new Schema(
  {
    businessId: biz,
    kind: { type: String, enum: PAYMENT_KINDS, required: true },
    direction: { type: String, enum: ["in", "out"], required: true },
    method: { type: String, required: true, maxlength: 30 },
    amount: money({ min: 1 }),
    saleId: ref("Sale"),
    customerId: ref("Customer"),
    purchaseId: ref("Purchase"),
    supplierId: ref("Supplier"),
    settlementId: { type: String },
    cashSessionId: ref("CashSession"),
    userId: ref("User", true),
    note: { type: String, maxlength: 300 },
    idempotencyKey: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
paymentSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true });
paymentSchema.index({ businessId: 1, createdAt: -1 });
paymentSchema.index({ businessId: 1, saleId: 1 });
paymentSchema.index({ businessId: 1, cashSessionId: 1 });
export const Payment = model("Payment", paymentSchema);
