import { Schema, model } from "mongoose";
import { biz, money, ref } from "../../db/schema-helpers.js";

const expenseSchema = new Schema(
  {
    businessId: biz,
    category: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    amount: money({ min: 1 }),
    date: { type: Date, required: true },
    method: { type: String, maxlength: 30 },
    status: { type: String, enum: ["paid", "payable"], required: true },
    paidAt: Date,
    userId: ref("User", true),
    attachmentUploadId: ref("Upload"),
    cashEntryId: ref("CashEntry"),
    history: [{ date: Date, userId: Schema.Types.ObjectId, changes: Schema.Types.Mixed, _id: false }],
  },
  { timestamps: true },
);
expenseSchema.index({ businessId: 1, date: -1 });
expenseSchema.index({ businessId: 1, category: 1 });
export const Expense = model("Expense", expenseSchema);
