import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "../components/icons";
import { api, download, qs } from "../lib/api";
import { useAuth } from "../lib/auth";
import { addDaysStr, money, qty, todayStr } from "../lib/format";
import type { Table } from "../lib/types";
import { Button, Card, EmptyState, ErrorState, Input, PageHeader, Select, Spinner, cx, errMsg, useToast } from "../components/ui";

const REPORTS = [
  { k: "sales-series", label: "Ventes au fil des jours", perm: "reports.read", period: true, group: true },
  { k: "top-products", label: "Articles les plus vendus", perm: "reports.read", period: true },
  { k: "sales-by-employee", label: "Ventes par caissier / employé", perm: "reports.read", period: true },
  { k: "collections", label: "Argent réellement perçu", perm: "reports.financial.read", period: true },
  { k: "expenses", label: "Dépenses de la boutique", perm: "reports.financial.read", period: true },
  { k: "cash-movements", label: "Entrées et retraits de caisse", perm: "reports.financial.read", period: true },
  { k: "stock", label: "Valeur de votre stock en rayon", perm: "reports.read" },
  { k: "low-stock", label: "Articles en rupture ou presque vides", perm: "reports.read" },
  { k: "receivables", label: "Ce qu'on vous doit (Crédits clients)", perm: "reports.read" },
  { k: "payables", label: "Ce que vous devez (Dettes grossistes)", perm: "reports.financial.read" },
];
const MONEY = new Set(["amount", "net", "gross", "refunds", "balance", "value", "costPrice", "salePrice", "revenue"]);
const cell = (key: string, v: string | number | boolean | null) => (v === null || v === "" ? "" : typeof v === "number" ? (MONEY.has(key) ? money(v) : qty(v)) : String(v));
interface Summary { grossSales: number; refunds: number; netSales: number; collected: number; cogs: number | null; grossMargin: number | null; expenses: number | null; salesCount: number; discounts: number }

export default function Reports() {
  const { can, business } = useAuth(); const toast = useToast(); const tz = business?.timezone; const avail = REPORTS.filter((r) => can(r.perm));
  const [key, setKey] = useState(avail[0]?.k ?? "stock"); const [from, setFrom] = useState(addDaysStr(todayStr(tz), -29)); const [to, setTo] = useState(todayStr(tz)); const [group, setGroup] = useState("day");
  const def = REPORTS.find((r) => r.k === key)!; const params = def.period ? { from, to, ...(def.group ? { group } : {}) } : {};
  const q = useQuery({ queryKey: ["report", business?.id, key, params], queryFn: async () => (await api<Table>("GET", `/reports/${key}${qs(params)}`)).data });
  const sum = useQuery({ queryKey: ["report-summary", business?.id, from, to], enabled: !!def.period, queryFn: async () => (await api<Summary>("GET", `/reports/summary${qs({ from, to })}`)).data });
  const exp = (format: string) => download(`/reports/${key}${qs({ ...params, format })}`, `${key}.${format}`).catch((e) => toast("error", errMsg(e)));
  const t = q.data;

  return (
    <>
      <PageHeader title="Rapports" subtitle="Tous vos chiffres en clair, avec filtres par période et téléchargement Excel ou PDF." actions={<div className="flex"><Button variant="secondary" className="rounded-r-none" onClick={() => void exp("csv")}><Download className="size-4" />CSV</Button><Button variant="secondary" className="-ml-px rounded-none" onClick={() => void exp("xlsx")}>Excel</Button><Button variant="secondary" className="-ml-px rounded-l-none" onClick={() => void exp("pdf")}>PDF</Button></div>} />
      <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
        <div className="lg:hidden">
          <Select label="Choisir le rapport à consulter" value={key} onChange={(e) => setKey(e.target.value)}>
            {avail.map((r) => <option key={r.k} value={r.k}>{r.label}</option>)}
          </Select>
        </div>
        <nav aria-label="Rapports" className="hidden lg:flex flex-col gap-1">
          {avail.map((r) => (
            <button key={r.k} onClick={() => setKey(r.k)} aria-current={key === r.k} className={cx("rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition", key === r.k ? "bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-brand-300 font-bold shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800")}>
              {r.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          {def.period && (
            <Card>
              <div className="flex flex-wrap items-end gap-2.5 sm:gap-3">
                <Input label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="flex-1 min-w-[130px] sm:w-40 sm:flex-initial" />
                <Input label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="flex-1 min-w-[130px] sm:w-40 sm:flex-initial" />
                {def.group && (
                  <Select label="Regrouper par" value={group} onChange={(e) => setGroup(e.target.value)} className="flex-1 min-w-[120px] sm:w-36 sm:flex-initial">
                    <option value="day">Jour par jour</option>
                    <option value="week">Par semaine</option>
                    <option value="month">Par mois</option>
                  </Select>
                )}
                <div className="flex flex-wrap gap-1.5 pb-0.5">
                  {[["Aujourd'hui", 0], ["7 derniers jours", 6], ["30 derniers jours", 29]].map(([l, d]) => (
                    <Button key={String(l)} variant="secondary" size="sm" onClick={() => { setTo(todayStr(tz)); setFrom(addDaysStr(todayStr(tz), -Number(d))); }}>
                      {l}
                    </Button>
                  ))}
                </div>
              </div>

              {sum.data && (
                <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 border-t border-slate-100 dark:border-slate-800 pt-4 text-sm sm:grid-cols-4">
                  {([
                    ["Nombre de ventes", `${sum.data.salesCount} vente(s)`],
                    ["Total des ventes", money(sum.data.grossSales)],
                    ["Remboursements", money(sum.data.refunds)],
                    ["Ventes nettes", money(sum.data.netSales)],
                    ["Argent encaissé", money(sum.data.collected)],
                    ...(sum.data.cogs !== null ? [
                      ["Coût d'achat des articles", money(sum.data.cogs)],
                      ["Bénéfice estimé (Gain)", money(sum.data.grossMargin)],
                      ["Dépenses du magasin", money(sum.data.expenses)],
                    ] : []),
                  ] as [string, string][]).map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-2.5">
                      <dt className="text-xs text-slate-500 dark:text-slate-400 font-medium">{l}</dt>
                      <dd className="font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-0.5 text-sm sm:text-base">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
          )}

          <Card title={t?.title ?? def.label}>
            {q.isLoading ? (
              <Spinner label="Calcul de votre rapport..." />
            ) : q.error ? (
              <ErrorState error={q.error} retry={() => void q.refetch()} />
            ) : !t || t.rows.length === 0 ? (
              <EmptyState title="Aucune donnée enregistrée" text="Il n'y a aucun résultat pour cette période ou ces critères." />
            ) : (
              <>
                {/* ─── Vue mobile : fiches claires avec totaux ─── */}
                <div className="space-y-2.5 md:hidden">
                  {t.rows.map((r, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        {cell(t.columns[0]?.key ?? "", r[t.columns[0]?.key ?? ""] ?? null)}
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {t.columns.slice(1).map((c) => (
                          <div key={c.key} className="flex items-center justify-between gap-2 py-0.5">
                            <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">{c.label}</span>
                            <span className={cx("font-semibold text-slate-800 dark:text-slate-200", c.align === "right" && "tabular-nums text-right")}>
                              {cell(c.key, r[c.key] ?? null)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {t.totals && (
                    <div className="rounded-2xl border-2 border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-950/30 p-3.5 shadow-sm space-y-2 mt-4">
                      <p className="text-xs font-extrabold uppercase tracking-wide text-brand-800 dark:text-brand-300 border-b border-brand-200 dark:border-brand-800/60 pb-1.5">
                        Total général
                      </p>
                      <div className="space-y-1.5 text-xs">
                        {t.columns.map((c) => {
                          if (!(c.key in t.totals!)) return null;
                          return (
                            <div key={c.key} className="flex items-center justify-between gap-2 py-0.5">
                              <span className="text-slate-600 dark:text-slate-400 font-bold">{c.label}</span>
                              <span className="font-extrabold text-slate-900 dark:text-white tabular-nums text-right text-sm">
                                {cell(c.key, t.totals![c.key] ?? 0)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── Vue bureau : grand tableau tabulaire ─── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[500px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                        {t.columns.map((c) => (
                          <th key={c.key} scope="col" className={cx("px-3 py-2.5 font-medium", c.align === "right" ? "text-right" : "text-left")}>
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/60 last:border-0">
                          {t.columns.map((c) => (
                            <td key={c.key} className={cx("px-3 py-2.5", c.align === "right" && "text-right tabular-nums")}>
                              {cell(c.key, r[c.key] ?? null)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {t.totals && (
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 bg-slate-50/60 dark:bg-slate-800/40">
                          {t.columns.map((c, i) => (
                            <td key={c.key} className={cx("px-3 py-2.5", c.align === "right" && "text-right tabular-nums")}>
                              {t.totals && c.key in t.totals ? cell(c.key, t.totals[c.key] ?? 0) : i === 0 ? "TOTAL" : ""}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            )}
          </Card>
          <p className="text-xs text-slate-500">
            Règles de calcul : Les ventes annulées ne sont pas comptées. Le bénéfice estimé correspond aux ventes diminuées du prix auquel vous avez acheté les marchandises.
          </p>
        </div>
      </div>
    </>
  );
}
