import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { api, qs } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { getRecents, pushRecent } from "../lib/prefs";
import { money } from "../lib/format";
import { ArrowRight, Banknote, BarChart3, Boxes, Command, CreditCard, Fire, History, Keyboard, LayoutDashboard, LogOut, Moon, Package, Receipt, ScrollText, Search, Settings, ShoppingCart, Sun, Tags, Truck, Users, UsersRound, Warehouse, Wallet, type IconType } from "./icons";
import { cx } from "./ui";

interface Cmd { id: string; group: string; label: string; hint?: string; icon: IconType; run: () => void; keywords?: string }
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function CommandPalette({ open, onClose, onHelp }: { open: boolean; onClose: () => void; onHelp: () => void }) {
  const { can, activeId, signOut } = useAuth(); const nav = useNavigate(); const theme = useTheme();
  const [q, setQ] = useState(""); const [idx, setIdx] = useState(0); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setIdx(0); setTimeout(() => input.current?.focus(), 30); } }, [open]);

  const go = (to: string, label: string) => () => { pushRecent(activeId, { to, label }); nav(to); onClose(); };
  const pages: Cmd[] = useMemo(() => [
    { id: "p-dash", group: "Aller à", label: "Tableau de bord", icon: LayoutDashboard, run: go("/", "Tableau de bord"), keywords: "accueil resume", hint: "G puis D" },
    { id: "p-pos", group: "Aller à", label: "Point de vente", icon: ShoppingCart, run: go("/pos", "Point de vente"), keywords: "caisse vendre encaisser", hint: "N" },
    { id: "p-prod", group: "Aller à", label: "Produits", icon: Package, run: go("/products", "Produits"), keywords: "catalogue articles", hint: "G puis P" },
    { id: "p-stock", group: "Aller à", label: "Stocks", icon: Warehouse, run: go("/stock", "Stocks"), keywords: "inventaire mouvements alertes", hint: "G puis S" },
    { id: "p-sales", group: "Aller à", label: "Ventes", icon: Receipt, run: go("/sales", "Ventes"), keywords: "historique recus", hint: "G puis V" },
    { id: "p-cust", group: "Aller à", label: "Clients", icon: Users, run: go("/customers", "Clients"), keywords: "credits dettes creances", hint: "G puis C" },
    { id: "p-sup", group: "Aller à", label: "Fournisseurs", icon: Truck, run: go("/suppliers", "Fournisseurs") },
    { id: "p-pur", group: "Aller à", label: "Achats", icon: Boxes, run: go("/purchases", "Achats"), keywords: "commandes reception" },
    { id: "p-exp", group: "Aller à", label: "Dépenses", icon: CreditCard, run: go("/expenses", "Dépenses"), keywords: "charges loyer" },
    { id: "p-cash", group: "Aller à", label: "Caisse", icon: Banknote, run: go("/cash", "Caisse"), keywords: "ouverture cloture ecart", hint: "G puis K" },
    { id: "p-rep", group: "Aller à", label: "Rapports", icon: BarChart3, run: go("/reports", "Rapports"), keywords: "export excel pdf marge", hint: "G puis R" },
    { id: "p-mem", group: "Aller à", label: "Employés", icon: UsersRound, run: go("/members", "Employés") },
    { id: "p-aud", group: "Aller à", label: "Journal d'audit", icon: ScrollText, run: go("/audit", "Journal d'audit") },
    { id: "p-set", group: "Aller à", label: "Paramètres", icon: Settings, run: go("/settings", "Paramètres") },
  ].filter((c) => ({ "p-dash": can("reports.read"), "p-pos": can("sales.create"), "p-prod": can("products.read"), "p-stock": can("stock.read"), "p-sales": can("sales.read"), "p-cust": can("customers.read"), "p-sup": can("suppliers.read"), "p-pur": can("purchases.read"), "p-exp": can("expenses.read"), "p-cash": can("cash.manage"), "p-rep": can("reports.read"), "p-mem": can("members.manage"), "p-aud": can("audit.read"), "p-set": can("settings.update") } as Record<string, boolean>)[c.id]),

  [can, activeId]);
  const actions: Cmd[] = useMemo(() => [
    ...(can("sales.create") ? [{ id: "a-sale", group: "Actions", label: "Nouvelle vente", icon: ShoppingCart, run: go("/pos", "Point de vente"), keywords: "vendre" }] : []),
    ...(can("products.create") ? [{ id: "a-prod", group: "Actions", label: "Nouveau produit", icon: Package, run: go("/products?new=1", "Nouveau produit"), keywords: "ajouter article" }] : []),
    ...(can("expenses.create") ? [{ id: "a-exp", group: "Actions", label: "Enregistrer une dépense", icon: Wallet, run: go("/expenses?new=1", "Nouvelle dépense") }] : []),
    ...(can("stock.adjust") ? [{ id: "a-stock", group: "Actions", label: "Mouvement de stock", icon: Warehouse, run: go("/stock?new=1", "Mouvement de stock"), keywords: "entree sortie ajustement" }] : []),
    ...(can("cash.manage") ? [{ id: "a-cash", group: "Actions", label: "Ouvrir / gérer la caisse", icon: Banknote, run: go("/cash", "Caisse") }] : []),
    ...(can("products.read") ? [{ id: "a-cat", group: "Actions", label: "Gérer les catégories", icon: Tags, run: go("/products", "Produits") }] : []),
    { id: "a-theme", group: "Préférences", label: theme.resolved === "dark" ? "Passer en mode clair" : "Passer en mode sombre", icon: theme.resolved === "dark" ? Sun : Moon, run: () => { theme.toggle(); onClose(); }, hint: "T", keywords: "theme sombre clair nuit" },
    { id: "a-help", group: "Préférences", label: "Raccourcis clavier", icon: Keyboard, run: () => { onClose(); onHelp(); }, hint: "?" },
    { id: "a-out", group: "Préférences", label: "Se déconnecter", icon: LogOut, run: () => { onClose(); void signOut(); } },

  ], [can, theme.resolved, activeId]);

  const term = norm(q.trim());
  const remote = useQuery({
    queryKey: ["palette", activeId, term], enabled: open && term.length >= 2, staleTime: 10_000,
    queryFn: async () => {
      const [p, c, s] = await Promise.all([
        can("products.read") ? api<{ id: string; name: string; sku: string; salePrice: number }[]>("GET", `/catalog/products${qs({ q: q.trim(), limit: 5 })}`).then((r) => r.data).catch(() => []) : [],
        can("customers.read") ? api<{ id: string; name: string; balance: number }[]>("GET", `/parties/customers${qs({ q: q.trim(), limit: 4 })}`).then((r) => r.data).catch(() => []) : [],
        can("sales.read") ? api<{ id: string; number: string; total: number; customerName?: string }[]>("GET", `/sales${qs({ q: q.trim(), limit: 4 })}`).then((r) => r.data).catch(() => []) : [],
      ]);
      return { p, c, s };
    },
  });
  const items: Cmd[] = useMemo(() => {
    if (!term) {
      const rec = getRecents(activeId).map((r, i): Cmd => ({ id: `r-${i}`, group: "Récents", label: r.label, icon: History, run: () => { nav(r.to); onClose(); } }));
      return [...rec, ...actions.filter((a) => ["a-sale", "a-prod", "a-exp"].includes(a.id)), ...pages.slice(0, 8)];
    }
    const match = (c: Cmd) => norm(`${c.label} ${c.keywords ?? ""}`).includes(term);
    const live: Cmd[] = [
      ...(remote.data?.p ?? []).map((p): Cmd => ({ id: `lp-${p.id}`, group: "Produits", label: p.name, hint: `${p.sku} · ${money(p.salePrice)}`, icon: Package, run: go(`/products?q=${encodeURIComponent(p.sku)}`, p.name) })),
      ...(remote.data?.c ?? []).map((c): Cmd => ({ id: `lc-${c.id}`, group: "Clients", label: c.name, hint: c.balance > 0 ? `doit ${money(c.balance)}` : undefined, icon: Users, run: go(`/customers?q=${encodeURIComponent(c.name)}`, c.name) })),
      ...(remote.data?.s ?? []).map((s): Cmd => ({ id: `ls-${s.id}`, group: "Ventes", label: s.number, hint: `${s.customerName ?? "Passage"} · ${money(s.total)}`, icon: Receipt, run: go(`/sales?q=${encodeURIComponent(s.number)}`, s.number) })),
    ];
    return [...pages.filter(match), ...actions.filter(match), ...live];

  }, [term, pages, actions, remote.data, activeId]);
  useEffect(() => setIdx(0), [term]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); items[idx]?.run(); }
    else if (e.key === "Escape") onClose();
  };
  useEffect(() => { document.getElementById(`cmd-${idx}`)?.scrollIntoView?.({ block: "nearest" }); }, [idx]);
  let lastGroup = "";
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="no-print fixed inset-0 z-[65] flex items-start justify-center bg-black/55 px-3 pt-4 sm:px-4 sm:pt-[12vh] backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div role="dialog" aria-modal="true" aria-label="Recherche rapide" initial={{ opacity: 0, y: -16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} transition={{ type: "spring", stiffness: 480, damping: 34 }}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onKeyDown={onKey}>
            <div className="flex items-center gap-2.5 sm:gap-3 border-b border-slate-100 px-3.5 sm:px-4">
              <Search className="size-5 shrink-0 text-brand-700" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} role="combobox" aria-expanded aria-controls="cmd-list" aria-activedescendant={`cmd-${idx}`} aria-label="Rechercher une page, un produit, un client ou une vente" placeholder="Rechercher une page, un produit, un client, une vente…" className="w-full bg-transparent py-3 sm:py-4 text-sm sm:text-base text-slate-900 outline-none placeholder:text-slate-400" />
              <kbd className="hidden rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 sm:block">Échap</kbd>
            </div>
            <ul id="cmd-list" role="listbox" className="scroll-thin max-h-[60vh] sm:max-h-[52vh] overflow-y-auto p-2">
              {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">{remote.isFetching ? "Recherche…" : "Aucun résultat. Essayez un autre mot."}</li>}
              {items.map((c, i) => {
                const showHeader = c.group !== lastGroup;
                if (showHeader) lastGroup = c.group;
                return (
                  <div key={c.id}>
                    {showHeader && <div role="presentation" className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{c.group}</div>}
                    <div role="presentation">
                      <button id={`cmd-${i}`} role="option" aria-selected={i === idx} onMouseMove={() => setIdx(i)} onClick={c.run} className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition">
                        {i === idx && <motion.span layoutId="cmd-active" className="absolute inset-0 rounded-xl bg-brand-50" transition={{ type: "spring", stiffness: 600, damping: 40 }} />}
                        <span className={cx("relative grid size-8 shrink-0 place-items-center rounded-lg", i === idx ? "bg-white text-brand-700 shadow-sm" : "bg-slate-100 text-slate-600")}><c.icon className="size-[18px]" /></span>
                        <span className="relative min-w-0 flex-1 truncate font-medium text-slate-800">{c.label}</span>
                        {c.hint && <span className="relative shrink-0 text-xs text-slate-400">{c.hint}</span>}
                        {i === idx && <ArrowRight className="relative size-4 text-brand-700" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500"><span className="flex items-center gap-1"><Command className="size-3.5" /> Navigation rapide</span><span>↑↓ choisir · Entrée ouvrir</span></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
void Fire;
