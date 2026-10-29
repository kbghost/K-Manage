import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CalendarCheck, CheckCircle2, CreditCard, ShieldCheck } from "../components/icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { errMsg, Button, Card, Input, PageHeader, Spinner } from "../components/ui";

interface BillingInfo {
  status: "trial" | "active" | "expired";
  access: boolean;
  trialStartedAt: string;
  trialEndsAt: string;
  currentPeriodEndsAt: string | null;
  accessUntil: string | null;
  monthlyPrice: number;
  currency: "XOF";
  businessName: string;
  isOwner: boolean;
  paymentConfigured: boolean;
  payments: { reference: string; amount: number; currency: string; paidAt: string }[];
}
const money = (amount: number) => `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
const date = (value: string | null) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(value)) : "—";

export default function Billing() {
  const { activeId } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState("");
  const billing = useQuery({
    queryKey: ["billing", activeId],
    enabled: !!activeId,
    queryFn: async () => (await api<BillingInfo>("GET", "/billing/current")).data,
  });
  const refresh = useMutation({
    mutationFn: async () => (await api<BillingInfo & { paymentStatus: "paid" | "pending" | "failed" | "unknown" }>("POST", "/billing/refresh", {})).data,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", activeId] });
      setNotice(result.paymentStatus === "paid"
        ? "Paiement confirmé. Votre abonnement est actif."
        : result.paymentStatus === "failed"
          ? "Le paiement a été refusé ou annulé. Relancez un paiement pour activer l’abonnement."
          : result.paymentStatus === "pending"
            ? "Le paiement n’est pas encore confirmé par FedaPay. Patientez quelques instants puis vérifiez à nouveau."
            : result.access
              ? "Votre abonnement est actif."
              : "Aucun paiement confirmé pour le moment. Finalisez le paiement FedaPay puis réessayez.");
      setParams((current) => { current.delete("payment"); return current; }, { replace: true });
    },
  });
  useEffect(() => {
    if (params.has("payment") && activeId && !refresh.isPending) refresh.mutate();
  }, [params, activeId]);
  const checkout = useMutation({
    mutationFn: async () => (await api<{ paymentUrl: string }>("POST", "/billing/checkout", { phone })).data,
    onSuccess: ({ paymentUrl }) => { window.location.assign(paymentUrl); },
  });

  if (billing.isLoading) return <Spinner label="Chargement de votre abonnement..." />;
  if (billing.isError || !billing.data) return <Card title="Abonnement"><p role="alert" className="text-sm text-red-700">{errMsg(billing.error)}</p><Button className="mt-4" variant="secondary" onClick={() => void billing.refetch()}>Réessayer</Button></Card>;
  const info = billing.data;
  const error = checkout.error ?? refresh.error;
  return (
    <>
      <PageHeader title="Abonnement" subtitle={info.businessName} />
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-5">
          <Card title="Votre formule" actions={<span className={`rounded-full px-3 py-1 text-xs font-semibold ${info.status === "active" ? "bg-emerald-100 text-emerald-800" : info.status === "trial" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>{info.status === "active" ? "Abonnement actif" : info.status === "trial" ? "Essai gratuit" : "Accès suspendu"}</span>}>
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div><p className="text-3xl font-bold tracking-tight text-slate-900">{money(info.monthlyPrice)}<span className="ml-1 text-sm font-medium text-slate-500">/ mois</span></p><p className="mt-2 text-sm text-slate-500">Un mois d’essai gratuit, puis renouvellement manuel mensuel.</p></div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">{info.status === "trial" ? "Fin de l’essai" : info.status === "active" ? "Accès jusqu’au" : "Essai terminé le"}</p><p className="mt-1 font-semibold text-slate-800">{date(info.status === "active" ? info.currentPeriodEndsAt : info.trialEndsAt)}</p></div>
            </div>
            {info.status === "trial" && <div className="mt-5 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><CalendarCheck className="mt-0.5 size-5 shrink-0" /><p>Votre période d’essai est en cours. Aucun paiement ne sera demandé avant son échéance.</p></div>}
            {!info.access && <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">La période d’essai est terminée. Effectuez votre paiement pour rétablir l’accès aux fonctions de gestion.</div>}
          </Card>

          <Card title="Historique des paiements">
            {info.payments.length === 0 ? <p className="text-sm text-slate-500">Aucun paiement enregistré pour cette boutique.</p> : <ul className="divide-y divide-slate-100">{info.payments.map((payment) => <li key={payment.reference} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><span><span className="block text-sm font-medium text-slate-800">{money(payment.amount)}</span><span className="text-xs text-slate-500">{payment.reference} · {date(payment.paidAt)}</span></span><span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-4" />Payé</span></li>)}</ul>}
          </Card>
        </div>

        <Card title={info.status === "active" ? "Prolonger l’abonnement" : "Activer mon abonnement"}>
          {!info.paymentConfigured ? (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Le paiement FedaPay n’est pas encore configuré. Contactez l’administrateur de la plateforme.</div>
          ) : !info.isOwner ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Seul le propriétaire de la boutique peut effectuer ou renouveler un paiement.</div>
          ) : (
            <>
              <p className="text-sm leading-6 text-slate-600">Payez {money(info.monthlyPrice)} via la page sécurisée FedaPay. Les moyens disponibles (Mobile Money, carte bancaire et autres) seront affichés par FedaPay selon votre pays.</p>
              <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); checkout.mutate(); }}>
                <Input label="Téléphone pour le paiement" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+229 97 00 00 00" hint="Utilisé par FedaPay pour les moyens de paiement mobile disponibles." />
                {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errMsg(error)}</p>}
                {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
                <Button type="submit" className="w-full" size="lg" loading={checkout.isPending} disabled={!phone.trim()}>Payer {money(info.monthlyPrice)} avec FedaPay <CreditCard className="size-5" /></Button>
              </form>
              <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" />La confirmation est vérifiée auprès de FedaPay avant l’activation. Ne fermez pas cette page si vous souhaitez vérifier votre paiement.</div>
              {params.has("payment") && <Button variant="secondary" className="mt-4 w-full" loading={refresh.isPending} onClick={() => refresh.mutate()}><CalendarCheck className="size-4" />Vérifier le paiement</Button>}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
