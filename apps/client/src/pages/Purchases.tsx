import { useState } from "react";
import { Boxes, PackageCheck, Plus, Trash2 } from "../components/icons";
import { useQuery } from "@tanstack/react-query";
import { api, newKey } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAction, useList } from "../lib/hooks";
import { fmtDate, fmtDateTime, methodLabel, money, qty } from "../lib/format";
import type { Party, Payment, Product, Purchase } from "../lib/types";
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Modal, MoneyInput, PageHeader, Pagination, Select, Spinner, type Tone } from "../components/ui";
import { ProductPicker } from "../components/ProductPicker";

const ST: Record<string, [string, Tone]> = {
  ordered: ["Commande en attente", "blue"],
  partial: ["Reçu en partie", "amber"],
  received: ["Marchandises reçues", "green"],
  cancelled: ["Annulée", "gray"],
};
interface Line { product: Product; quantity: string; unitCost: number }

function NewPurchase({ open, onClose }: { open: boolean; onClose: () => void }) {
  const suppliers = useList<Party>("pu-suppliers", "/parties/suppliers", { limit: 100 }, open);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [p, setP] = useState<Product | null>(null);
  const total = lines.reduce((s, l) => s + Math.round((Number(l.quantity.replace(",", ".")) || 0) * l.unitCost), 0);
  const save = useAction(() => api("POST", "/purchases", { supplierId, lines: lines.map((l) => ({ productId: l.product.id, quantity: Number(l.quantity.replace(",", ".")), unitCost: l.unitCost })) }), { invalidate: ["purchases"], success: "Commande d'achat enregistrée avec succès.", onSuccess: () => { setLines([]); setSupplierId(""); onClose(); } });
  const valid = !!supplierId && lines.length > 0 && lines.every((l) => Number(l.quantity.replace(",", ".")) > 0);

  return (
    <Modal open={open} onClose={onClose} title="Enregistrer une commande d'achat fournisseur" size="xl" footer={<><span className="mr-auto self-center text-sm font-bold text-slate-800">Total estimé : {money(total)}</span><Button variant="secondary" onClick={onClose}>Annuler</Button><Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate(undefined)}>Enregistrer la commande</Button></>}>
      <div className="space-y-4">
        <Select label="Fournisseur ou grossiste" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">— Choisir le fournisseur —</option>
          {suppliers.items?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <ProductPicker label="Ajouter un article à la commande" value={p} onChange={(x) => { if (x) { setLines((l) => (l.some((y) => y.product.id === x.id) ? l : [...l, { product: x, quantity: "1", unitCost: x.costPrice ?? 0 }])); setP(null); } }} />
        {lines.length === 0 ? (
          <EmptyState icon={Boxes} title="Aucun article dans la commande" text="Cherchez les articles ci-dessus pour les ajouter au bon de commande." />
        ) : (
          <DataTable rows={lines.map((l) => ({ ...l, id: l.product.id }))} columns={[
            { key: "n", header: "Article", render: (l) => <span className="font-semibold text-slate-900">{l.product.name}</span> },
            { key: "q", header: "Quantité", align: "right", render: (l) => <input aria-label={`Quantite ${l.product.name}`} inputMode="decimal" value={l.quantity} onChange={(e) => setLines((all) => all.map((y) => (y.product.id === l.product.id ? { ...y, quantity: e.target.value } : y)))} className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm font-semibold tabular-nums" /> },
            { key: "c", header: "Prix d'achat unitaire", align: "right", render: (l) => <input aria-label={`Prix ${l.product.name}`} inputMode="numeric" value={l.unitCost || ""} onChange={(e) => setLines((all) => all.map((y) => (y.product.id === l.product.id ? { ...y, unitCost: Number(e.target.value.replace(/\D/g, "")) || 0 } : y)))} className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm font-semibold tabular-nums" /> },
            { key: "t", header: "Total", align: "right", render: (l) => <span className="font-bold tabular-nums">{money(Math.round((Number(l.quantity.replace(",", ".")) || 0) * l.unitCost))}</span> },
            { key: "x", header: "", render: (l) => <Button variant="ghost" size="sm" aria-label="Retirer" onClick={() => setLines((all) => all.filter((y) => y.product.id !== l.product.id))}><Trash2 className="size-4 text-red-500" /></Button> },
          ]} />
        )}
      </div>
    </Modal>
  );
}

function PurchaseDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can, business } = useAuth(); const q = useQuery({ queryKey: ["purchase", id], enabled: !!id, queryFn: async () => (await api<Purchase>("GET", `/purchases/${id}`)).data });
  const [mode, setMode] = useState<"" | "receive" | "pay">(""); const [rq, setRq] = useState<Record<number, string>>({}); const [amount, setAmount] = useState(0); const [method, setMethod] = useState("cash"); const [key, setKey] = useState(newKey()); const [cancel, setCancel] = useState(false);
  const pu = q.data; const methods = business?.settings.paymentMethods ?? ["cash"]; const done = () => { setMode(""); setRq({}); setAmount(0); setKey(newKey()); void q.refetch(); };
  const inv = ["purchases", "purchase", "products", "pos-products", "suppliers", "stock-alerts", "cash-current"];
  const receive = useAction(() => api("POST", `/purchases/${id}/receive`, { lines: Object.entries(rq).filter(([, v]) => Number(v.replace(",", ".")) > 0).map(([i, v]) => ({ lineIndex: Number(i), quantity: Number(v.replace(",", ".")) })) }), { invalidate: inv, success: "Réception confirmée : le stock a été augmenté.", onSuccess: done });
  const pay = useAction(() => api("POST", `/purchases/${id}/payments`, { amount, method }, { idempotencyKey: key }), { invalidate: inv, success: "Paiement fournisseur enregistré.", onSuccess: done });
  const cancelAct = useAction(() => api("POST", `/purchases/${id}/cancel`), { invalidate: inv, success: "Achat annulé.", onSuccess: () => { setCancel(false); done(); } });

  return (
    <Modal open={!!id} onClose={() => { done(); onClose(); }} title={pu ? `Commande d'achat ${pu.number}` : "Achat"} size="lg">
      {!pu ? <Spinner label="Chargement de l'achat..." /> : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Badge tone={ST[pu.status]?.[1]}>{ST[pu.status]?.[0]}</Badge>
              <span className="font-semibold text-slate-800">{pu.supplierName}</span>
            </div>
            <span className="text-xs text-slate-500">{fmtDate(pu.createdAt, business?.timezone)}</span>
          </div>

          <DataTable rows={pu.lines.map((l, i) => ({ ...l, id: String(i) }))} columns={[
            { key: "n", header: "Article", render: (l) => <span className="font-medium text-slate-900">{l.name}</span> },
            { key: "q", header: "Commandé", align: "right", render: (l) => qty(l.quantityMilli / 1000) },
            { key: "r", header: "Déjà reçu", align: "right", render: (l) => <span className="font-semibold text-emerald-700">{qty(l.receivedMilli / 1000)}</span> },
            { key: "c", header: "Prix unitaire", align: "right", render: (l) => money(l.unitCost) },
            { key: "t", header: "Total", align: "right", render: (l) => money(l.total) },
            ...(mode === "receive" ? [{ key: "x", header: "Reçu aujourd'hui", align: "right" as const, render: (l: (typeof pu.lines)[number] & { id: string }) => { const left = (l.quantityMilli - l.receivedMilli) / 1000; return left > 0 ? <input aria-label={`Quantite recue ${l.name}`} inputMode="decimal" placeholder={`max ${qty(left)}`} value={rq[Number(l.id)] ?? ""} onChange={(e) => setRq((r) => ({ ...r, [Number(l.id)]: e.target.value }))} className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm font-semibold tabular-nums" /> : <span className="text-slate-400">Complet</span>; } }] : []),
          ]} />

          <dl className="ml-auto max-w-xs space-y-1.5 rounded-xl bg-slate-50 p-3.5 text-sm">
            <div className="flex justify-between font-bold"><dt>Montant total</dt><dd>{money(pu.total)}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>Montant déjà payé</dt><dd className="font-medium">{money(pu.paidAmount)}</dd></div>
            <div className="flex justify-between font-bold border-t border-slate-200 pt-1"><dt>Reste à payer</dt><dd className={pu.remaining ? "text-amber-700 font-bold" : "text-emerald-700"}>{money(pu.remaining)}</dd></div>
          </dl>

          {pu.payments && pu.payments.length > 0 && (
            <div className="rounded-xl border border-slate-100 p-3">
              <h3 className="mb-1.5 font-semibold text-slate-800">Versements au fournisseur</h3>
              <ul className="space-y-1 text-slate-600 text-xs">
                {pu.payments.map((p: Payment) => (
                  <li key={p.id} className="flex justify-between border-b border-slate-100 py-1 last:border-0">
                    <span>{fmtDateTime(p.createdAt, business?.timezone)} — {methodLabel(p.method)}</span>
                    <span className="font-semibold">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mode === "receive" && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="font-bold text-slate-800">Confirmer la réception des marchandises</p>
              <p className="text-xs text-slate-600">Saisissez les quantités qui sont physiquement arrivées dans votre boutique pour mettre à jour vos stocks.</p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setMode("")}>Retour</Button>
                <Button loading={receive.isPending} disabled={!Object.values(rq).some((v) => Number(v.replace(",", ".")) > 0)} onClick={() => receive.mutate(undefined)}>
                  <PackageCheck className="size-4" />Valider l'entrée en stock
                </Button>
              </div>
            </div>
          )}

          {mode === "pay" && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="font-bold text-slate-800">Payer le fournisseur (Reste dû : {money(pu.remaining)})</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Mode de paiement" value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}</Select>
                <MoneyInput label="Somme versée" value={amount} onChange={setAmount} error={amount > pu.remaining ? "Dépasse le reste à payer" : undefined} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setMode("")}>Retour</Button>
                <Button loading={pay.isPending} disabled={amount < 1 || amount > pu.remaining} onClick={() => pay.mutate(undefined)}>Enregistrer le versement</Button>
              </div>
            </div>
          )}

          {mode === "" && pu.status !== "cancelled" && can("purchases.manage") && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              {(pu.status === "ordered" || pu.status === "partial") && (
                <Button variant="secondary" onClick={() => setMode("receive")}><PackageCheck className="size-4" />Enregistrer la réception</Button>
              )}
              {pu.remaining > 0 && <Button onClick={() => { setAmount(pu.remaining); setMode("pay"); }}>Payer le fournisseur</Button>}
              {pu.status === "ordered" && pu.paidAmount === 0 && <Button variant="danger" onClick={() => setCancel(true)}>Annuler la commande</Button>}
            </div>
          )}
        </div>
      )}
      <ConfirmDialog open={cancel} title="Annuler cette commande ?" message="Cette commande n'a pas encore été livrée ni payée. Elle sera simplement marquée comme annulée." danger confirmLabel="Annuler la commande" loading={cancelAct.isPending} onConfirm={() => cancelAct.mutate(undefined)} onClose={() => setCancel(false)} />
    </Modal>
  );
}

export default function Purchases() {
  const { can, business } = useAuth(); const [page, setPage] = useState(1); const [status, setStatus] = useState(""); const [nw, setNw] = useState(false); const [open, setOpen] = useState<string | null>(null);
  const list = useList<Purchase>("purchases", "/purchases", { page, limit: 20, status });

  return (
    <>
      <PageHeader title="Achats" subtitle="Commandes auprès de vos grossistes, suivi des livraisons et des dettes." actions={can("purchases.manage") ? <Button onClick={() => setNw(true)}><Plus className="size-4" />Nouvel achat</Button> : undefined} />
      <Card>
        <div className="mb-4">
          <Select label="Filtrer par état" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full sm:w-56">
            <option value="">Toutes les commandes</option>
            {Object.entries(ST).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </div>
        <DataTable rows={list.items} loading={list.loading} error={list.error} onRetry={() => void list.refetch()} onRowClick={(p) => setOpen(p.id)} empty={<EmptyState icon={Boxes} title="Aucun achat enregistré" text="Notez vos achats auprès des grossistes pour suivre ce que vous recevez et ce que vous devez." />}
          columns={[
            { key: "n", header: "N° Commande", render: (p) => <span className="font-semibold text-brand-700">{p.number}</span> },
            { key: "d", header: "Date", render: (p) => fmtDate(p.createdAt, business?.timezone) },
            { key: "f", header: "Fournisseur", render: (p) => <span className="font-medium text-slate-800">{p.supplierName}</span> },
            { key: "t", header: "Total", align: "right", render: (p) => <span className="font-bold tabular-nums">{money(p.total)}</span> },
            { key: "r", header: "Reste à payer", align: "right", render: (p) => (p.remaining ? <span className="font-semibold text-amber-700 tabular-nums">{money(p.remaining)}</span> : <span className="text-slate-400">—</span>) },
            { key: "s", header: "État", render: (p) => <Badge tone={ST[p.status]?.[1]}>{ST[p.status]?.[0]}</Badge> },
          ]} />
        <Pagination meta={list.meta} onPage={setPage} />
      </Card>
      <NewPurchase open={nw} onClose={() => setNw(false)} /><PurchaseDetail id={open} onClose={() => setOpen(null)} />
    </>
  );
}
