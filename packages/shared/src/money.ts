/**
 * Strategie monetaire : tous les montants sont des ENTIERS en plus petite unite de la devise.
 * Pour le XOF (franc CFA), il n'y a pas de sous-unite : 1 = 1 FCFA.
 * Aucun calcul monetaire n'utilise de decimales flottantes ; les quantites sont gerees en milliemes.
 */
export type Money = number;

export class MoneyError extends Error {}

export function assertMoney(value: unknown, label = "montant"): asserts value is Money {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} doit etre un entier (XOF sans decimales)`);
  }
}

/** Arrondi "moitie vers le haut" pour des entiers : round(num / den). */
export function divRoundHalfUp(num: number, den: number): number {
  if (den <= 0) throw new MoneyError("diviseur invalide");
  const sign = num < 0 ? -1 : 1;
  const abs = Math.abs(num);
  return sign * Math.floor((2 * abs + den) / (2 * den));
}

/** Quantite decimale (max 3 decimales) -> milliemes entiers. */
export function toMilli(quantity: number): number {
  const milli = Math.round(quantity * 1000);
  if (Math.abs(milli / 1000 - quantity) > 1e-9) {
    throw new MoneyError("la quantite admet au plus 3 decimales");
  }
  return milli;
}

/** quantite (milliemes) x prix unitaire, arrondi a l'unite. */
export function multiplyQty(quantityMilli: number, unitPrice: Money): Money {
  assertMoney(unitPrice, "prix unitaire");
  return divRoundHalfUp(quantityMilli * unitPrice, 1000);
}

export function formatXOF(amount: Money, locale = "fr-FR"): string {
  assertMoney(amount);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)} FCFA`;
}

/** round(a * b / c) en demi-superieur, sans depassement (BigInt). Valeurs positives. */
export function mulDivRound(a: number, b: number, c: number): number {
  if (c <= 0 || a < 0 || b < 0) throw new MoneyError("mulDiv: arguments invalides");
  const A = BigInt(a), B = BigInt(b), C = BigInt(c);
  return Number((2n * A * B + C) / (2n * C));
}
