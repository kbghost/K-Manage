import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Archive, Pencil, Plus, RotateCcw, UsersRound } from "./icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAction, useList } from "../lib/hooks";
import { money } from "../lib/format";
import type { Party } from "../lib/types";
import { Badge, Button, Card, DataTable, EmptyState, Input, Modal, PageHeader, Pagination, SearchBox, Textarea } from "./ui";

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
  phone: z.string().optional(),
  email: z.union([z.string().email("Email invalide"), z.literal("")]).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});
type V = z.infer<typeof schema>;

function PartyForm({ kind, party, onClose }: { kind: "customers" | "suppliers"; party?: Party; onClose: () => void }) {
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { name: party?.name ?? "", phone: party?.phone ?? "", email: party?.email ?? "", address: party?.address ?? "", notes: party?.notes ?? "" } });
  const labelKind = kind === "customers" ? "client" : "fournisseur";
  const save = useAction((v: V) => {
    const b = { name: v.name, phone: v.phone || undefined, email: v.email || undefined, address: v.address || undefined, notes: v.notes || undefined };
    return party ? api("PATCH", `/parties/${kind}/${party.id}`, b) : api("POST", `/parties/${kind}`, b);
  }, { invalidate: [kind, "pos-customers"], success: party ? "Fiche modifiée avec succès." : "Fiche enregistrée avec succès.", onSuccess: onClose });
  const e = f.formState.errors;

  return (
    <form noValidate onSubmit={f.handleSubmit((v) => save.mutate(v))} className="space-y-3.5">
      <Input label={`Nom du ${labelKind}`} placeholder="Ex : Mme Adanlete" error={e.name?.message} {...f.register("name")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Numéro de téléphone" type="tel" placeholder="Ex : 97 00 00 00" {...f.register("phone")} />
        <Input label="Email (facultatif)" type="email" placeholder="client@exemple.com" error={e.email?.message} {...f.register("email")} />
      </div>
      <Input label="Adresse ou quartier (facultatif)" placeholder="Ex : Marché Dantokpa, Allée 3" {...f.register("address")} />
      <Textarea label="Notes ou remarques particulières (facultatif)" placeholder="Ex : paie toujours en fin de mois..." {...f.register("notes")} />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={save.isPending}>Enregistrer</Button>
      </div>
    </form>
  );
}

/** Liste commune clients / fournisseurs avec solde (créance ou dette). */
export function PartyList({ kind, title, subtitle, balanceLabel, manage, onOpen, extra }: { kind: "customers" | "suppliers"; title: string; subtitle: string; balanceLabel: string; manage: string; onOpen: (p: Party) => void; extra?: ReactNode }) {
  const { can } = useAuth(); const [page, setPage] = useState(1); const [sp] = useSearchParams(); const [q, setQ] = useState(sp.get("q") ?? ""); const [debt, setDebt] = useState(false); const [status, setStatus] = useState("active"); const [edit, setEdit] = useState<Party | "new" | null>(null);
  const list = useList<Party>(kind, `/parties/${kind}`, { page, limit: 20, q, status, withDebt: debt ? "true" : undefined });
  const toggle = useAction((p: Party) => api("PATCH", `/parties/${kind}/${p.id}`, { status: p.status === "active" ? "archived" : "active" }), { invalidate: [kind], success: "Statut mis à jour." });

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={can(manage) ? <Button onClick={() => setEdit("new")}><Plus className="size-4" />Ajouter {kind === "customers" ? "un client" : "un fournisseur"}</Button> : undefined} />
      {extra}
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-2.5 sm:gap-3">
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={`Rechercher un ${kind === "customers" ? "client" : "fournisseur"}...`} className="w-full sm:w-64" />
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" className="rounded text-brand-600" checked={debt} onChange={(e) => { setDebt(e.target.checked); setPage(1); }} />
            {kind === "customers" ? "Avec dette en cours" : "Avec solde à payer"}
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" className="rounded text-brand-600" checked={status === "archived"} onChange={(e) => { setStatus(e.target.checked ? "archived" : "active"); setPage(1); }} />
            Fiches archivées
          </label>
        </div>
        <DataTable rows={list.items} loading={list.loading} error={list.error} onRetry={() => void list.refetch()} onRowClick={onOpen}
          empty={<EmptyState icon={UsersRound} title="Aucune fiche enregistrée" text="Cliquez sur le bouton « Ajouter » pour enregistrer votre première fiche." />}
          columns={[
            { key: "n", header: "Nom", render: (p) => <span className="font-semibold text-slate-900">{p.name}</span> },
            { key: "t", header: "Téléphone", render: (p) => p.phone || <span className="text-slate-400">—</span> },
            { key: "b", header: balanceLabel, align: "right", render: (p) => (p.balance > 0 ? <Badge tone="amber">{money(p.balance)}</Badge> : <span className="text-slate-400">—</span>) },
            { key: "a", header: "", align: "right", render: (p) => can(manage) ? (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" aria-label={`Modifier ${p.name}`} title="Modifier la fiche" onClick={() => setEdit(p)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="sm" aria-label={`${p.status === "active" ? "Archiver" : "Restaurer"} ${p.name}`} title={p.status === "active" ? "Archiver" : "Restaurer"} onClick={() => toggle.mutate(p)}>
                  {p.status === "active" ? <Archive className="size-4 text-slate-400" /> : <RotateCcw className="size-4 text-emerald-600" />}
                </Button>
              </div>
            ) : null },
          ]} />
        <Pagination meta={list.meta} onPage={setPage} />
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? `Ajouter ${kind === "customers" ? "un client" : "un fournisseur"}` : "Modifier la fiche"}>
        {edit && <PartyForm key={edit === "new" ? "n" : edit.id} kind={kind} party={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
      </Modal>
    </>
  );
}
