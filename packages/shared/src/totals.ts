import { assertMoney, MoneyError, mulDivRound, multiplyQty, toMilli, type Money } from "./money.js";

export interface LineInput {
  quantity: number; // decimal, max 3 decimales
  unitPrice: Money;
  discount?: Money; // remise de ligne (montant)
}

export interface SaleTotals {
  lines: { quantityMilli: number; gross: Money; discount: Money; total: Money }[];
  subtotal: Money;
  globalDiscount: Money;
  total: Money;
}

/** Ligne = quantite x prix - remise ; vente = somme des lignes - remise globale. Jamais negatif. */
export function computeSaleTotals(lines: LineInput[], globalDiscount: Money = 0): SaleTotals {
  if (lines.length === 0) throw new MoneyError("une vente doit contenir au moins une ligne");
  assertMoney(globalDiscount, "remise globale");
  if (globalDiscount < 0) throw new MoneyError("remise globale negative");

  const computed = lines.map((l, i) => {
    const discount = l.discount ?? 0;
    assertMoney(discount, `remise ligne ${i + 1}`);
    if (l.quantity <= 0) throw new MoneyError(`quantite invalide ligne ${i + 1}`);
    if (l.unitPrice < 0 || discount < 0) throw new MoneyError(`montant negatif ligne ${i + 1}`);
    const quantityMilli = toMilli(l.quantity);
    const gross = multiplyQty(quantityMilli, l.unitPrice);
    if (discount > gross) throw new MoneyError(`remise superieure au montant ligne ${i + 1}`);
    return { quantityMilli, gross, discount, total: gross - discount };
  });

  const subtotal = computed.reduce((s, l) => s + l.total, 0);
  if (globalDiscount > subtotal) throw new MoneyError("remise globale superieure au sous-total");
  return { lines: computed, subtotal, globalDiscount, total: subtotal - globalDiscount };
}

export function amountRemaining(total: Money, paymentsApplied: Money[], adjustments: Money = 0): Money {
  const paid = paymentsApplied.reduce((s, p) => s + p, 0);
  return total - paid + adjustments;
}

export type PaymentStatus = "unpaid" | "partial" | "paid";
export function paymentStatus(total: Money, remaining: Money): PaymentStatus {
  if (remaining <= 0) return "paid";
  return remaining >= total ? "unpaid" : "partial";
}

/** Marge brute estimee = ventes nettes - cout des marchandises vendues (pas un benefice comptable). */
export function grossMargin(netSales: Money, cogs: Money): Money {
  return netSales - cogs;
}

/** Solde de caisse theorique = solde initial + entrees - sorties. */
export function cashBalance(opening: Money, cashIn: Money, cashOut: Money): Money {
  return opening + cashIn - cashOut;
}

/** Repartit `total` proportionnellement a `weights` (methode du plus fort reste) : la somme est exacte. */
export function allocateProportional(total: Money, weights: number[]): Money[] {
  assertMoney(total, "total a repartir");
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total === 0 || sum === 0) return weights.map(() => 0);
  const T = BigInt(total), S = BigInt(sum);
  const base = weights.map((w) => Number((T * BigInt(w)) / S));
  const rema = weights.map((w, i) => ({ i, r: Number((T * BigInt(w)) % S) }));
  let left = total - base.reduce((a, b) => a + b, 0);
  rema.sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of rema) {
    if (left <= 0) break;
    base[i] = (base[i] ?? 0) + 1;
    left--;
  }
  return base;
}

/**
 * Valeur remboursee pour `refundQtyMilli` d'une ligne dont le net (remise globale incluse) est `netTotal`.
 * Le dernier remboursement d'une ligne solde exactement le reste (aucune derive d'arrondi).
 */
export function refundLineValue(
  netTotal: Money, qtyMilli: number, refundedQtyMilli: number, refundedValue: Money, refundQtyMilli: number,
): Money {
  const remaining = qtyMilli - refundedQtyMilli;
  if (refundQtyMilli <= 0 || refundQtyMilli > remaining) throw new MoneyError("quantite a rembourser invalide");
  if (refundQtyMilli === remaining) return netTotal - refundedValue;
  return mulDivRound(netTotal, refundQtyMilli, qtyMilli);
}
