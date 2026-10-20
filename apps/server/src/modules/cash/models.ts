import { Schema, model } from "mongoose";
import { biz, money, ref, signedInt } from "../../db/schema-helpers.js";

const sessionSchema = new Schema(
  {
    businessId: biz,
    openedBy: ref("User", true),
    openedAt: { type: Date, default: Date.now },
    openingAmount: money(),
    status: { type: String, enum: ["open", "closed"], default: "open" },
    closedAt: Date,
    closedBy: ref("User"),
    expectedAmount: signedInt(),
    countedAmount: signedInt(),
    difference: signedInt(),
    note: { type: String, maxlength: 300 },
    corrections: [{ date: Date, userId: Schema.Types.ObjectId, reason: String, before: Number, after: Number, _id: false }],
  },
  { timestamps: true },
);
sessionSchema.index({ businessId: 1, status: 1, openedBy: 1 });
sessionSchema.index({ businessId: 1, openedAt: -1 });
export const CashSession = model("CashSession", sessionSchema);

const entrySchema = new Schema(
  {
    businessId: biz,
    cashSessionId: ref("CashSession", true),
    type: { type: String, enum: ["in", "out"], required: true },
    source: { type: String, enum: ["manual", "expense"], default: "manual" },
    amount: money({ min: 1 }),
    reason: { type: String, required: true, maxlength: 300 },
    userId: ref("User", true),
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
entrySchema.index({ businessId: 1, cashSessionId: 1 });
export const CashEntry = model("CashEntry", entrySchema);
