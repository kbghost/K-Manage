import type { Types } from "mongoose";
import {
  allocateProportional, computeSaleTotals, MoneyError, paymentStatus, refundLineValue, toMilli,
} from "@k-manage/shared";
import { AppError, forbidden, notFound } from "../../utils/errors.js";
import { runTx, type Tx } from "../../db/tx.js";
import { Product } from "../catalog/models.js";
import { Customer } from "../parties/models.js";
import { saleRemaining } from "../parties/service.js";
import { applyStock, getSettings, nextNumber } from "../stock/service.js";
import { openSessionFor } from "../cash/service.js";
import { Payment, Sale } from "./models.js";

export interface Actor { businessId: Types.ObjectId; userId: Types.ObjectId; canDiscount?: boolean }
export interface SaleInput {
  customerId?: string;
  lines: { productId: string; quantity: number; discount?: number }[];
  discount?: number;
  payments: { method: string; amount: number }[];
  note?: string;
}

const isDup = (e: unknown) => (e as { code?: number })?.code === 11000;

export const saleView = <T extends { total: number; refundedTotal: number; paidAmount: number; status: string }>(s: T) => {
  const remaining = saleRemaining(s);
  return { ...s, remaining, paymentStatus: s.status === "cancelled" ? "cancelled" : paymentStatus(s.total - s.refundedTotal, remaining) };
};

async function validMethods(businessId: Types.ObjectId) {
  const s = await getSettings(businessId);
  const set = new Set<string>(["cash", ...(s.settings?.paymentMethods ?? [])]);
  return { settings: s, set };
}
const wrapMoney = <T>(fn: () => T): T => { try { return fn(); } catch (e) { if (e instanceof MoneyError) throw new AppError(400, "INVALID_AMOUNT", e.message); throw e; } };

export interface PaymentArgs {
  businessId: Types.ObjectId; userId: Types.ObjectId; kind: "sale_payment" | "sale_refund" | "supplier_payment";
  direction: "in" | "out"; method: string; amount: number; key: string; note?: string;
  saleId?: unknown; customerId?: unknown; purchaseId?: unknown; supplierId?: unknown; settlementId?: string;
}
/** Enregistre un paiement ; les especes sont rattachees a la session de caisse OUVERTE de l'utilisateur. */
export async function recordPayment(tx: Tx, p: PaymentArgs) {
  const session = p.method === "cash" ? await openSessionFor(p.businessId, p.userId) : null;
  return tx.create(Payment, { ...p, idempotencyKey: p.key, cashSessionId: session?._id });
}

// ------------------------------------------------------------------ creation d'une vente
export async function createSale(a: Actor, input: SaleInput, key: string) {
  const replay = await Sale.findOne({ businessId: a.businessId, idempotencyKey: key }).lean();
  if (replay) return { sale: replay, replay: true };

  const { settings, set: methods } = await validMethods(a.businessId);
  const allowNeg = settings.settings?.allowNegativeStock ?? false;
  for (const p of input.payments) if (!methods.has(p.method)) throw new AppError(400, "INVALID_PAYMENT_METHOD", `Moyen de paiement non configure : ${p.method}`);

  const hasDiscount = (input.discount ?? 0) > 0 || input.lines.some((l) => (l.discount ?? 0) > 0);
  if (hasDiscount && !a.canDiscount) throw forbidden("Vous n'avez pas le droit d'accorder une remise");

  const ids = [...new Set(input.lines.map((l) => l.productId))];
  const products = new Map((await Product.find({ _id: { $in: ids }, businessId: a.businessId, status: "active" }).lean()).map((p) => [String(p._id), p]));
  for (const id of ids) if (!products.has(id)) throw new AppError(400, "PRODUCT_NOT_FOUND", "Un produit du panier est introuvable ou archive");

  // Les prix viennent TOUJOURS de la base : les totaux du navigateur ne sont jamais utilises.
  const totals = wrapMoney(() => computeSaleTotals(
    input.lines.map((l) => ({ quantity: l.quantity, unitPrice: products.get(l.productId)!.salePrice, discount: l.discount })), input.discount ?? 0));
  const alloc = allocateProportional(totals.globalDiscount, totals.lines.map((l) => l.total));

  const paid = input.payments.reduce((s, p) => s + p.amount, 0);
  if (paid > totals.total) throw new AppError(400, "OVERPAYMENT", "Le montant paye depasse le total de la vente");
  if (paid < totals.total && !input.customerId) throw new AppError(400, "CUSTOMER_REQUIRED_FOR_CREDIT", "Choisissez un client pour une vente a credit ou un paiement partiel");
  if (!input.customerId && settings.settings?.allowAnonymousSales === false) throw new AppError(400, "CUSTOMER_REQUIRED", "Les ventes anonymes sont desactivees : choisissez un client");
  let customer: { _id: unknown; name: string } | null = null;
  if (input.customerId) {
    customer = await Customer.findOne({ _id: input.customerId, businessId: a.businessId, status: "active" }).select("name").lean();
    if (!customer) throw new AppError(400, "CUSTOMER_NOT_FOUND", "Client introuvable");
  }

  const number = await nextNumber(a.businessId, "sale", "V");
  const session = await openSessionFor(a.businessId, a.userId);
  const lines = totals.lines.map((l, i) => {
    const src = input.lines[i]!; const p = products.get(src.productId)!;
    return {
      productId: p._id, name: p.name, sku: p.sku, unit: p.unit, quantityMilli: l.quantityMilli, unitPrice: p.salePrice, unitCost: p.costPrice,
      discount: l.discount, total: l.total, netTotal: l.total - (alloc[i] ?? 0), refundedQtyMilli: 0, refundedValue: 0,
    };
  });

  try {
    const sale = await runTx(async (tx) => {
      const s = await tx.create(Sale, {
        businessId: a.businessId, number, idempotencyKey: key, customerId: customer?._id, customerName: customer?.name, lines,
        subtotal: totals.subtotal, discount: totals.globalDiscount, total: totals.total, paidAmount: paid, refundedTotal: 0,
        userId: a.userId, cashSessionId: session?._id, note: input.note,
      });
      for (const l of lines) {
        await applyStock(tx, { businessId: a.businessId, productId: l.productId, deltaMilli: -l.quantityMilli, allowNegative: allowNeg, type: "sale", userId: a.userId, refKind: "sale", refId: s._id, unitCost: l.unitCost, reason: number });
      }
      let i = 0;
      for (const p of input.payments) {
        await recordPayment(tx, { businessId: a.businessId, userId: a.userId, kind: "sale_payment", direction: "in", method: p.method, amount: p.amount, saleId: s._id, customerId: customer?._id, key: `${key}:p${i++}` });
      }
      return s;
    });
    return { sale: (await Sale.findById(sale._id).lean())!, replay: false, discounted: hasDiscount };
  } catch (e) {
    if (isDup(e)) {
      const again = await Sale.findOne({ businessId: a.businessId, idempotencyKey: key }).lean();
      if (again) return { sale: again, replay: true };
    }
    throw e;
  }
}

// ------------------------------------------------------------------ remboursement / annulation
export interface RefundInput { lines?: { lineIndex: number; quantity: number }[]; restock: boolean; method?: string; reason: string }

export async function refundSale(a: Actor, saleId: string, input: RefundInput, mode: "refund" | "cancel") {
  const sale = await Sale.findOne({ _id: saleId, businessId: a.businessId }).lean();
  if (!sale) throw notFound("Vente introuvable");
  if (sale.status !== "completed") throw new AppError(409, "SALE_CANCELLED", "Cette vente est deja annulee");

  const req = mode === "cancel"
    ? sale.lines.map((l, i) => ({ lineIndex: i, qMilli: l.quantityMilli - l.refundedQtyMilli })).filter((x) => x.qMilli > 0)
    : (input.lines ?? []).map((l) => ({ lineIndex: l.lineIndex, qMilli: wrapMoney(() => toMilli(l.quantity)) }));
  if (req.length === 0) throw new AppError(409, "NOTHING_TO_REFUND", "Tout a deja ete rembourse");
  if (new Set(req.map((r) => r.lineIndex)).size !== req.length) throw new AppError(400, "DUPLICATE_LINE", "Une ligne apparait plusieurs fois");

  const { set: methods } = await validMethods(a.businessId);
  const method = input.method ?? "cash";
  if (!methods.has(method)) throw new AppError(400, "INVALID_PAYMENT_METHOD", "Moyen de remboursement non configure");

  const detail = req.map((r) => {
    const line = sale.lines[r.lineIndex];
    if (!line) throw new AppError(400, "LINE_NOT_FOUND", "Ligne de vente introuvable");
    const value = wrapMoney(() => refundLineValue(line.netTotal, line.quantityMilli, line.refundedQtyMilli, line.refundedValue, r.qMilli));
    return { ...r, value, line };
  });
  const valueTotal = detail.reduce((s, d) => s + d.value, 0);
  const newRefunded = sale.refundedTotal + valueTotal;
  const cashRefund = Math.max(0, sale.paidAmount - (sale.total - newRefunded));

  const $inc: Record<string, number> = { refundedTotal: valueTotal, paidAmount: -cashRefund };
  const inverseInc: Record<string, number> = { refundedTotal: -valueTotal, paidAmount: cashRefund };
  for (const d of detail) {
    $inc[`lines.${d.lineIndex}.refundedQtyMilli`] = d.qMilli; inverseInc[`lines.${d.lineIndex}.refundedQtyMilli`] = -d.qMilli;
    $inc[`lines.${d.lineIndex}.refundedValue`] = d.value; inverseInc[`lines.${d.lineIndex}.refundedValue`] = -d.value;
  }
  const entry = { date: new Date(), userId: a.userId, reason: input.reason, value: valueTotal, cashRefund, restocked: input.restock, lines: detail.map((d) => ({ lineIndex: d.lineIndex, quantityMilli: d.qMilli, value: d.value })) };

  await runTx(async (tx) => {
    const updated = await tx.update(
      Sale,
      { _id: sale._id, businessId: a.businessId, status: "completed", refundedTotal: sale.refundedTotal, paidAmount: sale.paidAmount },
      { $inc, $push: { refunds: entry }, ...(mode === "cancel" ? { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: input.reason } } : {}) },
      { $inc: inverseInc, $pop: { refunds: 1 }, ...(mode === "cancel" ? { $set: { status: "completed" }, $unset: { cancelledAt: 1, cancelReason: 1 } } : {}) },
    );
    if (!updated) throw new AppError(409, "SALE_CHANGED", "La vente a ete modifiee entre-temps, reessayez.");
    if (input.restock) {
      for (const d of detail) {
        await applyStock(tx, { businessId: a.businessId, productId: d.line.productId, deltaMilli: d.qMilli, allowNegative: true, type: "refund", userId: a.userId, refKind: "sale", refId: sale._id, unitCost: d.line.unitCost, reason: `${mode === "cancel" ? "Annulation" : "Remboursement"} ${sale.number}` });
      }
    }
    if (cashRefund > 0) {
      await recordPayment(tx, { businessId: a.businessId, userId: a.userId, kind: "sale_refund", direction: "out", method, amount: cashRefund, saleId: sale._id, customerId: sale.customerId, key: crypto.randomUUID(), note: input.reason });
    }
  });
  return { sale: (await Sale.findById(sale._id).lean())!, valueTotal, cashRefund };
}

// ------------------------------------------------------------------ paiement d'une vente
export async function paySale(a: Actor, saleId: string, input: { amount: number; method: string; note?: string }, key: string) {
  const dup = await Payment.findOne({ businessId: a.businessId, idempotencyKey: key }).lean();
  if (dup) return { payment: dup, sale: (await Sale.findById(saleId).lean())!, replay: true };
  const { set: methods } = await validMethods(a.businessId);
  if (!methods.has(input.method)) throw new AppError(400, "INVALID_PAYMENT_METHOD", "Moyen de paiement non configure");
  const sale = await Sale.findOne({ _id: saleId, businessId: a.businessId }).lean();
  if (!sale) throw notFound("Vente introuvable");
  if (sale.status !== "completed") throw new AppError(409, "SALE_CANCELLED", "Vente annulee");
  const remaining = saleRemaining(sale);
  if (remaining <= 0) throw new AppError(409, "ALREADY_PAID", "Cette vente est deja soldee");
  if (input.amount > remaining) throw new AppError(400, "OVERPAYMENT", `Le paiement depasse le reste a payer (${remaining} FCFA)`);
  try {
    const payment = await runTx(async (tx) => {
      const u = await tx.update(Sale, { _id: sale._id, businessId: a.businessId, status: "completed", paidAmount: sale.paidAmount, refundedTotal: sale.refundedTotal }, { $inc: { paidAmount: input.amount } }, { $inc: { paidAmount: -input.amount } });
      if (!u) throw new AppError(409, "SALE_CHANGED", "La vente a ete modifiee entre-temps, reessayez.");
      return recordPayment(tx, { businessId: a.businessId, userId: a.userId, kind: "sale_payment", direction: "in", method: input.method, amount: input.amount, saleId: sale._id, customerId: sale.customerId, key, note: input.note });
    });
    return { payment, sale: (await Sale.findById(sale._id).lean())!, replay: false };
  } catch (e) {
    if (isDup(e)) { const again = await Payment.findOne({ businessId: a.businessId, idempotencyKey: key }).lean(); if (again) return { payment: again, sale, replay: true }; }
    throw e;
  }
}

// ------------------------------------------------------------------ reglement de dette client (FIFO)
export async function settleCustomer(a: Actor, customerId: string, input: { amount: number; method: string; note?: string }, key: string) {
  const prior = await Payment.find({ businessId: a.businessId, settlementId: key }).lean();
  if (prior.length) return { payments: prior, remaining: 0, replay: true };
  const { set: methods } = await validMethods(a.businessId);
  if (!methods.has(input.method)) throw new AppError(400, "INVALID_PAYMENT_METHOD", "Moyen de paiement non configure");
  const customer = await Customer.findOne({ _id: customerId, businessId: a.businessId }).lean();
  if (!customer) throw notFound("Client introuvable");
  const open = (await Sale.find({ businessId: a.businessId, customerId, status: "completed" }).sort({ createdAt: 1, _id: 1 }).lean()).filter((s) => saleRemaining(s) > 0);
  const due = open.reduce((s, x) => s + saleRemaining(x), 0);
  if (due === 0) throw new AppError(409, "NO_DEBT", "Ce client n'a aucune dette");
  if (input.amount > due) throw new AppError(400, "OVERPAYMENT", `Le montant depasse la dette du client (${due} FCFA)`);

  let left = input.amount; const allocs: { sale: (typeof open)[number]; amount: number }[] = [];
  for (const s of open) { if (left <= 0) break; const take = Math.min(left, saleRemaining(s)); allocs.push({ sale: s, amount: take }); left -= take; }
  try {
    const payments = await runTx(async (tx) => {
      const out = [];
      for (const al of allocs) {
        const u = await tx.update(Sale, { _id: al.sale._id, businessId: a.businessId, status: "completed", paidAmount: al.sale.paidAmount, refundedTotal: al.sale.refundedTotal }, { $inc: { paidAmount: al.amount } }, { $inc: { paidAmount: -al.amount } });
        if (!u) throw new AppError(409, "SALE_CHANGED", "Une vente a ete modifiee entre-temps, reessayez.");
        out.push(await recordPayment(tx, { businessId: a.businessId, userId: a.userId, kind: "sale_payment", direction: "in", method: input.method, amount: al.amount, saleId: al.sale._id, customerId: al.sale.customerId, settlementId: key, key: `${key}:${al.sale._id}`, note: input.note }));
      }
      return out;
    });
    return { payments, remaining: due - input.amount, replay: false };
  } catch (e) {
    if (isDup(e)) { const again = await Payment.find({ businessId: a.businessId, settlementId: key }).lean(); if (again.length) return { payments: again, remaining: 0, replay: true }; }
    throw e;
  }
}

/** Controle de coherence : le champ paidAmount doit egaler les paiements enregistres. */
export async function reconcileSale(businessId: Types.ObjectId, saleId: string) {
  const [sale, pays] = await Promise.all([Sale.findOne({ _id: saleId, businessId }).lean(), Payment.find({ businessId, saleId }).lean()]);
  if (!sale) throw notFound("Vente introuvable");
  const ledger = pays.reduce((s, p) => s + (p.direction === "in" ? p.amount : -p.amount), 0);
  return { stored: sale.paidAmount, ledger, consistent: ledger === sale.paidAmount };
}
