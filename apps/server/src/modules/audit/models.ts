import { Schema, model } from "mongoose";

const auditSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business" }, // absent pour les evenements de securite globaux
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, maxlength: 60 },
    resourceType: { type: String, maxlength: 40 },
    resourceId: { type: String, maxlength: 40 },
    details: Schema.Types.Mixed,
    ip: { type: String, maxlength: 60 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditSchema.index({ businessId: 1, createdAt: -1 });
auditSchema.index({ businessId: 1, resourceType: 1, resourceId: 1 });
export const AuditLog = model("AuditLog", auditSchema);
