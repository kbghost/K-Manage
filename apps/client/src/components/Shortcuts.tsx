import { useEffect, useRef } from "react";
import { Modal } from "./ui";

export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Ctrl + K  ou  /", label: "Recherche rapide (pages, produits, clients, ventes)" },
  { keys: "N", label: "Nouvelle vente (point de vente)" },
  { keys: "G puis D", label: "Tableau de bord" }, { keys: "G puis P", label: "Produits" }, { keys: "G puis S", label: "Stocks" },
  { keys: "G puis V", label: "Ventes" }, { keys: "G puis C", label: "Clients" }, { keys: "G puis K", label: "Caisse" }, { keys: "G puis R", label: "Rapports" },
  { keys: "T", label: "Basculer mode clair / sombre" }, { keys: "?", label: "Afficher cette aide" }, { keys: "Échap", label: "Fermer la fenêtre ouverte" },
];
const GO: Record<string, [string, string]> = { d: ["/", "reports.read"], p: ["/products", "products.read"], s: ["/stock", "stock.read"], v: ["/sales", "sales.read"], c: ["/customers", "customers.read"], k: ["/cash", "cash.manage"], r: ["/reports", "reports.read"] };
const typing = (t: EventTarget | null) => { const el = t as HTMLElement | null; return !!el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable); };

/** Raccourcis clavier globaux (ignores pendant la saisie dans un champ). */
export function useGlobalShortcuts(o: { onPalette: () => void; onHelp: () => void; go: (to: string) => void; toggleTheme: () => void; can: (p: string) => boolean; disabled?: boolean }) {
  const ref = useRef(o); ref.current = o; const pendingG = useRef<number>(0);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const c = ref.current; if (c.disabled) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); c.onPalette(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      const key = e.key.toLowerCase();
      if (pendingG.current && Date.now() - pendingG.current < 1200) {
        pendingG.current = 0; const t = GO[key];
        if (t) { e.preventDefault(); if (c.can(t[1])) c.go(t[0]); } return;
      }
      if (key === "g") { pendingG.current = Date.now(); return; }
      if (key === "/") { e.preventDefault(); c.onPalette(); }
      else if (key === "?") { e.preventDefault(); c.onHelp(); }
      else if (key === "n" && c.can("sales.create")) { e.preventDefault(); c.go("/pos"); }
      else if (key === "t") c.toggleTheme();
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
}

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Raccourcis clavier" size="md">
      <ul className="divide-y divide-slate-100">{SHORTCUTS.map((s) => <li key={s.keys} className="flex items-center justify-between gap-4 py-2.5 text-sm"><span className="text-slate-700">{s.label}</span><kbd className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">{s.keys}</kbd></li>)}</ul>
      <p className="mt-3 text-xs text-slate-500">Astuce : « G » puis une lettre fonctionne comme dans Gmail. Les raccourcis sont désactivés pendant la saisie dans un champ.</p>
    </Modal>
  );
}
