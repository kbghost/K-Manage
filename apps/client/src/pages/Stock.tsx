import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, ClipboardCheck, PackageX, Plus, Warehouse } from "../components/icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAction, useData, useList } from "../lib/hooks";
import { fmtDateTime, qty, todayStr, addDaysStr } from "../lib/format";
import type { Product } from "../lib/types";
import { Badge, Button, Card, DataTable, EmptyState, Input, Modal, PageHeader, Pagination, Select, Spinner } from "../components/ui";
import { ProductPicker } from "../components/ProductPicker";

interface Mv { id: string; type: string; quantity: number; stockAfter: number; reason?: string; createdAt: string; product?: { name: string; sku: string } }
const TYPES: Record<string, string> = {
  initial: "Stock de départ",
  entry: "Entrée en stock",
  exit: "Sortie (casse/perte)",
  adjustment: "Correction après comptage",
  sale: "Vente client",
  refund: "Retour client",
  purchase_receipt: "Arrivée achat fournisseur",
  import: "Import de fichier",
};

function MovementModal({ open, onClose, defaultProduct }: { open: boolean; onClose: () => void; defaultProduct?: Product | null }) {
  const [p, setP] = useState<Product | null>(defaultProduct ?? null); const [type, setType] = useState("entry"); const [quantity, setQuantity] = useState(""); const [reason, setReason] = useState("");
  useEffect(() => {
    if (open && defaultProduct) {
      setP(defaultProduct);
    }
  }, [open, defaultProduct]);
  const save = useAction(() => {
    const n = Number(quantity.replace(",", "."));
    return api("POST", "/stock/movements", type === "adjustment" ? { type, productId: p!.id, countedQuantity: n, reason } : { type, productId: p!.id, quantity: n, reason: reason || undefined });
  }, { invalidate: ["stock-movements", "stock-alerts", "products", "pos-products"], success: "Mouvement de stock enregistré avec succès.", onSuccess: () => { setP(null); setQuantity(""); setReason(""); onClose(); } });
  const n = Number(quantity.replace(",", ".")); const needReason = type !== "entry"; const valid = !!p && quantity !== "" && Number.isFinite(n) && n >= 0 && (type === "adjustment" || n > 0) && (!needReason || reason.trim().length >= 3);

  return (
    <Modal open={open} onClose={onClose} title="Entrée ou sortie manuelle de stock" footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate(undefined)}>Enregistrer l'opération</Button></>}>
      <div className="space-y-3.5">
        <ProductPicker label="Choisir l'article concerné" value={p} onChange={setP} />
        <Select label="Type d'opération" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="entry">Entrée de stock (nouvel arrivage / retour)</option>
          <option value="exit">Sortie manuelle (casse, perte, produit gâté, usage personnel)</option>
          <option value="adjustment">Correction : fixer la quantité réellement comptée</option>
        </Select>
        <Input label={type === "adjustment" ? "Quantité réelle comptée en rayon" : "Quantité à ajouter ou retirer"} inputMode="decimal" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} hint={type === "adjustment" && p ? `Stock actuellement enregistré : ${qty(p.stock)} ${p.unit}` : undefined} />
        <Input label={needReason ? "Raison ou motif (obligatoire)" : "Motif ou commentaire (facultatif)"} placeholder="Ex : 2 bouteilles cassées lors du déchargement..." value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}

function InventoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const products = useList<Product>("inv-products", "/catalog/products", { limit: 100, sort: "name" }, open);
  const [counted, setCounted] = useState<Record<string, string>>({}); const [note, setNote] = useState("");
  const items = Object.entries(counted).filter(([, v]) => v !== "" && Number.isFinite(Number(v.replace(",", ".")))).map(([productId, v]) => ({ productId, counted: Number(v.replace(",", ".")) })).filter((i) => { const p = products.items?.find((x) => x.id === i.productId); return p && p.stock !== i.counted; });
  const save = useAction(() => api("POST", "/stock/inventory", { note, items }), { invalidate: ["stock-movements", "stock-alerts", "products", "pos-products"], success: "Comptage inventaire enregistré avec succès.", onSuccess: () => { setCounted({}); setNote(""); onClose(); } });

  return (
    <Modal open={open} onClose={onClose} title="Comptage des stocks (Inventaire complet)" size="xl" footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button disabled={items.length === 0 || note.trim().length < 3} loading={save.isPending} onClick={() => save.mutate(undefined)}>Valider {items.length} correction(s)</Button></>}>
      <Input label="Nom de l'inventaire" placeholder="Ex : Grand comptage de fin de mois" value={note} onChange={(e) => setNote(e.target.value)} className="mb-3" />
      <p className="mb-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        Indiquez simplement la quantité que vous avez comptée de vos propres yeux en rayon. Laissez vide les articles non comptés. Seuls les écarts seront corrigés.
      </p>
      {products.loading ? <Spinner label="Chargement de vos articles..." /> : (
        <DataTable rows={products.items} columns={[
          { key: "n", header: "Article", render: (p) => <div><p className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</p><p className="text-xs text-slate-400 font-mono">{p.sku}</p></div> },
          { key: "s", header: "Stock attendu", align: "right", render: (p) => <span className="tabular-nums font-medium">{qty(p.stock)} {p.unit}</span> },
          { key: "c", header: "Quantité réelle comptée", align: "right", render: (p) => <input aria-label={`Quantite comptee ${p.name}`} inputMode="decimal" placeholder="—" value={counted[p.id] ?? ""} onChange={(e) => setCounted((c) => ({ ...c, [p.id]: e.target.value }))} className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-2 py-1 text-right text-sm font-semibold tabular-nums" /> },
          { key: "e", header: "Différence", align: "right", render: (p) => { const v = counted[p.id]; if (!v) return <span className="text-slate-300">—</span>; const d = Number(v.replace(",", ".")) - p.stock; return <span className={d === 0 ? "text-slate-400 font-medium" : d < 0 ? "font-bold text-red-600" : "font-bold text-emerald-700"}>{d > 0 ? "+" : ""}{qty(d)}</span>; } },
        ]} />
      )}
    </Modal>
  );
}

export default function Stock() {
  const { can } = useAuth(); const [tab, setTab] = useState<"alerts" | "moves">("alerts"); const [page, setPage] = useState(1); const [type, setType] = useState(""); const [sp, setSp] = useSearchParams(); const [mv, setMv] = useState(sp.get("new") === "1"); const [mvProd, setMvProd] = useState<Product | null>(null);
  useEffect(() => { if (sp.get("new")) setSp({}, { replace: true }); }, []);
  const [inv, setInv] = useState(false);
  const to = todayStr(); const [days, setDays] = useState("30");
  const alerts = useData<{ low: Product[]; out: Product[] }>("stock-alerts", "/stock/alerts");
  const moves = useList<Mv>("stock-movements", "/stock/movements", { page, limit: 20, type, from: days === "all" ? undefined : addDaysStr(to, -Number(days)), to: days === "all" ? undefined : to }, tab === "moves");
  const totalAlerts = (alerts.data?.low.length ?? 0) + (alerts.data?.out.length ?? 0);

  return (
    <>
      <PageHeader
        title="Stocks"
        subtitle="Alertes de rupture, historique des entrées/sorties et comptage d'inventaire."
        actions={can("stock.adjust") ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setInv(true)} className="flex-1 sm:flex-initial"><ClipboardCheck className="size-4" />Faire l'inventaire</Button>
            <Button onClick={() => { setMvProd(null); setMv(true); }} className="flex-1 sm:flex-initial"><Plus className="size-4" />Nouvelle entrée / sortie</Button>
          </div>
        ) : undefined}
      />

      <div role="tablist" className="mb-5 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1.5 shadow-inner">
        <button
          role="tab"
          aria-selected={tab === "alerts"}
          onClick={() => setTab("alerts")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-semibold transition-all ${
            tab === "alerts"
              ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-sm font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <span>Articles en alerte</span>
          {totalAlerts > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-950/60 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-400">
              {totalAlerts}
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === "moves"}
          onClick={() => setTab("moves")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-semibold transition-all ${
            tab === "moves"
              ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-sm font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <span>Historique mouvements</span>
        </button>
      </div>

      {tab === "alerts" ? (alerts.isLoading ? <Spinner label="Vérification des stocks..." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Articles totalement épuisés (Rupture)" actions={<PackageX className="size-5 text-red-500" />}>
            {alerts.data?.out.length ? (
              <DataTable rows={alerts.data.out} columns={[
                { key: "n", header: "Article", render: (p) => <div><p className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</p><p className="font-mono text-xs text-slate-400">{p.sku}</p></div> },
                { key: "s", header: "Stock restant", align: "right", render: (p) => <Badge tone="red">0 {p.unit}</Badge> },
                { key: "a", header: "", align: "right", render: (p) => can("stock.adjust") ? (
                  <Button size="sm" variant="secondary" onClick={() => { setMvProd(p); setMv(true); }} className="text-xs">
                    <Plus className="size-3.5" />Réapprovisionner
                  </Button>
                ) : null },
              ]} />
            ) : (
              <EmptyState icon={Warehouse} title="Aucun article épuisé" text="Félicitations, aucun de vos articles n'est en rupture totale." />
            )}
          </Card>
          <Card title="Articles presque finis (Sous le seuil)" actions={<AlertTriangle className="size-5 text-amber-500" />}>
            {alerts.data?.low.length ? (
              <DataTable rows={alerts.data.low} columns={[
                { key: "n", header: "Article", render: (p) => <div><p className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</p><p className="font-mono text-xs text-slate-400">{p.sku}</p></div> },
                { key: "s", header: "Quantité en rayon", align: "right", render: (p) => <Badge tone="amber">{qty(p.stock)} {p.unit}</Badge> },
                { key: "t", header: "Seuil d'alerte", align: "right", render: (p) => <span className="text-slate-500 dark:text-slate-400 font-medium">{qty(p.alertThreshold)}</span> },
                { key: "a", header: "", align: "right", render: (p) => can("stock.adjust") ? (
                  <Button size="sm" variant="secondary" onClick={() => { setMvProd(p); setMv(true); }} className="text-xs">
                    <Plus className="size-3.5" />Réapprovisionner
                  </Button>
                ) : null },
              ]} />
            ) : (
              <EmptyState icon={Warehouse} title="Aucun stock faible" text="Tous vos articles ont un niveau de stock convenable." />
            )}
          </Card>
        </div>
      )) : (
        <Card>
          <div className="mb-4 flex flex-wrap gap-2.5 sm:gap-3">
            <Select label="Filtrer par opération" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="w-full sm:w-56"><option value="">Toutes les opérations</option>{Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
            <Select label="Période" value={days} onChange={(e) => { setDays(e.target.value); setPage(1); }} className="w-full sm:w-44"><option value="7">7 derniers jours</option><option value="30">30 derniers jours</option><option value="90">3 derniers mois</option><option value="all">Tout l'historique</option></Select>
          </div>
          <DataTable rows={moves.items} loading={moves.loading} error={moves.error} onRetry={() => void moves.refetch()} columns={[
            { key: "p", header: "Article", render: (m) => <span className="font-semibold text-slate-800 dark:text-slate-100">{m.product?.name ?? "—"}</span> },
            { key: "t", header: "Opération", render: (m) => <Badge tone={m.quantity < 0 ? "red" : "green"}>{TYPES[m.type] ?? m.type}</Badge> },
            { key: "q", header: "Quantité", align: "right", render: (m) => <span className={m.quantity < 0 ? "font-bold text-red-600 dark:text-red-400 tabular-nums" : "font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"}>{m.quantity > 0 ? "+" : ""}{qty(m.quantity)}</span> },
            { key: "s", header: "Stock après", align: "right", render: (m) => <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">{qty(m.stockAfter)}</span> },
            { key: "d", header: "Date et heure", render: (m) => fmtDateTime(m.createdAt) },
            { key: "r", header: "Motif / Raison", render: (m) => <span className="text-slate-600 dark:text-slate-400">{m.reason || "—"}</span> },
          ]} />
          <Pagination meta={moves.meta} onPage={setPage} />
        </Card>
      )}
      <MovementModal open={mv} onClose={() => { setMv(false); setMvProd(null); }} defaultProduct={mvProd} />
      <InventoryModal open={inv} onClose={() => setInv(false)} />
    </>
  );
}
