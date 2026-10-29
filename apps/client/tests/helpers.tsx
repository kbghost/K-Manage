import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { MotionConfig } from "motion/react";
import { AuthProvider } from "../src/lib/auth";
import { ThemeProvider } from "../src/lib/theme";
import { ToastProvider } from "../src/components/ui";

export const BUSINESS = {
  id: "b1", name: "Boutique Test", currency: "XOF", timezone: "Africa/Porto-Novo", role: "owner",
  permissions: ["products.read", "products.create", "products.update", "sales.create", "sales.read", "sales.discount", "customers.read", "customers.manage", "cash.manage", "reports.read", "stock.read", "settings.update"],
  settings: { allowNegativeStock: false, allowAnonymousSales: true, lowStockDefault: 5, paymentMethods: ["cash", "transfer"], creditDueDays: 30 },
  receipt: { header: "", footer: "Merci", paperWidth: "80mm", showTaxId: "" },
};
export const PRODUCTS = [
  { id: "p1", name: "Riz 5 kg", sku: "RIZ5", unit: "piece", salePrice: 3800, costPrice: 3200, stock: 10, alertThreshold: 2, outOfStock: false, lowStock: false, status: "active" },
  { id: "p2", name: "Sucre 1 kg", sku: "SUCRE", unit: "piece", salePrice: 800, costPrice: 650, stock: 0, alertThreshold: 2, outOfStock: true, lowStock: false, status: "active" },
];

type Routes = Record<string, (init?: RequestInit) => { status?: number; body?: unknown }>;
/** Simule l'API : { "GET /auth/me": () => ({ body: {...} }) } */
export function mockApi(routes: Routes) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace("/api/v1", "").split("?")[0]!; const method = init?.method ?? "GET";
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const h = routes[`${method} ${path}`];
    if (!h) return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: `non simule: ${method} ${path}` } }), { status: 404 });
    const r = h(init); const status = r.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(r.body ?? { data: null }), { status, headers: { "Content-Type": "application/json" } });
  }));
  return calls;
}
export const loggedIn: Routes = {
  "GET /auth/me": () => ({ body: { data: { id: "u1", email: "a@b.bj", fullName: "Awa Test", csrfToken: "csrf" } } }),
  "GET /businesses": () => ({ body: { data: [{ id: "b1", name: "Boutique Test", role: "owner", currency: "XOF" }] } }),
  "GET /businesses/current": () => ({ body: { data: BUSINESS } }),
  "GET /billing/current": () => ({ body: { data: { status: "trial", access: true, trialEndsAt: "2026-11-29T00:00:00.000Z", currentPeriodEndsAt: null, monthlyPrice: 7000, currency: "XOF", businessName: "Boutique Test", isOwner: true, paymentConfigured: false, payments: [] } } }),
  "GET /reports/notifications": () => ({ body: { data: [] } }),
};

export function renderApp(ui: ReactNode, route = "/") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[route]}><ThemeProvider><MotionConfig reducedMotion="always"><ToastProvider><AuthProvider>{ui}</AuthProvider></ToastProvider></MotionConfig></ThemeProvider></MemoryRouter></QueryClientProvider>);
}
