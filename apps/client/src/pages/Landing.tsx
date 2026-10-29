import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Package,
  Printer,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Sparkle,
  Store,
  Users,
  Wallet,
  Menu,
  X,
} from "../components/icons";
import { Button, Modal } from "../components/ui";

interface SlideItem {
  id: string;
  badge: string;
  eyebrow: string;
  title: string;
  text: string;
  metric: string;
  value: string;
  secondary: string;
  tag: string;
  image: string;
  imageAlt: string;
  component: () => ReactNode;
}

const SLIDES: SlideItem[] = [
  {
    id: "pos",
    badge: "Point de Vente Tactile",
    eyebrow: "Votre caisse, rapide et sans erreur",
    title: "Tout votre commerce, au même endroit.",
    text: "Enregistrez vos ventes en 3 clics, scannez les codes-barres, acceptez Mobile Money ou espèces et imprimez des reçus thermiques professionnels.",
    metric: "Ventes du jour",
    value: "142 500 FCFA",
    secondary: "38 tickets · 0 erreur de caisse",
    tag: "Caisse en direct",
    image: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Encaissement en boutique et caisse tactile moderne",
    component: PosMockup,
  },
  {
    id: "stock",
    badge: "Stocks & Inventaire",
    eyebrow: "Stocks sous contrôle absolu",
    title: "Ne perdez plus jamais la trace de vos marchandises.",
    text: "Suivez chaque entrée et sortie, soyez alerté avant les ruptures et valorisez votre magasin en temps réel pour ne plus refuser de vente.",
    metric: "Articles en magasin",
    value: "320 produits",
    secondary: "Valeur : 2 450 000 FCFA · 2 alertes",
    tag: "Inventaire temps réel",
    image: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Rayons et stock de marchandises organisés en boutique",
    component: StockMockup,
  },
  {
    id: "customers",
    badge: "Clients & Crédits",
    eyebrow: "Finis les carnets de dettes égarés",
    title: "Suivez vos clients et faites-vous payer à temps.",
    text: "Fiches clients complètes, historique des achats et suivi rigoureux des crédits avec gestion des acomptes. Vous savez exactement qui vous doit quoi.",
    metric: "Créances récupérées",
    value: "85% plus rapide",
    secondary: "Reste dû maîtrisé : 48 500 FCFA",
    tag: "Recouvrement facile",
    image: "https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Relation client de confiance et suivi des paiements au comptoir",
    component: CustomerMockup,
  },
  {
    id: "reports",
    badge: "Bénéfice Réel & Gestion",
    eyebrow: "Des chiffres clairs qui vous parlent",
    title: "Connaissez votre vrai bénéfice net chaque soir.",
    text: "Vos ventes moins vos achats de marchandises et vos dépenses d’électricité ou de transport : découvrez exactement ce qu’il reste dans votre poche.",
    metric: "Bénéfice net estimé",
    value: "385 000 FCFA",
    secondary: "Ce mois · Marge nette de 24.5%",
    tag: "Rentabilité transparente",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Tableau de bord financier, calcul de la marge nette et rentabilité",
    component: ReportsMockup,
  },
];

function PosMockup() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700">
            <ShoppingCart className="size-4" />
          </span>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Point de Vente — Caisse #1</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ouverte (25 000 F)
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 p-2.5 space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Panier en cours (3 articles)</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-700 dark:text-slate-300">
              <span className="truncate">Riz parfumé 25kg (x1)</span>
              <span className="font-semibold tabular-nums">19 500 F</span>
            </div>
            <div className="flex justify-between text-slate-700 dark:text-slate-300">
              <span className="truncate">Huile raffinée 5L (x1)</span>
              <span className="font-semibold tabular-nums">6 800 F</span>
            </div>
            <div className="flex justify-between text-slate-700 dark:text-slate-300">
              <span className="truncate">Sucre paquet (x1)</span>
              <span className="font-semibold tabular-nums">1 200 F</span>
            </div>
          </div>
          <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-white text-xs">
            <span>Total net</span>
            <span className="text-emerald-700 font-extrabold text-sm">27 500 FCFA</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-emerald-50/60 p-2.5 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-900">Encaissement FedaPay & Caisse</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 shadow-sm border border-emerald-100">MTN Momo</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 shadow-sm border border-emerald-100">Moov Money</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 shadow-sm border border-emerald-100">Espèces</span>
            </div>
          </div>
          <div className="mt-2 rounded-lg bg-white p-2 text-center shadow-sm border border-emerald-100/80">
            <p className="text-[10px] text-slate-500">Ticket #V-00034</p>
            <p className="text-xs font-bold text-emerald-800">Prêt pour ticket thermique 80mm</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StockMockup() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-amber-500/10 text-amber-700">
            <Package className="size-4" />
          </span>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Articles & Inventaire en Rayon</span>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          320 références
        </span>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-100">
          <div>
            <p className="font-semibold text-slate-800">Lait en poudre Bonnet Rouge 400g</p>
            <p className="text-[10px] text-slate-400 font-mono">SKU: LAIT-04 · Rayon Épicerie</p>
          </div>
          <div className="text-right">
            <span className="inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">38 boîtes</span>
            <p className="text-[10px] text-slate-500 mt-0.5">Vente : 2 400 F</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-amber-50/70 p-2.5 border border-amber-200/60">
          <div>
            <p className="font-semibold text-slate-800">Savon de ménage 250g (carton)</p>
            <p className="text-[10px] text-amber-700 font-mono">⚠️ Seuil d’alerte (min. 5)</p>
          </div>
          <div className="text-right">
            <span className="inline-block rounded-md bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">3 cartons</span>
            <p className="text-[10px] text-slate-500 mt-0.5">Réapprovisionner</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-100">
          <div>
            <p className="font-semibold text-slate-800">Spaghetti Roni 500g</p>
            <p className="text-[10px] text-slate-400 font-mono">SKU: SPAG-01 · 450 F/u</p>
          </div>
          <div className="text-right">
            <span className="inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">120 paquets</span>
            <p className="text-[10px] text-slate-500 mt-0.5">En stock</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerMockup() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-teal-500/10 text-teal-700">
            <Users className="size-4" />
          </span>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Carnet de Crédits & Clients</span>
        </div>
        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
          Recouvrement actif
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800">Mme Adanho Claire</p>
            <p className="text-[10px] text-slate-500">Marché Dantokpa · +229 97 22 xx xx</p>
          </div>
          <div className="text-right">
            <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">Dette : 15 000 F</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Acompte reçu : 10 000 F</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800">M. Tossou Jean</p>
            <p className="text-[10px] text-slate-500">Client fidèle · 12 achats</p>
          </div>
          <div className="text-right">
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Compte soldé (0 F)</span>
            <p className="text-[10px] text-emerald-700 mt-0.5">En règle</p>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-2 text-center">
          <p className="text-[11px] font-semibold text-emerald-900">Historique complet des remboursements</p>
          <p className="text-[10px] text-emerald-700">Chaque paiement partiel est horodaté et sécurisé.</p>
        </div>
      </div>
    </div>
  );
}

function ReportsMockup() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700">
            <BarChart3 className="size-4" />
          </span>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Rentabilité & Marge Nette</span>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          Mois en cours
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-slate-50 p-2.5">
          <p className="text-[10px] text-slate-500">Chiffre d’affaires</p>
          <p className="text-base font-bold text-slate-900">1 570 000 F</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">+14% vs mois préc.</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-2.5 border border-emerald-100">
          <p className="text-[10px] text-emerald-800">Vrai bénéfice net</p>
          <p className="text-base font-extrabold text-emerald-800">385 000 F</p>
          <p className="text-[10px] text-emerald-700 mt-0.5">Après achats & charges</p>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-2.5">
        <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1.5">
          <span>Activité de la semaine (Ventes quotidiennes)</span>
          <span className="font-semibold text-emerald-700">Moy. 55 000 F/j</span>
        </div>
        <div className="flex h-16 items-end gap-1.5 pt-2" aria-label="Graphique d'activité de la semaine">
          {[40, 65, 50, 85, 70, 95, 80].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span style={{ height: `${h}%` }} className={`w-full rounded-t-sm transition-all ${i === 5 ? "bg-emerald-600" : "bg-emerald-300"}`} />
              <span className="text-[9px] text-slate-400">J{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Landing({ defaultSection }: { defaultSection?: "details" | "tarifs" }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(defaultSection === "details");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [dailySales, setDailySales] = useState(75000);
  const location = useLocation();

  useEffect(() => {
    if (location.hash === "#details" || defaultSection === "details") {
      setDetailsOpen(true);
    }
  }, [location.hash, defaultSection]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [paused]);

  const slide = (SLIDES[active] ?? SLIDES[0]) as SlideItem;
  const Mockup = slide.component;

  // Calculateur de rentabilité
  const monthlyRev = dailySales * 30;
  const stockLossPrevented = Math.round(monthlyRev * 0.025);
  const debtRecovered = Math.round(monthlyRev * 0.035);
  const hoursSaved = 22;

  return (
    <div className="min-h-full overflow-hidden bg-white text-slate-800 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* ─── Barre de notification haute ─── */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 px-3 py-1.5 text-center text-xs font-medium text-emerald-100 sm:px-6 sm:py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
          <span className="shrink-0 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wide">
            Offre spéciale
          </span>
          <span className="truncate text-[11px] sm:text-xs">
            <b>30 jours d’essai offert</b> <span className="hidden md:inline">sans engagement · Passerelle FedaPay certifiée</span>
          </span>
          <Link to="/register" className="shrink-0 text-[11px] sm:text-xs underline font-semibold text-white hover:text-emerald-200 whitespace-nowrap">
            Commencer →
          </Link>
        </div>
      </div>

      {/* ─── En-tête principal ─── */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8 sm:py-4">
          <a href="#accueil" className="flex shrink-0 items-center gap-2 sm:gap-2.5" aria-label="K-Manage, accueil">
            <span className="grid size-9 sm:size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-md shadow-emerald-700/20">
              <ClipboardList className="size-5 sm:size-6" />
            </span>
            <div className="shrink-0">
              <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">K-Manage</span>
              <span className="hidden text-[10px] -mt-1 font-medium text-slate-500 sm:block whitespace-nowrap">Gestion & Caisse</span>
            </div>
          </a>

          <nav className="hidden items-center gap-6 lg:flex">
            <a href="#apercu" className="text-sm font-medium text-slate-600 transition hover:text-emerald-700">Démonstration</a>
            <a href="#fonctionnalites" className="text-sm font-medium text-slate-600 transition hover:text-emerald-700">Fonctionnalités</a>
            <a href="#details" onClick={(e) => { e.preventDefault(); setDetailsOpen(true); }} className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-800">
              Tous les détails
            </a>
            <a href="#tarif" className="text-sm font-medium text-slate-600 transition hover:text-emerald-700">Tarif</a>
            <a href="#fedapay" className="text-sm font-medium text-slate-600 transition hover:text-emerald-700">Paiement FedaPay</a>
            <a href="#faq" className="text-sm font-medium text-slate-600 transition hover:text-emerald-700">FAQ</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="rounded-xl px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 transition hover:bg-slate-100 whitespace-nowrap">
              Connexion
            </Link>
            <Link to="/register" className="shrink-0">
              <Button size="sm" className="rounded-xl bg-emerald-700 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold text-white hover:bg-emerald-800 shadow-md shadow-emerald-700/20 whitespace-nowrap">
                <span className="sm:hidden">Essai gratuit</span>
                <span className="hidden sm:inline">Essai gratuit 30 jours</span>
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 lg:hidden"
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Menu mobile déroulant */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-slate-200 bg-white px-5 py-4 lg:hidden shadow-xl"
            >
              <div className="flex flex-col space-y-3 text-sm font-semibold">
                <a
                  href="#apercu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  Démonstration
                </a>
                <a
                  href="#fonctionnalites"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  Fonctionnalités
                </a>
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); setDetailsOpen(true); }}
                  className="text-left rounded-lg px-3 py-2 font-bold text-emerald-700 hover:bg-emerald-50"
                >
                  Tous les détails de l’offre →
                </button>
                <a
                  href="#tarif"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  Tarif unique (7000 FCFA/mois)
                </a>
                <a
                  href="#fedapay"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  Paiement Mobile Money FedaPay
                </a>
                <a
                  href="#faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  Questions fréquentes (FAQ)
                </a>
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white shadow-md hover:bg-emerald-800"
                  >
                    Créer mon compte (1 mois offert)
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Accéder à mon espace
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="accueil">
        {/* ─── Hero Section avec Slides Interactifs ─── */}
        <section className="relative isolate mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-8 sm:pb-28 sm:pt-16">
          <div className="absolute -left-44 top-0 -z-10 size-[36rem] rounded-full bg-emerald-100/60 blur-3xl" />
          <div className="absolute right-0 top-1/3 -z-10 size-[30rem] rounded-full bg-teal-100/50 blur-3xl" />

          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            {/* Texte et appel à l'action */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold text-emerald-800 shadow-sm leading-tight">
                <Sparkle className="size-3.5 shrink-0 text-emerald-600" />
                <span>Logiciel de gestion commerciale n°1 en Afrique de l’Ouest</span>
              </div>

              <h1 className="mt-5 text-2xl font-bold leading-[1.2] tracking-tight text-slate-900 sm:text-4xl lg:text-[3.25rem]">
                Tout votre commerce, au même endroit.
              </h1>

              <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                Ventes de caisse, suivi des stocks, carnet de dettes clients et calcul automatique de vos vrais bénéfices.
                Prenez le contrôle total de votre boutique sur smartphone, tablette ou ordinateur.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link to="/register" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto justify-center rounded-xl bg-emerald-700 px-6 font-bold text-white hover:bg-emerald-800 shadow-lg shadow-emerald-700/25">
                    Essayer gratuitement 1 mois <ArrowRight className="size-5" />
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className="w-full sm:w-auto text-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700 hover:bg-slate-50"
                >
                  Découvrir tous les détails
                </button>
              </div>

              {/* Arguments clés de réassurance */}
              <div className="mt-6 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  1 mois d’essai gratuit
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  Sans carte bancaire au départ
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  Puis 7000 FCFA / mois
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  Paiement FedaPay (Momo & Carte)
                </span>
              </div>

              {/* Contrôles des diapositives */}
              <div className="mt-9 flex items-center gap-2.5">
                <button
                  onClick={() => setActive((active + SLIDES.length - 1) % SLIDES.length)}
                  aria-label="Diapositive précédente"
                  className="grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-500 hover:text-emerald-700 shadow-sm"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <div className="flex gap-1.5">
                  {SLIDES.map((item, index) => (
                    <button
                      key={item.id}
                      onClick={() => setActive(index)}
                      aria-label={`Afficher la diapositive ${index + 1} : ${item.badge}`}
                      aria-current={index === active ? "true" : undefined}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        index === active ? "w-8 bg-emerald-700" : "w-2.5 bg-slate-300 hover:bg-emerald-400"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setActive((active + 1) % SLIDES.length)}
                  aria-label="Diapositive suivante"
                  className="grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-500 hover:text-emerald-700 shadow-sm"
                >
                  <ChevronRight className="size-5" />
                </button>
                <span className="ml-2 text-xs font-semibold text-slate-400">
                  {active + 1} / {SLIDES.length} : {slide.badge}
                </span>
              </div>
            </div>

            {/* Aperçu interactif du produit avec slides */}
            <div
              id="apercu"
              className="relative"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-emerald-500/20 via-teal-500/10 to-amber-500/15 blur-2xl" />

              <div className="relative rounded-[1.75rem] sm:rounded-[2rem] border border-slate-200/80 bg-white p-3.5 sm:p-7 shadow-2xl shadow-slate-900/10">
                {/* Barre supérieure du mockup */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <span className="grid size-8 sm:size-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
                      <ClipboardList className="size-4 sm:size-5" />
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">K-Manage Boutique</span>
                      <p className="text-[9px] sm:text-[10px] text-slate-400">Commerce connecté · Cotonou</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-emerald-800">
                      {slide.tag}
                    </span>
                  </div>
                </div>

                {/* Photo d'illustration réelle du cas d'usage */}
                <div className="mt-3.5 relative h-36 sm:h-44 w-full overflow-hidden rounded-2xl border border-slate-100 shadow-inner group">
                  <img
                    src={slide.image}
                    alt={slide.imageAlt}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex items-end justify-between p-3 sm:p-3.5">
                    <div>
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-300">Scénario réel</span>
                      <p className="text-[11px] sm:text-xs font-semibold text-white drop-shadow-sm">{slide.imageAlt}</p>
                    </div>
                    <span className="rounded-lg bg-emerald-700/90 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-bold text-white shadow-sm">
                      {slide.badge}
                    </span>
                  </div>
                </div>

                {/* Métrique principale en vedette */}
                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-slate-50 p-3 sm:p-4">
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium text-slate-500">{slide.metric}</p>
                    <p className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">{slide.value}</p>
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg">
                    {slide.secondary}
                  </span>
                </div>

                {/* Composant dynamique du slide */}
                <div className="mt-3.5 min-h-[240px] sm:min-h-[260px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={slide.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                    >
                      <Mockup />
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Sélecteur d'onglets de diapositive avec vignettes */}
                <div className="mt-4 grid grid-cols-4 gap-1.5 sm:gap-2 border-t border-slate-100 pt-3">
                  {SLIDES.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => setActive(i)}
                      className={`group flex flex-col items-center gap-1 rounded-xl p-1 sm:p-1.5 transition text-center ${
                        i === active
                          ? "bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600 shadow-sm"
                          : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <div className="h-8 sm:h-9 w-full overflow-hidden rounded-lg bg-slate-100">
                        <img
                          src={item.image}
                          alt={item.badge}
                          className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition"
                          loading="lazy"
                        />
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-bold truncate max-w-full">
                        {item.badge.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Bandeau de réassurance commerciale ─── */}
        <section className="border-y border-slate-100 bg-slate-50/80 px-5 py-8 sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 text-center sm:text-left">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Adopté au quotidien</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                Spécialement adapté pour les supérettes, boutiques de prêt-à-porter, quincailleries, grossistes et dépôts.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Store className="size-4 text-emerald-600" />
                +1 200 commerces actifs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CreditCard className="size-4 text-emerald-600" />
                Paiements FedaPay certifiés
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-600" />
                Données 100% sécurisées
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Printer className="size-4 text-emerald-600" />
                Reçus 58mm / 80mm
              </span>
            </div>
          </div>
        </section>

        {/* ─── Fonctionnalités en Grille (Bento) ─── */}
        <section id="fonctionnalites" className="px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Tout pour réussir</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Une solution complète conçue pour votre réalité commerciale
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                Fini les pertes d’articles, les cahiers de dettes égarés et les caisses non équilibrées.
                K-Manage vous apporte la rigueur d’une grande enseigne avec la simplicité dont vous avez besoin.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: ShoppingCart,
                  title: "Point de Vente & Caisse Tactile",
                  desc: "Vente express au comptoir avec recherche par nom, code-barres ou raccourcis. Calcul automatique de la monnaie à rendre et impression instantanée de tickets.",
                  badge: "Caisse",
                  image: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=600&q=80",
                },
                {
                  icon: Package,
                  title: "Gestion des Stocks & Alertes Ruptures",
                  desc: "Inventaire en temps réel avec alerte automatique dès qu'un produit descend sous le seuil critique. Ne ratez plus aucune vente faute de marchandise.",
                  badge: "Stock",
                  image: "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=600&q=80",
                },
                {
                  icon: Users,
                  title: "Clients, Crédits & Dettes",
                  desc: "Fini les carnets perdus ou raturés. Enregistrez les acomptes, visualisez les soldes dus et retrouvez l’historique d’achats de chaque client en un clin d’œil.",
                  badge: "Créances",
                  image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
                },
                {
                  icon: Wallet,
                  title: "Suivi des Dépenses & Sorties de Caisse",
                  desc: "Notez les frais d’électricité, loyer, transport ou salaires directement dans la plateforme pour avoir un bilan net exact et sans surprise.",
                  badge: "Trésorerie",
                  image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80",
                },
                {
                  icon: BarChart3,
                  title: "Vrai Bénéfice Net & Statistiques",
                  desc: "K-Manage soustrait automatiquement le prix d’achat et vos dépenses pour vous donner votre bénéfice net réel, jour par jour et mois par mois.",
                  badge: "Rentabilité",
                  image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80",
                },
                {
                  icon: Printer,
                  title: "Tickets Thermiques & Factures A4",
                  desc: "Compatible avec les imprimantes thermiques de caisse (58mm et 80mm USB ou Bluetooth) ainsi que les formats A4 pour les livraisons et grossistes.",
                  badge: "Impression",
                  image: "https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=600&q=80",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl"
                >
                  <div>
                    <div className="relative h-44 w-full overflow-hidden rounded-2xl bg-slate-100">
                      <img
                        src={f.image}
                        alt={f.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent flex items-end justify-between p-3.5">
                        <span className="grid size-9 place-items-center rounded-xl bg-white/95 text-emerald-800 shadow-md">
                          <f.icon className="size-5" />
                        </span>
                        <span className="rounded-full bg-emerald-600/95 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                          {f.badge}
                        </span>
                      </div>
                    </div>
                    <h3 className="mt-5 text-lg font-bold text-slate-900">{f.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
              >
                Consulter le tableau complet de toutes les fonctionnalités <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ─── Calculateur de rentabilité pour commerçant ─── */}
        <section className="bg-slate-50 px-5 py-20 sm:px-8 sm:py-24 border-y border-slate-200/60">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wide">
                Simulateur de rentabilité
              </span>
              <h2 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
                Combien K-Manage vous fait-il économiser chaque mois ?
              </h2>
              <p className="mt-3 text-slate-600">
                Ajustez vos ventes moyennes par jour et observez les pertes évitées par rapport aux 7000 FCFA/mois.
              </p>
            </div>

            <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-lg">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="daily-sales" className="text-sm font-bold text-slate-800">
                    Vos ventes moyennes par jour :
                  </label>
                  <span className="text-2xl font-black text-emerald-700 tabular-nums">
                    {new Intl.NumberFormat("fr-FR").format(dailySales)} FCFA / jour
                  </span>
                </div>
                <input
                  id="daily-sales"
                  type="range"
                  min={20000}
                  max={500000}
                  step={5000}
                  value={dailySales}
                  onChange={(e) => setDailySales(Number(e.target.value))}
                  className="h-3 w-full cursor-pointer accent-emerald-600 rounded-lg bg-slate-200"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>20 000 F/jour</span>
                  <span>250 000 F/jour</span>
                  <span>500 000 F/jour</span>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3 pt-6 border-t border-slate-100 text-center">
                <div className="rounded-2xl bg-emerald-50/70 p-4 border border-emerald-100">
                  <p className="text-xs text-emerald-800 font-medium">Pertes de stock évitées</p>
                  <p className="mt-1 text-xl font-bold text-emerald-900 tabular-nums">
                    +{new Intl.NumberFormat("fr-FR").format(stockLossPrevented)} F / mois
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-1">Évite les ruptures & périmés</p>
                </div>
                <div className="rounded-2xl bg-teal-50/70 p-4 border border-teal-100">
                  <p className="text-xs text-teal-800 font-medium">Crédits impayés récupérés</p>
                  <p className="mt-1 text-xl font-bold text-teal-900 tabular-nums">
                    +{new Intl.NumberFormat("fr-FR").format(debtRecovered)} F / mois
                  </p>
                  <p className="text-[11px] text-teal-700 mt-1">Zéro dette oubliée</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                  <p className="text-xs text-slate-600 font-medium">Temps de gestion gagné</p>
                  <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
                    ~{hoursSaved} heures / mois
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Fin des calculs manuels</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-emerald-700 p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm">Pour un investissement de seulement 7000 FCFA / mois :</p>
                  <p className="text-xs text-emerald-100">Votre boutique gagne plus de 10 fois le coût de l’abonnement en sérénité et chiffre d'affaires.</p>
                </div>
                <Link to="/register" className="shrink-0">
                  <Button size="sm" className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-4">
                    Commencer l'essai gratuit
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Section Passerelle FedaPay ─── */}
        <section id="fedapay" className="px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wide">
                  Paiement sécurisé FedaPay
                </span>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Réglez votre abonnement en toute liberté, par Mobile Money ou Carte
                </h2>
                <p className="mt-4 leading-7 text-slate-600">
                  Nous avons intégré <b>FedaPay</b>, la passerelle de paiement de référence en Afrique de l’Ouest.
                  Aucun débit automatique imprévu : à la fin de votre mois d’essai gratuit, vous déclenchez vous-même votre paiement
                  en 30 secondes depuis votre espace.
                </p>

                <div className="mt-6 space-y-3.5 text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                    <span><b>Mobile Money instantané :</b> MTN Mobile Money, Moov Money, Orange Money, Wave et Free selon votre pays.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CreditCard className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                    <span><b>Cartes bancaires acceptées :</b> Visa et MasterCard avec protocole 3D-Secure certifié.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                    <span><b>Sans engagement ni prélèvement forcé :</b> Renouvellement manuel mois par mois à 7000 FCFA.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Receipt className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                    <span><b>Factures et reçus téléchargeables :</b> Conservez la trace de chaque paiement pour votre comptabilité.</span>
                  </div>
                </div>
              </div>

              {/* Carte visuelle des moyens FedaPay */}
              <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 p-7 sm:p-9 shadow-xl">
                <div className="relative h-44 w-full overflow-hidden rounded-2xl mb-6 shadow-sm border border-emerald-100/80">
                  <img
                    src="https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80"
                    alt="Paiement Mobile Money et carte bancaire FedaPay"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent flex items-end justify-between p-4">
                    <div>
                      <p className="font-bold text-white text-sm">Passerelle FedaPay intégrée</p>
                      <p className="text-xs text-emerald-200">Règlement instantané en Francs CFA (XOF)</p>
                    </div>
                    <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950 shadow-sm">
                      100% Sécurisé
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-white p-3.5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                        MTN
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">MTN Mobile Money</p>
                        <p className="text-[10px] text-slate-500">Bénin, Côte d'Ivoire, etc.</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">Disponible</span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-white p-3.5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white font-black text-xs">
                        Moov
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Moov Money Flooz</p>
                        <p className="text-[10px] text-slate-500">Bénin, Togo, Côte d'Ivoire</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">Disponible</span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-white p-3.5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-slate-900 text-white font-bold text-xs">
                        CB
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Carte Visa & MasterCard</p>
                        <p className="text-[10px] text-slate-500">Paiement international en XOF</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">Disponible</span>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl bg-emerald-100/60 p-3.5 text-center text-xs text-emerald-900 font-medium">
                  Le paiement de <b>7000 FCFA</b> prolonge l’accès de votre commerce pour 1 mois complet.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Tarifs clairs & transparents ─── */}
        <section id="tarif" className="bg-slate-50 px-5 py-20 sm:px-8 sm:py-24 border-t border-slate-200/60">
          <div className="mx-auto max-w-6xl">
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Tarif unique & transparent</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Commencez gratuitement. Continuez à votre rythme.
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                Découvrez K-Manage pendant un mois sans aucun frais. À la fin de l’essai, gardez l’accès complet à votre boutique
                avec un tarif simple, sans mauvaise surprise.
              </p>
            </div>

            <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.1fr] items-center">
              {/* Carte Essai gratuit */}
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <span className="rounded-full bg-slate-100 px-3.5 py-1 text-xs font-bold text-slate-700">
                  1er Mois Offert
                </span>
                <h3 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">30 jours d’essai offerts</h3>
                <p className="mt-2 text-sm text-slate-600 leading-6">
                  Testez toutes les fonctionnalités en conditions réelles dans votre boutique dès aujourd'hui.
                </p>
                <p className="mt-6 text-4xl font-black text-slate-900">
                  0 <span className="text-base font-semibold text-slate-500">FCFA</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-700">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-5 text-emerald-600" /> Accès complet immédiat
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-5 text-emerald-600" /> Aucune carte bancaire requise
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-5 text-emerald-600" /> Produits et ventes illimités
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-5 text-emerald-600" /> Assistance gratuite par WhatsApp
                  </li>
                </ul>
                <Link to="/register" className="mt-8 block">
                  <Button variant="secondary" size="lg" className="w-full rounded-xl font-bold">
                    Démarrer mon mois gratuit
                  </Button>
                </Link>
              </div>

              {/* Carte Formule Pro FedaPay */}
              <div className="relative rounded-3xl border-2 border-emerald-600 bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 p-8 sm:p-10 text-white shadow-2xl">
                <span className="absolute -top-3.5 left-8 rounded-full bg-emerald-500 px-4 py-1 text-xs font-extrabold text-slate-950 shadow-md">
                  FORMULE PRO ILLIMITÉE
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Abonnement Mensuel</span>
                  <CreditCard className="size-6 text-emerald-400" />
                </div>
                <p className="mt-4 text-sm text-emerald-100">Après votre mois d’essai gratuit :</p>
                <p className="mt-1 text-4xl font-bold tracking-tight text-white">
                  7 000 <span className="text-lg font-semibold text-emerald-300">FCFA / mois</span>
                </p>
                <p className="mt-2 text-xs text-slate-300">Renouvellement manuel via FedaPay (Mobile Money & Carte).</p>

                <ul className="mt-8 space-y-3.5 text-sm text-slate-200 border-t border-emerald-800/80 pt-6">
                  {[
                    "Tous les outils de gestion et caisse",
                    "Produits et ventes illimités",
                    "Gestion complète des stocks & ruptures",
                    "Carnet de crédit & clients",
                    "Accès à vos données de boutique à vie",
                    "Impression tickets 58mm / 80mm / A4",
                    "Paiement sécurisé via FedaPay",
                    "Support commercial 7j/7",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5">
                      <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/register" className="mt-8 block">
                  <Button size="lg" className="w-full rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-extrabold text-base shadow-lg shadow-emerald-500/20">
                    Créer mon compte et profiter du mois offert <ArrowRight className="size-5" />
                  </Button>
                </Link>
                <p className="mt-3 text-center text-xs text-slate-400">
                  Aucun prélèvement forcé. Vos données restent conservées même en cas d’oubli.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Témoignages de Commerçants ─── */}
        <section className="px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="text-center max-w-2xl mx-auto">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wide">
                Retours d'expérience
              </span>
              <h2 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
                Ils gèrent leur boutique avec K-Manage
              </h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  quote: "Avant K-Manage, je perdais au moins 50 000 F chaque mois en dettes oubliées dans mon cahier. Maintenant, chaque crédit est enregistré et je me fais payer à temps.",
                  name: "Bernadette K.",
                  role: "Prêt-à-porter féminin",
                  city: "Cotonou (Ganhi)",
                  avatar: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=200&h=200&q=80",
                },
                {
                  quote: "L'alerte de stock m'a sauvé plusieurs fois pendant les fêtes. Dès qu'un carton de lait baisse sous 5 unités, je suis prévenu et je commande chez mon grossiste.",
                  name: "Moussa D.",
                  role: "Supérette & Alimentation générale",
                  city: "Lomé (Adidogomé)",
                  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80",
                },
                {
                  quote: "Le paiement FedaPay par Moov Money est ultra pratique. Je paie mes 7000 F en 20 secondes sur mon téléphone et j'ai directement mon reçu.",
                  name: "Yves A.",
                  role: "Quincaillerie & Matériaux",
                  city: "Abidjan (Yopougon)",
                  avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&h=200&q=80",
                },
              ].map((t) => (
                <div key={t.name} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm flex flex-col justify-between">
                  <p className="text-sm leading-6 text-slate-700 italic">« {t.quote} »</p>
                  <div className="mt-6 flex items-center gap-3 pt-4 border-t border-slate-100">
                    <img
                      src={t.avatar}
                      alt={t.name}
                      className="size-11 rounded-full object-cover ring-2 ring-emerald-500/30 shadow-sm"
                      loading="lazy"
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.role} · {t.city}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ Interactive ─── */}
        <section id="faq" className="bg-slate-50 px-5 py-20 sm:px-8 sm:py-24 border-t border-slate-200/60">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wide">
                Foire aux questions
              </span>
              <h2 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
                Questions fréquentes
              </h2>
            </div>

            <div className="mt-12 space-y-3.5">
              {[
                {
                  q: "Comment fonctionne le mois d’essai gratuit ?",
                  a: "Dès votre inscription, votre boutique bénéficie de 30 jours complets d’essai gratuit sans aucune restriction. Vous n'avez pas besoin d'entrer de carte bancaire ni d'effectuer de paiement pour commencer.",
                },
                {
                  q: "Que se passe-t-il à la fin des 30 jours d’essai ?",
                  a: "À l’échéance des 30 jours, l’accès aux opérations de vente nécessite l’activation de votre abonnement mensuel à 7000 FCFA. Vos données, produits, clients et historiques restent précieusement conservés.",
                },
                {
                  q: "Comment s’effectue le paiement de 7000 FCFA avec FedaPay ?",
                  a: "Depuis votre page Abonnement, entrez simplement votre numéro de téléphone et cliquez sur 'Payer avec FedaPay'. Vous serez redirigé vers l’interface sécurisée FedaPay pour valider via votre compte Mobile Money (MTN, Moov, Orange, Wave...) ou carte bancaire.",
                },
                {
                  q: "Y a-t-il des prélèvements automatiques sur mon compte ?",
                  a: "Non, absolument aucun débit automatique. K-Manage ne stocke aucune coordonnée bancaire. Le renouvellement est déclenché manuellement par vous-même mois par mois selon vos besoins.",
                },
                {
                  q: "Puis-je utiliser K-Manage sur téléphone, tablette et ordinateur ?",
                  a: "Oui ! K-Manage fonctionne directement sur tous les navigateurs modernes (Chrome, Safari, Firefox, Edge) et s’adapte parfaitement à l’écran d’un smartphone Android/iPhone, d’une tablette de caisse ou d’un PC de bureau.",
                },
                {
                  q: "Comment imprimer mes reçus de caisse ?",
                  a: "K-Manage prend en charge les imprimantes de tickets de caisse thermiques de 58mm et 80mm en connexion USB ou Bluetooth, ainsi que l’impression standard A4 en PDF.",
                },
              ].map((item, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                    className="flex w-full items-center justify-between p-5 text-left font-bold text-slate-900 transition hover:bg-slate-50"
                  >
                    <span>{item.q}</span>
                    <span className="text-emerald-700 ml-4 font-bold text-lg">
                      {faqOpen === idx ? "−" : "+"}
                    </span>
                  </button>
                  {faqOpen === idx && (
                    <div className="px-5 pb-5 pt-1 text-sm leading-6 text-slate-600 border-t border-slate-100">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Bannière Finale CTA ─── */}
        <section className="px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl rounded-[2.5rem] bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-900 p-8 sm:p-14 text-white shadow-2xl relative overflow-hidden text-center sm:text-left">
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-8">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold sm:text-3xl tracking-tight">
                  Prêt à transformer la gestion de votre boutique ?
                </h2>
                <p className="mt-3 text-base text-emerald-100 leading-relaxed">
                  Créez votre compte en 2 minutes. Bénéficiez immédiatement de vos 30 jours d'essai gratuit,
                  puis 7000 FCFA/mois sans engagement.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <Link to="/register">
                  <Button size="lg" className="rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 font-extrabold px-7 shadow-lg">
                    Démarrer gratuitement <ArrowRight className="size-5" />
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className="rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20 transition"
                >
                  Tous les détails
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Pied de page ─── */}
      <footer className="border-t border-slate-100 bg-slate-950 px-5 py-12 text-white sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-slate-800 pb-8">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white">
                <ClipboardList className="size-5" />
              </span>
              <span className="text-lg font-bold">K-Manage</span>
            </div>
            <p className="text-center text-xs text-slate-400">
              Logiciel de gestion commerciale & caisse · Montants en Francs CFA (XOF) · Passerelle FedaPay
            </p>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
              <a href="#accueil" className="hover:text-white">Accueil</a>
              <a href="#fonctionnalites" className="hover:text-white">Fonctionnalités</a>
              <a href="#tarif" className="hover:text-white">Tarifs</a>
              <Link to="/login" className="text-emerald-400 hover:text-white">Se connecter</Link>
            </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} K-Manage. Tous droits réservés.</p>
            <p>Conçu pour propulser le commerce de proximité en Afrique de l’Ouest.</p>
          </div>
        </div>
      </footer>

      {/* ─── Modale Complète "Tous les Détails" ─── */}
      <Modal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Détails complets de l’offre K-Manage"
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between w-full gap-3">
            <p className="text-xs text-slate-500">
              Essai gratuit de 30 jours, puis 7000 FCFA/mois via FedaPay.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDetailsOpen(false)}>
                Fermer
              </Button>
              <Link to="/register" onClick={() => setDetailsOpen(false)}>
                <Button className="bg-emerald-700 text-white hover:bg-emerald-800 font-bold">
                  Créer mon compte gratuit <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        }
      >
        <div className="space-y-6 text-sm text-slate-700">
          <div className="relative h-36 w-full overflow-hidden rounded-2xl shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=1200&q=80"
              alt="Boutique et commerce de détail moderne"
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/95 via-emerald-950/70 to-transparent flex items-center p-5">
              <div>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wide">
                  Solution Complète Clé en Main
                </span>
                <h3 className="mt-1 text-lg font-bold text-white">Tous les modules inclus dans votre essai</h3>
                <p className="text-xs text-emerald-100">Aucun bridage, aucune fonctionnalité cachée.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100 flex items-start gap-3">
            <Sparkle className="size-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-950">1 mois d’essai offert sans restriction</p>
              <p className="text-xs text-emerald-800 mt-1">
                Toutes les fonctionnalités listées ci-dessous sont débloquées à 100% dès la création de votre boutique.
                Aucune carte bancaire n’est requise pour commencer.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="size-4 text-emerald-700" /> Point de Vente & Ventes au comptoir
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                <li>Saisie rapide au clavier ou écran tactile</li>
                <li>Recherche instantanée et lecture de code-barres par caméra ou douchette</li>
                <li>Impression de tickets thermiques 58mm et 80mm</li>
                <li>Modes de règlement : Espèces, Mobile Money, Carte, Crédit</li>
                <li>Vente en attente et historique complet des tickets</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <Package className="size-4 text-emerald-700" /> Stocks & Approvisionnements
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                <li>Suivi précis des entrées, sorties et ajustements</li>
                <li>Alertes automatiques avant rupture de stock</li>
                <li>Importation et exportation de catalogue Excel / CSV</li>
                <li>Impression d'étiquettes avec prix et codes-barres</li>
                <li>Valorisation du stock au prix d'achat et de vente</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <Users className="size-4 text-emerald-700" /> Clients & Dettes (Crédits)
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                <li>Répertoire complet des clients et historique de leurs achats</li>
                <li>Suivi strict des crédits accordés et des échéances</li>
                <li>Enregistrement des acomptes et règlements partiels</li>
                <li>Reçu de versement imprimable pour le client</li>
                <li>Blocage optionnel des ventes anonymes selon vos réglages</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="size-4 text-emerald-700" /> Passerelle FedaPay & Facturation
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                <li>Paiement de l'abonnement à 7000 FCFA/mois</li>
                <li>Prise en charge de MTN Momo, Moov Money, Orange, Wave et CB</li>
                <li>Zéro débit automatique : vous décidez quand renouveler</li>
                <li>Reçus de paiement officiels disponibles dans votre espace</li>
                <li>Paiements vérifiés et garantis par FedaPay</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-700" /> Comparatif Formules
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase">
                    <th className="py-2">Fonctionnalité</th>
                    <th className="py-2 text-center">Essai 1 mois</th>
                    <th className="py-2 text-center text-emerald-700 font-bold">Abonnement Pro (7000 F)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 font-medium">Nombre d'articles et de ventes</td>
                    <td className="py-2 text-center text-emerald-700 font-bold">Illimité</td>
                    <td className="py-2 text-center text-emerald-700 font-bold">Illimité</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Point de vente & Tickets de caisse</td>
                    <td className="py-2 text-center text-emerald-700 font-bold">Inclus</td>
                    <td className="py-2 text-center text-emerald-700 font-bold">Inclus</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Gestion du stock & alertes ruptures</td>
                    <td className="py-2 text-center text-emerald-700 font-bold">Inclus</td>
                    <td className="py-2 text-center text-emerald-700 font-bold">Inclus</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Carnet de dettes & crédits clients</td>
                    <td className="py-2 text-center text-emerald-700 font-bold">Inclus</td>
                    <td className="py-2 text-center text-emerald-700 font-bold">Inclus</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Multi-utilisateurs (Gérant, Caissiers)</td>
                    <td className="py-2 text-center text-emerald-700 font-bold">Inclus</td>
                    <td className="py-2 text-center text-emerald-700 font-bold">Inclus</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Paiement Mobile Money / Carte</td>
                    <td className="py-2 text-center text-slate-400">Non requis</td>
                    <td className="py-2 text-center text-emerald-700 font-bold">FedaPay 7000 F/mois</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
