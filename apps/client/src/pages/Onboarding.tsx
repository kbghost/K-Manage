import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Store } from "../components/icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Input, errMsg } from "../components/ui";

const schema = z.object({
  name: z.string().trim().min(2, "Donnez un nom à votre commerce"),
  address: z.string().optional(),
  phone: z.string().optional(),
});

/** Création d'un commerce : le créateur devient propriétaire. Sert aussi à ajouter une 2e boutique. */
export default function Onboarding({ onDone }: { onDone?: () => void }) {
  const { selectBusiness, signOut, businesses } = useAuth(); const qc = useQueryClient(); const [error, setError] = useState("");
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3.5 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700 shadow-sm border border-brand-100">
          <Store className="size-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{businesses.length ? "Ajouter une autre boutique" : "Bienvenue ! Enregistrez votre boutique"}</h1>
        <p className="mt-1.5 text-sm text-slate-500">Vous serez le gérant principal. Vous pourrez ajouter vos employés et caissiers par la suite.</p>
      </div>

      <form noValidate className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-md" onSubmit={f.handleSubmit(async (v) => {
        setError(""); try { const r = await api<{ id: string }>("POST", "/businesses", { ...v, address: v.address || undefined, phone: v.phone || undefined }, { tenant: false }); await qc.invalidateQueries({ queryKey: ["businesses"] }); selectBusiness(r.data.id); onDone?.(); } catch (e) { setError(errMsg(e)); }
      })}>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 font-medium">{error}</p>}
        <Input label="Nom de votre boutique / magasin" placeholder="Ex : Boutique Sainte Grâce" error={f.formState.errors.name?.message} {...f.register("name")} />
        <Input label="Quartier, marché ou adresse (facultatif)" placeholder="Ex : Grand Marché, Allée A" {...f.register("address")} />
        <Input label="Numéro de téléphone (facultatif)" placeholder="Ex : 97 00 00 00" type="tel" {...f.register("phone")} />
        <Button type="submit" size="lg" className="w-full font-bold shadow-md" loading={f.formState.isSubmitting}>
          Créer ma boutique
        </Button>
      </form>

      {!businesses.length && (
        <p className="mt-5 text-center text-xs text-slate-500">
          Vous êtes vendeur ou caissier ? Demandez au gérant de vous ajouter avec votre email, puis{" "}
          <button className="font-semibold text-brand-700 underline" onClick={() => void signOut()}>reconnectez-vous</button>.
        </p>
      )}
    </div>
  );
}
