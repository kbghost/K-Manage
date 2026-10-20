/**
 * Donnees de DEMONSTRATION (fictives).
 * - En production, exige un opt-in par variable d'environnement et argument CLI.
 * - En production, la remise a zero est interdite et un mot de passe explicite est requis.
 * - Idempotent : si le commerce de demo existe deja, ne fait rien (sauf --reset, qui supprime UNIQUEMENT le commerce de demo).
 * - Ne touche jamais aux autres commerces ni aux autres comptes.
 */
import mongoose, { type Types } from "mongoose";
import { loadEnv } from "../config/env.js";
import { configureTransactions, runTx } from "../db/tx.js";
import { User, Session } from "../modules/auth/models.js";
import { Business, Membership } from "../modules/businesses/models.js";
import { Category, Product } from "../modules/catalog/models.js";
import { applyStock, nextNumber } from "../modules/stock/service.js";
import { Customer, Supplier } from "../modules/parties/models.js";
import { Payment, Sale } from "../modules/sales/models.js";
import { createSale, recordPayment } from "../modules/sales/service.js";
import { Purchase } from "../modules/purchases/models.js";
import { Expense } from "../modules/expenses/models.js";
import { CashEntry, CashSession } from "../modules/cash/models.js";
import { StockMovement, Counter } from "../modules/stock/models.js";
import { AuditLog } from "../modules/audit/models.js";
import { registerUser } from "../modules/auth/service.js";

const env = loadEnv();
const productionDemoSeed = env.NODE_ENV === "production"
  && env.ALLOW_DEMO_SEED_IN_PRODUCTION
  && process.argv.includes("--allow-production-demo");
if (env.NODE_ENV === "production" && !productionDemoSeed) {
  console.error("Seed production refuse. Activez explicitement ALLOW_DEMO_SEED_IN_PRODUCTION et utilisez --allow-production-demo.");
  process.exit(1);
}
if (env.NODE_ENV === "production" && process.argv.includes("--reset")) {
  console.error("La remise a zero du seed est interdite en production.");
  process.exit(1);
}
const productionPassword = () => {
  if (!env.DEMO_SEED_PASSWORD) {
    console.error("DEMO_SEED_PASSWORD est requis pour le seed en production.");
    process.exit(1);
  }
  return env.DEMO_SEED_PASSWORD;
};
const password = productionDemoSeed ? productionPassword() : "Demo-K-Manage-2026";
configureTransactions(env.USE_TRANSACTIONS);
await mongoose.connect(env.MONGODB_URI);
await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));

const NAME = "Boutique Demo K-Manage (donnees fictives)";
const USERS = [
  { key: "owner", email: "proprietaire@demo.k-manage.local", fullName: "Awa Proprietaire (demo)", role: "owner" },
  { key: "manager", email: "gerant@demo.k-manage.local", fullName: "Koffi Gerant (demo)", role: "manager" },
  { key: "cashier", email: "caissier@demo.k-manage.local", fullName: "Fatou Caissiere (demo)", role: "cashier" },
  { key: "keeper", email: "magasinier@demo.k-manage.local", fullName: "Yao Magasinier (demo)", role: "storekeeper" },
] as const;

const existing = await Business.findOne({ name: NAME, isDemo: true });
if (existing && process.argv.includes("--reset")) {
  const businessId = existing._id;
  for (const m of [Category, Product, Customer, Supplier, Sale, Payment, Purchase, Expense, CashEntry, CashSession, StockMovement, Counter, AuditLog, Membership]) {
    await (m as unknown as mongoose.Model<object>).deleteMany({ businessId });
  }
  await Business.deleteOne({ _id: businessId });
  const demoUsers = await User.find({ email: { $in: USERS.map((u) => u.email) } }).select("_id").lean();
  await Session.deleteMany({ userId: { $in: demoUsers.map((u) => u._id) } });
  await User.deleteMany({ email: { $in: USERS.map((u) => u.email) } });
  console.log("Commerce de demonstration supprime.");
} else if (existing) {
  console.log(productionDemoSeed
    ? "Le commerce de demonstration existe deja : rien a faire. La remise a zero est interdite en production."
    : "Le commerce de demonstration existe deja : rien a faire. (utilisez --reset pour le regenerer)");
  await mongoose.disconnect(); process.exit(0);
}

if (productionDemoSeed) {
  const existingDemoUsers = await User.find({ email: { $in: USERS.map((u) => u.email) } }).select("email").lean();
  if (existingDemoUsers.length > 0) {
    console.error("Seed production refuse : un ou plusieurs comptes demo existent deja sans commerce de demo. Verifiez la base avant toute intervention.");
    await mongoose.disconnect();
    process.exit(1);
  }
}

const ids: Record<string, Types.ObjectId> = {};
for (const u of USERS) {
  const user = productionDemoSeed
    ? await registerUser({ email: u.email, password, fullName: u.fullName })
    : (await User.findOne({ email: u.email })) ?? (await registerUser({ email: u.email, password, fullName: u.fullName }));
  ids[u.key] = user._id;
}
const business = await Business.create({ name: NAME, ownerId: ids.owner, address: "Quartier fictif, Cotonou", phone: "+229 00 00 00 00", isDemo: true, receipt: { header: "Boutique de demonstration", footer: "Merci ! (donnees fictives)", paperWidth: "80mm" } });
const businessId = business._id;
for (const u of USERS) await Membership.create({ businessId, userId: ids[u.key], role: u.role });

const cats: Record<string, Types.ObjectId> = {};
for (const n of ["Alimentation", "Boissons", "Hygiene", "Quincaillerie", "Vetements"]) cats[n] = (await Category.create({ businessId, name: n }))._id;

const P: [string, string, string, string, number, number, number, number][] = [
  ["Riz parfume 5 kg", "RIZ5", "6001000000011", "Alimentation", 3200, 3800, 40, 10], ["Huile vegetale 1 L", "HUILE1", "6001000000028", "Alimentation", 1100, 1400, 60, 12],
  ["Sucre 1 kg", "SUCRE1", "6001000000035", "Alimentation", 650, 800, 80, 15], ["Pates alimentaires 500 g", "PATES5", "6001000000042", "Alimentation", 350, 500, 100, 20],
  ["Eau minerale 1,5 L", "EAU15", "6001000000059", "Boissons", 250, 400, 120, 24], ["Jus d'orange 1 L", "JUS1", "6001000000066", "Boissons", 600, 900, 36, 10],
  ["Savon de toilette", "SAVON", "6001000000073", "Hygiene", 200, 350, 90, 20], ["Dentifrice", "DENT", "6001000000080", "Hygiene", 450, 700, 4, 6],
  ["Marteau", "MART", "6001000000097", "Quincaillerie", 2500, 3500, 12, 3], ["Clous 100 g", "CLOU", "6001000000103", "Quincaillerie", 150, 250, 50, 10],
  ["T-shirt coton", "TSHIRT", "6001000000110", "Vetements", 2000, 3500, 25, 5], ["Sandales", "SAND", "6001000000127", "Vetements", 2500, 4000, 0, 4],
];
const pid: Record<string, Types.ObjectId> = {};
await runTx(async (tx) => {
  for (const [name, sku, barcode, cat, cost, price, stock, alert] of P) {
    const p = await tx.create(Product, { businessId, name, sku, barcode, categoryId: cats[cat], costPrice: cost, salePrice: price, alertMilli: alert * 1000, stockMilli: 0 });
    pid[sku] = p._id;
    if (stock > 0) await applyStock(tx, { businessId, productId: p._id, deltaMilli: stock * 1000, allowNegative: true, type: "initial", userId: ids.owner!, reason: "Stock initial (demo)", unitCost: cost });
  }
});

const customers: Types.ObjectId[] = [];
for (const [name, phone] of [["Client Comptoir Habitue (demo)", "+229 01 00 00 01"], ["Restaurant Le Palmier (demo)", "+229 01 00 00 02"], ["Mme Adjovi (demo)", "+229 01 00 00 03"], ["Ecole Les Cocotiers (demo)", "+229 01 00 00 04"]] as const) {
  customers.push((await Customer.create({ businessId, name, phone }))._id);
}
const suppliers: Types.ObjectId[] = [];
for (const name of ["Grossiste Dantokpa (demo)", "Distribution Ganhi (demo)"]) suppliers.push((await Supplier.create({ businessId, name }))._id);

// Caisse du caissier : ouverte pendant la saisie des ventes, puis cloturee.
const session = await CashSession.create({ businessId, openedBy: ids.cashier, openingAmount: 20000 });
const actor = { businessId, userId: ids.cashier!, canDiscount: false };
const backdate = async (saleId: Types.ObjectId, daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86400_000 - Math.floor(Math.random() * 6) * 3600_000);
  await Sale.collection.updateOne({ _id: saleId }, { $set: { createdAt: d, updatedAt: d } });
  await Payment.collection.updateMany({ saleId }, { $set: { createdAt: d } });
  await StockMovement.collection.updateMany({ refId: saleId }, { $set: { createdAt: d } });
};
const plan: { days: number; cust?: number; lines: [string, number][]; pay: "full" | "half" | "none" | "transfer" }[] = [
  { days: 12, lines: [["RIZ5", 2], ["HUILE1", 1]], pay: "full" }, { days: 11, lines: [["EAU15", 6]], pay: "full" }, { days: 10, cust: 1, lines: [["RIZ5", 5], ["SUCRE1", 5], ["HUILE1", 4]], pay: "half" },
  { days: 9, lines: [["SAVON", 4], ["DENT", 1]], pay: "full" }, { days: 8, lines: [["TSHIRT", 2]], pay: "transfer" }, { days: 7, cust: 3, lines: [["PATES5", 20], ["SUCRE1", 10]], pay: "none" },
  { days: 6, lines: [["JUS1", 3], ["EAU15", 2]], pay: "full" }, { days: 5, lines: [["MART", 1], ["CLOU", 6]], pay: "full" }, { days: 4, cust: 2, lines: [["HUILE1", 3]], pay: "half" },
  { days: 3, lines: [["RIZ5", 1]], pay: "full" }, { days: 2, lines: [["SAVON", 6], ["PATES5", 5]], pay: "full" }, { days: 1, lines: [["EAU15", 10], ["JUS1", 2]], pay: "full" },
  { days: 0, lines: [["RIZ5", 3], ["SUCRE1", 2]], pay: "full" }, { days: 0, lines: [["TSHIRT", 1], ["DENT", 2]], pay: "transfer" },
];
let n = 0;
for (const s of plan) {
  const totalGuess = s.lines.reduce((t, [sku, q]) => t + q * (P.find((p) => p[1] === sku)![5]), 0);
  const amount = s.pay === "full" || s.pay === "transfer" ? totalGuess : s.pay === "half" ? Math.floor(totalGuess / 2) : 0;
  const r = await createSale(actor, {
    customerId: s.cust !== undefined ? String(customers[s.cust]) : undefined,
    lines: s.lines.map(([sku, quantity]) => ({ productId: String(pid[sku]), quantity })),
    payments: amount > 0 ? [{ method: s.pay === "transfer" ? "transfer" : "cash", amount }] : [],
  }, `seed-sale-${++n}-demo`);
  await backdate(r.sale._id, s.days);
}
// Achats : un recu et partiellement paye, un commande
const mkPurchase = async (supplier: Types.ObjectId, name: string, lines: [string, number, number][], receive: boolean, paid: number) => {
  const number = await nextNumber(businessId, "purchase", "A");
  const ls = lines.map(([sku, q, cost]) => { const p = P.find((x) => x[1] === sku)!; return { productId: pid[sku], name: p[0], sku, quantityMilli: q * 1000, receivedMilli: receive ? q * 1000 : 0, unitCost: cost, total: q * cost }; });
  const pu = await Purchase.create({ businessId, number, supplierId: supplier, supplierName: name, lines: ls, total: ls.reduce((t, l) => t + l.total, 0), paidAmount: paid, status: receive ? "received" : "ordered", userId: ids.keeper });
  await runTx(async (tx) => {
    if (receive) for (const l of ls) await applyStock(tx, { businessId, productId: l.productId!, deltaMilli: l.quantityMilli, allowNegative: true, type: "purchase_receipt", userId: ids.keeper!, refKind: "purchase", refId: pu._id, unitCost: l.unitCost, reason: number });
    if (paid > 0) await recordPayment(tx, { businessId, userId: ids.owner!, kind: "supplier_payment", direction: "out", method: "transfer", amount: paid, purchaseId: pu._id, supplierId: supplier, key: `seed-purchase-pay-${number}` });
  });
};
await mkPurchase(suppliers[0]!, "Grossiste Dantokpa (demo)", [["RIZ5", 20, 3200], ["SUCRE1", 30, 650]], true, 50000);
await mkPurchase(suppliers[1]!, "Distribution Ganhi (demo)", [["SAND", 12, 2500]], false, 0);
// Depenses
const today = new Date();
for (const [category, description, amount, status] of [["Loyer", "Loyer du mois (demo)", 60000, "payable"], ["Electricite", "Facture d'electricite (demo)", 18000, "paid"], ["Transport", "Livraison marchandises (demo)", 5000, "paid"]] as const) {
  await Expense.create({ businessId, category, description, amount, date: today, method: status === "paid" ? "transfer" : undefined, status, paidAt: status === "paid" ? today : undefined, userId: ids.manager });
}
// Cloture de la caisse
const pays = await Payment.find({ businessId, cashSessionId: session._id, method: "cash" }).lean();
const expected = 20000 + pays.reduce((s, p) => s + (p.direction === "in" ? p.amount : -p.amount), 0);
await CashSession.updateOne({ _id: session._id }, { status: "closed", closedAt: new Date(), closedBy: ids.cashier, expectedAmount: expected, countedAmount: expected - 100, difference: -100, note: "Ecart de demonstration" });

console.log(`Donnees de demonstration creees pour « ${NAME} ».`);
if (!productionDemoSeed) console.log(`Comptes (mot de passe : ${password}) :`);
else console.log("Comptes de demonstration crees avec DEMO_SEED_PASSWORD.");
for (const u of USERS) console.log(`  - ${u.role.padEnd(11)} ${u.email}`);
await mongoose.disconnect();
