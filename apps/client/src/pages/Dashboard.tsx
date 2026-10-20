import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Banknote, CheckCircle2, Confetti as ConfettiIcon, Fire, HandCoins, Lightbulb, PackageX, Pencil, Percent, Receipt, Rocket, ShoppingBag, Target, TrendingUp, Truck, Wallet } from "../components/icons";
import { useData, useList } from "../lib/hooks";
import { useAuth } from "../lib/auth";
import { addDaysStr, fmtDateTime, money, qty, todayStr } from "../lib/format";
import { celebratedToday, checklistDismissed, computeStreak, dismissChecklist, getGoal, greeting, markCelebrated, setGoal } from "../lib/prefs";
import { buildInsights } from "../lib/insights";
import { Badge, Button, Card, ErrorState, Modal, MoneyInput, PageHeader, Skeleton, StatCard, cx } from "../components/ui";
import { Confetti, Item, ProgressRing, Stagger } from "../components/motion";

interface Dash {
  summary: { salesCount: number; netSales: number; collected: number; grossMargin: number | null; expenses: number | null; receivables: number; payables: number; lowStockCount: number; outOfStockCount: number; refunds: number };
  today: { revenue: number; salesCount: number };
  series: { period: string; net: number; count: number }[];
  topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
  recent: { kind: string; label: string; amount: number; at: string; status?: string }[];
}
const KIND = { sale: "Vente", purchase: "Achat fournisseur", expense: "Dépense" } as Record<string, string>;
const PRESETS = [{ k: "7", label: "7 derniers jours", days: 6 }, { k: "30", label: "30 derniers jours", days: 29 }, { k: "90", label: "3 derniers mois", days: 89 }];
const TONE = { danger: "bg-red-50 text-red-800 border border-red-200", warning: "bg-amber-50 text-amber-800 border border-amber-200", info: "bg-brand-50 text-brand-800 border border-brand-200", success: "bg-emerald-50 text-emerald-800 border border-emerald-200" } as const;

function Checklist({ onDismiss }: { onDismiss: () => void }) {
  const { can } = useAuth();
  const prod = useList<unknown>("ck-products", "/catalog/products", { limit: 1 }, can("products.read"));
  const sales = useList<unknown>("ck-sales", "/sales", { limit: 1 }, can("sales.read"));
  const cust = useList<unknown>("ck-customers", "/parties/customers", { limit: 1 }, can("customers.read"));
  const cash = useList<unknown>("ck-cash", "/cash-sessions", { limit: 1 }, can("cash.manage"));
  const steps = [
    { id: "p", label: "Ajouter un premier article en rayon", to: "/products?new=1", done: (prod.meta?.total ?? 0) > 0, show: can("products.create") },
    { id: "s", label: "Faire votre première vente au comptoir", to: "/pos", done: (sales.meta?.total ?? 0) > 0, show: can("sales.create") },
    { id: "k", label: "Ouvrir votre caisse avec la monnaie de départ", to: "/cash", done: (cash.meta?.total ?? 0) > 0, show: can("cash.manage") },
    { id: "c", label: "Enregistrer un premier client", to: "/customers", done: (cust.meta?.total ?? 0) > 0, show: can("customers.manage") },
  ].filter((x) => x.show);
  const loading = prod.loading || sales.loading || cust.loading || cash.loading; const done = steps.filter((x) => x.done).length; const all = steps.length > 0 && done === steps.length;
  if (loading || steps.length === 0 || all) return all ? <CelebrateChecklist onDismiss={onDismiss} /> : null;
  return (
    <Card title="Démarrage rapide de votre boutique" actions={<button onClick={onDismiss} className="text-xs text-slate-500 hover:text-slate-800">Masquer</button>} className="border-brand-500/30">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <motion.div className="h-full rounded-full bg-brand-600" initial={{ width: 0 }} animate={{ width: `${(done / steps.length) * 100}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
        </div>
        <span className="text-sm font-semibold tabular-nums text-slate-700">{done}/{steps.length}</span>
      </div>
      <ul className="space-y-1">{steps.map((st) => (
        <li key={st.id}>
          <Link to={st.to} className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-slate-50", st.done && "text-slate-400 line-through")}>
            <span className={cx("grid size-6 place-items-center rounded-full border", st.done ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300")}>{st.done && <CheckCircle2 className="size-5" />}</span>
            {st.label}
          </Link>
        </li>
      ))}</ul>
    </Card>
  );
}

function CelebrateChecklist({ onDismiss }: { onDismiss: () => void }) {
  const [run, setRun] = useState(true);
  return (
    <>
      <Confetti run={run} onDone={() => setRun(false)} />
      <Card className="border-emerald-300 bg-emerald-50/40">
        <div className="flex items-center gap-3 text-sm">
          <ConfettiIcon className="size-9 text-emerald-700 shrink-0" />
          <p className="flex-1 font-medium text-emerald-950"><b>Bravo, votre commerce est bien configuré !</b> Toutes les étapes clés pour démarrer sont prêtes.</p>
          <Button size="sm" variant="secondary" onClick={onDismiss}>Fermer</Button>
        </div>
      </Card>
    </>
  );
}

export default function Dashboard() {
  const { business, user, activeId } = useAuth(); const tz = business?.timezone ?? "Africa/Porto-Novo"; const [preset, setPreset] = useState("30");
  const to = todayStr(tz); const from = addDaysStr(to, -(PRESETS.find((p) => p.k === preset)?.days ?? 29));
  const q = useData<Dash>("dashboard", `/reports/dashboard?from=${from}&to=${to}`);
  const d = q.data; const s = d?.summary;
  const [goal, setGoalState] = useState(() => getGoal(activeId)); const [editGoal, setEditGoal] = useState(false); const [draft, setDraft] = useState(0); const [confetti, setConfetti] = useState(false); const [hideCk, setHideCk] = useState(() => checklistDismissed(activeId));
  useEffect(() => { setGoalState(getGoal(activeId)); setHideCk(checklistDismissed(activeId)); }, [activeId]);
  const reached = !!d && goal > 0 && d.today.revenue >= goal;
  useEffect(() => { if (reached && !celebratedToday(activeId, to)) { markCelebrated(activeId, to); setConfetti(true); } }, [reached, activeId, to]);
  const streak = useMemo(() => (d ? computeStreak(d.series, to) : 0), [d, to]);
  const insights = useMemo(() => (d ? buildInsights(d, goal, tz) : []), [d, goal, tz]);
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()));
  const first = (user?.fullName ?? "").split(" ")[0];
  const pct = goal > 0 && d ? d.today.revenue / goal : 0;

  return (
    <>
      <Confetti run={confetti} onDone={() => setConfetti(false)} />
      <PageHeader title="Tableau de bord" subtitle={`Bilan du ${from} au ${to}`} actions={
        <div role="group" aria-label="Période" className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {PRESETS.map((p) => <button key={p.k} onClick={() => setPreset(p.k)} aria-pressed={preset === p.k} className={cx("relative rounded-lg px-3.5 py-1.5 text-xs font-semibold sm:text-sm whitespace-nowrap", preset === p.k ? "text-white" : "text-slate-600 hover:bg-slate-100")}>{preset === p.k && <motion.span layoutId="preset" className="absolute inset-0 rounded-lg bg-brand-700" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}<span className="relative">{p.label}</span></button>)}
        </div>} />
      {q.isLoading ? (
        <div className="space-y-5" role="status" aria-label="Chargement"><Skeleton className="h-44 rounded-3xl" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div><Skeleton className="h-72 rounded-2xl" /></div>
      ) : q.error || !d || !s ? <ErrorState error={q.error} retry={() => void q.refetch()} /> : (
        <Stagger className="space-y-5" delay={0.06}>
          <Item>
            <section className="hero-card rounded-3xl p-6 shadow-xl sm:p-8" aria-label="Votre journée">
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/80">{business?.name}</p>
                  <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{greeting(hour)}{first ? `, ${first}` : ""} 👋</h2>
                  <p className="mt-3 text-xs uppercase tracking-wider text-emerald-200 font-semibold">Ventes d'aujourd'hui</p>
                  <p className="text-4xl font-extrabold tabular-nums sm:text-5xl" data-testid="today-revenue">{money(d.today.revenue)}</p>
                  <p className="mt-1 text-sm text-white/80">{d.today.salesCount} vente{d.today.salesCount > 1 ? "s" : ""} enregistrée{d.today.salesCount > 1 ? "s" : ""} aujourd'hui</p>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {streak > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur"><Fire className="size-4 text-emerald-300" />{streak} jour{streak > 1 ? "s" : ""} consécutif{streak > 1 ? "s" : ""} de vente</span>}
                    <Link to="/pos" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-brand-800 shadow-md transition hover:scale-105 active:scale-95"><Rocket className="size-4" />Nouvelle vente au comptoir</Link>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <ProgressRing value={pct} size={112} stroke={10}><span className="text-lg font-bold tabular-nums">{goal > 0 ? `${Math.min(999, Math.round(pct * 100))}%` : <Target className="size-8" />}</span></ProgressRing>
                  <button onClick={() => { setDraft(goal); setEditGoal(true); }} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold hover:bg-white/25 transition"><Pencil className="size-3.5" />{goal > 0 ? `Objectif du jour : ${money(goal)}` : "Fixer un objectif de vente"}</button>
                  {reached && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300"><ConfettiIcon className="size-4" />Objectif atteint !</span>}
                </div>
              </div>
            </section>
          </Item>

          {/* Cartes statistiques en langage simple pour commerçant */}
          <Item className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Total des ventes" count={s.netSales} format={money} hint={`${s.salesCount} vente(s) au total`} icon={ShoppingBag} tone="blue" />
            <StatCard label="Argent réellement encaissé" count={s.collected} format={money} hint="Ce qui est entré dans votre poche" icon={Banknote} tone="green" />
            {s.expenses !== null ? (
              <StatCard label="Dépenses payées" count={s.expenses} format={money} hint="Loyer, factures, transport..." icon={Wallet} tone="amber" />
            ) : (
              <StatCard label="Marchandises remboursées" count={s.refunds} format={money} icon={Receipt} tone="amber" />
            )}
            {s.grossMargin !== null ? (
              <StatCard label="Gain estimé (Bénéfice)" count={s.grossMargin} format={money} hint="Prix de vente − Prix d'achat" icon={Percent} tone="green" />
            ) : (
              <StatCard label="Ventes du jour" count={d.today.revenue} format={money} icon={TrendingUp} />
            )}
            <StatCard label="Ce qu'on vous doit (Crédits)" count={s.receivables} format={money} hint="Argent à récupérer chez les clients" icon={HandCoins} tone={s.receivables > 0 ? "amber" : "gray"} />
            <StatCard label="Ce que vous devez (Fournisseurs)" count={s.payables} format={money} hint="Dettes auprès des fournisseurs" icon={Truck} tone={s.payables > 0 ? "amber" : "gray"} />
            <StatCard label="Articles en alerte stock" value={`${s.lowStockCount} presque finis / ${s.outOfStockCount} vides`} icon={s.outOfStockCount ? PackageX : AlertTriangle} tone={s.outOfStockCount ? "red" : s.lowStockCount ? "amber" : "gray"} />
            <StatCard label="Achat moyen par client" count={s.salesCount ? Math.round(s.netSales / s.salesCount) : 0} format={money} hint="Montant moyen par panier" icon={Receipt} tone="blue" />
          </Item>

          <Item className="grid gap-5 lg:grid-cols-3">
            <Card title="Évolution des ventes par jour" className="lg:col-span-2 min-w-0 overflow-hidden">
              {d.series.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Aucune vente sur cette période.</p> : (
                <div className="h-64 w-full min-w-0 overflow-hidden" role="img" aria-label="Graphique des ventes nettes par jour">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={d.series} margin={{ left: -14, right: 6, top: 8 }}>
                      <defs>
                        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#059669" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--s200)" />
                      <XAxis dataKey="period" tick={{ fontSize: 12, fill: "var(--s500)" }} tickFormatter={(v: string) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 12, fill: "var(--s500)" }} width={56} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--s200)", background: "var(--surface)", color: "var(--s800)" }} formatter={(v) => money(Number(v))} labelFormatter={(l) => `Date : ${String(l)}`} />
                      <Area type="monotone" dataKey="net" name="Total ventes" stroke="#059669" fill="url(#g)" strokeWidth={2.5} animationDuration={1000} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>)}
            </Card>
            <div className="space-y-5 min-w-0">
              {insights.length > 0 && (
                <Card title="Conseils du jour" actions={<Lightbulb className="size-5 text-brand-700" />}>
                  <ul className="space-y-2.5">{insights.map((i, k) => (
                    <motion.li key={i.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + k * 0.08 }} className={cx("rounded-xl p-3 text-xs sm:text-sm leading-relaxed", TONE[i.tone])}>
                      {i.text}{i.cta && <Link to={i.cta.to} className="ml-1.5 font-bold underline underline-offset-2">{i.cta.label} →</Link>}
                    </motion.li>))}</ul>
                </Card>)}
              {!hideCk && <Checklist onDismiss={() => { dismissChecklist(activeId); setHideCk(true); }} />}
            </div>
          </Item>

          <Item className="grid gap-5 lg:grid-cols-2">
            <Card title="Vos articles les plus vendus" className="min-w-0 overflow-hidden">
              {d.topProducts.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Aucun produit vendu pour l'instant.</p> : (
                <ol className="space-y-3">{d.topProducts.map((p, i) => (
                  <motion.li key={p.productId} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }} className="flex items-center gap-2.5 sm:gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 dark:bg-brand-950/60 text-xs font-bold text-brand-700 dark:text-brand-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">{qty(p.quantity)} vendu(s)</p>
                    </div>
                    <span className="shrink-0 text-right text-xs sm:text-sm font-bold tabular-nums text-brand-700 dark:text-brand-400 whitespace-nowrap pl-1.5 sm:pl-2">{money(p.revenue)}</span>
                  </motion.li>))}
                </ol>)}
            </Card>

            <Card title="Dernières opérations enregistrées" className="min-w-0 overflow-hidden">
              {d.recent.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Aucune opération pour l'instant.</p> : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">{d.recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-2.5 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge tone={r.kind === "sale" ? "blue" : r.kind === "expense" ? "amber" : "gray"}>{KIND[r.kind]}</Badge>
                        {r.status === "cancelled" && <Badge tone="red">annulée</Badge>}
                      </div>
                      <p className="mt-1 truncate text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">{r.label}</p>
                    </div>
                    <div className="shrink-0 text-right pl-2">
                      <p className="text-xs sm:text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">{money(r.amount)}</p>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{fmtDateTime(r.at, business?.timezone)}</p>
                    </div>
                  </li>))}
                </ul>)}
            </Card>
          </Item>
        </Stagger>
      )}
      <Modal open={editGoal} onClose={() => setEditGoal(false)} title="Objectif de vente journalier" size="sm" footer={<><Button variant="secondary" onClick={() => setEditGoal(false)}>Annuler</Button><Button onClick={() => { setGoal(activeId, draft); setGoalState(draft); setEditGoal(false); }}>Enregistrer l'objectif</Button></>}>
        <MoneyInput label="Somme à atteindre chaque jour" value={draft} onChange={setDraft} hint="Fixez un objectif motivant ! Laissez 0 pour désactiver." />
      </Modal>
      <AnimatePresence />
    </>
  );
}
