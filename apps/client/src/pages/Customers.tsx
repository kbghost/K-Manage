import { useState } from "react";
import { HandCoins, Printer } from "../components/icons";
import { useQuery } from "@tanstack/react-query";
import { api, newKey } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAction, useData, useList } from "../lib/hooks";
import { fmtDate, fmtDateTime, methodLabel, money } from "../lib/format";
import type { Party, Payment, Sale } from "../lib/types";
import { Badge, Button, Card, DataTable, Modal, MoneyInput, Pagination, Select, Spinner } from "../components/ui";
import { PartyList } from "../components/PartyList";

interface Recv extends Party { openSales: number; oldest?: string; overdue: boolean }
interface Settled { payments: Payment[]; remaining: number }

function CustomerModal({ party, onClose }: { party: Party | null; onClose: () => void }) {
  const { can, business } = useAuth(); const [page, setPage] = useState(1); const [amount, setAmount] = useState(0); const [method, setMethod] = useState("cash"); const [key, setKey] = useState(newKey()); const [done, setDone] = useState<Settled | null>(null);
  const detail = useQuery({ queryKey: ["customer", party?.id], enabled: !!party, queryFn: async () => (await api<Party>("GET", `/parties/customers/${party!.id}`)).data });
  const sales = useList<Sale>("customer-sales", `/parties/customers/${party?.id}/sales`, { page, limit: 8 }, !!party);
  const settle = useAction(() => api<Settled>("POST", `/parties/customers/${party!.id}/settlements`, { amount, method }, { idempotencyKey: key }), { invalidate: ["customers", "customer", "customer-sales", "receivables", "sales", "cash-current"], success: "Paiement du client enregistré avec succès.", onSuccess: (r) => { setDone(r.data); setAmount(0); setKey(newKey()); } });
  const balance = detail.data?.balance ?? party?.balance ?? 0; const methods = business?.settings.paymentMethods ?? ["cash"];

  return (
    <Modal open={!!party} onClose={() => { setDone(null); onClose(); }} title={party?.name ?? ""} size="lg">
      {!party || detail.isLoading ? <Spinner label="Chargement de la fiche client..." /> : done ? (
        <div className="space-y-4 text-sm">
          <div className="print-area rounded-2xl border border-slate-200 bg-slate-50/50 p-5 font-sans">
            <p className="text-base font-bold text-slate-900">Reçu de paiement (Règlement dette)</p>
            <p className="text-sm font-medium text-slate-700">{business?.name}</p>
            <p className="text-xs text-slate-500 mt-1">Client : <b>{party.name}</b></p>
            <p className="text-xs text-slate-500">{fmtDateTime(done.payments[0]?.createdAt ?? new Date(), business?.timezone)}</p>
            <ul className="my-3 divide-y divide-slate-200 border-y border-slate-200 py-2">
              {done.payments.map((p) => (
                <li key={p.id} className="flex justify-between py-1 text-sm">
                  <span>Paiement ({methodLabel(p.method)})</span>
                  <span className="font-semibold">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1 text-right">
              <p className="font-bold text-emerald-700">Total payé : {money(done.payments.reduce((s, p) => s + p.amount, 0))}</p>
              <p className="text-sm font-semibold text-slate-700">Reste à payer : {money(done.remaining)}</p>
            </div>
          </div>
          <div className="no-print flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDone(null)}>Retour à la fiche</Button>
            <Button onClick={() => window.print()}><Printer className="size-4" />Imprimer le reçu</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-slate-500">{[party.phone, party.email, party.address].filter(Boolean).join(" · ") || "Aucune coordonnée renseignée"}</p>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Crédit en cours (Ce qu'il vous doit)</span>
              <p className={`text-xl font-bold mt-0.5 ${balance > 0 ? "text-amber-700" : "text-emerald-700"}`}>{money(balance)}</p>
            </div>
            {balance === 0 && <Badge tone="green">À jour</Badge>}
          </div>

          {balance > 0 && can("customers.manage") && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="font-bold text-slate-800">Encaisser un versement de ce client</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <MoneyInput label="Somme versée" value={amount} onChange={setAmount} error={amount > balance ? "Dépasse la dette du client" : undefined} />
                <Select label="Mode de paiement" value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}</Select>
                <div className="flex gap-1.5">
                  <Button variant="secondary" onClick={() => setAmount(balance)}>Tout solder</Button>
                  <Button loading={settle.isPending} disabled={amount < 1 || amount > balance} onClick={() => settle.mutate(undefined)}>
                    <HandCoins className="size-4" />Encaisser
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-500">Ce versement vient déduire automatiquement ses achats à crédit les plus anciens.</p>
            </div>
          )}

          <div>
            <h3 className="mb-2 font-semibold text-slate-800">Historique de ses achats</h3>
            <DataTable rows={sales.items} loading={sales.loading} columns={[
              { key: "n", header: "N° Vente", render: (s) => <span className="font-medium">{s.number}</span> },
              { key: "d", header: "Date", render: (s) => fmtDate(s.createdAt, business?.timezone) },
              { key: "t", header: "Total", align: "right", render: (s) => money(s.total) },
              { key: "r", header: "Reste", align: "right", render: (s) => (s.remaining ? <Badge tone="amber">{money(s.remaining)}</Badge> : s.status === "cancelled" ? <Badge>Annulée</Badge> : <Badge tone="green">Payée</Badge>) },
            ]} />
            <Pagination meta={sales.meta} onPage={setPage} />
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Customers() {
  const { business } = useAuth(); const [open, setOpen] = useState<Party | null>(null);
  const rec = useData<Recv[]>("receivables", "/parties/customers/receivables/list");
  const total = rec.data?.reduce((s, r) => s + r.balance, 0) ?? 0;
  const late = rec.data?.filter((r) => r.overdue) ?? [];

  return (
    <>
      <PartyList
        kind="customers"
        title="Clients"
        subtitle="Fiches de vos clients, coordonnées et suivi de leurs crédits en cours."
        balanceLabel="Crédit en cours"
        manage="customers.manage"
        onOpen={setOpen}
        extra={rec.data && rec.data.length > 0 ? (
          <Card className="mb-4" title={`Crédits clients à récupérer — ${money(total)}`}>
            {late.length > 0 && (
              <p className="mb-3 rounded-xl bg-red-50 p-3 text-xs sm:text-sm font-medium text-red-800 border border-red-200">
                {late.length} client(s) ont dépassé le délai autorisé ({business?.settings.creditDueDays} jours) : {late.map((l) => l.name).join(", ")}.
              </p>
            )}
            <DataTable rows={rec.data} onRowClick={setOpen} columns={[
              { key: "n", header: "Client", render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
              { key: "o", header: "Ventes non soldées", align: "right", render: (r) => r.openSales },
              { key: "s", header: "Date du 1er crédit", render: (r) => (r.oldest ? fmtDate(r.oldest, business?.timezone) : "—") },
              { key: "b", header: "Somme due", align: "right", render: (r) => <Badge tone={r.overdue ? "red" : "amber"}>{money(r.balance)}</Badge> },
            ]} />
          </Card>
        ) : null}
      />
      <CustomerModal party={open} onClose={() => setOpen(null)} />
    </>
  );
}
