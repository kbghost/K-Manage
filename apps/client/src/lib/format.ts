import { formatXOF } from "@k-manage/shared";

export const money = (n: number | null | undefined) => (n === null || n === undefined ? "—" : formatXOF(Math.round(n)));
export const qty = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(n);
export const DEFAULT_TZ = "Africa/Porto-Novo";
export const fmtDateTime = (d: string | Date, tz = DEFAULT_TZ) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: tz }).format(new Date(d));
export const fmtDate = (d: string | Date, tz = DEFAULT_TZ) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: tz }).format(new Date(d));
export const todayStr = (tz = DEFAULT_TZ) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
export const addDaysStr = (s: string, n: number) => { const [y, m, d] = s.split("-").map(Number) as [number, number, number]; return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const METHOD_LABELS: Record<string, string> = { cash: "Especes", transfer: "Virement", mobile_money: "Mobile Money", card: "Carte" };
export const methodLabel = (m: string) => METHOD_LABELS[m] ?? m.replace(/_/g, " ");
/** Conversion d'un texte saisi (« 1 500 », « 1500 ») en entier FCFA. */
export const parseMoney = (s: string) => { const d = s.replace(/[^\d]/g, ""); return d ? Math.min(Number(d), 1_000_000_000) : 0; };
