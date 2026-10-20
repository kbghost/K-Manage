import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "../components/icons";
import { api, fileUrl, upload } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAction } from "../lib/hooks";
import { methodLabel } from "../lib/format";
import { Button, Card, Input, Modal, PageHeader, Select, Textarea, errMsg, useToast } from "../components/ui";
import Onboarding from "./Onboarding";
import { Receipt } from "../components/Receipt";
import type { Sale } from "../lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Nom obligatoire"), address: z.string().optional(), phone: z.string().optional(), email: z.union([z.string().email("Email invalide"), z.literal("")]).optional(), timezone: z.string().min(1),
  allowNegativeStock: z.boolean(), allowAnonymousSales: z.boolean(), creditDueDays: z.number().int().min(1).max(365), paymentMethods: z.string(),
  header: z.string().optional(), footer: z.string().optional(), paperWidth: z.enum(["80mm", "58mm", "a4"]), showTaxId: z.string().optional(),
});
type V = z.infer<typeof schema>;
const DEMO: Sale = { id: "x", number: "V-000123", lines: [{ productId: "1", name: "Article exemple", sku: "EX", quantityMilli: 2000, unitPrice: 1500, discount: 0, total: 3000, netTotal: 3000, refundedQtyMilli: 0, refundedValue: 0 }], subtotal: 3000, discount: 0, total: 3000, paidAmount: 3000, refundedTotal: 0, remaining: 0, paymentStatus: "paid", status: "completed", createdAt: new Date().toISOString(), cashier: "Caissier", payments: [{ id: "p", kind: "sale_payment", direction: "in", method: "cash", amount: 3000, createdAt: new Date().toISOString() }] };

export default function SettingsPage() {
  const { business, activeId } = useAuth(); const qc = useQueryClient(); const toast = useToast(); const [addBiz, setAddBiz] = useState(false); const [logo, setLogo] = useState(business?.logoUploadId);
  const b = business!;
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { name: b.name, address: b.address ?? "", phone: b.phone ?? "", email: b.email ?? "", timezone: b.timezone, allowNegativeStock: b.settings.allowNegativeStock, allowAnonymousSales: b.settings.allowAnonymousSales, creditDueDays: b.settings.creditDueDays, paymentMethods: b.settings.paymentMethods.filter((m) => m !== "cash").join(", "), header: b.receipt.header, footer: b.receipt.footer, paperWidth: b.receipt.paperWidth, showTaxId: b.receipt.showTaxId } });
  const save = useAction(async (v: V) => {
    const methods = v.paymentMethods.split(",").map((m) => m.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
    return api("PATCH", "/businesses/current", { name: v.name, address: v.address, phone: v.phone, email: v.email, timezone: v.timezone, logoUploadId: logo,
      settings: { allowNegativeStock: v.allowNegativeStock, allowAnonymousSales: v.allowAnonymousSales, creditDueDays: v.creditDueDays, paymentMethods: methods.length ? methods : ["cash"] },
      receipt: { header: v.header ?? "", footer: v.footer ?? "", paperWidth: v.paperWidth, showTaxId: v.showTaxId ?? "" } });
  }, { success: "Paramètres de votre boutique enregistrés avec succès.", onSuccess: () => { void qc.invalidateQueries({ queryKey: ["business", activeId] }); void qc.invalidateQueries({ queryKey: ["businesses"] }); } });
  const e = f.formState.errors; const w = f.watch();
  const preview: Business2 = { ...b, name: w.name || b.name, address: w.address, phone: w.phone, logoUploadId: logo, receipt: { header: w.header ?? "", footer: w.footer ?? "", paperWidth: w.paperWidth, showTaxId: w.showTaxId ?? "" } };

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Informations de votre boutique, règles de vente et personnalisation des reçus." actions={<Button variant="secondary" onClick={() => setAddBiz(true)}><Plus className="size-4" />Ajouter une autre boutique</Button>} />
      <form noValidate onSubmit={f.handleSubmit((v) => save.mutate(v))} className="grid gap-5 lg:grid-cols-2">
        <Card title="Informations de la boutique">
          <div className="space-y-3.5">
            <Input label="Nom de votre commerce / boutique" placeholder="Ex : Épicerie Sainte Marie" error={e.name?.message} {...f.register("name")} />
            <Input label="Adresse ou localisation" placeholder="Ex : Cotonou, Akpakpa Dodomey" {...f.register("address")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Numéro de téléphone" placeholder="Ex : 97 00 00 00" type="tel" {...f.register("phone")} />
              <Input label="Email de contact (facultatif)" placeholder="boutique@exemple.com" type="email" error={e.email?.message} {...f.register("email")} />
            </div>
            <Input label="Fuseau horaire" hint="Ex : Africa/Porto-Novo (Bénin, Togo, Niger)" {...f.register("timezone")} />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <label className="block text-sm font-semibold text-slate-800 mb-2">Logo de la boutique (imprimé sur les tickets)</label>
              <div className="flex items-center gap-3">
                {logo && <img src={fileUrl(logo)} alt="Logo" className="size-14 rounded-xl border border-slate-200 object-contain bg-white p-1" />}
                <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium hover:bg-slate-50 transition shadow-sm">
                  {logo ? "Changer le logo" : "Ajouter un logo"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (ev) => { const file = ev.target.files?.[0]; if (!file) return; try { setLogo((await upload(file)).id); } catch (er) { toast("error", errMsg(er)); } }} />
                </label>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Règles de vente & Fonctionnement">
          <div className="space-y-4">
            <Controller control={f.control} name="allowNegativeStock" render={({ field }) => (
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm cursor-pointer hover:bg-slate-50 transition">
                <input type="checkbox" className="mt-1 rounded text-brand-600" checked={field.value} onChange={field.onChange} />
                <span>
                  <b className="text-slate-900">Autoriser la vente même si le stock est à 0</b><br />
                  <span className="text-xs text-slate-500">Permet d'encaisser un client tout de suite même si vous n'aviez pas encore saisi l'arrivage en stock.</span>
                </span>
              </label>
            )} />
            <Controller control={f.control} name="allowAnonymousSales" render={({ field }) => (
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm cursor-pointer hover:bg-slate-50 transition">
                <input type="checkbox" className="mt-1 rounded text-brand-600" checked={field.value} onChange={field.onChange} />
                <span>
                  <b className="text-slate-900">Autoriser les ventes rapides au comptoir (sans nom de client)</b><br />
                  <span className="text-xs text-slate-500">Si décoché, le vendeur doit obligatoirement choisir une fiche client pour chaque vente.</span>
                </span>
              </label>
            )} />
            <Input label="Délai maximum avant qu'un crédit soit en retard (en jours)" type="number" min={1} max={365} {...f.register("creditDueDays", { valueAsNumber: true })} hint="Ex : 30 jours (les clients ayant des dettes plus anciennes apparaîtront en rouge)" />
            <Input label="Autres modes de paiement acceptés" hint={`Séparez par des virgules. Espèces est toujours inclus. Actuels : ${b.settings.paymentMethods.map(methodLabel).join(", ")}`} placeholder="Ex : mobile_money, carte, virement..." {...f.register("paymentMethods")} />
          </div>
        </Card>

        <Card title="Ticket de caisse / Reçu client" className="lg:col-span-2">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3.5">
              <Textarea label="Message en haut du ticket (En-tête)" placeholder="Ex : Merci pour votre visite chez..." {...f.register("header")} />
              <Textarea label="Message en bas du ticket (Pied de page)" placeholder="Ex : Les marchandises vendues ne sont ni reprises ni échangées." {...f.register("footer")} />
              <Input label="N° IFU ou identifiant fiscal (facultatif)" placeholder="Ex : 0201910000000" {...f.register("showTaxId")} />
              <Select label="Taille du papier d'impression" {...f.register("paperWidth")}>
                <option value="80mm">Ticket de caisse thermique 80 mm (Standard imprimante caisse)</option>
                <option value="58mm">Petit ticket thermique 58 mm (Mini imprimante mobile)</option>
                <option value="a4">Feuille standard A4 (Facture papier de bureau)</option>
              </Select>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Aperçu du ticket tel qu'il sera imprimé :</p>
              <div className="max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-inner">
                <div className="pointer-events-none origin-top-left">
                  <Receipt sale={DEMO} business={preview} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2 flex justify-end">
          <Button type="submit" size="lg" className="font-bold shadow-md" loading={save.isPending}>Enregistrer les paramètres</Button>
        </div>
      </form>
      <Modal open={addBiz} onClose={() => setAddBiz(false)} title="Créer un nouveau commerce" size="md">
        <Onboarding onDone={() => setAddBiz(false)} />
      </Modal>
    </>
  );
}
type Business2 = NonNullable<ReturnType<typeof useAuth>["business"]>;
