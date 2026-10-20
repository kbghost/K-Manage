import { Schema, model } from "mongoose";
import { biz } from "../../db/schema-helpers.js";

const party = {
  businessId: biz,
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, maxlength: 30 },
  email: { type: String, trim: true, maxlength: 200 },
  address: { type: String, trim: true, maxlength: 300 },
  notes: { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: ["active", "archived"], default: "active" },
};
const customerSchema = new Schema(party, { timestamps: true });
customerSchema.index({ businessId: 1, name: 1 });
export const Customer = model("Customer", customerSchema);

const supplierSchema = new Schema(party, { timestamps: true });
supplierSchema.index({ businessId: 1, name: 1 });
export const Supplier = model("Supplier", supplierSchema);
