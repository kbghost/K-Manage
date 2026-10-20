import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Ban, Printer, RotateCcw } from "../components/icons";
import { useQuery } from "@tanstack/react-query";
import { api, newKey } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAction, useList } from "../lib/hooks";
import { fmtDateTime, methodLabel, money, qty } from "../lib/format";
import type { Sale } from "../lib/types";
import { Badge, Button, Card, DataTable, Input, Modal, MoneyInput, PageHeader, Pagination, SearchBox, Select, Spinner, errMsg, useToast, type Tone } from "../components/ui";
import { Receipt, printReceiptContent } from "../components/Receipt";

const STATUS: Record<string, [string, Tone]> = {
  paid: ["Payée", "green"],
  partial: ["Acompte payé", "amber"],
  unpaid: ["À crédit", "red"],
  cancelled: ["Annulée", "gray"],
};

export function SaleDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can, business } = useAuth(); const toast = useToast();
  const q = useQuery({ queryKey: ["sale", id], enabled: !!id, queryFn: async () => (await api<Sale>("GET", `/sales/${id}`)).data });
  const [mode, setMode] = useState<"" | "refund" | "cancel" | "pay" | "receipt">(""); const [reason, setReason] = useState(""); const [restock, setRestock] = useState(true); const [method, setMethod] = useState("cash"); const [amount, setAmount] = useState(0);
  const [rq, setRq] = useState<Record<number, string>>({}); const [payKey, setPayKey] = useState(newKey());
  const receiptRef = useRef<HTMLDivElement>(null);
  const sale = q.data; const methods = business?.settings.paymentMethods ?? ["cash"];
  const reset = () => { setMode(""); setReason(""); setRq({}); setAmount(0); setPayKey(newKey()); void q.refetch(); };
  const inv = ["sales", "sale", "products", "pos-products", "customers", "cash-current", "stock-alerts"];
  const refund = useAction(() => api("POST", `/sales/${id}/refund`, { lines: Object.entries(rq).filter(([, v]) => Number(v.replace(",", ".")) > 0).map(([i, v]) => ({ lineIndex: Number(i), quantity: Number(v.replace(",", ".")) })), reason, restock, method }), { invalidate: inv, success: "Remboursement enregistré avec succès.", onSuccess: reset });
  const cancel = useAction(() => api("POST", `/sales/${id}/cancel`, { reason, restock, method }), { invalidate: inv, success: "Vente annulée.", onSuccess: reset });
  const pay = useAction(() => api("POST", `/sales/${id}/payments`, { amount, method }, { idempotencyKey: payKey }), { invalidate: inv, success: "Paiement enregistré avec succès.", onSuccess: reset });
  const close = () => { reset(); onClose(); };
  const active = sale?.status === "completed";

  return (
    <Modal open={!!id} onClose={close} title={sale ? `Détail de la vente ${sale.number}` : "Vente"} size="lg">
      {q.isLoading || !sale ? <Spinner label="Chargement des détails..." /> : mode === "receipt" ? (
        <div>
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 print:border-none print:bg-white print:p-0 print:max-h-none"><Receipt ref={receiptRef} sale={sale} business={sale.business} /></div>
          <div className="no-print mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode("")}>Retour</Button>
            <Button onClick={() => printReceiptContent(receiptRef.current, sale.business?.receipt?.paperWidth ?? "80mm")}><Printer className="size-4" />Imprimer le reçu</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Badge tone={STATUS[sale.paymentStatus]?.[1]}>{STATUS[sale.paymentStatus]?.[0]}</Badge>
              <span className="text-slate-600 font-medium">{sale.customerName ?? "Client de passage (comptoir)"}</span>
            </div>
            <span className="text-xs text-slate-500">{fmtDateTime(sale.createdAt, business?.timezone)} · Vendeur : {sale.cashier ?? "—"}</span>
          </div>

          {sale.cancelReason && <p className="rounded-xl bg-red-50 p-3 text-red-800 font-medium">Motif de l'annulation : {sale.cancelReason}</p>}

          <DataTable rows={sale.lines.map((l, i) => ({ ...l, id: String(i) }))} columns={[
            { key: "n", header: "Article", render: (l) => <span className="font-medium text-slate-800">{l.name}</span> },
            { key: "q", header: "Quantité", align: "right", render: (l) => qty(l.quantityMilli / 1000) },
            { key: "p", header: "Prix unitaire", align: "right", render: (l) => money(l.unitPrice) },
            { key: "t", header: "Total", align: "right", render: (l) => money(l.total - l.discount) },
            { key: "r", header: "Remboursé", align: "right", render: (l) => (l.refundedQtyMilli ? `${qty(l.refundedQtyMilli / 1000)} (${money(l.refundedValue)})` : "—") },
            ...(mode === "refund" ? [{ key: "x", header: "À rembourser", align: "right" as const, render: (l: typeof sale.lines[number] & { id: string }) => { const max = (l.quantityMilli - l.refundedQtyMilli) / 1000; return max > 0 ? <input aria-label={`Quantite a rembourser ${l.name}`} inputMode="decimal" placeholder={`max ${qty(max)}`} value={rq[Number(l.id)] ?? ""} onChange={(e) => setRq((r) => ({ ...r, [Number(l.id)]: e.target.value }))} className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm font-medium" /> : "—"; } }] : []),
          ]} />

          <dl className="ml-auto max-w-xs space-y-1.5 rounded-xl bg-slate-50 p-3.5 text-sm">
            {sale.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Réduction accordée</dt><dd>-{money(sale.discount)}</dd></div>}
            <div className="flex justify-between font-bold text-slate-900"><dt>Montant total</dt><dd>{money(sale.total)}</dd></div>
            {sale.refundedTotal > 0 && <div className="flex justify-between text-red-600"><dt>Marchandises retournées</dt><dd>-{money(sale.refundedTotal)}</dd></div>}
            <div className="flex justify-between border-t border-slate-200 pt-1 text-slate-700"><dt>Montant déjà payé</dt><dd className="font-medium">{money(sale.paidAmount)}</dd></div>
            <div className="flex justify-between font-bold"><dt>Reste à payer</dt><dd className={sale.remaining ? "text-amber-700 font-bold" : "text-emerald-700"}>{money(sale.remaining)}</dd></div>
          </dl>

          {sale.payments && sale.payments.length > 0 && (
            <div className="rounded-xl border border-slate-100 p-3">
              <h3 className="mb-1.5 font-semibold text-slate-800">Historique des versements</h3>
              <ul className="space-y-1 text-slate-600 text-xs">
                {sale.payments.map((p) => (
                  <li key={p.id} className="flex justify-between border-b border-slate-100 py-1 last:border-0">
                    <span>{fmtDateTime(p.createdAt, business?.timezone)} — {p.direction === "in" ? "Paiement client" : "Remboursement"} ({methodLabel(p.method)})</span>
                    <span className="font-semibold">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sale.ledger && !sale.ledger.consistent && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700 font-medium">Attention : le solde enregistré ne correspond pas aux paiements. Signalez-le au responsable.</p>}

          {(mode === "refund" || mode === "cancel") && (
            <div className="space-y-3 rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
              <p className="font-bold text-slate-800">{mode === "refund" ? "Rembourser le client" : "Annuler toute la vente"}</p>
              <Input label="Raison / Motif (obligatoire)" placeholder="Ex : erreur de saisie, client a changé d'avis..." value={reason} onChange={(e) => setReason(e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="checkbox" className="rounded text-brand-600" checked={restock} onChange={(e) => setRestock(e.target.checked)} />Remettre automatiquement les articles en rayon (stock)</label>
              <Select label="Moyen de remboursement (si de l'argent est rendu)" value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}</Select>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setMode("")}>Retour</Button>
                {mode === "refund" ? (
                  <Button variant="danger" loading={refund.isPending} disabled={reason.trim().length < 3 || !Object.values(rq).some((v) => Number(v.replace(",", ".")) > 0)} onClick={() => refund.mutate(undefined)}>Confirmer le remboursement</Button>
                ) : (
                  <Button variant="danger" loading={cancel.isPending} disabled={reason.trim().length < 3} onClick={() => cancel.mutate(undefined)}>Confirmer l'annulation</Button>
                )}
              </div>
            </div>
          )}

          {mode === "pay" && (
            <div className="space-y-3 rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
              <p className="font-bold text-slate-800">Encaisser le reste dû ({money(sale.remaining)})</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Mode de paiement" value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}</Select>
                <MoneyInput label="Somme reçue" value={amount} onChange={setAmount} error={amount > sale.remaining ? "Dépasse le reste à payer" : undefined} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setMode("")}>Retour</Button>
                <Button loading={pay.isPending} disabled={amount < 1 || amount > sale.remaining} onClick={() => pay.mutate(undefined)}>Encaisser {money(amount)}</Button>
              </div>
            </div>
          )}

          {mode === "" && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="secondary" onClick={() => setMode("receipt")}><Printer className="size-4" />Voir / Imprimer le reçu</Button>
              {active && sale.remaining > 0 && can("sales.create") && <Button onClick={() => { setAmount(sale.remaining); setMode("pay"); }}>Encaisser le reste ({money(sale.remaining)})</Button>}
              {active && can("sales.refund") && <Button variant="secondary" onClick={() => setMode("refund")}><RotateCcw className="size-4" />Rembourser</Button>}
              {active && can("sales.cancel") && <Button variant="danger" onClick={() => setMode("cancel")}><Ban className="size-4" />Annuler la vente</Button>}
            </div>
          )}
        </div>
      )}
      {refund.error || cancel.error ? <p role="alert" className="mt-2 text-sm text-red-600">{errMsg(refund.error ?? cancel.error)}</p> : null}
      {void toast}
    </Modal>
  );
}

export default function Sales() {
  const { business } = useAuth(); const [sp] = useSearchParams(); const [page, setPage] = useState(1); const [q, setQ] = useState(sp.get("q") ?? ""); const [status, setStatus] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [open, setOpen] = useState<string | null>(null);
  const list = useList<Sale>("sales", "/sales", { page, limit: 20, q, status, from, to });

  return (
    <>
      <PageHeader title="Historique des ventes" subtitle="Consultez toutes les ventes réalisées, encaissez les crédits ou réimprimez les tickets." />
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-2.5 sm:gap-3">
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="N° de vente ou nom du client..." className="w-full sm:w-64" />
          <Select label="État" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="flex-1 min-w-[130px] sm:w-40 sm:flex-initial">
            <option value="">Toutes les ventes</option>
            <option value="completed">Ventes validées</option>
            <option value="cancelled">Ventes annulées</option>
          </Select>
          <Input label="Du (Date début)" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="flex-1 min-w-[130px] sm:w-40 sm:flex-initial" />
          <Input label="Au (Date fin)" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="flex-1 min-w-[130px] sm:w-40 sm:flex-initial" />
        </div>
        <DataTable rows={list.items} loading={list.loading} error={list.error} onRetry={() => void list.refetch()} onRowClick={(s) => setOpen(s.id)} columns={[
          { key: "n", header: "N° Reçu", render: (s) => <span className="font-semibold text-brand-700">{s.number}</span> },
          { key: "d", header: "Date et heure", render: (s) => fmtDateTime(s.createdAt, business?.timezone) },
          { key: "c", header: "Client", render: (s) => s.customerName ?? <span className="text-slate-400">Comptoir</span> },
          { key: "u", header: "Caissier", render: (s) => s.cashier ?? "—" },
          { key: "t", header: "Montant total", align: "right", render: (s) => <span className="font-bold tabular-nums">{money(s.total)}</span> },
          { key: "r", header: "Reste à payer", align: "right", render: (s) => (s.remaining ? <span className="font-semibold text-amber-700 tabular-nums">{money(s.remaining)}</span> : <span className="text-slate-400">—</span>) },
          { key: "s", header: "État du paiement", render: (s) => <Badge tone={STATUS[s.paymentStatus]?.[1]}>{STATUS[s.paymentStatus]?.[0]}</Badge> },
        ]} />
        <Pagination meta={list.meta} onPage={setPage} />
      </Card>
      <SaleDetail id={open} onClose={() => setOpen(null)} />
    </>
  );
}
