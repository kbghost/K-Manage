import { Schema, model } from "mongoose";
import { biz, money, ref, signedInt } from "../../db/schema-helpers.js";

const categorySchema = new Schema(
  { businessId: biz, name: { type: String, required: true, trim: true, maxlength: 80 } },
  { timestamps: true },
);
categorySchema.index({ businessId: 1, name: 1 }, { unique: true });
export const Category = model("Category", categorySchema);

const productSchema = new Schema(
  {
    businessId: biz,
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000 },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
    barcode: { type: String, trim: true, maxlength: 64 },
    categoryId: ref("Category"),
    costPrice: money(),
    salePrice: money(),
    unit: { type: String, default: "piece", trim: true, maxlength: 20 },
    stockMilli: signedInt(), // stock en milliemes d'unite (pas de derive flottante)
    alertMilli: signedInt({ min: 0 }),
    imageUploadId: ref("Upload"),
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true },
);
productSchema.index({ businessId: 1, sku: 1 }, { unique: true });
productSchema.index({ businessId: 1, status: 1, name: 1 });
export const Product = model("Product", productSchema);

/**
 * Un code-barres absent ne doit pas entrer en collision : index unique PARTIEL (chaines uniquement).
 * Cree au demarrage sur MongoDB reel ; l'API verifie aussi l'unicite avant ecriture (messages clairs).
 */
export async function ensureProductIndexes() {
  await Product.collection.createIndex({ businessId: 1, barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: "string" } }, name: "uniq_barcode_per_business" });
}
