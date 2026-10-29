import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Archive, Download, History, Pencil, Plus, Printer, RotateCcw, Tags, Upload as UploadIcon, Package } from "../components/icons";
import { api, download, fileUrl, qs, upload } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAction, useData, useList } from "../lib/hooks";
import { csvToRows } from "../lib/csv";
import { fmtDateTime, money, qty } from "../lib/format";
import type { Category, Product } from "../lib/types";
import { Badge, Button, ConfirmDialog, DataTable, EmptyState, ErrorState, Input, Modal, MoneyInput, PageHeader, Pagination, SearchBox, Select, Skeleton, Textarea, useToast, errMsg, Card, Spinner } from "../components/ui";
import { LabelsModal } from "../components/Labels";

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"), sku: z.string().trim().min(1, "La référence (SKU) est obligatoire"), barcode: z.string().trim().optional(),
  categoryId: z.string().optional(), unit: z.string().trim().min(1, "Unité obligatoire"), costPrice: z.number().int().min(0), salePrice: z.number().int().min(0),
  initialStock: z.number().min(0).optional(), alertThreshold: z.number().min(0), description: z.string().optional(),
}).refine((v) => v.salePrice >= 0, { path: ["salePrice"], message: "Prix invalide" });
type FormV = z.infer<typeof schema>;

function ProductForm({ product, categories, onClose }: { product?: Product; categories: Category[]; onClose: () => void }) {
  const toast = useToast(); const [imageId, setImageId] = useState<string | undefined>(product?.imageUploadId); const [uploading, setUploading] = useState(false);
  const f = useForm<FormV>({ resolver: zodResolver(schema), defaultValues: product ? { name: product.name, sku: product.sku, barcode: product.barcode ?? "", categoryId: product.categoryId ?? "", unit: product.unit, costPrice: product.costPrice, salePrice: product.salePrice, alertThreshold: product.alertThreshold, description: product.description ?? "" } : { unit: "pièce", costPrice: 0, salePrice: 0, initialStock: 0, alertThreshold: 0 } });
  const save = useAction(async (v: FormV) => {
    const body = { name: v.name, sku: v.sku, barcode: v.barcode || undefined, categoryId: v.categoryId || null, unit: v.unit, costPrice: v.costPrice, salePrice: v.salePrice, alertThreshold: v.alertThreshold, description: v.description || undefined, imageUploadId: imageId ?? null };
    return product ? api("PATCH", `/catalog/products/${product.id}`, body) : api("POST", "/catalog/products", { ...body, categoryId: v.categoryId || undefined, imageUploadId: imageId, initialStock: v.initialStock ?? 0 });
  }, { invalidate: ["products", "pos-products", "stock-alerts"], success: product ? "Article modifié avec succès." : "Article créé avec succès.", onSuccess: onClose });
  const e = f.formState.errors;

  return (
    <form noValidate onSubmit={f.handleSubmit((v) => save.mutate(v))} className="space-y-4">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Input label="Nom de l'article" placeholder="Ex : Savon de Marseille 200g" className="sm:col-span-2" error={e.name?.message} {...f.register("name")} />
        <Input label="Référence ou code article (SKU)" placeholder="Ex : SAV-001" error={e.sku?.message} {...f.register("sku")} />
        <Input label="Code-barres (facultatif)" placeholder="Ex : 6181100000000" inputMode="numeric" error={e.barcode?.message} {...f.register("barcode")} />
        <Select label="Catégorie" {...f.register("categoryId")}>
          <option value="">— Sans catégorie —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input label="Unité" placeholder="pièce, sachet, kg, carton..." hint="Ex : pièce, paquet, kg, litre..." error={e.unit?.message} {...f.register("unit")} />
        <Controller control={f.control} name="costPrice" render={({ field }) => <MoneyInput label="Prix d'achat (ce que vous payez)" value={field.value} onChange={field.onChange} />} />
        <Controller control={f.control} name="salePrice" render={({ field }) => <MoneyInput label="Prix de vente (ce que le client paie)" value={field.value} onChange={field.onChange} error={e.salePrice?.message} />} />
        {!product && <Input label="Quantité actuellement en rayon (Stock départ)" type="number" step="any" min={0} error={e.initialStock?.message} {...f.register("initialStock", { valueAsNumber: true })} />}
        <Input label="Alerte quand le stock descend sous..." type="number" step="any" min={0} hint="Quantité minimale avant alerte" {...f.register("alertThreshold", { valueAsNumber: true })} />
        <Textarea label="Détails ou description (facultatif)" placeholder="Emplacement, caractéristiques..." className="sm:col-span-2" {...f.register("description")} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
        <label className="block text-sm font-semibold text-slate-800 mb-2">Photo de l'article</label>
        <div className="flex items-center gap-3">
          {imageId ? (
            <img src={fileUrl(imageId)} alt="Aperçu du produit" className="size-16 rounded-xl border border-slate-200 object-cover shadow-sm" />
          ) : (
            <div className="grid size-16 place-items-center rounded-xl bg-slate-200 text-slate-400">
              <Package className="size-8" />
            </div>
          )}
          <div>
            <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">
              {uploading ? "Envoi de la photo..." : imageId ? "Changer la photo" : "Ajouter une photo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (ev) => { const file = ev.target.files?.[0]; if (!file) return; setUploading(true); try { setImageId((await upload(file)).id); } catch (er) { toast("error", errMsg(er)); } finally { setUploading(false); } }} />
            </label>
            {imageId && <Button type="button" variant="ghost" size="sm" className="ml-2 text-red-600" onClick={() => setImageId(undefined)}>Retirer la photo</Button>}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={save.isPending}>Enregistrer</Button>
      </div>
    </form>
  );
}

interface Hist { movements: { id: string; type: string; quantity: number; stockAfter: number; reason?: string; createdAt: string }[]; changes: { id: string; action: string; createdAt: string; details?: Record<string, [number, number]> }[] }
function HistoryModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const q = useData<Hist>("product-history", `/catalog/products/${product?.id}/history`, !!product);
  return (
    <Modal open={!!product} onClose={onClose} title={`Historique — ${product?.name ?? ""}`} size="lg">
      {q.isLoading ? <Spinner label="Chargement de l'historique..." /> : (
        <div className="space-y-4 text-sm">
          {q.data?.changes.length ? (
            <div>
              <h3 className="mb-1 font-semibold text-slate-800">Changements de prix</h3>
              <ul className="space-y-1">{q.data.changes.map((c) => <li key={c.id} className="text-slate-600">{fmtDateTime(c.createdAt)} — Achat : {money(c.details?.costPrice?.[0])} → {money(c.details?.costPrice?.[1])} ; Vente : {money(c.details?.salePrice?.[0])} → {money(c.details?.salePrice?.[1])}</li>)}</ul>
            </div>
          ) : null}
          <div>
            <h3 className="mb-1.5 font-semibold text-slate-800">Entrées et sorties de stock</h3>
            <DataTable rows={q.data?.movements} columns={[
              { key: "d", header: "Date", render: (m) => fmtDateTime(m.createdAt) },
              { key: "t", header: "Opération", render: (m) => <Badge>{m.type}</Badge> },
              { key: "q", header: "Quantité", align: "right", render: (m) => <span className={m.quantity < 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>{m.quantity > 0 ? "+" : ""}{qty(m.quantity)}</span> },
              { key: "s", header: "Nouveau stock", align: "right", render: (m) => qty(m.stockAfter) },
              { key: "r", header: "Motif", render: (m) => m.reason ?? "—" },
            ]} />
          </div>
        </div>)}
    </Modal>
  );
}

function CategoriesModal({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: Category[] }) {
  const [name, setName] = useState(""); const [edit, setEdit] = useState<Category | null>(null); const [del, setDel] = useState<Category | null>(null);
  const done = { invalidate: ["categories", "products"] };
  const add = useAction(() => api("POST", "/catalog/categories", { name }), { ...done, success: "Catégorie ajoutée.", onSuccess: () => setName("") });
  const rename = useAction(() => api("PATCH", `/catalog/categories/${edit!.id}`, { name }), { ...done, success: "Catégorie renommée.", onSuccess: () => { setEdit(null); setName(""); } });
  const remove = useAction(() => api("DELETE", `/catalog/categories/${del!.id}`), { ...done, success: "Catégorie supprimée.", onSuccess: () => setDel(null) });

  return (
    <Modal open={open} onClose={onClose} title="Catégories d'articles" size="sm">
      <form className="mb-3.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) (edit ? rename : add).mutate(undefined); }}>
        <input aria-label="Nom de la categorie" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle catégorie (ex : Boissons)" className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm" />
        <Button type="submit" loading={add.isPending || rename.isPending}>{edit ? "Renommer" : "Ajouter"}</Button>
      </form>
      <ul className="divide-y divide-slate-100">{categories.map((c) => (
        <li key={c.id} className="flex items-center justify-between py-2.5 text-sm font-medium text-slate-700">
          {c.name}
          <span className="flex gap-1">
            <Button variant="ghost" size="sm" aria-label={`Renommer ${c.name}`} onClick={() => { setEdit(c); setName(c.name); }}><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="sm" aria-label={`Supprimer ${c.name}`} onClick={() => setDel(c)}><Archive className="size-4 text-slate-400" /></Button>
          </span>
        </li>
      ))}</ul>
      {categories.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">Aucune catégorie pour l'instant.</p>}
      <ConfirmDialog open={!!del} title="Supprimer la catégorie ?" message={`« ${del?.name} » sera supprimée (impossible si des articles y sont encore rattachés).`} danger confirmLabel="Supprimer" loading={remove.isPending} onConfirm={() => remove.mutate(undefined)} onClose={() => setDel(null)} />
    </Modal>
  );
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]); const [result, setResult] = useState<{ valid: boolean; count: number; errors: { row: number; message: string }[] } | null>(null); const toast = useToast(); const [busy, setBusy] = useState(false);
  const check = async (r: Record<string, string>[]) => { setBusy(true); try { setResult((await api<NonNullable<typeof result>>("POST", "/catalog/products/import", { rows: r, dryRun: true })).data); } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); } };
  const run = useAction(() => api("POST", "/catalog/products/import", { rows }), { invalidate: ["products", "categories", "pos-products"], success: "Import terminé avec succès.", onSuccess: () => { setRows([]); setResult(null); onClose(); } });

  return (
    <Modal open={open} onClose={onClose} title="Importer des articles depuis Excel / CSV" size="lg" footer={<><Button variant="secondary" onClick={onClose}>Fermer</Button><Button disabled={!result?.valid || run.isPending} loading={run.isPending} onClick={() => run.mutate(undefined)}>Importer {result?.valid ? `${result.count} article(s)` : ""}</Button></>}>
      <p className="mb-2 text-sm text-slate-600">Colonnes acceptées dans votre fichier : <code>nom, sku, code-barres, categorie, prix achat, prix vente, unite, stock, seuil</code>. Le fichier est vérifié avant enregistrement pour éviter toute erreur.</p>
      <input type="file" accept=".csv,text/csv" aria-label="Fichier CSV" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const r = csvToRows(await file.text()).slice(0, 1000); setRows(r); setResult(null); if (r.length) await check(r); else toast("error", "Fichier vide ou illisible."); }} />
      {busy && <Spinner label="Vérification du fichier..." />}
      {result && <div className="mt-3 text-sm">{result.valid ? <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 font-medium text-emerald-800">{result.count} article(s) valide(s), prêts à être ajoutés au catalogue.</p> : <div role="alert" className="rounded-xl bg-red-50 p-3 text-red-800"><p className="font-semibold">Veuillez corriger ces erreurs :</p><ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5">{result.errors.map((er, i) => <li key={i}>{er.row ? `Ligne ${er.row} : ` : ""}{er.message}</li>)}</ul></div>}</div>}
    </Modal>
  );
}

export default function Products() {
  const { can, business } = useAuth(); const [sp, setSp] = useSearchParams(); const toast = useToast();
  const [page, setPage] = useState(1); const [categoryId, setCategoryId] = useState(""); const [status, setStatus] = useState("active"); const [low, setLow] = useState(false);
  const q = sp.get("q") ?? ""; const setQ = (v: string) => { setSp(v ? { q: v } : {}); setPage(1); };
  const [edit, setEdit] = useState<Product | "new" | null>(sp.get("new") ? "new" : null);
  useEffect(() => { if (sp.get("new")) { const n = new URLSearchParams(sp); n.delete("new"); setSp(n, { replace: true }); } }, []);
  const [hist, setHist] = useState<Product | null>(null); const [cats, setCats] = useState(false); const [imp, setImp] = useState(false); const [labels, setLabels] = useState<Product[]>([]); const [arch, setArch] = useState<Product | null>(null);
  const params = { q, page, limit: 20, categoryId, status, low: low ? "true" : undefined };
  const list = useList<Product>("products", "/catalog/products", params);
  const categories = useData<Category[]>("categories", "/catalog/categories"); const cats_ = categories.data ?? []; const catName = (id?: string) => cats_.find((c) => c.id === id)?.name ?? "—";
  const showCost = can("products.update") || can("reports.financial.read");
  const setStatusAct = useAction((v: { p: Product; status: "active" | "archived" }) => api("PATCH", `/catalog/products/${v.p.id}`, { status: v.status }), { invalidate: ["products", "pos-products"], success: "Statut mis à jour.", onSuccess: () => setArch(null) });
  const exp = (format: string) => download(`/catalog/products${qs({ ...params, page: undefined, limit: undefined, format })}`, `produits.${format}`).catch((e) => toast("error", errMsg(e)));

  return (
    <>
      <PageHeader title="Produits" subtitle="Catalogue de vos articles, prix de vente et quantités en rayon." actions={<>
        <Button variant="secondary" onClick={() => setCats(true)}><Tags className="size-4" />Catégories</Button>
        <Button variant="secondary" onClick={() => setLabels(list.items ?? [])} disabled={!list.items?.length}><Printer className="size-4" />Étiquettes</Button>
        <div className="flex"><Button variant="secondary" className="rounded-r-none" onClick={() => void exp("csv")}><Download className="size-4" />CSV</Button><Button variant="secondary" className="-ml-px rounded-none" onClick={() => void exp("xlsx")}>Excel</Button><Button variant="secondary" className="-ml-px rounded-l-none" onClick={() => void exp("pdf")}>PDF</Button></div>
        {can("products.create") && <><Button variant="secondary" onClick={() => setImp(true)}><UploadIcon className="size-4" />Importer</Button><Button onClick={() => setEdit("new")}><Plus className="size-4" />Nouveau produit</Button></>}
      </>} />
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-2.5 sm:gap-3">
          <div className="w-full sm:w-auto sm:flex-1 sm:max-w-xs">
            <SearchBox value={q} onChange={setQ} placeholder="Nom, SKU ou code-barres..." />
          </div>
          <Select label="Catégorie" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="flex-1 min-w-[130px] sm:w-44 sm:flex-initial"><option value="">Toutes les catégories</option>{cats_.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select label="État" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="flex-1 min-w-[130px] sm:w-36 sm:flex-initial"><option value="active">Articles en vente</option><option value="archived">Articles archivés</option><option value="all">Tous les articles</option></Select>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer"><input type="checkbox" className="rounded text-brand-600" checked={low} onChange={(e) => { setLow(e.target.checked); setPage(1); }} />Stock presque fini ou épuisé</label>
        </div>

        <DataTable rows={list.items} loading={list.loading} error={list.error} onRetry={() => void list.refetch()}
          empty={<EmptyState icon={Package} title="Aucun produit trouvé" text={q || low || categoryId ? "Aucun article ne correspond à votre recherche." : "Ajoutez votre premier article ou importez une liste CSV."} action={can("products.create") ? <Button onClick={() => setEdit("new")}><Plus className="size-4" />Nouveau produit</Button> : undefined} />}
          columns={[
              { key: "n", header: "Article", render: (p) => (
                <div className="flex items-center gap-3">
                  {p.imageUploadId ? (
                    <img src={fileUrl(p.imageUploadId)} alt="" className="size-11 rounded-xl border border-slate-200 object-cover shadow-sm shrink-0" />
                  ) : (
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400">
                      <Package className="size-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{p.sku}{p.barcode ? ` · ${p.barcode}` : ""}</p>
                  </div>
                </div>
              ) },
              { key: "c", header: "Catégorie", render: (p) => catName(p.categoryId) },
              ...(showCost ? [{ key: "pa", header: "Prix d'achat", align: "right" as const, render: (p: Product) => money(p.costPrice) }] : []),
              { key: "pv", header: "Prix de vente", align: "right", render: (p) => <span className="font-semibold text-brand-700 tabular-nums">{money(p.salePrice)}</span> },
              { key: "s", header: "Stock restant", align: "right", render: (p) => p.status === "archived" ? <Badge>Archivé</Badge> : p.outOfStock ? <Badge tone="red">Epuise</Badge> : <span className={p.lowStock ? "font-bold text-amber-700" : "font-medium"}>{qty(p.stock)} {p.unit}</span> },
              { key: "a", header: "", align: "right", render: (p) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" aria-label={`Historique de ${p.name}`} title="Voir l'historique" onClick={() => setHist(p)}><History className="size-4" /></Button>
                  <Button variant="ghost" size="sm" aria-label={`Etiquette de ${p.name}`} title="Imprimer l'étiquette" onClick={() => setLabels([p])}><Printer className="size-4" /></Button>
                  {can("products.update") && <>
                    <Button variant="ghost" size="sm" aria-label={`Modifier ${p.name}`} title="Modifier" onClick={() => setEdit(p)}><Pencil className="size-4" /></Button>
                    {p.status === "active" ? (
                      <Button variant="ghost" size="sm" aria-label={`Archiver ${p.name}`} title="Archiver l'article" onClick={() => setArch(p)}><Archive className="size-4 text-slate-400" /></Button>
                    ) : (
                      <Button variant="ghost" size="sm" aria-label={`Restaurer ${p.name}`} title="Restaurer l'article" onClick={() => setStatusAct.mutate({ p, status: "active" })}><RotateCcw className="size-4 text-emerald-600" /></Button>
                    )}
                  </>}
                </div>
              ) },
            ]} />
        <Pagination meta={list.meta} onPage={setPage} />
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Nouveau produit" : "Modifier l'article"} size="lg">
        {edit && <ProductForm key={edit === "new" ? "new" : edit.id} product={edit === "new" ? undefined : edit} categories={cats_} onClose={() => setEdit(null)} />}
      </Modal>
      <HistoryModal product={hist} onClose={() => setHist(null)} />
      <CategoriesModal open={cats} onClose={() => setCats(false)} categories={cats_} />
      <ImportModal open={imp} onClose={() => setImp(false)} />
      <LabelsModal products={labels} onClose={() => setLabels([])} />
      <ConfirmDialog open={!!arch} title="Archiver cet article ?" message={`« ${arch?.name} » ne sera plus proposé à la vente. Son historique reste conservé et vous pourrez le réactiver à tout moment.`} confirmLabel="Archiver" danger loading={setStatusAct.isPending} onConfirm={() => arch && setStatusAct.mutate({ p: arch, status: "archived" })} onClose={() => setArch(null)} />
      {business?.settings.allowNegativeStock && <p className="mt-3 text-xs text-slate-500">Note : La vente sans stock (stock négatif) est autorisée dans vos paramètres.</p>}
    </>
  );
}
