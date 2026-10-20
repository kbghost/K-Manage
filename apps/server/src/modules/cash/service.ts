import type { Types } from "mongoose";
import { CashEntry, CashSession } from "./models.js";
import { Payment } from "../sales/models.js";

export async function openSessionFor(businessId: Types.ObjectId, userId: Types.ObjectId) {
  return CashSession.findOne({ businessId, openedBy: userId, status: "open" }).lean();
}

/** Solde de caisse theorique = ouverture + encaissements especes - decaissements especes + entrees manuelles - sorties (manuelles/depenses). */
export async function cashSummary(businessId: Types.ObjectId, sessionId: Types.ObjectId | string, openingAmount: number) {
  const [payments, entries] = await Promise.all([
    Payment.find({ businessId, cashSessionId: sessionId, method: "cash" }).select("direction amount kind").lean(),
    CashEntry.find({ businessId, cashSessionId: sessionId }).select("type amount source").lean(),
  ]);
  const paymentsIn = payments.filter((p) => p.direction === "in").reduce((s, p) => s + p.amount, 0);
  const paymentsOut = payments.filter((p) => p.direction === "out").reduce((s, p) => s + p.amount, 0);
  const manualIn = entries.filter((e) => e.type === "in").reduce((s, e) => s + e.amount, 0);
  const manualOut = entries.filter((e) => e.type === "out" && e.source === "manual").reduce((s, e) => s + e.amount, 0);
  const expensesOut = entries.filter((e) => e.type === "out" && e.source === "expense").reduce((s, e) => s + e.amount, 0);
  const expected = openingAmount + paymentsIn - paymentsOut + manualIn - manualOut - expensesOut;
  return { openingAmount, paymentsIn, paymentsOut, manualIn, manualOut, expensesOut, expected };
}
