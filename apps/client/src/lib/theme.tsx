import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "km_theme";
const systemDark = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
export const resolveTheme = (c: ThemeChoice) => (c === "system" ? (systemDark() ? "dark" : "light") : c);

interface Ctx { choice: ThemeChoice; resolved: "light" | "dark"; setChoice: (c: ThemeChoice) => void; toggle: () => void }
const ThemeCtx = createContext<Ctx | null>(null);
export const useTheme = () => { const c = useContext(ThemeCtx); if (!c) throw new Error("ThemeProvider manquant"); return c; };

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => (localStorage.getItem(KEY) as ThemeChoice | null) ?? "light");
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolveTheme(choice));
  useEffect(() => {
    const apply = () => { const r = resolveTheme(choice); setResolved(r); document.documentElement.classList.toggle("dark", r === "dark"); };
    apply();
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", apply); return () => mq?.removeEventListener?.("change", apply);
  }, [choice]);
  const setChoice = useCallback((c: ThemeChoice) => { localStorage.setItem(KEY, c); setChoiceState(c); }, []);
  const toggle = useCallback(() => setChoice(resolved === "dark" ? "light" : "dark"), [resolved, setChoice]);
  const value = useMemo(() => ({ choice, resolved, setChoice, toggle }), [choice, resolved, setChoice, toggle]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
