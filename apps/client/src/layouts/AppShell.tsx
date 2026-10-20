import { useState } from "react";
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, BarChart3, Bell, Boxes, ChevronLeft, ChevronRight, ClipboardList, CreditCard, History, Home, Keyboard, LayoutDashboard, LogOut, Menu, Moon, Package, Plus, Receipt, Search, Settings, ShoppingCart, Sun, Truck, UserCircle, Users, UsersRound, Wallet, Warehouse, X, type IconType } from "../components/icons";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme";
import type { Notification } from "../lib/types";
import { cx } from "../components/ui";
import { CommandPalette } from "../components/CommandPalette";
import { ShortcutsModal, useGlobalShortcuts } from "../components/Shortcuts";

interface NavItem { to: string; label: string; icon: IconType; perm: string; end?: boolean }
const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Ventes & Caisse", items: [
      { to: "/pos", label: "Point de vente", icon: ShoppingCart, perm: "sales.create" }, { to: "/sales", label: "Ventes", icon: Receipt, perm: "sales.read" },
      { to: "/customers", label: "Clients", icon: Users, perm: "customers.read" }, { to: "/cash", label: "Caisse", icon: Banknote, perm: "cash.manage" }]
  },
  {
    title: "Marchandises & Stock", items: [
      { to: "/products", label: "Produits", icon: Package, perm: "products.read" }, { to: "/stock", label: "Stocks", icon: Warehouse, perm: "stock.read" },
      { to: "/purchases", label: "Achats", icon: Boxes, perm: "purchases.read" }, { to: "/suppliers", label: "Fournisseurs", icon: Truck, perm: "suppliers.read" }]
  },
  {
    title: "Gestion & Résultats", items: [
      { to: "/", label: "Tableau de bord", icon: LayoutDashboard, perm: "reports.read", end: true }, { to: "/reports", label: "Rapports", icon: BarChart3, perm: "reports.read" },
      { to: "/expenses", label: "Dépenses", icon: CreditCard, perm: "expenses.read" }]
  },
  {
    title: "Configuration", items: [
      { to: "/members", label: "Employés", icon: UsersRound, perm: "members.manage" }, { to: "/audit", label: "Journal", icon: History, perm: "audit.read" }, { to: "/settings", label: "Paramètres", icon: Settings, perm: "settings.update" }]
  },
];

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-2">
      <motion.div whileHover={{ rotate: -8, scale: 1.08 }} className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-lg shadow-brand-700/40"><ClipboardList className="size-6" /></motion.div>
      {!collapsed && <div className="leading-tight"><p className="text-lg font-semibold tracking-tight text-white">K-Manage</p><p className="text-xs text-slate-400">Gestion de commerce</p></div>}
    </div>
  );
}

function NavList({ collapsed, onNavigate, pillId }: { collapsed?: boolean; onNavigate?: () => void; pillId: string }) {
  const { can, business } = useAuth();
  return (
    <nav aria-label="Navigation principale" className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
      {SECTIONS.map((sec) => {
        const items = sec.items.filter((n) => can(n.perm)); if (!items.length) return null;
        return (
          <div key={sec.title}>
            {!collapsed && <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-widest text-slate-500">{sec.title}</p>}
            <div className="flex flex-col gap-0.5">
              {items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} title={collapsed ? n.label : undefined} className={({ isActive }) => cx("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", collapsed && "justify-center", isActive ? "text-white" : "text-slate-400 hover:bg-white/5 hover:text-white")}>
                  {({ isActive }) => (<>
                    {isActive && <motion.span layoutId={pillId} className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-600/90 to-brand-700/60 shadow-md shadow-brand-700/30 ring-1 ring-white/10" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                    <n.icon className="relative size-[22px]" /><span className={cx("relative", collapsed && "sr-only")}>{n.label}</span>
                  </>)}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
      {!collapsed && business && <p className="mt-auto truncate px-3 pt-2 text-xs text-slate-500">{business.name}</p>}
    </nav>
  );
}

function Notifications() {
  const { activeId } = useAuth(); const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["notifications", activeId], enabled: !!activeId, refetchInterval: 60_000, queryFn: async () => (await api<Notification[]>("GET", "/reports/notifications")).data });
  const n = q.data ?? [];
  return (
    <div className="relative">
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${n.length})`} aria-expanded={open} className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition">
        <Bell className="size-5" />{n.length > 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white">{n.length}</motion.span>}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.14 }} className="absolute right-0 z-40 mt-2 w-80 origin-top-right rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl" role="menu">
            {n.length === 0 ? <p className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">Rien à signaler. Tout est sous contrôle !</p> : n.map((x, i) => (
              <NavLink key={i} to={x.type.startsWith("stock") ? "/stock" : x.type === "credit_overdue" ? "/customers" : "/cash"} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200">
                <span className={cx("size-2.5 shrink-0 rounded-full", x.severity === "danger" ? "bg-red-500" : x.severity === "warning" ? "bg-amber-500" : "bg-brand-500")} />{x.message}
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BottomNav({ onMenu }: { onMenu: () => void }) {
  const { can } = useAuth();
  const items: NavItem[] = [
    { to: "/", label: "Accueil", icon: Home, perm: "reports.read", end: true }, { to: "/pos", label: "Vente", icon: ShoppingCart, perm: "sales.create" },
    { to: "/products", label: "Produits", icon: Package, perm: "products.read" }, { to: "/sales", label: "Ventes", icon: Receipt, perm: "sales.read" },
  ].filter((n) => can(n.perm)).slice(0, 4);
  return (
    <nav aria-label="Navigation mobile" className="no-print fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 backdrop-blur lg:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx("relative flex min-w-14 flex-col items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition", isActive ? "text-brand-600 dark:text-brand-400 font-semibold" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white")}>
          {({ isActive }) => (<>{isActive && <motion.span layoutId="bottom-pill" className="absolute inset-x-2 -top-1.5 h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />}<n.icon className="size-5 sm:size-6" />{n.label}</>)}
        </NavLink>
      ))}
      <button onClick={onMenu} className="flex min-w-14 flex-col items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"><Menu className="size-5 sm:size-6" />Menu</button>
    </nav>
  );
}

function QuickActions() {
  const { can } = useAuth(); const nav = useNavigate(); const [open, setOpen] = useState(false);
  const acts = [
    can("sales.create") && { label: "Nouvelle vente", icon: ShoppingCart, to: "/pos" }, can("products.create") && { label: "Nouveau produit", icon: Package, to: "/products?new=1" },
    can("expenses.create") && { label: "Nouvelle dépense", icon: Wallet, to: "/expenses?new=1" }, can("stock.adjust") && { label: "Mouvement de stock", icon: Warehouse, to: "/stock?new=1" },
  ].filter(Boolean) as { label: string; icon: IconType; to: string }[];
  if (!acts.length) return null;
  return (
    <div className="no-print fixed bottom-20 right-3.5 z-40 flex flex-col items-end gap-2 lg:hidden">
      <AnimatePresence>
        {open && acts.map((a, i) => (
          <motion.button key={a.to} initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: (acts.length - i) * 0.04 } }} exit={{ opacity: 0, y: 8, scale: 0.9, transition: { delay: i * 0.02 } }} onClick={() => { setOpen(false); nav(a.to); }} className="flex items-center gap-3 rounded-full bg-white dark:bg-slate-800 py-2 pl-4 pr-2 text-sm font-medium text-slate-800 dark:text-slate-100 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
            {a.label}<span className="grid size-8 place-items-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-400"><a.icon className="size-4.5" /></span>
          </motion.button>
        ))}
      </AnimatePresence>
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen((o) => !o)} aria-label={open ? "Fermer les actions rapides" : "Actions rapides"} aria-expanded={open} className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-lg shadow-brand-700/30">
        <motion.span animate={{ rotate: open ? 135 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 24 }}><Plus className="size-6" /></motion.span>
      </motion.button>
    </div>
  );
}

export default function AppShell() {
  const { user, business, businesses, activeId, selectBusiness, signOut, can } = useAuth(); const theme = useTheme(); const nav = useNavigate(); const loc = useLocation(); const outlet = useOutlet();
  const [drawer, setDrawer] = useState(false); const [menu, setMenu] = useState(false); const [palette, setPalette] = useState(false); const [help, setHelp] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("km_nav_collapsed") === "1");
  useGlobalShortcuts({ onPalette: () => setPalette(true), onHelp: () => setHelp(true), go: (to) => nav(to), toggleTheme: theme.toggle, can, disabled: palette });
  const toggleCollapse = () => setCollapsed((c) => { localStorage.setItem("km_nav_collapsed", c ? "0" : "1"); return !c; });
  const onPos = loc.pathname === "/pos";
  return (
    <div className="flex h-full">
      <motion.aside initial={false} animate={{ width: collapsed ? 76 : 264 }} transition={{ type: "spring", stiffness: 380, damping: 36 }} className="nav-dark no-print relative hidden shrink-0 flex-col bg-gradient-to-b from-ink to-ink-2 pt-5 lg:flex">
        <Brand collapsed={collapsed} />
        <div className="h-5" /><NavList collapsed={collapsed} pillId="nav-pill" />
        <button onClick={toggleCollapse} aria-label={collapsed ? "Déplier le menu" : "Replier le menu"} className="absolute -right-3 top-8 grid size-6 place-items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:text-brand-700">{collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}</button>
      </motion.aside>
      <AnimatePresence>
        {drawer && (
          <motion.div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/55" onClick={() => setDrawer(false)} />
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", stiffness: 420, damping: 38 }} className="nav-dark absolute inset-y-0 left-0 flex w-72 flex-col bg-gradient-to-b from-ink to-ink-2 pt-5 shadow-xl">
              <button onClick={() => setDrawer(false)} aria-label="Fermer le menu" className="absolute right-3 top-4 rounded-lg p-2 text-slate-400 hover:bg-white/10"><X className="size-5" /></button>
              <Brand /><div className="h-5" /><NavList onNavigate={() => setDrawer(false)} pillId="drawer-pill" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-3 py-2.5 backdrop-blur sm:px-6 transition-colors">
          <button onClick={() => setDrawer(true)} aria-label="Ouvrir le menu" className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition lg:hidden"><Menu className="size-6" /></button>
          {businesses.length > 0 && (
            <select aria-label="Commerce actif" value={activeId ?? ""} onChange={(e) => selectBusiness(e.target.value)} className="max-w-[8.5rem] sm:max-w-xs truncate rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button onClick={() => setPalette(true)} aria-label="Recherche rapide (Ctrl+K)" className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 transition hover:border-brand-500 hover:bg-white dark:hover:bg-slate-700 sm:min-w-60 sm:flex-1 sm:max-w-xs sm:ml-0">
            <Search className="size-4.5 text-brand-600 dark:text-brand-400 shrink-0" /><span className="hidden flex-1 text-left sm:block">Rechercher…</span><kbd className="hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-xs text-slate-500 dark:text-slate-400 sm:block font-mono">Ctrl K</kbd>
          </button>
          <div className="flex items-center gap-0.5 sm:gap-1 sm:ml-auto">
            <motion.button whileTap={{ scale: 0.85, rotate: 20 }} onClick={theme.toggle} aria-label={theme.resolved === "dark" ? "Passer en mode clair" : "Passer en mode sombre"} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition">
              <AnimatePresence mode="wait" initial={false}><motion.span key={theme.resolved} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }} className="block">{theme.resolved === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}</motion.span></AnimatePresence>
            </motion.button>
            <button onClick={() => setHelp(true)} aria-label="Raccourcis clavier" className="hidden rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition md:block"><Keyboard className="size-5" /></button>
            <Notifications />
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu du profil" className="flex items-center gap-2 rounded-xl p-1 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition">
                <UserCircle className="size-7 sm:size-8 text-brand-600 dark:text-brand-400" /><span className="hidden max-w-[8rem] truncate text-sm font-medium text-slate-800 dark:text-slate-200 sm:block">{user?.fullName}</span>
              </button>
              <AnimatePresence>
                {menu && (
                  <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.14 }} className="absolute right-0 z-40 mt-2 w-60 origin-top-right rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl" role="menu">
                    <p className="truncate px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{user?.email}{business ? ` — ${business.role}` : ""}</p>
                    <NavLink to="/profile" onClick={() => setMenu(false)} className="block rounded-xl px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200">Mon profil et sécurité</NavLink>
                    <button onClick={() => { setMenu(false); void signOut(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><LogOut className="size-5" />Se déconnecter</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
        <main className={cx("min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-grain p-3 sm:p-6", !onPos && "pb-36 lg:pb-8")}>
          <div className="mx-auto max-w-7xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={loc.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: "easeOut" }}>{outlet}</motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      {!onPos && <><BottomNav onMenu={() => setDrawer(true)} /><QuickActions /></>}
      <CommandPalette open={palette} onClose={() => setPalette(false)} onHelp={() => setHelp(true)} />
      <ShortcutsModal open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
