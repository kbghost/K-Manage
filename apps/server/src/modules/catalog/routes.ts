/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import type { Types } from "mongoose";
import { z } from "zod";
import { toMilli, MoneyError } from "@k-manage/shared";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requirePermission, requireTenant } from "../../middleware/auth.js";
import { AppError, notFound } from "../../utils/errors.js";
import { escapeRegex, oid, pageQuery, paginate, sortSpec } from "../../utils/pagination.js";
import { can, idParam, send } from "../../utils/http.js";
import { mapDuplicate } from "../../utils/dup.js";
import { audit } from "../audit/service.js";
import { AuditLog } from "../audit/models.js";
import { runTx } from "../../db/tx.js";
import { applyStock } from "../stock/service.js";
import { StockMovement } from "../stock/models.js";
import { FORMATS, sendTable } from "../../utils/export.js";
import { Category, Product } from "./models.js";
import { productDto } from "./dto.js";

const money = z.number().int("Montant entier (FCFA)").min(0).max(1_000_000_000);
const qty = z.number().min(0).max(1_000_000_000).refine((n) => Math.abs(Math.round(n * 1000) / 1000 - n) < 1e-9, "3 decimales maximum");
const optStr = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

const productBody = z.object({
  name: z.string().trim().min(1).max(160),
  description: optStr(1000),
  sku: z.string().trim().min(1).max(60),
  barcode: optStr(64),
  categoryId: oid.optional().nullable(),
  costPrice: money,
  salePrice: money,
  unit: z.string().trim().min(1).max(20).default("piece"),
  alertThreshold: qty.default(0),
  imageUploadId: oid.optional().nullable(),
});
const createBody = productBody.extend({ initialStock: qty.default(0) });
const updateBody = productBody.partial().extend({ status: z.enum(["active", "archived"]).optional() });
const DUP = { sku: ["DUPLICATE_SKU", "Cette reference (SKU) existe deja"], barcode: ["DUPLICATE_BARCODE", "Ce code-barres existe deja"] } as Record<string, [string, string]>;

const importRow = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(60),
  barcode: optStr(64),
  category: optStr(80),
  costPrice: z.coerce.number().int().min(0),
  salePrice: z.coerce.number().int().min(0),
  unit: z.string().trim().max(20).optional().transform((v) => v || "piece"),
  stock: z.coerce.number().min(0).default(0),
  alertThreshold: z.coerce.number().min(0).default(0),
});

async function assertCategory(businessId: Types.ObjectId, id?: string | null) {
  if (id && !(await Category.exists({ _id: id, businessId }))) throw new AppError(400, "CATEGORY_NOT_FOUND", "Categorie introuvable");
}

async function assertSkuFree(businessId: Types.ObjectId, sku: string, exceptId?: string) {
  const f: Record<string, unknown> = { businessId, sku: sku.trim().toUpperCase() };
  if (exceptId) f._id = { $ne: exceptId };
  if (await Product.exists(f)) throw new AppError(409, "DUPLICATE_SKU", "Cette reference (SKU) existe deja");
}

async function assertBarcodeFree(businessId: Types.ObjectId, barcode?: string | null, exceptId?: string) {
  if (!barcode) return;
  const f: Record<string, unknown> = { businessId, barcode };
  if (exceptId) f._id = { $ne: exceptId };
  if (await Product.exists(f)) throw new AppError(409, "DUPLICATE_BARCODE", "Ce code-barres existe deja");
}

/** Le prix d'achat n'est visible que des roles qui gerent les produits ou voient les chiffres financiers. */
const shape = (req: import("express").Request, p: Record<string, any>) => {
  const d: Record<string, any> = productDto(p);
  if (!can(req, "products.update") && !can(req, "reports.financial.read")) delete d.costPrice;
  return d;
};

export function catalogRouter() {
  const r = Router();
  r.use(requireAuth, requireTenant);

  // ---- Categories
  r.get("/categories", requirePermission("products.read"), ah(async (req, res) => {
    const items = await Category.find({ businessId: req.tenant!.businessId }).sort({ name: 1 }).lean();
    send(res, items);
  }));
  r.post("/categories", requirePermission("products.create"), ah(async (req, res) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    try { send(res, await Category.create({ businessId: req.tenant!.businessId, name }), 201); }
    catch (e) { mapDuplicate(e, { name: ["DUPLICATE_CATEGORY", "Cette categorie existe deja"] }); }
  }));
  r.patch("/categories/:id", requirePermission("products.update"), ah(async (req, res) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    try {
      const c = await Category.findOneAndUpdate({ _id: oid.parse(idParam(req)), businessId: req.tenant!.businessId }, { name }, { returnDocument: "after" });
      if (!c) throw notFound();
      send(res, c);
    } catch (e) { mapDuplicate(e, { name: ["DUPLICATE_CATEGORY", "Cette categorie existe deja"] }); }
  }));
  r.delete("/categories/:id", requirePermission("products.update"), ah(async (req, res) => {
    const id = oid.parse(idParam(req)); const businessId = req.tenant!.businessId;
    if (await Product.exists({ businessId, categoryId: id })) throw new AppError(409, "CATEGORY_IN_USE", "Des produits utilisent cette categorie");
    const d = await Category.deleteOne({ _id: id, businessId });
    if (!d.deletedCount) throw notFound();
    res.status(204).end();
  }));

  // ---- Produits
  const listQuery = pageQuery.extend({
    categoryId: oid.optional(),
    status: z.enum(["active", "archived", "all"]).default("active"),
    low: z.enum(["true", "false"]).optional(),
    sort: z.string().max(30).optional(),
    format: z.enum(FORMATS).default("json"),
  });

  r.get("/products", requirePermission("products.read"), ah(async (req, res) => {
    const f = listQuery.parse(req.query); const businessId = req.tenant!.businessId;
    const filter: Record<string, any> = { businessId };
    if (f.status !== "all") filter.status = f.status;
    if (f.categoryId) filter.categoryId = f.categoryId;
    if (f.q) { const rx = new RegExp(escapeRegex(f.q), "i"); filter.$or = [{ name: rx }, { sku: rx }, { barcode: rx }]; }
    if (f.low === "true") {
      const all = await Product.find({ ...filter }).select("stockMilli alertMilli").lean();
      filter._id = { $in: all.filter((p) => p.stockMilli <= 0 || (p.alertMilli > 0 && p.stockMilli <= p.alertMilli)).map((p) => p._id) };
    }
    const sort = sortSpec(f.sort, ["name", "sku", "salePrice", "stockMilli", "createdAt"], "name");
    if (f.format !== "json") {
      const rows = await Product.find(filter).sort(sort).lean();
      const cats = new Map((await Category.find({ businessId }).lean()).map((c) => [String(c._id), c.name]));
      await sendTable(res, f.format, {
        title: "Produits", filename: "produits",
        columns: [
          { key: "name", label: "Nom" }, { key: "sku", label: "SKU" }, { key: "barcode", label: "Code-barres" }, { key: "category", label: "Categorie" },
          { key: "unit", label: "Unite" }, { key: "costPrice", label: "Prix achat", align: "right" }, { key: "salePrice", label: "Prix vente", align: "right" },
          { key: "stock", label: "Stock", align: "right" }, { key: "alertThreshold", label: "Seuil", align: "right" }, { key: "status", label: "Statut" },
        ],
        rows: rows.map((p) => ({ ...p, category: p.categoryId ? cats.get(String(p.categoryId)) : "", stock: p.stockMilli / 1000, alertThreshold: p.alertMilli / 1000, barcode: p.barcode ?? "" })) as never,
      });
      return;
    }
    const { items, meta } = await paginate(Product as any, filter, { page: f.page, limit: f.limit, sort });
    send(res, items.map((p) => shape(req, p)), 200, meta);
  }));

  r.get("/products/lookup", requirePermission("products.read"), ah(async (req, res) => {
    const { code } = z.object({ code: z.string().trim().min(1).max(64) }).parse(req.query);
    const p = await Product.findOne({ businessId: req.tenant!.businessId, status: "active", $or: [{ barcode: code }, { sku: code.toUpperCase() }] }).lean();
    if (!p) throw notFound("Aucun produit pour ce code");
    send(res, shape(req, p));
  }));

  r.post("/products/import", requirePermission("products.create"), ah(async (req, res) => {
    const { rows, dryRun } = z.object({ rows: z.array(z.unknown()).min(1).max(1000), dryRun: z.boolean().default(false) }).parse(req.body);
    const businessId = req.tenant!.businessId;
    const errors: { row: number; message: string }[] = []; const ok: z.infer<typeof importRow>[] = [];
    rows.forEach((raw, i) => {
      const p = importRow.safeParse(raw);
      if (!p.success) errors.push({ row: i + 1, message: p.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
      else ok.push(p.data);
    });
    const seenSku = new Set<string>(), seenBar = new Set<string>();
    ok.forEach((p, i) => {
      const sku = p.sku.toUpperCase();
      if (seenSku.has(sku)) errors.push({ row: i + 1, message: `SKU en double dans le fichier: ${sku}` }); seenSku.add(sku);
      if (p.barcode) { if (seenBar.has(p.barcode)) errors.push({ row: i + 1, message: `Code-barres en double dans le fichier: ${p.barcode}` }); seenBar.add(p.barcode); }
    });
    const existing = await Product.find({ businessId, $or: [{ sku: { $in: [...seenSku] } }, ...(seenBar.size ? [{ barcode: { $in: [...seenBar] } }] : [])] }).select("sku barcode").lean();
    for (const e of existing) errors.push({ row: 0, message: `Deja existant: ${e.sku}${e.barcode ? ` / ${e.barcode}` : ""}` });
    if (dryRun || errors.length) {
      if (!dryRun) throw new AppError(422, "IMPORT_INVALID", "Import refuse : corrigez les erreurs puis recommencez", errors);
      return send(res, { valid: errors.length === 0, count: ok.length, errors });
    }
    const catIds = new Map<string, unknown>();
    for (const name of new Set(ok.map((p) => p.category).filter(Boolean) as string[])) {
      const c = await Category.findOneAndUpdate({ businessId, name }, { $setOnInsert: { businessId, name } }, { upsert: true, returnDocument: "after" });
      catIds.set(name, c!._id);
    }
    const created = await runTx(async (tx) => {
      let n = 0;
      for (const p of ok) {
        const doc = await tx.create(Product, {
          businessId, name: p.name, sku: p.sku, barcode: p.barcode, categoryId: p.category ? catIds.get(p.category) : undefined,
          costPrice: p.costPrice, salePrice: p.salePrice, unit: p.unit, alertMilli: toMilli(p.alertThreshold), stockMilli: 0,
        });
        if (p.stock > 0) await applyStock(tx, { businessId, productId: doc._id, deltaMilli: toMilli(p.stock), allowNegative: true, type: "import", userId: req.auth!.userId, reason: "Import de produits", unitCost: p.costPrice });
        n++;
      }
      return n;
    }).catch((e) => mapDuplicate(e, DUP));
    await audit(req, { businessId, userId: req.auth!.userId, action: "product.import", details: { count: created } });
    send(res, { valid: true, count: created, errors: [] }, 201);
  }));

  r.post("/products", requirePermission("products.create"), ah(async (req, res) => {
    const b = createBody.parse(req.body); const businessId = req.tenant!.businessId;
    await assertCategory(businessId, b.categoryId);
    await assertSkuFree(businessId, b.sku);
    await assertBarcodeFree(businessId, b.barcode);
    try {
      const doc = await runTx(async (tx) => {
        const p = await tx.create(Product, {
          businessId, name: b.name, description: b.description, sku: b.sku, barcode: b.barcode, categoryId: b.categoryId ?? undefined,
          costPrice: b.costPrice, salePrice: b.salePrice, unit: b.unit, alertMilli: toMilli(b.alertThreshold), stockMilli: 0, imageUploadId: b.imageUploadId ?? undefined,
        });
        if (b.initialStock > 0) {
          await applyStock(tx, { businessId, productId: p._id, deltaMilli: toMilli(b.initialStock), allowNegative: true, type: "initial", userId: req.auth!.userId, reason: "Stock initial", unitCost: b.costPrice });
        }
        return p;
      });
      const fresh = await Product.findById(doc._id).lean();
      send(res, productDto(fresh!), 201);
    } catch (e) { if (e instanceof MoneyError) throw new AppError(400, "INVALID_AMOUNT", e.message); mapDuplicate(e, DUP); }
  }));

  r.get("/products/:id", requirePermission("products.read"), ah(async (req, res) => {
    const p = await Product.findOne({ _id: oid.parse(idParam(req)), businessId: req.tenant!.businessId }).lean();
    if (!p) throw notFound("Produit introuvable");
    send(res, shape(req, p));
  }));

  r.patch("/products/:id", requirePermission("products.update"), ah(async (req, res) => {
    const id = oid.parse(idParam(req)); const businessId = req.tenant!.businessId;
    const b = updateBody.parse(req.body);
    const before = await Product.findOne({ _id: id, businessId }).lean();
    if (!before) throw notFound("Produit introuvable");
    if (b.categoryId !== undefined) await assertCategory(businessId, b.categoryId);
    if (b.sku) await assertSkuFree(businessId, b.sku, id);
    await assertBarcodeFree(businessId, b.barcode, id);
    const { alertThreshold, categoryId, imageUploadId, ...rest } = b;
    const $set: Record<string, unknown> = { ...rest };
    const $unset: Record<string, 1> = {};
    if (alertThreshold !== undefined) $set.alertMilli = toMilli(alertThreshold);
    if (categoryId !== undefined) if (categoryId) $set.categoryId = categoryId; else $unset.categoryId = 1;
    if (imageUploadId !== undefined) if (imageUploadId) $set.imageUploadId = imageUploadId; else $unset.imageUploadId = 1;
    if ("barcode" in b && !b.barcode) { delete $set.barcode; $unset.barcode = 1; }
    try {
      const after = await Product.findOneAndUpdate({ _id: id, businessId }, { $set, ...(Object.keys($unset).length ? { $unset } : {}) }, { returnDocument: "after" }).lean();
      if (b.costPrice !== undefined && b.costPrice !== before.costPrice || b.salePrice !== undefined && b.salePrice !== before.salePrice) {
        await audit(req, { businessId, userId: req.auth!.userId, action: "product.price_changed", resourceType: "product", resourceId: id,
          details: { costPrice: [before.costPrice, after!.costPrice], salePrice: [before.salePrice, after!.salePrice] } });
      }
      if (b.status && b.status !== before.status) await audit(req, { businessId, userId: req.auth!.userId, action: `product.${b.status}`, resourceType: "product", resourceId: id });
      send(res, productDto(after!));
    } catch (e) { mapDuplicate(e, DUP); }
  }));

  r.delete("/products/:id", requirePermission("products.update"), ah(async (req, res) => {
    const id = oid.parse(idParam(req)); const businessId = req.tenant!.businessId;
    const p = await Product.findOneAndUpdate({ _id: id, businessId }, { status: "archived" }, { returnDocument: "after" }).lean();
    if (!p) throw notFound("Produit introuvable");
    await audit(req, { businessId, userId: req.auth!.userId, action: "product.archived", resourceType: "product", resourceId: id });
    send(res, productDto(p));
  }));

  r.get("/products/:id/history", requirePermission("products.read"), ah(async (req, res) => {
    const id = oid.parse(idParam(req)); const businessId = req.tenant!.businessId;
    if (!(await Product.exists({ _id: id, businessId }))) throw notFound("Produit introuvable");
    const [movements, changes] = await Promise.all([
      StockMovement.find({ businessId, productId: id }).sort({ createdAt: -1 }).limit(100).lean(),
      AuditLog.find({ businessId, resourceType: "product", resourceId: id }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    send(res, { movements: movements.map((m) => ({ ...m, quantity: m.quantityMilli / 1000, stockAfter: m.stockAfterMilli / 1000 })), changes });
  }));

  return r;
}
