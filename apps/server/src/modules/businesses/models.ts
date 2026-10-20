import { Schema, model } from "mongoose";
import { ROLES } from "@k-manage/shared";

const businessSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 300 },
    phone: { type: String, trim: true, maxlength: 30 },
    currency: { type: String, default: "XOF", enum: ["XOF"] },
    timezone: { type: String, default: "Africa/Porto-Novo" },
    settings: {
      allowNegativeStock: { type: Boolean, default: false },
      allowAnonymousSales: { type: Boolean, default: true },
      lowStockDefault: { type: Number, default: 5, min: 0 },
      paymentMethods: { type: [String], default: ["cash", "transfer", "mobile_money"] },
      creditDueDays: { type: Number, default: 30, min: 1 },
    },
    receipt: {
      header: { type: String, maxlength: 300, default: "" },
      footer: { type: String, maxlength: 300, default: "Merci de votre visite !" },
      paperWidth: { type: String, enum: ["80mm", "58mm", "a4"], default: "80mm" },
      showTaxId: { type: String, maxlength: 60, default: "" },
    },
    logoUploadId: { type: Schema.Types.ObjectId },
    email: { type: String, trim: true, maxlength: 200 },
    isDemo: { type: Boolean, default: false },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
export const Business = model("Business", businessSchema);

const membershipSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
  },
  { timestamps: true },
);
membershipSchema.index({ businessId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1, status: 1 });
export const Membership = model("Membership", membershipSchema);
