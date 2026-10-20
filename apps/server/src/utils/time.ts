/** Decalage (ms) de `tz` par rapport a UTC a l'instant `at`. */
export function tzOffsetMs(at: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(at));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(at / 1000) * 1000;
}

/** Debut du jour `YYYY-MM-DD` dans le fuseau `tz`, en Date UTC. */
export function startOfDay(dateStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - tzOffsetMs(guess, tz));
}

export function dayKey(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function today(tz: string): string { return dayKey(new Date(), tz); }

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Bornes [from, to) en Date UTC pour une periode de jours inclusifs. */
export function periodBounds(from: string | undefined, to: string | undefined, tz: string) {
  const t = today(tz);
  const f = from ?? t;
  const e = to ?? f;
  return { from: startOfDay(f, tz), to: startOfDay(addDays(e, 1), tz), fromStr: f, toStr: e };
}

export function groupKey(date: Date, tz: string, group: "day" | "week" | "month"): string {
  const k = dayKey(date, tz);
  if (group === "day") return k;
  if (group === "month") return k.slice(0, 7);
  const [y, m, d] = k.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // lundi = 0
  return addDays(k, -dow);
}
