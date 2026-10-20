import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreditCard, Download, Paperclip, Pencil, Plus } from "../components/icons";
import { api, download, fileUrl, qs, upload } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAction, useData, useList } from "../lib/hooks";
import { fmtDate, methodLabel, money, todayStr } from "../lib/format";
import type { Expense } from "../lib/types";
import { Badge, Button, Card, DataTable, EmptyState, Input, Modal, MoneyInput, PageHeader, Pagination, Select, SearchBox, errMsg, useToast } from "../components/ui";

const schema = z.object({
  category: z.string().trim().min(1, "Choisissez une catégorie de dépense"),
  description: z.string().trim().min(1, "Précisez la dépense"),
  amount: z.number().int().min(1, "Montant obligatoire"),
  date: z.string().min(1, "Date obligatoire"),
  status: z.enum(["paid", "payable"]),
  method: z.string().optional(),
}).refine((v) => v.status === "payable" || !!v.method, { path: ["method"], message: "Choisissez le moyen de paiement" });
type V = z.infer<typeof schema>;

function ExpenseForm({ expense, categories, onClose }: { expense?: Expense; categories: string[]; onClose: () => void }) {
  const { business } = useAuth(); const toast = useToast(); const methods = business?.settings.paymentMethods ?? ["cash"]; const [att, setAtt] = useState(expense?.attachmentUploadId);
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: expense ? { category: expense.category, description: expense.description, amount: expense.amount, date: expense.date.slice(0, 10), status: expense.status, method: expense.method } : { category: "Autre", description: "", amount: 0, date: todayStr(business?.timezone), status: "paid", method: "cash" } });
  const save = useAction((v: V) => expense ? api("PATCH", `/expenses/${expense.id}`, { category: v.category, description: v.description, amount: v.amount, date: v.date, attachmentUploadId: att }) : api("POST", "/expenses", { ...v, method: v.status === "paid" ? v.method : undefined, attachmentUploadId: att }), { invalidate: ["expenses", "cash-current"], success: expense ? "Dépense modifiée avec succès." : "Dépense enregistrée avec succès.", onSuccess: onClose });
  const status = f.watch("status"); const e = f.formState.errors;

  return (
    <form noValidate onSubmit={f.handleSubmit((v) => save.mutate(v))} className="space-y-4">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Input label="Catégorie de la dépense" placeholder="Ex : Loyer, Transport, Électricité..." list="exp-cats" error={e.category?.message} {...f.register("category")} />
        <datalist id="exp-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <Input label="Date du paiement" type="date" error={e.date?.message} {...f.register("date")} />
        <Input label="Pour quoi était cette dépense ?" placeholder="Ex : Facture SBEE du mois, sac de sachets plastiques..." className="sm:col-span-2" error={e.description?.message} {...f.register("description")} />
        <Controller control={f.control} name="amount" render={({ field }) => <MoneyInput label="Montant dépensé" value={field.value} onChange={field.onChange} error={e.amount?.message} />} />
        {!expense && (
          <>
            <Select label="État du règlement" {...f.register("status")}>
              <option value="paid">Payée immédiatement</option>
              <option value="payable">À payer plus tard (dette en attente)</option>
            </Select>
            {status === "paid" && (
              <Select label="Moyen de paiement utilisé" error={e.method?.message} {...f.register("method")}>
                {methods.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
              </Select>
            )}
          </>
        )}
      </div>

      {!expense && f.watch("method") === "cash" && status === "paid" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 font-medium">
          Note : Cette dépense en espèces sera automatiquement déduite de votre caisse du jour.
        </p>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
        <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">
          <Paperclip className="mr-1.5 inline size-4 text-slate-500" />
          {att ? "Changer la photo du reçu" : "Prendre en photo le reçu / facture"}
          <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={async (ev) => { const file = ev.target.files?.[0]; if (!file) return; try { setAtt((await upload(file)).id); } catch (er) { toast("error", errMsg(er)); } }} />
        </label>
        {att && <a className="font-semibold text-brand-700 underline" href={fileUrl(att)} target="_blank" rel="noreferrer">Voir le justificatif joint</a>}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={save.isPending}>Enregistrer la dépense</Button>
      </div>
    </form>
  );
}

function PayModal({ e, onClose }: { e: Expense | null; onClose: () => void }) {
  const { business } = useAuth(); const [method, setMethod] = useState("transfer"); const methods = business?.settings.paymentMethods ?? ["cash"];
  const pay = useAction(() => api("POST", `/expenses/${e!.id}/pay`, { method }), { invalidate: ["expenses", "cash-current"], success: "Dépense marquée comme payée.", onSuccess: onClose });

  return (
    <Modal open={!!e} onClose={onClose} title="Payer cette dépense en attente" size="sm" footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button loading={pay.isPending} onClick={() => pay.mutate(undefined)}>Confirmer le paiement de {money(e?.amount)}</Button></>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Vous allez régler la dépense « <b>{e?.description}</b> » d'un montant de <b>{money(e?.amount)}</b>.</p>
        <Select label="Moyen de paiement utilisé" value={method} onChange={(x) => setMethod(x.target.value)}>{methods.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}</Select>
      </div>
    </Modal>
  );
}

export default function Expenses() {
  const { can, business } = useAuth(); const toast = useToast(); const [page, setPage] = useState(1); const [q, setQ] = useState(""); const [category, setCategory] = useState(""); const [status, setStatus] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [sp, setSp] = useSearchParams(); const [edit, setEdit] = useState<Expense | "new" | null>(sp.get("new") ? "new" : null);
  useEffect(() => { if (sp.get("new")) setSp({}, { replace: true }); }, []);
  const [payE, setPayE] = useState<Expense | null>(null);
  const params = { page, limit: 20, q, category, status, from, to }; const list = useList<Expense>("expenses", "/expenses", params); const cats = useData<string[]>("expense-cats", "/expenses/categories");
  const exp = (format: string) => download(`/expenses${qs({ ...params, page: undefined, limit: undefined, format })}`, `depenses.${format}`).catch((er) => toast("error", errMsg(er)));
  const total = list.items?.reduce((s, x) => s + x.amount, 0) ?? 0;

  return (
    <>
      <PageHeader title="Dépenses" subtitle="Loyer, transport, factures, salaires... Suivez précisément où part l'argent de la boutique." actions={<><div className="flex"><Button variant="secondary" className="rounded-r-none" onClick={() => void exp("csv")}><Download className="size-4" />CSV</Button><Button variant="secondary" className="-ml-px rounded-none" onClick={() => void exp("xlsx")}>Excel</Button><Button variant="secondary" className="-ml-px rounded-l-none" onClick={() => void exp("pdf")}>PDF</Button></div>{can("expenses.create") && <Button onClick={() => setEdit("new")}><Plus className="size-4" />Nouvelle dépense</Button>}</>} />
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-2.5 sm:gap-3">
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Rechercher une dépense..." className="w-full sm:w-64" />
          <Select label="Catégorie" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="flex-1 min-w-[130px] sm:w-44 sm:flex-initial"><option value="">Toutes les catégories</option>{cats.data?.map((c) => <option key={c}>{c}</option>)}</Select>
          <Select label="État" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="flex-1 min-w-[120px] sm:w-36 sm:flex-initial"><option value="">Tous les états</option><option value="paid">Payées</option><option value="payable">À payer plus tard</option></Select>
          <Input label="Du (Date début)" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="flex-1 min-w-[130px] sm:w-40 sm:flex-initial" />
          <Input label="Au (Date fin)" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="flex-1 min-w-[130px] sm:w-40 sm:flex-initial" />
        </div>
        <DataTable rows={list.items} loading={list.loading} error={list.error} onRetry={() => void list.refetch()} empty={<EmptyState icon={CreditCard} title="Aucune dépense enregistrée" text="Enregistrez vos frais et sorties d'argent pour calculer votre vrai bénéfice." />}
          columns={[
            { key: "t", header: "Description / Objet", render: (x) => <span className="font-semibold text-slate-800 dark:text-slate-100">{x.description}{x.attachmentUploadId && <a href={fileUrl(x.attachmentUploadId)} target="_blank" rel="noreferrer" aria-label="Justificatif" title="Voir la photo du reçu" className="ml-1.5 text-brand-700 hover:underline"><Paperclip className="inline size-3.5" /></a>}</span> },
            { key: "d", header: "Date", render: (x) => fmtDate(x.date, "UTC") },
            { key: "c", header: "Catégorie", render: (x) => <Badge>{x.category}</Badge> },
            { key: "a", header: "Montant", align: "right", render: (x) => <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{money(x.amount)}</span> },
            { key: "s", header: "Règlement", render: (x) => x.status === "paid" ? <Badge tone="green">{methodLabel(x.method ?? "")}</Badge> : can("expenses.create") ? <Button size="sm" variant="secondary" onClick={() => setPayE(x)}>À payer — Régler</Button> : <Badge tone="amber">À payer</Badge> },
            { key: "e", header: "", align: "right", render: (x) => can("expenses.update") ? <Button variant="ghost" size="sm" aria-label="Modifier" title="Modifier la dépense" onClick={() => setEdit(x)}><Pencil className="size-4" /></Button> : null },
          ]} />
        <Pagination meta={list.meta} onPage={setPage} />
        {list.items && list.items.length > 0 && <p className="px-3 pt-3 text-right text-sm font-semibold text-slate-800 border-t border-slate-100 mt-2">Total des dépenses affichées : {money(total)}</p>}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Enregistrer une dépense" : "Modifier la dépense"}>{edit && <ExpenseForm key={edit === "new" ? "n" : edit.id} expense={edit === "new" ? undefined : edit} categories={cats.data ?? []} onClose={() => setEdit(null)} />}</Modal>
      <PayModal e={payE} onClose={() => setPayE(null)} />{void business}
    </>
  );
}
