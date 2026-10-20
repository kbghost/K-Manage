import { Schema } from "mongoose";

const isInt = (v: number) => Number.isSafeInteger(v);
/** Montant monetaire : entier (XOF), jamais de flottant. */
export const money = (extra: Record<string, unknown> = {}) => ({
  type: Number, required: true, default: 0, min: 0,
  validate: { validator: isInt, message: "montant entier requis" }, ...extra,
});
export const signedInt = (extra: Record<string, unknown> = {}) => ({
  type: Number, required: true, default: 0,
  validate: { validator: isInt, message: "entier requis" }, ...extra,
});
export const biz = { type: Schema.Types.ObjectId, ref: "Business", required: true };
export const ref = (name: string, required = false) => ({ type: Schema.Types.ObjectId, ref: name, required });
