/**
 * Preferences et habitudes de l'utilisateur, stockees localement par commerce (jamais d'informations sensibles).
 * Alimentent : favoris du point de vente, objectif du jour, recents de la palette, checklist de demarrage.
 */
const k = (biz: string | null, name: string) => `km:${biz ?? "none"}:${name}`;
const read = <T,>(key: string, fallback: T): T => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* stockage plein ou desactive */ } };

// ── Produits frequents (point de vente)
export interface FreqProduct { id: string; name: string; n: number; last: number }
export function bumpFrequent(biz: string | null, p: { id: string; name: string }) {
  const m = read<Record<string, FreqProduct>>(k(biz, "freq"), {});
  const cur = m[p.id]; m[p.id] = { id: p.id, name: p.name, n: (cur?.n ?? 0) + 1, last: Date.now() };
  const top = Object.values(m).sort((a, b) => b.n - a.n || b.last - a.last).slice(0, 30);
  write(k(biz, "freq"), Object.fromEntries(top.map((x) => [x.id, x])));
}
export const topFrequent = (biz: string | null, n = 6): FreqProduct[] => Object.values(read<Record<string, FreqProduct>>(k(biz, "freq"), {})).sort((a, b) => b.n - a.n || b.last - a.last).slice(0, n);

// ── Objectif de ventes du jour
export const getGoal = (biz: string | null) => read<number>(k(biz, "goal"), 0);
export const setGoal = (biz: string | null, v: number) => write(k(biz, "goal"), Math.max(0, Math.round(v)));
export const celebratedToday = (biz: string | null, day: string) => read<string>(k(biz, "celebrated"), "") === day;
export const markCelebrated = (biz: string | null, day: string) => write(k(biz, "celebrated"), day);

// ── Checklist de demarrage
export const checklistDismissed = (biz: string | null) => read<boolean>(k(biz, "checklist-off"), false);
export const dismissChecklist = (biz: string | null) => write(k(biz, "checklist-off"), true);

// ── Elements recents (palette de commandes)
export interface Recent { to: string; label: string; at: number }
export const getRecents = (biz: string | null): Recent[] => read<Recent[]>(k(biz, "recents"), []);
export function pushRecent(biz: string | null, r: Omit<Recent, "at">) {
  const list = [{ ...r, at: Date.now() }, ...getRecents(biz).filter((x) => x.to !== r.to)].slice(0, 6); write(k(biz, "recents"), list);
}

/** Serie de jours consecutifs avec au moins une vente, en partant d'aujourd'hui (ou d'hier si aujourd'hui est vide). */
export function computeStreak(series: { period: string; count: number }[], today: string): number {
  const days = new Set(series.filter((s) => s.count > 0).map((s) => s.period));
  const prev = (d: string) => { const [y, m, dd] = d.split("-").map(Number) as [number, number, number]; return new Date(Date.UTC(y, m - 1, dd - 1)).toISOString().slice(0, 10); };
  let cur = days.has(today) ? today : prev(today); let n = 0;
  while (days.has(cur)) { n++; cur = prev(cur); }
  return n;
}
export const greeting = (hour: number) => (hour < 5 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon apres-midi" : "Bonsoir");
