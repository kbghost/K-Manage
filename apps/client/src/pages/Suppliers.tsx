import { useState } from "react";
import { useList } from "../lib/hooks";
import { fmtDate, money } from "../lib/format";
import { useAuth } from "../lib/auth";
import type { Party, Purchase } from "../lib/types";
import { Badge, DataTable, Modal } from "../components/ui";
import { PartyList } from "../components/PartyList";

function SupplierModal({ party, onClose }: { party: Party | null; onClose: () => void }) {
  const { business } = useAuth(); const list = useList<Purchase>("supplier-purchases", `/parties/suppliers/${party?.id}/purchases`, { limit: 10 }, !!party);
  return (
    <Modal open={!!party} onClose={onClose} title={party?.name ?? ""} size="lg">
      <div className="space-y-4 text-sm">
        <p className="text-slate-500">{[party?.phone, party?.email, party?.address].filter(Boolean).join(" · ") || "Aucune coordonnée renseignée"}</p>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-100">
          <span className="font-semibold text-slate-700">Ce que vous devez à ce fournisseur</span>
          <span className={`text-xl font-bold tabular-nums ${party?.balance ? "text-amber-700" : "text-emerald-700"}`}>{money(party?.balance ?? 0)}</span>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-slate-800">Historique des commandes passées</h3>
          <DataTable rows={list.items} loading={list.loading} columns={[
            { key: "n", header: "N° Commande", render: (p) => <span className="font-medium text-brand-700">{p.number}</span> },
            { key: "d", header: "Date", render: (p) => fmtDate(p.createdAt, business?.timezone) },
            { key: "t", header: "Total", align: "right", render: (p) => <span className="font-bold tabular-nums">{money(p.total)}</span> },
            { key: "r", header: "Reste à payer", align: "right", render: (p) => (p.remaining ? <Badge tone="amber">{money(p.remaining)}</Badge> : <Badge tone="green">Payé</Badge>) },
          ]} />
        </div>
      </div>
    </Modal>
  );
}

export default function Suppliers() {
  const [open, setOpen] = useState<Party | null>(null);
  return (
    <>
      <PartyList kind="suppliers" title="Fournisseurs" subtitle="Vos grossistes, contacts et ce que vous leur devez." balanceLabel="Ce que vous devez" manage="suppliers.manage" onOpen={setOpen} />
      <SupplierModal party={open} onClose={() => setOpen(null)} />
    </>
  );
}
