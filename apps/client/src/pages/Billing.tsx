import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Banknote,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  History,
  Printer,
  Receipt,
  ShieldCheck,
  Sparkle,
  Store,
} from "../components/icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { errMsg, Button, Card, Input, Modal, PageHeader, Spinner } from "../components/ui";

interface BillingPaymentItem {
  reference: string;
  amount: number;
  currency: string;
  paidAt: string;
}

interface BillingInfo {
  status: "trial" | "active" | "expired";
  access: boolean;
  trialStartedAt: string;
  trialEndsAt: string;
  currentPeriodEndsAt: string | null;
  accessUntil: string | null;
  daysRemaining?: number;
  monthlyPrice: number;
  currency: "XOF";
  businessName: string;
  isOwner: boolean;
  paymentConfigured: boolean;
  payments: BillingPaymentItem[];
}

const money = (amount: number) => `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
const date = (value: string | null) =>
  value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(value)) : "—";
const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";

const COUNTRIES = [
  { flag: "🇧🇯", name: "Bénin", code: "+229", hint: "Ex: 97 00 00 00" },
  { flag: "🇨🇮", name: "Côte d'Ivoire", code: "+225", hint: "Ex: 07 00 00 00 00" },
  { flag: "🇹🇬", name: "Togo", code: "+228", hint: "Ex: 90 00 00 00" },
  { flag: "🇸🇳", name: "Sénégal", code: "+221", hint: "Ex: 77 00 00 000" },
  { flag: "🇧🇫", name: "Burkina", code: "+226", hint: "Ex: 70 00 00 00" },
];

export default function Billing() {
  const { activeId } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<BillingPaymentItem | null>(null);

  const billing = useQuery({
    queryKey: ["billing", activeId],
    enabled: !!activeId,
    queryFn: async () => (await api<BillingInfo>("GET", "/billing/current")).data,
  });

  const refresh = useMutation({
    mutationFn: async () =>
      (
        await api<BillingInfo & { paymentStatus: "paid" | "pending" | "failed" | "unknown" }>(
          "POST",
          "/billing/refresh",
          {},
        )
      ).data,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", activeId] });
      setNotice(
        result.paymentStatus === "paid"
          ? "Paiement confirmé avec succès ! Votre abonnement est actif."
          : result.paymentStatus === "failed"
            ? "Le paiement a été refusé ou annulé. Relancez un paiement pour activer l’abonnement."
            : result.paymentStatus === "pending"
              ? "Le paiement n’est pas encore confirmé par FedaPay. Patientez quelques instants puis cliquez sur 'Vérifier le paiement'."
              : result.access
                ? "Votre abonnement est actif."
                : "Aucun paiement confirmé pour le moment. Finalisez le paiement sur FedaPay puis réessayez.",
      );
      setParams(
        (current) => {
          current.delete("payment");
          return current;
        },
        { replace: true },
      );
    },
  });

  useEffect(() => {
    if (params.has("payment") && activeId && !refresh.isPending) {
      refresh.mutate();
    }
  }, [params, activeId]);

  const checkout = useMutation({
    mutationFn: async () => (await api<{ paymentUrl: string }>("POST", "/billing/checkout", { phone })).data,
    onSuccess: ({ paymentUrl }) => {
      window.location.assign(paymentUrl);
    },
  });

  if (billing.isLoading) return <Spinner label="Chargement de votre abonnement..." />;
  if (billing.isError || !billing.data) {
    return (
      <Card title="Abonnement">
        <p role="alert" className="text-sm text-red-700">
          {errMsg(billing.error)}
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => void billing.refetch()}>
          Réessayer
        </Button>
      </Card>
    );
  }

  const info = billing.data;
  const error = checkout.error ?? refresh.error;

  // Calcul du nombre de jours restants
  const now = new Date();
  const targetDate = info.status === "active" ? info.currentPeriodEndsAt : info.trialEndsAt;
  const daysLeft = targetDate
    ? Math.max(0, Math.ceil((new Date(targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleCountryPick = (code: string) => {
    const raw = phone.replace(/^\+\d{3}\s*/, "").trim();
    setPhone(`${code} ${raw}`);
  };

  return (
    <>
      <PageHeader
        title="Abonnement"
        subtitle={`${info.businessName} · Gestion de la formule et des paiements FedaPay`}
      />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          {/* Carte principale de formule */}
          <Card
            title="Votre formule"
            actions={
              <span
                className={`rounded-full px-3.5 py-1 text-xs font-bold ${
                  info.status === "active"
                    ? "bg-emerald-100 text-emerald-800"
                    : info.status === "trial"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {info.status === "active"
                  ? "Abonnement actif"
                  : info.status === "trial"
                    ? "Essai gratuit"
                    : "Accès suspendu"}
              </span>
            }
          >
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {money(info.monthlyPrice)}
                  <span className="ml-1 text-sm font-semibold text-slate-500">/ mois</span>
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  1 mois d’essai gratuit offert, puis renouvellement manuel de 7 000 FCFA/mois.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                <p className="text-xs font-medium text-slate-500">
                  {info.status === "trial"
                    ? "Fin de l’essai"
                    : info.status === "active"
                      ? "Accès jusqu’au"
                      : "Essai terminé le"}
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">
                  {date(info.status === "active" ? info.currentPeriodEndsAt : info.trialEndsAt)}
                </p>
                {info.status !== "expired" && (
                  <span className="mt-1 inline-block text-[11px] font-semibold text-emerald-700">
                    {daysLeft > 0 ? `${daysLeft} jour(s) restant(s)` : "Échéance aujourd'hui"}
                  </span>
                )}
              </div>
            </div>

            {/* Notification d'état de l'essai */}
            {info.status === "trial" && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <CalendarCheck className="size-5 text-amber-700 shrink-0" />
                  <span>Période d’essai gratuit en cours ({daysLeft} jours restants)</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed pl-7">
                  Vous profitez de 100% des fonctions de K-Manage. Aucun paiement ne sera prélevé automatiquement.
                  Vous pouvez activer votre abonnement mensuel dès maintenant pour anticiper votre fin d’essai.
                </p>
              </div>
            )}

            {!info.access && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-1">
                <p className="font-bold text-red-900">La période d’essai est terminée.</p>
                <p className="text-xs text-red-700 leading-relaxed">
                  Vos données, stocks et clients sont conservés en toute sécurité. Effectuez votre paiement de 7 000 FCFA
                  pour rétablir immédiatement l’accès aux fonctions de caisse et de gestion.
                </p>
              </div>
            )}

            {/* Inclus dans la formule */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Fonctionnalités incluses dans votre formule :
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Ventes & Caisse illimitées
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Gestion complète des stocks
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Carnet de dettes & clients
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Calcul automatique du bénéfice
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Reçus thermiques 58mm / 80mm
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Sauvegarde automatique cloud
                </span>
              </div>
            </div>
          </Card>

          {/* Historique des paiements */}
          <Card title="Historique des paiements">
            {info.payments.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                <Receipt className="mx-auto size-8 text-slate-300 mb-2" />
                <p>Aucun paiement enregistré pour cette boutique pour le moment.</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tous vos règlements FedaPay apparaîtront ici avec possibilité d'imprimer une quittance.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {info.payments.map((payment) => (
                  <li
                    key={payment.reference}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <span className="block text-sm font-bold text-slate-900">{money(payment.amount)}</span>
                      <span className="text-xs text-slate-500 font-mono">
                        {payment.reference} · {dateTime(payment.paidAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="size-3.5" /> Payé
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedReceipt(payment)}
                        title="Voir et imprimer la quittance"
                      >
                        <Printer className="size-3.5" /> Quittance
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Colonne de droite : Paiement FedaPay */}
        <Card title={info.status === "active" ? "Prolonger l’abonnement" : "Activer mon abonnement"}>
          {!info.paymentConfigured ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
              <p className="font-bold">Passerelle de paiement en cours d'activation</p>
              <p className="text-xs text-amber-800 leading-relaxed">
                Le paiement FedaPay n’est pas encore configuré sur le serveur. Contactez l’administrateur de la
                plateforme pour valider votre compte marchand.
              </p>
            </div>
          ) : !info.isOwner ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Autorisation réservée au propriétaire</p>
              <p className="text-xs">
                Seul le propriétaire de la boutique a l’autorisation de déclencher le paiement de l'abonnement.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm leading-6 text-slate-600">
                Réglez <b>{money(info.monthlyPrice)}</b> en toute sécurité via la page sécurisée <b>FedaPay</b>. Les
                moyens de paiement disponibles (Mobile Money et cartes bancaires) seront affichés par FedaPay.
              </p>

              {/* Badges des moyens disponibles */}
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Moyens acceptés via FedaPay :
                </p>
                <div className="flex flex-wrap gap-1.5 text-xs font-medium text-slate-700">
                  <span className="rounded-lg bg-white px-2 py-1 shadow-sm border border-slate-200">MTN Momo</span>
                  <span className="rounded-lg bg-white px-2 py-1 shadow-sm border border-slate-200">Moov Money</span>
                  <span className="rounded-lg bg-white px-2 py-1 shadow-sm border border-slate-200">Orange Money</span>
                  <span className="rounded-lg bg-white px-2 py-1 shadow-sm border border-slate-200">Wave</span>
                  <span className="rounded-lg bg-white px-2 py-1 shadow-sm border border-slate-200">Visa / Mastercard</span>
                </div>
              </div>

              {/* Raccourcis d'indicatifs pays */}
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-600 mb-1.5">Sélection rapide de l'indicatif :</p>
                <div className="flex flex-wrap gap-1.5">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleCountryPick(c.code)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50"
                    >
                      {c.flag} {c.code}
                    </button>
                  ))}
                </div>
              </div>

              <form
                className="mt-4 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  checkout.mutate();
                }}
              >
                <Input
                  label="Téléphone pour le paiement"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+229 97 00 00 00"
                  hint="Utilisé par FedaPay pour les moyens de paiement mobile disponibles (MTN, Moov, etc.)."
                />

                {error && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
                    {errMsg(error)}
                  </p>
                )}
                {notice && (
                  <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
                    {notice}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-base shadow-lg shadow-emerald-700/20"
                  size="lg"
                  loading={checkout.isPending}
                  disabled={!phone.trim()}
                >
                  Payer {money(info.monthlyPrice)} avec FedaPay <CreditCard className="size-5 ml-2" />
                </Button>
              </form>

              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 border border-slate-100">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                <span>
                  La confirmation du paiement est vérifiée directement auprès de FedaPay avant l’activation de votre
                  boutique. Aucun débit récurrent forcé.
                </span>
              </div>

              {(params.has("payment") || notice) && (
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  loading={refresh.isPending}
                  onClick={() => refresh.mutate()}
                >
                  <CalendarCheck className="size-4" /> Vérifier le statut du paiement
                </Button>
              )}
            </>
          )}
        </Card>
      </div>

      {/* ─── Modale Quittance / Reçu de paiement ─── */}
      <Modal
        open={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        title="Quittance de paiement FedaPay"
        size="md"
        footer={
          <div className="flex justify-between items-center w-full">
            <Button variant="secondary" onClick={() => setSelectedReceipt(null)}>
              Fermer
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimer la quittance
            </Button>
          </div>
        }
      >
        {selectedReceipt && (
          <div className="space-y-4 text-slate-800">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-emerald-600 text-white mx-auto mb-3 shadow-sm">
                <CheckCircle2 className="size-7" />
              </span>
              <h3 className="text-xl font-extrabold text-slate-900">Paiement validé avec succès</h3>
              <p className="text-xs text-slate-500 mt-1">Plateforme K-Manage · Reçu officiel</p>
            </div>

            <div className="rounded-xl border border-slate-100 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Boutique cliente :</span>
                <span className="font-bold text-slate-900">{info.businessName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Référence transaction :</span>
                <span className="font-mono font-bold text-slate-900">{selectedReceipt.reference}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Date et heure :</span>
                <span className="font-semibold">{dateTime(selectedReceipt.paidAt)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Passerelle :</span>
                <span className="font-semibold text-emerald-800">FedaPay (Bénin / UEMOA)</span>
              </div>
              <div className="flex justify-between py-1 pt-2 text-sm font-extrabold text-slate-900">
                <span>Montant réglé :</span>
                <span className="text-emerald-700">{money(selectedReceipt.amount)}</span>
              </div>
            </div>

            <p className="text-center text-[11px] text-slate-400">
              Ce document atteste de la validation de votre abonnement mensuel K-Manage pour 30 jours supplémentaires.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
