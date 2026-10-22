import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, session } from "./api";
import type { Business, BusinessSummary, User } from "./types";

interface Ctx {
  user: User | null; loading: boolean;
  businesses: BusinessSummary[]; business: Business | null; businessLoading: boolean;
  activeId: string | null; selectBusiness: (id: string) => void;
  can: (p: string) => boolean;
  signIn: (path: "login" | "register", body: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => { const c = useContext(AuthCtx); if (!c) throw new Error("AuthProvider manquant"); return c; };

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(session.business());
  const me = useQuery({
    queryKey: ["me"], retry: false, staleTime: 60_000,
    queryFn: async () => { try { const { data } = await api<User>("GET", "/auth/me"); session.setCsrf(data.csrfToken ?? null); return data; } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; } },
  });
  const user = me.data ?? null;
  const list = useQuery({ queryKey: ["businesses"], enabled: !!user, queryFn: async () => (await api<BusinessSummary[]>("GET", "/businesses")).data });
  const businesses = useMemo(() => list.data ?? [], [list.data]);

  // Le commerce actif doit toujours etre un commerce dont l'utilisateur est membre.
  useEffect(() => {
    if (!list.data) return;
    const valid = list.data.some((b) => b.id === activeId);
    const next = valid ? activeId : (list.data[0]?.id ?? null);
    if (next !== activeId) { session.setBusiness(next); setActiveId(next); }
  }, [list.data, activeId]);

  const biz = useQuery({
    queryKey: ["business", activeId], enabled: !!user && !!activeId && businesses.some((b) => b.id === activeId), retry: false,
    queryFn: async () => (await api<Business>("GET", "/businesses/current")).data,
  });

  const selectBusiness = useCallback((id: string) => { session.setBusiness(id); setActiveId(id); qc.removeQueries({ predicate: (q) => !["me", "businesses"].includes(String(q.queryKey[0])) }); }, [qc]);
  const signIn: Ctx["signIn"] = useCallback(async (path, body) => {
    const { data } = await api<User>("POST", `/auth/${path}`, body, { tenant: false });
    session.setCsrf(data.csrfToken ?? null);
    qc.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
    qc.setQueryData(["me"], data);
  }, [qc]);
  const signOut = useCallback(async () => {
    try { await api("POST", "/auth/logout"); } catch { /* deja deconnecte */ }
    session.setCsrf(null); qc.clear(); qc.setQueryData(["me"], null);
  }, [qc]);

  useEffect(() => { const h = () => { qc.setQueryData(["me"], null); }; window.addEventListener("km:unauthorized", h); return () => window.removeEventListener("km:unauthorized", h); }, [qc]);

  const business = biz.data ?? null;
  const can = useCallback((p: string) => !!business?.permissions.includes(p), [business]);
  const value: Ctx = { user, loading: me.isLoading, businesses, business, businessLoading: list.isLoading || biz.isLoading, activeId, selectBusiness, can, signIn, signOut };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
