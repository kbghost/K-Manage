/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import { z } from "zod";
import { toMilli } from "@k-manage/shared";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requirePermission, requireTenant } from "../../middleware/auth.js";
import { AppError, notFound } from "../../utils/errors.js";
import { dateRange, oid, pageQuery, paginate } from "../../utils/pagination.js";
import { send } from "../../utils/http.js";
import { periodBounds } from "../../utils/time.js";
import { audit } from "../audit/service.js";
import { runTx } from "../../db/tx.js";
import { Product } from "../catalog/models.js";
import { productDto } from "../catalog/dto.js";
import { applyStock, getSettings, stockAlerts } from "./service.js";
import { MOVEMENT_TYPES, StockMovement } from "./models.js";

const qty = z.number().min(0).max(1_000_000_000).refine((n) => Math.abs(Math.round(n * 1000) / 1000 - n) < 1e-9, "3 decimales maximum");
const movementBody = z.discriminatedUnion("type", [
  z.object({ type: z.literal("entry"), productId: oid, quantity: qty.refine((n) => n > 0, "quantite > 0"), reason: z.string().trim().max(300).optional(), unitCost: z.number().int().min(0).optional() }),
  z.object({ type: z.literal("exit"), productId: oid, quantity: qty.refine((n) => n > 0, "quantite > 0"), reason: z.string().trim().min(3, "Motif obligatoire").max(300) }),
  z.object({ type: z.literal("adjustment"), productId: oid, countedQuantity: qty, reason: z.string().trim().min(3, "Motif obligatoire").max(300) }),
]);

export function stockRouter() {
  const r = Router();
  r.use(requireAuth, requireTenant);

  r.get("/movements", requirePermission("stock.read"), ah(async (req, res) => {
    const f = pageQuery.merge(dateRange).extend({ productId: oid.optional(), type: z.enum(MOVEMENT_TYPES).optional() }).parse(req.query);
    const businessId = req.tenant!.businessId;
    const filter: Record<string, any> = { businessId };
    if (f.productId) filter.productId = f.productId;
    if (f.type) filter.type = f.type;
    if (f.from || f.to) {
      const tz = (await getSettings(businessId)).timezone ?? "Africa/Porto-Novo";
      const b = periodBounds(f.from, f.to ?? f.from, tz);
      filter.createdAt = { $gte: b.from, $lt: b.to };
    }
    const { items, meta } = await paginate(StockMovement as any, filter, { page: f.page, limit: f.limit, sort: { createdAt: -1, _id: -1 } });
    const prods = new Map((await Product.find({ _id: { $in: items.map((m) => m.productId) } }).select("name sku unit").lean()).map((p) => [String(p._id), p]));
    send(res, items.map((m) => ({ ...m, quantity: m.quantityMilli / 1000, stockAfter: m.stockAfterMilli / 1000, product: prods.get(String(m.productId)) })), 200, meta);
  }));

  r.get("/alerts", requirePermission("stock.read"), ah(async (req, res) => {
    const a = await stockAlerts(req.tenant!.businessId);
    send(res, { low: a.low.map(productDto), out: a.out.map(productDto) });
  }));

  r.post("/movements", requirePermission("stock.adjust"), ah(async (req, res) => {
    const b = movementBody.parse(req.body); const businessId = req.tenant!.businessId; const userId = req.auth!.userId;
    const settings = await getSettings(businessId);
    const product = await Product.findOne({ _id: b.productId, businessId, status: "active" }).lean();
    if (!product) throw notFound("Produit introuvable");
    let delta: number; let expected: number | undefined;
    if (b.type === "entry") delta = toMilli(b.quantity);
    else if (b.type === "exit") delta = -toMilli(b.quantity);
    else { delta = toMilli(b.countedQuantity) - product.stockMilli; expected = product.stockMilli; if (delta === 0) throw new AppError(400, "NO_CHANGE", "Le stock compte est identique au stock actuel"); }
    const updated = await runTx((tx) => applyStock(tx, {
      businessId, productId: product._id, deltaMilli: delta, allowNegative: settings.settings?.allowNegativeStock ?? false,
      type: b.type, userId, reason: "reason" in b ? b.reason : undefined, expectedStockMilli: expected,
      unitCost: b.type === "entry" ? b.unitCost : undefined,
    }));
    if (b.type !== "entry") await audit(req, { businessId, userId, action: `stock.${b.type}`, resourceType: "product", resourceId: product._id, details: { delta: delta / 1000, reason: "reason" in b ? b.reason : undefined } });
    send(res, productDto(updated as never), 201);
  }));

  r.post("/inventory", requirePermission("stock.adjust"), ah(async (req, res) => {
    const b = z.object({ note: z.string().trim().min(3).max(200), items: z.array(z.object({ productId: oid, counted: qty })).min(1).max(1000) }).parse(req.body);
    const businessId = req.tenant!.businessId; const userId = req.auth!.userId;
    const ids = b.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) throw new AppError(400, "DUPLICATE_ITEM", "Un produit apparait plusieurs fois");
    const products = new Map((await Product.find({ _id: { $in: ids }, businessId }).lean()).map((p) => [String(p._id), p]));
    if (products.size !== ids.length) throw notFound("Un produit de l'inventaire est introuvable");
    const settings = await getSettings(businessId);
    const diffs = await runTx(async (tx) => {
      const out: { productId: string; name: string; before: number; after: number }[] = [];
      for (const it of b.items) {
        const p = products.get(it.productId)!; const delta = toMilli(it.counted) - p.stockMilli;
        if (delta === 0) continue;
        await applyStock(tx, { businessId, productId: p._id, deltaMilli: delta, allowNegative: settings.settings?.allowNegativeStock ?? false, type: "adjustment", userId, reason: `Inventaire physique : ${b.note}`, expectedStockMilli: p.stockMilli });
        out.push({ productId: it.productId, name: p.name, before: p.stockMilli / 1000, after: toMilli(it.counted) / 1000 });
      }
      return out;
    });
    await audit(req, { businessId, userId, action: "stock.inventory", details: { note: b.note, adjusted: diffs.length } });
    send(res, { adjusted: diffs.length, diffs }, 201);
  }));

  return r;
}
