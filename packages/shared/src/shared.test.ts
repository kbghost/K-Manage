import { describe, expect, it } from "vitest";
import {
  allocateProportional, refundLineValue,
  amountRemaining, cashBalance, computeSaleTotals, divRoundHalfUp, grossMargin,
  MoneyError, paymentStatus, roleHasPermission, toMilli, formatXOF,
} from "./index.js";

describe("arrondis et quantites", () => {
  it("arrondit la moitie vers le haut", () => {
    expect(divRoundHalfUp(5, 2)).toBe(3);
    expect(divRoundHalfUp(4, 3)).toBe(1);
    expect(divRoundHalfUp(1, 3)).toBe(0);
  });
  it("convertit en milliemes sans erreur flottante", () => {
    expect(toMilli(0.1 + 0.2)).toBe(300);
    expect(() => toMilli(1.2345)).toThrow(MoneyError);
  });
});

describe("totaux de vente", () => {
  it("ligne = quantite x prix - remise ; vente = somme - remise globale", () => {
    const t = computeSaleTotals(
      [{ quantity: 3, unitPrice: 1500, discount: 500 }, { quantity: 1.5, unitPrice: 1000 }],
      200,
    );
    expect(t.lines.map((l) => l.total)).toEqual([4000, 1500]);
    expect(t.subtotal).toBe(5500);
    expect(t.total).toBe(5300);
  });
  it("refuse les montants incoherents", () => {
    expect(() => computeSaleTotals([])).toThrow();
    expect(() => computeSaleTotals([{ quantity: 1, unitPrice: 100, discount: 200 }])).toThrow();
    expect(() => computeSaleTotals([{ quantity: 1, unitPrice: 100.5 }])).toThrow();
    expect(() => computeSaleTotals([{ quantity: 1, unitPrice: 100 }], 101)).toThrow();
  });
});

describe("paiements, marge, caisse", () => {
  it("calcule le reste a payer et le statut", () => {
    expect(amountRemaining(10000, [4000, 1000])).toBe(5000);
    expect(paymentStatus(10000, 10000)).toBe("unpaid");
    expect(paymentStatus(10000, 5000)).toBe("partial");
    expect(paymentStatus(10000, 0)).toBe("paid");
  });
  it("marge brute et solde de caisse", () => {
    expect(grossMargin(10000, 7000)).toBe(3000);
    expect(cashBalance(5000, 20000, 3500)).toBe(21500);
  });
  it("formate le XOF", () => {
    expect(formatXOF(1500000)).toMatch(/FCFA$/);
  });
});

describe("permissions", () => {
  it("applique la matrice des roles", () => {
    expect(roleHasPermission("owner", "members.manage")).toBe(true);
    expect(roleHasPermission("manager", "members.manage")).toBe(false);
    expect(roleHasPermission("cashier", "sales.create")).toBe(true);
    expect(roleHasPermission("cashier", "stock.adjust")).toBe(false);
    expect(roleHasPermission("storekeeper", "sales.create")).toBe(false);
  });
});

describe("repartition et remboursements", () => {
  it("la repartition proportionnelle est exacte", () => {
    const a = allocateProportional(100, [1, 1, 1]);
    expect(a.reduce((x, y) => x + y, 0)).toBe(100);
    expect(allocateProportional(0, [5, 5])).toEqual([0, 0]);
    expect(allocateProportional(7, [3000, 1000]).reduce((x, y) => x + y, 0)).toBe(7);
  });
  it("le dernier remboursement solde exactement la ligne", () => {
    const first = refundLineValue(1000, 3000, 0, 0, 1000); // 1/3 de 1000 = 333
    expect(first).toBe(333);
    const second = refundLineValue(1000, 3000, 1000, first, 1000);
    const third = refundLineValue(1000, 3000, 2000, first + second, 1000);
    expect(first + second + third).toBe(1000);
    expect(() => refundLineValue(1000, 3000, 3000, 1000, 1)).toThrow();
  });
  it("manager peut corriger la caisse, caissier non", () => {
    expect(roleHasPermission("manager", "cash.correct")).toBe(true);
    expect(roleHasPermission("cashier", "cash.correct")).toBe(false);
  });
});
