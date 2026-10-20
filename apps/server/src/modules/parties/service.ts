import type { Types } from "mongoose";
import { Sale } from "../sales/models.js";
import { Purchase } from "../purchases/models.js";

export const saleRemaining = (s: { total: number; refundedTotal: number; paidAmount: number; status: string }) =>
  s.status === "completed" ? Math.max(0, s.total - s.refundedTotal - s.paidAmount) : 0;

export async function customerBalances(businessId: Types.ObjectId, customerId?: string) {
  const filter: Record<string, unknown> = { businessId, status: "completed", customerId: customerId ?? { $exists: true } };
  const sales = await Sale.find(filter).select("customerId total refundedTotal paidAmount status createdAt number").lean();
  const map = new Map<string, { balance: number; count: number; oldest?: Date }>();
  for (const s of sales) {
    const rem = saleRemaining(s); if (rem <= 0 || !s.customerId) continue;
    const k = String(s.customerId); const cur = map.get(k) ?? { balance: 0, count: 0 };
    cur.balance += rem; cur.count++; cur.oldest = !cur.oldest || s.createdAt < cur.oldest ? s.createdAt : cur.oldest; map.set(k, cur);
  }
  return map;
}

export async function supplierBalances(businessId: Types.ObjectId, supplierId?: string) {
  const filter: Record<string, unknown> = { businessId, status: { $ne: "cancelled" } };
  if (supplierId) filter.supplierId = supplierId;
  const purchases = await Purchase.find(filter).select("supplierId total paidAmount").lean();
  const map = new Map<string, number>();
  for (const p of purchases) { const rem = p.total - p.paidAmount; if (rem > 0) map.set(String(p.supplierId), (map.get(String(p.supplierId)) ?? 0) + rem); }
  return map;
}
