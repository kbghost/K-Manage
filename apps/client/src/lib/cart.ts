import { computeSaleTotals, MoneyError } from "@k-manage/shared";

export interface CartItem { productId: string; name: string; sku: string; unit: string; unitPrice: number; stock: number; quantity: number; discount: number; imageUploadId?: string }

/** Apercu des totaux a l'ecran. Le SERVEUR recalcule toujours prix et totaux a la validation. */
export function previewTotals(items: CartItem[], globalDiscount: number) {
  if (items.length === 0) return { ok: true as const, subtotal: 0, total: 0, error: "" };
  try {
    const t = computeSaleTotals(items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount })), globalDiscount);
    return { ok: true as const, subtotal: t.subtotal, total: t.total, error: "" };
  } catch (e) {
    return { ok: false as const, subtotal: 0, total: 0, error: e instanceof MoneyError ? e.message : "Panier invalide" };
  }
}
export function addToCart(items: CartItem[], p: { id: string; name: string; sku: string; unit: string; salePrice: number; stock: number; imageUploadId?: string }): CartItem[] {
  const i = items.findIndex((x) => x.productId === p.id);
  if (i >= 0) return items.map((x, k) => (k === i ? { ...x, quantity: Math.round((x.quantity + 1) * 1000) / 1000 } : x));
  return [...items, { productId: p.id, name: p.name, sku: p.sku, unit: p.unit, unitPrice: p.salePrice, stock: p.stock, quantity: 1, discount: 0, imageUploadId: p.imageUploadId }];
}
