import { describe, expect, it } from "vitest";
import { addToCart, previewTotals } from "../src/lib/cart";
import { csvToRows, parseCsv } from "../src/lib/csv";
import { addDaysStr, methodLabel, money, parseMoney } from "../src/lib/format";

describe("format", () => {
  it("formate le FCFA sans decimales", () => { expect(money(1500000)).toMatch(/^1[\s\u202f\u00a0]500[\s\u202f\u00a0]000[\s\u202f\u00a0]FCFA$/); expect(money(null)).toBe("—"); });
  it("analyse une saisie monetaire", () => { expect(parseMoney("1 500")).toBe(1500); expect(parseMoney("abc")).toBe(0); expect(parseMoney("99999999999")).toBe(1_000_000_000); });
  it("libelles de paiement et dates", () => { expect(methodLabel("mobile_money")).toBe("Mobile Money"); expect(methodLabel("autre_moyen")).toBe("autre moyen"); expect(addDaysStr("2026-03-01", -1)).toBe("2026-02-28"); });
});
describe("panier", () => {
  const p = { id: "1", name: "Riz", sku: "R", unit: "piece", salePrice: 1000, stock: 5 };
  it("incremente la quantite d'un produit deja present", () => { const c = addToCart(addToCart([], p), p); expect(c).toHaveLength(1); expect(c[0]!.quantity).toBe(2); });
  it("calcule les totaux avec remises", () => {
    const c = [{ productId: "1", name: "Riz", sku: "R", unit: "piece", unitPrice: 1500, stock: 9, quantity: 3, discount: 500 }];
    expect(previewTotals(c, 200)).toMatchObject({ ok: true, subtotal: 4000, total: 3800 });
  });
  it("signale un panier invalide au lieu de planter", () => {
    const c = [{ productId: "1", name: "Riz", sku: "R", unit: "piece", unitPrice: 100, stock: 9, quantity: 1, discount: 500 }];
    expect(previewTotals(c, 0).ok).toBe(false);
  });
});
describe("csv", () => {
  it("gere les separateurs ; et les guillemets", () => { expect(parseCsv('nom;sku\n"Riz; 5kg";R5\n')).toEqual([["nom", "sku"], ["Riz; 5kg", "R5"]]); });
  it("reconnait les en-tetes francais", () => {
    const rows = csvToRows("Nom,SKU,Prix achat,Prix vente,Catégorie\nRiz,R5,3200,3800,Alimentation");
    expect(rows[0]).toMatchObject({ name: "Riz", sku: "R5", costPrice: "3200", salePrice: "3800", category: "Alimentation" });
  });
});
