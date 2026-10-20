export interface User { id: string; email: string; fullName: string; phone?: string; isPlatformAdmin?: boolean; csrfToken?: string }
export interface BusinessSummary { id: string; name: string; role: string; currency: string }
export interface Business {
  id: string; name: string; address?: string; phone?: string; email?: string; currency: string; timezone: string; role: string; permissions: string[];
  settings: { allowNegativeStock: boolean; allowAnonymousSales: boolean; lowStockDefault: number; paymentMethods: string[]; creditDueDays: number };
  receipt: { header: string; footer: string; paperWidth: "80mm" | "58mm" | "a4"; showTaxId: string };
  logoUploadId?: string;
}
export interface Product {
  id: string; name: string; sku: string; barcode?: string; description?: string; categoryId?: string; costPrice: number; salePrice: number; unit: string;
  stock: number; alertThreshold: number; outOfStock: boolean; lowStock: boolean; status: "active" | "archived"; imageUploadId?: string;
}
export interface Category { id: string; name: string }
export interface Party { id: string; name: string; phone?: string; email?: string; address?: string; notes?: string; status: string; balance: number }
export interface SaleLine { productId: string; name: string; sku: string; unit?: string; quantityMilli: number; unitPrice: number; discount: number; total: number; netTotal: number; refundedQtyMilli: number; refundedValue: number }
export interface Payment { id: string; kind: string; direction: "in" | "out"; method: string; amount: number; createdAt: string; note?: string }
export interface Sale {
  id: string; number: string; customerId?: string; customerName?: string; lines: SaleLine[]; lineCount?: number; subtotal: number; discount: number; total: number;
  paidAmount: number; refundedTotal: number; remaining: number; paymentStatus: "paid" | "partial" | "unpaid" | "cancelled"; status: "completed" | "cancelled";
  createdAt: string; cashier?: string; payments?: Payment[]; refunds?: { date: string; reason?: string; value: number; cashRefund: number }[]; cancelReason?: string;
  business?: Business; customer?: { name: string; phone?: string }; ledger?: { consistent: boolean };
}
export interface Purchase { id: string; number: string; supplierId: string; supplierName: string; lines: { name: string; sku: string; quantityMilli: number; receivedMilli: number; unitCost: number; total: number }[]; lineCount?: number; total: number; paidAmount: number; remaining: number; status: "ordered" | "partial" | "received" | "cancelled"; createdAt: string; payments?: Payment[] }
export interface Expense { id: string; category: string; description: string; amount: number; date: string; method?: string; status: "paid" | "payable"; attachmentUploadId?: string }
export interface CashSummary { openingAmount: number; paymentsIn: number; paymentsOut: number; manualIn: number; manualOut: number; expensesOut: number; expected: number }
export interface CashSession { id: string; openedAt: string; closedAt?: string; openingAmount: number; status: "open" | "closed"; expectedAmount: number; countedAmount: number; difference: number; summary?: CashSummary; openedByName?: string; note?: string; entries?: { id: string; type: "in" | "out"; amount: number; reason: string; createdAt: string }[] }
export interface Table { title: string; columns: { key: string; label: string; align?: "left" | "right" }[]; rows: Record<string, string | number | boolean | null>[]; totals?: Record<string, number> }
export interface Notification { type: string; severity: "info" | "warning" | "danger"; message: string }
