import { Schema, model } from "mongoose";
import { biz, ref } from "../../db/schema-helpers.js";

const uploadSchema = new Schema(
  {
    businessId: biz,
    userId: ref("User", true),
    filename: { type: String, required: true }, // nom aleatoire cote serveur, jamais fourni par le client
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    cloudinaryUrl: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
export const Upload = model("Upload", uploadSchema);
