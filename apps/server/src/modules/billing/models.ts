import { Schema, model } from "mongoose";

const subscriptionSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, unique: true },
    trialStartedAt: { type: Date, required: true },
    trialEndsAt: { type: Date, required: true },
    currentPeriodEndsAt: { type: Date },
  },
  { timestamps: true },
);
export const Subscription = model("Subscription", subscriptionSchema);

const paymentSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: true },
    reference: { type: String, required: true, unique: true },
    providerTransactionId: { type: String, unique: true, sparse: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, enum: ["XOF"] },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    paidAt: { type: Date },
  },
  { timestamps: true },
);
export const BillingPayment = model("BillingPayment", paymentSchema);
