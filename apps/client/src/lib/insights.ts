import { fmtDate, money } from "./format";

export interface DashLike {
  summary: { netSales: number; grossMargin: number | null; receivables: number; payables: number; lowStockCount: number; outOfStockCount: number };
  today: { revenue: number; salesCount: number };
  series: { period: string; net: number; count: number }[];
}
export interface Insight { id: string; tone: "info" | "warning" | "danger" | "success"; text: string; cta?: { label: string; to: string } }

/** Conseils du jour calcules a partir des chiffres reels (aucune donnee inventee). */
export function buildInsights(d: DashLike, goal: number, tz: string): Insight[] {
  const out: Insight[] = []; const s = d.summary;
  if (d.today.salesCount === 0) out.push({ id: "no-sale", tone: "info", text: "Aucune vente enregistrée aujourd'hui. Une première vente lance la journée !", cta: { label: "Ouvrir le point de vente", to: "/pos" } });
  else if (goal > 0 && d.today.revenue < goal) out.push({ id: "goal", tone: "info", text: `Plus que ${money(goal - d.today.revenue)} pour atteindre votre objectif du jour.` });
  if (s.outOfStockCount > 0) out.push({ id: "out", tone: "danger", text: `${s.outOfStockCount} produit(s) épuisé(s) : réapprovisionnez pour ne pas perdre de ventes.`, cta: { label: "Voir les stocks", to: "/stock" } });
  else if (s.lowStockCount > 0) out.push({ id: "low", tone: "warning", text: `${s.lowStockCount} produit(s) bientôt en rupture.`, cta: { label: "Voir les alertes", to: "/stock" } });
  if (s.receivables > 0) out.push({ id: "recv", tone: "warning", text: `${money(s.receivables)} restent à encaisser auprès de vos clients.`, cta: { label: "Voir les crédits", to: "/customers" } });
  if (s.payables > 0) out.push({ id: "pay", tone: "info", text: `Vous devez ${money(s.payables)} à vos fournisseurs.`, cta: { label: "Voir les achats", to: "/purchases" } });
  if (s.grossMargin !== null && s.netSales > 0) {
    const pct = Math.round((s.grossMargin / s.netSales) * 100);
    if (pct < 15) out.push({ id: "margin-low", tone: "warning", text: `Votre marge brute estimée est de ${pct} % : vérifiez vos prix de vente et d'achat.`, cta: { label: "Voir les produits", to: "/products" } });
    else if (pct >= 30) out.push({ id: "margin-ok", tone: "success", text: `Belle marge brute estimée : ${pct} % des ventes nettes.` });
  }
  const active = d.series.filter((x) => x.count > 0);
  if (active.length >= 3) { const best = active.reduce((a, b) => (b.net > a.net ? b : a)); out.push({ id: "best", tone: "success", text: `Votre meilleur jour sur la période : ${fmtDate(`${best.period}T12:00:00Z`, tz)} (${money(best.net)}).` }); }
  const order = { danger: 0, warning: 1, info: 2, success: 3 } as const;
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 4);
}
