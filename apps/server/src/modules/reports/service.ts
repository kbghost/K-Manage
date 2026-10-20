/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Types } from "mongoose";
import { multiplyQty } from "@k-manage/shared";
import { groupKey, periodBounds } from "../../utils/time.js";
import { Sale, Payment } from "../sales/models.js";
import { Expense } from "../expenses/models.js";
import { CashEntry } from "../cash/models.js";
import { Product } from "../catalog/models.js";
import { User } from "../auth/models.js";
import { Customer, Supplier } from "../parties/models.js";
import { customerBalances, supplierBalances } from "../parties/service.js";
import { stockAlerts } from "../stock/service.js";

export interface Period { businessId: Types.ObjectId; tz: string; from?: string; to?: string }
export interface Table { title: string; columns: { key: string; label: string; align?: "left" | "right" }[]; rows: Record<string, any>[]; totals?: Record<string, number> }

const bounds = (p: Period) => periodBounds(p.from, p.to, p.tz);
const activeSales = async (p: Period) => {
  const b = bounds(p);
  return Sale.find({ businessId: p.businessId, status: "completed", createdAt: { $gte: b.from, $lt: b.to } }).lean();
};
const cogsOf = (s: any) => s.lines.reduce((t: number, l: any) => t + multiplyQty(l.quantityMilli - l.refundedQtyMilli, l.unitCost), 0);

/**
 * SOURCE UNIQUE des chiffres (tableau de bord ET rapports).
 * Ventes actives = ventes non annulees ; ventes nettes = total - marchandises remboursees ;
 * marge brute estimee = ventes nettes - cout des marchandises vendues (hors remboursements) — pas un benefice comptable.
 */
export async function summary(p: Period, financial: boolean) {
  const b = bounds(p);
  const [sales, pays, expenses] = await Promise.all([
    activeSales(p),
    Payment.find({ businessId: p.businessId, kind: { $in: ["sale_payment", "sale_refund"] }, createdAt: { $gte: b.from, $lt: b.to } }).select("direction amount").lean(),
    financial ? Expense.find({ businessId: p.businessId, date: { $gte: b.from, $lt: b.to } }).select("amount status").lean() : Promise.resolve([]),
  ]);
  const grossSales = sales.reduce((s, x) => s + x.total, 0);
  const refunds = sales.reduce((s, x) => s + x.refundedTotal, 0);
  const netSales = grossSales - refunds;
  const cogs = sales.reduce((s, x) => s + cogsOf(x), 0);
  const collected = pays.reduce((s, x) => s + (x.direction === "in" ? x.amount : -x.amount), 0);
  const [recv, pay, alerts] = await Promise.all([customerBalances(p.businessId), supplierBalances(p.businessId), stockAlerts(p.businessId)]);
  return {
    period: { from: b.fromStr, to: b.toStr },
    salesCount: sales.length, grossSales, refunds, netSales, collected,
    discounts: sales.reduce((s, x) => s + x.discount + x.lines.reduce((t, l) => t + l.discount, 0), 0),
    cogs: financial ? cogs : null,
    grossMargin: financial ? netSales - cogs : null,
    expenses: financial ? expenses.reduce((s, e) => s + e.amount, 0) : null,
    expensesPayable: financial ? expenses.filter((e) => e.status === "payable").reduce((s, e) => s + e.amount, 0) : null,
    receivables: [...recv.values()].reduce((s, x) => s + x.balance, 0),
    payables: [...pay.values()].reduce((s, x) => s + x, 0),
    lowStockCount: alerts.low.length, outOfStockCount: alerts.out.length,
  };
}

export async function salesSeries(p: Period, group: "day" | "week" | "month" = "day"): Promise<Table> {
  const map = new Map<string, { period: string; count: number; gross: number; refunds: number; net: number }>();
  for (const s of await activeSales(p)) {
    const k = groupKey(s.createdAt, p.tz, group); const c = map.get(k) ?? { period: k, count: 0, gross: 0, refunds: 0, net: 0 };
    c.count++; c.gross += s.total; c.refunds += s.refundedTotal; c.net += s.total - s.refundedTotal; map.set(k, c);
  }
  const rows = [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
  return { title: "Ventes par periode", columns: [{ key: "period", label: "Periode" }, { key: "count", label: "Ventes", align: "right" }, { key: "gross", label: "Brut", align: "right" }, { key: "refunds", label: "Rembourse", align: "right" }, { key: "net", label: "Net", align: "right" }], rows,
    totals: { count: rows.reduce((s, r) => s + r.count, 0), net: rows.reduce((s, r) => s + r.net, 0) } };
}

export async function topProducts(p: Period, limit = 10): Promise<Table> {
  const map = new Map<string, { productId: string; name: string; sku: string; quantity: number; revenue: number }>();
  for (const s of await activeSales(p)) for (const l of s.lines) {
    const k = String(l.productId); const c = map.get(k) ?? { productId: k, name: l.name, sku: l.sku, quantity: 0, revenue: 0 };
    c.quantity += (l.quantityMilli - l.refundedQtyMilli) / 1000; c.revenue += l.netTotal - l.refundedValue; map.set(k, c);
  }
  const rows = [...map.values()].filter((r) => r.quantity > 0).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  return { title: "Produits les plus vendus", columns: [{ key: "name", label: "Produit" }, { key: "sku", label: "SKU" }, { key: "quantity", label: "Quantite", align: "right" }, { key: "revenue", label: "Chiffre d'affaires", align: "right" }], rows };
}

export async function salesByEmployee(p: Period): Promise<Table> {
  const map = new Map<string, { userId: string; employee?: string; count: number; net: number }>();
  for (const s of await activeSales(p)) { const k = String(s.userId); const c = map.get(k) ?? { userId: k, count: 0, net: 0 }; c.count++; c.net += s.total - s.refundedTotal; map.set(k, c); }
  const users = new Map((await User.find({ _id: { $in: [...map.keys()] } }).select("fullName").lean()).map((u) => [String(u._id), u.fullName]));
  const rows = [...map.values()].map((r) => ({ ...r, employee: users.get(r.userId) ?? "?" })).sort((a, b) => b.net - a.net);
  return { title: "Ventes par employe", columns: [{ key: "employee", label: "Employe" }, { key: "count", label: "Ventes", align: "right" }, { key: "net", label: "Ventes nettes", align: "right" }], rows };
}

export async function stockReport(businessId: Types.ObjectId, financial: boolean, onlyAlerts = false): Promise<Table> {
  const products = await Product.find({ businessId, status: "active" }).sort({ name: 1 }).lean();
  let rows = products.map((x) => ({
    name: x.name, sku: x.sku, unit: x.unit, stock: x.stockMilli / 1000, threshold: x.alertMilli / 1000, salePrice: x.salePrice,
    ...(financial ? { costPrice: x.costPrice, value: x.stockMilli > 0 ? multiplyQty(x.stockMilli, x.costPrice) : 0 } : {}),
    state: x.stockMilli <= 0 ? "epuise" : x.alertMilli > 0 && x.stockMilli <= x.alertMilli ? "faible" : "ok",
  }));
  if (onlyAlerts) rows = rows.filter((r) => r.state !== "ok");
  const columns: Table["columns"] = [{ key: "name", label: "Produit" }, { key: "sku", label: "SKU" }, { key: "stock", label: "Stock", align: "right" }, { key: "threshold", label: "Seuil", align: "right" }, { key: "state", label: "Etat" }, ...(financial ? [{ key: "costPrice", label: "Prix achat", align: "right" as const }, { key: "value", label: "Valeur estimee", align: "right" as const }] : [])];
  return { title: onlyAlerts ? "Stocks faibles et epuises" : "Stock disponible", columns, rows, totals: financial ? { value: rows.reduce((s, r: any) => s + (r.value ?? 0), 0) } : undefined };
}

export async function receivablesReport(businessId: Types.ObjectId): Promise<Table> {
  const bal = await customerBalances(businessId);
  const cs = await Customer.find({ _id: { $in: [...bal.keys()] }, businessId }).lean();
  const rows = cs.map((c) => ({ name: c.name, phone: c.phone ?? "", openSales: bal.get(String(c._id))!.count, since: bal.get(String(c._id))!.oldest?.toISOString().slice(0, 10), balance: bal.get(String(c._id))!.balance })).sort((a, b) => b.balance - a.balance);
  return { title: "Creances clients", columns: [{ key: "name", label: "Client" }, { key: "phone", label: "Telephone" }, { key: "openSales", label: "Ventes ouvertes", align: "right" }, { key: "since", label: "Depuis" }, { key: "balance", label: "Du", align: "right" }], rows, totals: { balance: rows.reduce((s, r) => s + r.balance, 0) } };
}

export async function payablesReport(businessId: Types.ObjectId): Promise<Table> {
  const bal = await supplierBalances(businessId);
  const ss = await Supplier.find({ _id: { $in: [...bal.keys()] }, businessId }).lean();
  const rows = ss.map((s) => ({ name: s.name, phone: s.phone ?? "", balance: bal.get(String(s._id))! })).sort((a, b) => b.balance - a.balance);
  return { title: "Dettes fournisseurs", columns: [{ key: "name", label: "Fournisseur" }, { key: "phone", label: "Telephone" }, { key: "balance", label: "Du", align: "right" }], rows, totals: { balance: rows.reduce((s, r) => s + r.balance, 0) } };
}

export async function expensesReport(p: Period): Promise<Table> {
  const b = bounds(p);
  const list = await Expense.find({ businessId: p.businessId, date: { $gte: b.from, $lt: b.to } }).sort({ date: -1 }).lean();
  const byCat = new Map<string, number>(); for (const e of list) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const rows = [...byCat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  return { title: "Depenses par categorie", columns: [{ key: "category", label: "Categorie" }, { key: "amount", label: "Montant", align: "right" }], rows, totals: { amount: rows.reduce((s, r) => s + r.amount, 0) } };
}

export async function collectionsReport(p: Period): Promise<Table> {
  const b = bounds(p);
  const pays = await Payment.find({ businessId: p.businessId, kind: { $in: ["sale_payment", "sale_refund"] }, createdAt: { $gte: b.from, $lt: b.to } }).sort({ createdAt: -1 }).lean();
  const rows = pays.map((x) => ({ date: x.createdAt.toISOString().slice(0, 16).replace("T", " "), type: x.direction === "in" ? "Encaissement" : "Remboursement", method: x.method, amount: x.direction === "in" ? x.amount : -x.amount }));
  return { title: "Encaissements", columns: [{ key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "method", label: "Moyen" }, { key: "amount", label: "Montant", align: "right" }], rows, totals: { amount: rows.reduce((s, r) => s + r.amount, 0) } };
}

export async function cashMovementsReport(p: Period): Promise<Table> {
  const b = bounds(p);
  const [pays, entries] = await Promise.all([
    Payment.find({ businessId: p.businessId, method: "cash", createdAt: { $gte: b.from, $lt: b.to } }).lean(),
    CashEntry.find({ businessId: p.businessId, createdAt: { $gte: b.from, $lt: b.to } }).lean(),
  ]);
  const rows = [
    ...pays.map((x) => ({ at: x.createdAt, label: x.kind === "sale_payment" ? "Encaissement vente" : x.kind === "sale_refund" ? "Remboursement client" : "Paiement fournisseur", amount: x.direction === "in" ? x.amount : -x.amount })),
    ...entries.map((x) => ({ at: x.createdAt, label: x.reason, amount: x.type === "in" ? x.amount : -x.amount })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).map((x) => ({ date: x.at.toISOString().slice(0, 16).replace("T", " "), label: x.label, amount: x.amount }));
  return { title: "Mouvements de caisse (especes)", columns: [{ key: "date", label: "Date" }, { key: "label", label: "Libelle" }, { key: "amount", label: "Montant", align: "right" }], rows, totals: { amount: rows.reduce((s, r) => s + r.amount, 0) } };
}

export async function recentActivity(businessId: Types.ObjectId) {
  const [sales, purchases, expenses] = await Promise.all([
    Sale.find({ businessId }).sort({ createdAt: -1 }).limit(6).select("number total status customerName createdAt").lean(),
    (await import("../purchases/models.js")).Purchase.find({ businessId }).sort({ createdAt: -1 }).limit(4).select("number total supplierName createdAt").lean(),
    Expense.find({ businessId }).sort({ createdAt: -1 }).limit(4).select("description amount createdAt").lean(),
  ]);
  return [
    ...sales.map((s) => ({ kind: "sale", label: `${s.number}${s.customerName ? ` — ${s.customerName}` : ""}`, amount: s.total, at: s.createdAt, status: s.status })),
    ...purchases.map((s) => ({ kind: "purchase", label: `${s.number} — ${s.supplierName}`, amount: s.total, at: s.createdAt })),
    ...expenses.map((s) => ({ kind: "expense", label: s.description, amount: s.amount, at: s.createdAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 10);
}
