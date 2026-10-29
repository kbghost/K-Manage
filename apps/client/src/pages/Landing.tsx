import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Package, ShieldCheck, ShoppingCart, Store, Users } from "../components/icons";
import { Button } from "../components/ui";

const SLIDES = [
  { eyebrow: "Votre boutique, mieux organisée", title: "Tout votre commerce, au même endroit.", text: "Ventes, caisse et clients : avancez chaque jour avec une vue claire de votre activité.", icon: ShoppingCart, color: "from-emerald-500 to-teal-700", metric: "Ventes du jour", value: "128 500 F", secondary: "32 transactions" },
  { eyebrow: "Stocks sous contrôle", title: "Ne perdez plus le fil de vos produits.", text: "Suivez les entrées, repérez les ruptures et gardez vos articles disponibles.", icon: Package, color: "from-amber-400 to-orange-600", metric: "Articles en stock", value: "248 produits", secondary: "4 alertes à vérifier" },
  { eyebrow: "Des chiffres qui vous parlent", title: "Prenez vos décisions avec confiance.", text: "Consultez les bénéfices, les dépenses et les performances de votre commerce.", icon: BarChart3, color: "from-teal-500 to-cyan-700", metric: "Bénéfice estimé", value: "86 200 F", secondary: "Cette semaine" },
] as const;

function ProductPreview({ index }: { index: number }) {
  const slide = SLIDES[index] ?? SLIDES[0];
  const SlideIcon = slide.icon;
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className={`absolute -inset-8 rounded-[3rem] bg-gradient-to-br ${slide.color} opacity-20 blur-3xl`} />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white p-5 shadow-2xl shadow-slate-900/15 sm:p-7">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ClipboardList className="size-5" /></span><span className="font-semibold text-slate-800">K-Manage</span></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">En direct</span>
        </div>
        <div className="grid gap-4 pt-5 sm:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">{slide.metric}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{slide.value}</p>
            <div className="mt-5 flex h-24 items-end gap-2" aria-label="Graphique d'activité">
              {[34, 52, 43, 74, 58, 88, 67, 100].map((height, i) => <span key={i} style={{ height: `${height}%` }} className={`flex-1 rounded-t-md ${i === 7 ? "bg-emerald-600" : "bg-emerald-200"}`} />)}
            </div>
            <p className="mt-3 text-xs text-slate-500">{slide.secondary}</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-emerald-50 p-4"><span className="grid size-10 place-items-center rounded-xl bg-white text-emerald-700"><SlideIcon className="size-6" /></span><p className="mt-4 text-sm font-semibold text-slate-800">Une gestion simple</p><p className="mt-1 text-xs leading-5 text-slate-500">Les informations essentielles, toujours à portée de main.</p></div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><CheckCircle2 className="size-5" /></span><p className="text-xs font-medium text-slate-700">Prêt pour votre journée</p></div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-2 rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-xl sm:-left-8"><p className="text-[11px] text-slate-500">Conçu pour les commerces</p><p className="mt-0.5 text-sm font-semibold text-slate-800">Simple. Rapide. Local.</p></div>
    </div>
  );
}

export default function Landing() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % SLIDES.length), 6500);
    return () => window.clearInterval(timer);
  }, []);
  const slide = SLIDES[active] ?? SLIDES[0];
  return (
    <div className="min-h-full overflow-hidden bg-white text-slate-800">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="#accueil" className="flex items-center gap-2.5" aria-label="K-Manage, accueil"><span className="grid size-10 place-items-center rounded-2xl bg-emerald-700 text-white shadow-lg shadow-emerald-700/20"><ClipboardList className="size-6" /></span><span className="text-lg font-bold tracking-tight">K-Manage</span></a>
        <nav className="flex items-center gap-2 sm:gap-4"><a href="#fonctionnalites" className="hidden text-sm font-medium text-slate-600 hover:text-emerald-700 sm:block">Fonctionnalités</a><a href="#tarif" className="hidden text-sm font-medium text-slate-600 hover:text-emerald-700 sm:block">Tarif</a><Link to="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Connexion</Link><Link to="/register"><Button size="sm">Commencer</Button></Link></nav>
      </header>

      <main id="accueil">
        <section className="relative isolate mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-16 lg:grid-cols-[.9fr_1.1fr]">
          <div className="absolute -left-44 top-0 -z-10 size-[34rem] rounded-full bg-emerald-100/60 blur-3xl" />
          <div className="max-w-xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm"><span className="size-2 rounded-full bg-emerald-500" />{slide.eyebrow}</p>
                <h1 className="mt-6 text-4xl font-bold leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.55rem]">{slide.title}</h1>
                <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">{slide.text}</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register"><Button size="lg" className="rounded-xl px-6">Essayer gratuitement <ArrowRight className="size-5" /></Button></Link>
              <a href="#fonctionnalites" className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-white">Découvrir la plateforme</a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-600" />1 mois d’essai gratuit</span><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-600" />Sans carte bancaire au départ</span></div>
            <div className="mt-8 flex items-center gap-2">
              <button onClick={() => setActive((active + SLIDES.length - 1) % SLIDES.length)} aria-label="Diapositive précédente" className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-700"><ChevronLeft className="size-5" /></button>
              {SLIDES.map((item, index) => <button key={item.eyebrow} onClick={() => setActive(index)} aria-label={`Afficher la diapositive ${index + 1}`} aria-current={index === active ? "true" : undefined} className={`h-2 rounded-full transition-all ${index === active ? "w-8 bg-emerald-700" : "w-2 bg-slate-300 hover:bg-emerald-400"}`} />)}
              <button onClick={() => setActive((active + 1) % SLIDES.length)} aria-label="Diapositive suivante" className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-700"><ChevronRight className="size-5" /></button>
            </div>
          </div>
          <div className="min-h-[18rem] pt-4 sm:min-h-[25rem]">
            <AnimatePresence mode="wait" initial={false}><motion.div key={active} initial={{ opacity: 0, x: 18, scale: 0.98 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -12, scale: 0.99 }} transition={{ duration: 0.3 }}><ProductPreview index={active} /></motion.div></AnimatePresence>
          </div>
        </section>

        <section id="fonctionnalites" className="bg-slate-50 px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Pensé pour votre quotidien</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Une meilleure visibilité sur votre commerce</h2><p className="mt-4 leading-7 text-slate-600">Les bons outils pour vendre, suivre vos stocks et comprendre vos résultats, sans compliquer votre travail.</p></div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                { icon: ShoppingCart, title: "Vendez sans ralentir", text: "Un point de vente rapide, des tickets clairs et un historique des ventes facile à consulter." },
                { icon: Package, title: "Gardez la maîtrise du stock", text: "Suivez vos articles et soyez alerté avant qu'un produit important ne manque." },
                { icon: Users, title: "Suivez vos clients et crédits", text: "Retrouvez les achats, les paiements et les soldes de vos clients au même endroit." },
              ].map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon className="size-6" /></span><h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}
            </div>
          </div>
        </section>

        <section id="tarif" className="px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_.85fr]">
            <div><p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Simple et transparent</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Commencez gratuitement. Continuez à votre rythme.</h2><p className="mt-4 max-w-xl leading-7 text-slate-600">Découvrez K-Manage pendant un mois sans frais. À la fin de l’essai, gardez l’accès à votre boutique avec un abonnement mensuel que vous choisissez d’activer.</p><div className="mt-6 flex items-start gap-3 text-sm text-slate-600"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" /><span>Le paiement est traité de manière sécurisée par FedaPay. Les moyens proposés peuvent inclure Mobile Money et carte bancaire, selon leur disponibilité.</span></div></div>
            <div className="rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-7 shadow-lg sm:p-9">
              <div className="flex items-center justify-between"><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">Abonnement mensuel</span><CreditCard className="size-6 text-emerald-700" /></div>
              <p className="mt-6 text-sm font-medium text-slate-600">Après votre mois d’essai</p><p className="mt-1 text-4xl font-bold tracking-tight text-slate-950">7 000 <span className="text-base font-semibold text-slate-600">FCFA / mois</span></p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700">{["Tous les outils de gestion", "Accès à vos données de boutique", "Paiement sécurisé via FedaPay"].map((item) => <li key={item} className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" />{item}</li>)}</ul>
              <Link to="/register" className="mt-7 block"><Button size="lg" className="w-full rounded-xl">Créer mon compte <ArrowRight className="size-5" /></Button></Link>
              <p className="mt-3 text-center text-xs text-slate-500">Aucun prélèvement pendant la période d’essai.</p>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-100 bg-slate-950 px-5 py-8 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row"><div className="flex items-center gap-2"><Store className="size-5 text-emerald-400" /><span className="font-semibold">K-Manage</span></div><p className="text-center text-xs text-slate-400">La gestion de votre commerce, en toute sérénité · Montants en FCFA</p><Link to="/login" className="text-sm text-emerald-300 hover:text-white">Se connecter</Link></div>
      </footer>
    </div>
  );
}
