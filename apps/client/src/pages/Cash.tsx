import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, LockKeyhole, Plus, Wrench } from "../components/icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAction, useList } from "../lib/hooks";
import { fmtDateTime, money } from "../lib/format";
import type { CashSession, CashSummary } from "../lib/types";
import { Badge, Button, Card, DataTable, EmptyState, Input, Modal, MoneyInput, PageHeader, Pagination, Spinner, StatCard } from "../components/ui";

const Summary = ({ s }: { s: CashSummary }) => (
  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
    {([
      ["Monnaie de départ (Fond)", s.openingAmount],
      ["Ventes encaissées en espèces", s.paymentsIn],
      ["Remboursements / sorties clients", -s.paymentsOut],
      ["Ajouts d'argent en caisse", s.manualIn],
      ["Retraits d'argent de la caisse", -s.manualOut],
      ["Dépenses payées avec la caisse", -s.expensesOut],
    ] as const).map(([l, v]) => (
      <div key={l} className="flex justify-between gap-2 border-b border-slate-100 py-1.5">
        <dt className="text-slate-500">{l}</dt>
        <dd className="font-semibold tabular-nums text-slate-800">{money(v)}</dd>
      </div>
    ))}
  </dl>
);

export default function Cash() {
  const { can, business } = useAuth(); const tz = business?.timezone; const [page, setPage] = useState(1);
  const cur = useQuery({ queryKey: ["cash-current", business?.id], queryFn: async () => (await api<CashSession | null>("GET", "/cash-sessions/current")).data });
  const hist = useList<CashSession>("cash-history", "/cash-sessions", { page, limit: 10 });
  const [opening, setOpening] = useState(0); const [entry, setEntry] = useState<"in" | "out" | null>(null); const [amt, setAmt] = useState(0); const [reason, setReason] = useState(""); const [closing, setClosing] = useState(false); const [counted, setCounted] = useState(0); const [note, setNote] = useState("");
  const [fix, setFix] = useState<CashSession | null>(null); const [fixAmt, setFixAmt] = useState(0); const [fixReason, setFixReason] = useState("");
  const inv = ["cash-current", "cash-history"];
  const open = useAction(() => api("POST", "/cash-sessions", { openingAmount: opening }), { invalidate: inv, success: "Caisse ouverte avec succès." });
  const addEntry = useAction(() => api("POST", "/cash-sessions/current/entries", { type: entry, amount: amt, reason }), { invalidate: inv, success: "Opération enregistrée avec succès.", onSuccess: () => { setEntry(null); setAmt(0); setReason(""); } });
  const close = useAction(() => api("POST", "/cash-sessions/current/close", { countedAmount: counted, note: note || undefined }), { invalidate: inv, success: "Caisse fermée avec succès.", onSuccess: () => { setClosing(false); setCounted(0); setNote(""); } });
  const correct = useAction(() => api("POST", `/cash-sessions/${fix!.id}/corrections`, { countedAmount: fixAmt, reason: fixReason }), { invalidate: inv, success: "Correction enregistrée dans le journal.", onSuccess: () => { setFix(null); setFixReason(""); } });
  const s = cur.data;

  return (
    <>
      <PageHeader title="Caisse" subtitle="Ouverture, entrées / sorties de monnaie et clôture de caisse en fin de journée." />
      {cur.isLoading ? <Spinner label="Vérification de la caisse..." /> : !s ? (
        <Card className="mb-5 border-brand-500/30">
          <EmptyState icon={Banknote} title="Votre caisse n'est pas encore ouverte" text="Indiquez la monnaie de départ présente dans votre tiroir pour commencer la journée." />
          <div className="mx-auto flex max-w-md items-end gap-2.5 pb-2">
            <MoneyInput label="Monnaie de départ (Fond de caisse)" placeholder="0" value={opening} onChange={setOpening} className="flex-1" />
            <Button loading={open.isPending} onClick={() => open.mutate(undefined)}>Ouvrir la caisse</Button>
          </div>
        </Card>
      ) : (
        <div className="mb-5 space-y-4">
          <div className="grid gap-3.5 sm:grid-cols-3">
            <StatCard label="Argent attendu en caisse" value={money(s.summary?.expected)} icon={Banknote} tone="blue" hint="Calculé d'après vos ventes et mouvements" />
            <StatCard label="Caisse ouverte le" value={fmtDateTime(s.openedAt, tz)} tone="gray" />
            <StatCard label="Monnaie de départ (Fond)" value={money(s.openingAmount)} tone="gray" />
          </div>
          <Card title="Détail des mouvements d'espèces" actions={
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEntry("in")}><Plus className="size-4" />Ajouter de l'argent</Button>
              <Button size="sm" variant="secondary" onClick={() => setEntry("out")}>Retirer de l'argent</Button>
              <Button size="sm" variant="danger" onClick={() => { setCounted(s.summary?.expected ?? 0); setClosing(true); }}><LockKeyhole className="size-4" />Fermer la caisse</Button>
            </div>
          }>
            {s.summary && <Summary s={s.summary} />}
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Formule simple : Monnaie de départ + Ventes en espèces − Remboursements + Ajouts − Retraits − Dépenses payées en caisse.
            </p>
          </Card>
        </div>
      )}

      <Card title="Historique des journées de caisse">
        <DataTable rows={hist.items} loading={hist.loading} error={hist.error} onRetry={() => void hist.refetch()} empty={<EmptyState title="Aucune session de caisse passée" />} columns={[
          { key: "o", header: "Ouverture", render: (x) => fmtDateTime(x.openedAt, tz) },
          { key: "u", header: "Caissier", render: (x) => x.openedByName ?? "—" },
          { key: "c", header: "Fermeture", render: (x) => (x.closedAt ? fmtDateTime(x.closedAt, tz) : <Badge tone="blue">En cours</Badge>) },
          { key: "e", header: "Attendu", align: "right", render: (x) => (x.status === "closed" ? money(x.expectedAmount) : "") },
          { key: "k", header: "Physique compté", align: "right", render: (x) => (x.status === "closed" ? money(x.countedAmount) : "") },
          { key: "d", header: "Différence", align: "right", render: (x) => (x.status === "closed" ? <Badge tone={x.difference === 0 ? "green" : "red"}>{x.difference === 0 ? "Exact (0)" : money(x.difference)}</Badge> : "") },
          { key: "a", header: "", align: "right", render: (x) => x.status === "closed" && can("cash.correct") ? <Button variant="ghost" size="sm" aria-label="Corriger" title="Corriger le montant compté" onClick={() => { setFix(x); setFixAmt(x.countedAmount); }}><Wrench className="size-4" /></Button> : null },
        ]} />
        <Pagination meta={hist.meta} onPage={setPage} />
      </Card>

      <Modal open={!!entry} onClose={() => setEntry(null)} title={entry === "in" ? "Ajouter de l'argent dans la caisse" : "Retirer de l'argent de la caisse"} size="sm" footer={<><Button variant="secondary" onClick={() => setEntry(null)}>Annuler</Button><Button loading={addEntry.isPending} disabled={amt < 1 || reason.trim().length < 3} onClick={() => addEntry.mutate(undefined)}>Enregistrer l'opération</Button></>}>
        <div className="space-y-3">
          <MoneyInput label="Somme à enregistrer" value={amt} onChange={setAmt} />
          <Input label="Motif (Ex : appoint de monnaie, retrait gérant...)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Modal>

      <Modal open={closing} onClose={() => setClosing(false)} title="Fermer la caisse (Bilan de fin de journée)" size="sm" footer={<><Button variant="secondary" onClick={() => setClosing(false)}>Annuler</Button><Button variant="danger" loading={close.isPending} onClick={() => close.mutate(undefined)}>Confirmer la fermeture</Button></>}>
        <div className="space-y-3.5 text-sm">
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
            <span className="text-xs text-slate-500 font-semibold uppercase">Somme attendue d'après les calculs</span>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{money(s?.summary?.expected)}</p>
          </div>
          <MoneyInput label="Combien d'argent physique avez-vous compté ?" value={counted} onChange={setCounted} />
          <div className={counted - (s?.summary?.expected ?? 0) === 0 ? "rounded-xl bg-emerald-50 p-3 text-emerald-800 font-semibold" : "rounded-xl bg-red-50 p-3 text-red-700 font-semibold"}>
            Différence constatée : {money(counted - (s?.summary?.expected ?? 0))}
            {counted - (s?.summary?.expected ?? 0) === 0 ? " (Compte parfait !)" : counted - (s?.summary?.expected ?? 0) < 0 ? " (Manquant)" : " (Surplus)"}
          </div>
          <Input label="Note ou remarque (facultatif)" placeholder="Ex : RAS ou manque 500F monnaie..." value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="text-xs text-slate-500">Une fois la caisse fermée, elle est archivée. Vous pourrez ouvrir une nouvelle caisse le lendemain.</p>
        </div>
      </Modal>

      <Modal open={!!fix} onClose={() => setFix(null)} title="Corriger le montant d'une caisse fermée" size="sm" footer={<><Button variant="secondary" onClick={() => setFix(null)}>Annuler</Button><Button loading={correct.isPending} disabled={fixReason.trim().length < 5} onClick={() => correct.mutate(undefined)}>Enregistrer la correction</Button></>}>
        <div className="space-y-3">
          <MoneyInput label="Nouveau montant physique recompté" value={fixAmt} onChange={setFixAmt} />
          <Input label="Motif obligatoire de la correction" placeholder="Ex : erreur de comptage des billets..." value={fixReason} onChange={(e) => setFixReason(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}
