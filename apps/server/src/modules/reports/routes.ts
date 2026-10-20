import { Router } from "express";
import { z } from "zod";
import { ah } from "../../utils/async-handler.js";
import { requireAuth, requirePermission, requireTenant } from "../../middleware/auth.js";
import { AppError } from "../../utils/errors.js";
import { dateRange } from "../../utils/pagination.js";
import { can, send } from "../../utils/http.js";
import { FORMATS, sendTable } from "../../utils/export.js";
import { addDays, today } from "../../utils/time.js";
import { getSettings, stockAlerts } from "../stock/service.js";
import { Customer } from "../parties/models.js";
import { customerBalances } from "../parties/service.js";
import { CashSession } from "../cash/models.js";
import * as svc from "./service.js";

const q = dateRange.extend({ group: z.enum(["day", "week", "month"]).default("day"), format: z.enum(FORMATS).default("json") });
const FINANCIAL = new Set(["expenses", "collections", "cash-movements", "payables"]);

export function reportsRouter() {
  const r = Router();
  r.use(requireAuth, requireTenant);

  const period = async (req: import("express").Request) => {
    const f = q.parse(req.query); const s = await getSettings(req.tenant!.businessId);
    return { f, p: { businessId: req.tenant!.businessId, tz: s.timezone ?? "Africa/Porto-Novo", from: f.from, to: f.to } };
  };

  r.get("/dashboard", requirePermission("reports.read"), ah(async (req, res) => {
    const { f, p } = await period(req); const fin = can(req, "reports.financial.read");
    const t = today(p.tz);
    const [sum, todaySum, series, top, recent] = await Promise.all([
      svc.summary(p, fin), svc.summary({ ...p, from: t, to: t }, false),
      svc.salesSeries({ ...p, from: p.from ?? addDays(t, -29), to: p.to ?? t }, f.group), svc.topProducts(p, 5), svc.recentActivity(p.businessId),
    ]);
    send(res, { summary: sum, today: { revenue: todaySum.netSales, salesCount: todaySum.salesCount }, series: series.rows, topProducts: top.rows, recent });
  }));

  r.get("/notifications", requireAuth, ah(async (req, res) => {
    const businessId = req.tenant!.businessId; const out: { type: string; severity: "info" | "warning" | "danger"; message: string }[] = [];
    if (can(req, "stock.read")) {
      const a = await stockAlerts(businessId);
      if (a.out.length) out.push({ type: "stock_out", severity: "danger", message: `${a.out.length} produit(s) epuise(s)` });
      if (a.low.length) out.push({ type: "stock_low", severity: "warning", message: `${a.low.length} produit(s) en stock faible` });
    }
    if (can(req, "customers.read")) {
      const days = (await getSettings(businessId)).settings?.creditDueDays ?? 30; const bal = await customerBalances(businessId);
      const limit = Date.now() - days * 86400_000; const late = [...bal.values()].filter((b) => b.oldest && b.oldest.getTime() < limit).length;
      if (late) out.push({ type: "credit_overdue", severity: "warning", message: `${late} client(s) en retard de paiement (> ${days} jours)` });
      void Customer;
    }
    if (can(req, "cash.manage")) {
      const old = await CashSession.countDocuments({ businessId, status: "open", openedAt: { $lt: new Date(Date.now() - 24 * 3600_000) } });
      if (old) out.push({ type: "cash_open", severity: "info", message: `${old} caisse(s) ouverte(s) depuis plus de 24 h` });
    }
    send(res, out);
  }));

  r.get("/:name", ah(async (req, res, next) => {
    const name = String(req.params.name); const fin = can(req, "reports.financial.read");
    const need = FINANCIAL.has(name) ? "reports.financial.read" : "reports.read";
    if (!can(req, need)) return next(new AppError(403, "FORBIDDEN", "Permission insuffisante"));
    const { f, p } = await period(req);
    const handlers: Record<string, () => Promise<svc.Table>> = {
      "sales-series": () => svc.salesSeries(p, f.group), "top-products": () => svc.topProducts(p, 50), "sales-by-employee": () => svc.salesByEmployee(p),
      stock: () => svc.stockReport(p.businessId, fin), "low-stock": () => svc.stockReport(p.businessId, fin, true), receivables: () => svc.receivablesReport(p.businessId),
      payables: () => svc.payablesReport(p.businessId), expenses: () => svc.expensesReport(p), collections: () => svc.collectionsReport(p), "cash-movements": () => svc.cashMovementsReport(p),
    };
    if (name === "summary") return send(res, await svc.summary(p, fin));
    const h = handlers[name]; if (!h) return next(new AppError(404, "NOT_FOUND", "Rapport inconnu"));
    const t = await h();
    if (await sendTable(res, f.format, { title: t.title, filename: name, columns: t.columns, rows: t.rows as never })) return;
    send(res, t);
  }));

  return r;
}
