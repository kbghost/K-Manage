import { useState } from "react";
import { ScrollText } from "../components/icons";
import { useList } from "../lib/hooks";
import { fmtDateTime } from "../lib/format";
import { useAuth } from "../lib/auth";
import { Badge, Card, DataTable, EmptyState, Input, PageHeader, Pagination, Select } from "../components/ui";

interface Log { id: string; action: string; userName?: string; resourceType?: string; resourceId?: string; details?: Record<string, unknown>; createdAt: string }
const ACTIONS: Record<string, string> = {
  "sale.refund": "Remboursement de vente",
  "sale.cancel": "Annulation de vente",
  "sale.discount": "Remise / Réduction accordée",
  "product.price_changed": "Prix article modifié",
  "product.archived": "Article archivé",
  "product.import": "Import d'articles (fichier)",
  "stock.exit": "Sortie manuelle de stock",
  "stock.adjustment": "Correction de stock",
  "stock.inventory": "Comptage complet inventaire",
  "cash.close": "Fermeture de caisse",
  "cash.correction": "Correction montant de caisse",
  "member.added": "Employé ajouté",
  "member.updated": "Rôle employé modifié",
  "member.revoked": "Accès employé retiré",
  "settings.updated": "Paramètres de la boutique modifiés",
  "expense.updated": "Dépense modifiée",
  "purchase.receive": "Réception marchandise fournisseur",
  "purchase.cancel": "Commande fournisseur annulée",
  "customer.settlement": "Paiement de crédit client",
  "product.active": "Article réactivé",
};

export default function Audit() {
  const { business } = useAuth(); const [page, setPage] = useState(1); const [action, setAction] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const list = useList<Log>("audit", "/audit-logs", { page, limit: 25, action, from, to });

  return (
    <>
      <PageHeader title="Journal des actions" subtitle="Historique de sécurité : qui a fait quoi, quand et comment. Protège votre boutique contre les erreurs." />
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-2.5 sm:gap-3">
          <Select label="Filtrer par action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-full sm:w-64">
            <option value="">Toutes les actions</option>
            {Object.entries(ACTIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Input label="Du" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="flex-1 min-w-[130px] sm:w-40 sm:flex-initial" />
          <Input label="Au" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="flex-1 min-w-[130px] sm:w-40 sm:flex-initial" />
        </div>
        <DataTable rows={list.items} loading={list.loading} error={list.error} onRetry={() => void list.refetch()} empty={<EmptyState icon={ScrollText} title="Aucun événement enregistré" />} columns={[
          { key: "a", header: "Opération effectuée", render: (l) => <Badge tone="blue">{ACTIONS[l.action] ?? l.action}</Badge> },
          { key: "u", header: "Auteur (Employé)", render: (l) => <span className="font-semibold text-slate-800 dark:text-slate-100">{l.userName ?? "—"}</span> },
          { key: "d", header: "Date et heure", render: (l) => fmtDateTime(l.createdAt, business?.timezone) },
          { key: "r", header: "Détails techniques", render: (l) => <code className="break-all text-xs text-slate-500 font-mono">{l.details ? JSON.stringify(l.details).slice(0, 140) : "—"}</code> },
        ]} />
        <Pagination meta={list.meta} onPage={setPage} />
      </Card>
    </>
  );
}
