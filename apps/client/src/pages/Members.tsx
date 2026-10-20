import { useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "../components/icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAction, useData } from "../lib/hooks";
import { fmtDate } from "../lib/format";
import { Badge, Button, Card, ConfirmDialog, DataTable, Input, Modal, PageHeader, Select, Spinner } from "../components/ui";

interface M { id: string; role: string; status: "active" | "disabled"; createdAt: string; userId: string; user?: { fullName: string; email: string; phone?: string } }
const ROLE: Record<string, string> = { owner: "Propriétaire", manager: "Gérant", cashier: "Caissier / Vendeur", storekeeper: "Magasinier (Gestion stock)" };
const ROLE_HELP: Record<string, string> = {
  manager: "Peut tout faire sauf modifier les employés et les paramètres principaux du commerce.",
  cashier: "Peut vendre au comptoir, gérer les clients et sa caisse. Ne peut pas rembourser ni modifier les stocks.",
  storekeeper: "Gère les articles, les stocks et les réceptions d'achats. Ne vend pas au comptoir.",
};

export default function Members() {
  const { user } = useAuth(); const list = useData<M[]>("members", "/members"); const [add, setAdd] = useState(false); const [email, setEmail] = useState(""); const [role, setRole] = useState("cashier"); const [del, setDel] = useState<M | null>(null);
  const done = { invalidate: ["members"] };
  const create = useAction(() => api("POST", "/members", { email, role }), { ...done, success: "Employé ajouté avec succès.", onSuccess: () => { setAdd(false); setEmail(""); } });
  const patch = useAction((v: { id: string; body: object }) => api("PATCH", `/members/${v.id}`, v.body), { ...done, success: "Rôle d'accès mis à jour." });
  const revoke = useAction((id: string) => api("DELETE", `/members/${id}`), { ...done, success: "Accès retiré.", onSuccess: () => setDel(null) });

  return (
    <>
      <PageHeader title="Employés" subtitle="Gérez votre équipe, qui a accès à votre boutique et avec quelles autorisations." actions={<Button onClick={() => setAdd(true)}><Plus className="size-4" />Ajouter un employé</Button>} />
      <Card>{list.isLoading ? <Spinner label="Chargement de votre équipe..." /> : <DataTable rows={list.data} columns={[
        { key: "n", header: "Nom et email", render: (m) => <div><p className="font-semibold text-slate-900">{m.user?.fullName}</p><p className="text-xs text-slate-500">{m.user?.email}</p></div> },
        { key: "r", header: "Rôle attribué", render: (m) => m.role === "owner" || m.userId === user?.id ? <Badge tone="blue">{ROLE[m.role]}</Badge> : (
          <select aria-label={`Role de ${m.user?.fullName}`} value={m.role} onChange={(e) => patch.mutate({ id: m.id, body: { role: e.target.value } })} className="rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium">
            {["manager", "cashier", "storekeeper"].map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
          </select>
        ) },
        { key: "s", header: "État de l'accès", render: (m) => <Badge tone={m.status === "active" ? "green" : "gray"}>{m.status === "active" ? "Actif (Autorisé)" : "Désactivé (Bloqué)"}</Badge> },
        { key: "d", header: "Date d'ajout", render: (m) => fmtDate(m.createdAt) },
        { key: "a", header: "", align: "right", render: (m) => m.role === "owner" || m.userId === user?.id ? null : (
          <div className="flex justify-end gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => patch.mutate({ id: m.id, body: { status: m.status === "active" ? "disabled" : "active" } })}>
              {m.status === "active" ? "Bloquer" : "Débloquer"}
            </Button>
            <Button variant="ghost" size="sm" aria-label={`Revoquer ${m.user?.fullName}`} title="Supprimer cet accès" onClick={() => setDel(m)}>
              <Trash2 className="size-4 text-red-500" />
            </Button>
          </div>
        ) },
      ]} />}</Card>

      <Card className="mt-4" title="Explication simple des rôles" actions={<ShieldCheck className="size-5 text-brand-700" />}>
        <ul className="space-y-2 text-sm text-slate-600">
          {Object.entries(ROLE_HELP).map(([r, h]) => (
            <li key={r} className="rounded-xl bg-slate-50 p-2.5">
              <b className="text-slate-900">{ROLE[r]} :</b> {h}
            </li>
          ))}
          <li className="rounded-xl bg-slate-50 p-2.5">
            <b className="text-slate-900">Propriétaire :</b> A tous les droits absolus sur la boutique.
          </li>
        </ul>
      </Card>

      <Modal open={add} onClose={() => setAdd(false)} title="Donner accès à un employé" size="sm" footer={<><Button variant="secondary" onClick={() => setAdd(false)}>Annuler</Button><Button loading={create.isPending} disabled={!email.includes("@")} onClick={() => create.mutate(undefined)}>Donner l'accès</Button></>}>
        <div className="space-y-3.5">
          <Input label="Email de l'employé" type="email" placeholder="employe@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} hint="L'employé doit d'abord créer son compte K-Manage avec cette adresse email." />
          <Select label="Rôle à lui attribuer" value={role} onChange={(e) => setRole(e.target.value)}>
            {["cashier", "manager", "storekeeper"].map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
          </Select>
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200">{ROLE_HELP[role]}</p>
        </div>
      </Modal>

      <ConfirmDialog open={!!del} title="Retirer l'accès à cet employé ?" message={`${del?.user?.fullName} ne pourra plus se connecter à ce commerce. Toutes les ventes et opérations qu'il a déjà faites restent enregistrées dans l'historique.`} danger confirmLabel="Retirer l'accès" loading={revoke.isPending} onConfirm={() => del && revoke.mutate(del.id)} onClose={() => setDel(null)} />
    </>
  );
}
