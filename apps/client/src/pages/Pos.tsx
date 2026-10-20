import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Fire, Minus, Package, PackageSearch, Plus, ScanLine, ShoppingCart, Trash2, UserPlus } from "../components/icons";
import { bumpFrequent, topFrequent } from "../lib/prefs";
import { api, fileUrl, newKey } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useList } from "../lib/hooks";
import { addToCart, previewTotals, type CartItem } from "../lib/cart";
import { methodLabel, money } from "../lib/format";
import type { CashSession, Party, Product, Sale } from "../lib/types";
import { Badge, Button, Card, EmptyState, Input, Modal, MoneyInput, Select, Spinner, cx, errMsg, inputCls, useToast } from "../components/ui";
import { ReceiptModal } from "../components/Receipt";
import { BarcodeScannerModal, cameraScanSupported } from "../components/BarcodeScanner";

interface Pay { id: number; method: string; amount: number }

export default function Pos() {
  const { business, can, activeId } = useAuth(); const toast = useToast(); const qc = useQueryClient();
  const [q, setQ] = useState(""); const [cart, setCart] = useState<CartItem[]>([]); const [discount, setDiscount] = useState(0);
  const [customerId, setCustomerId] = useState(""); const [pays, setPays] = useState<Pay[]>([{ id: 1, method: "cash", amount: 0 }]);
  const [busy, setBusy] = useState(false); const [receipt, setReceipt] = useState<Sale | null>(null); const [scan, setScan] = useState(false); const [newCust, setNewCust] = useState(false);
  const [favTick, setFavTick] = useState(0); const favs = useMemo(() => topFrequent(activeId, 6), [activeId, favTick]);
  const key = useRef(newKey()); const cartRef = useRef<HTMLDivElement>(null); const searchRef = useRef<HTMLInputElement>(null);
  const canDiscount = can("sales.discount"); const methods = business?.settings.paymentMethods ?? ["cash"];

  const products = useList<Product>("pos-products", "/catalog/products", { q, limit: 32, sort: "name" });
  const customers = useList<Party>("pos-customers", "/parties/customers", { limit: 100 }, can("customers.read"));
  const session = useQuery({ queryKey: ["cash-current", activeId], enabled: can("cash.manage") && !!activeId, queryFn: async () => (await api<CashSession | null>("GET", "/cash-sessions/current")).data });

  const t = useMemo(() => previewTotals(cart, discount), [cart, discount]);
  const paid = pays.reduce((s, p) => s + p.amount, 0); const remaining = Math.max(0, t.total - paid);
  const needCustomer = remaining > 0 && !customerId; const anonBlocked = !customerId && business?.settings.allowAnonymousSales === false;

  const add = useCallback((p: Product) => {
    if (p.outOfStock && !business?.settings.allowNegativeStock) { toast("error", `« ${p.name} » est en rupture de stock.`); return; }
    setCart((c) => addToCart(c, p)); key.current = newKey(); bumpFrequent(activeId, p); setFavTick((t) => t + 1);
  }, [business, toast, activeId]);

  // Douchette USB : elle tape le code puis Entrée. On cherche une correspondance exacte (code-barres ou SKU).
  const lookup = useCallback(async (code: string) => {
    try { const { data } = await api<Product>("GET", `/catalog/products/lookup?code=${encodeURIComponent(code)}`); add(data); setQ(""); }
    catch { toast("error", `Aucun article trouvé pour le code « ${code} ».`); }
  }, [add, toast]);

  useEffect(() => { searchRef.current?.focus(); }, []);
  const setQty = (id: string, v: number) => setCart((c) => c.map((i) => (i.productId === id ? { ...i, quantity: v } : i)));
  const reset = () => { setCart([]); setDiscount(0); setCustomerId(""); setPays([{ id: 1, method: "cash", amount: 0 }]); key.current = newKey(); searchRef.current?.focus(); };

  async function submit() {
    setBusy(true);
    try {
      const body = {
        customerId: customerId || undefined, discount: discount || undefined,
        lines: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, discount: i.discount || undefined })),
        payments: pays.filter((p) => p.amount > 0).map((p) => ({ method: p.method, amount: p.amount })),
      };
      const { data } = await api<Sale>("POST", "/sales", body, { idempotencyKey: key.current });
      toast("success", `Vente ${data.number} enregistrée avec succès.`); setReceipt({ ...data, business: business ?? undefined }); reset();
      void qc.invalidateQueries({ queryKey: ["pos-products"] }); void qc.invalidateQueries({ queryKey: ["cash-current"] });
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }
  const blocked = cart.length === 0 || !t.ok || needCustomer || anonBlocked || paid > t.total || busy;

  return (
    <div className="grid gap-5 pb-20 lg:grid-cols-[1fr_26rem] lg:pb-0">
      <div className="min-w-0 space-y-4">
        {/* Barre de recherche avec lecteur de code-barres */}
        <div className="flex gap-2">
          <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); const code = q.trim(); if (code) void lookup(code); }}>
            <ScanLine className="pointer-events-none absolute left-3.5 top-3 size-5 text-slate-400" aria-hidden />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un produit ou scanner un code-barres" placeholder="Tapez le nom, la référence ou scannez le code-barres..." className={cx(inputCls, "py-2.5 pl-11 shadow-sm")} />
          </form>
          {cameraScanSupported() && <Button variant="secondary" onClick={() => setScan(true)} aria-label="Scanner avec la camera" title="Scanner avec l'appareil photo"><Camera className="size-5" /></Button>}
        </div>

        {session.data === null && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <p className="font-medium">Aucune caisse ouverte pour le moment.</p>
            <p className="mt-0.5 text-xs text-amber-800">Les encaissements en espèces ne seront pas liés à un fond de caisse. <Link className="font-semibold underline" to="/cash">Ouvrir la caisse maintenant</Link></p>
          </div>
        )}

        {/* Produits fréquents / favoris */}
        {!q && favs.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scroll-thin" aria-label="Vos favoris">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Fire className="size-4 text-brand-700" />Articles fréquents :
            </span>
            {favs.map((f) => (
              <motion.button key={f.id} whileTap={{ scale: 0.95 }} whileHover={{ y: -1 }} onClick={async () => { try { const { data } = await api<Product>("GET", `/catalog/products/${f.id}`); add(data); } catch { toast("error", `« ${f.name} » est introuvable.`); } }} className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-500 hover:text-brand-700">
                {f.name}
              </motion.button>
            ))}
          </div>
        )}

        {/* Grille de sélection visuelle rapide des produits */}
        {products.loading ? (
          <Spinner label="Chargement des produits..." />
        ) : !products.items?.length ? (
          <EmptyState icon={PackageSearch} title="Aucun produit trouvé" text={q ? "Essayez un autre nom ou vérifiez le code-barres." : "Ajoutez vos premiers produits dans l'onglet Produits."} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.items.map((p) => {
              const off = p.outOfStock && !business?.settings.allowNegativeStock;
              return (
                <motion.button
                  key={p.id}
                  whileHover={off ? undefined : { y: -3 }}
                  whileTap={off ? undefined : { scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 450, damping: 28 }}
                  onClick={() => add(p)}
                  disabled={off}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3 text-left shadow-sm transition-all hover:border-brand-500 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <div className="w-full">
                    {/* Image nette et mise en avant pour choix visuel rapide */}
                    <div className="relative mb-2.5 aspect-square w-full overflow-hidden rounded-xl bg-slate-100 flex items-center justify-center">
                      {p.imageUploadId ? (
                        <img
                          src={fileUrl(p.imageUploadId)}
                          alt=""
                          className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="size-10 text-slate-300" aria-hidden />
                      )}
                    </div>
                    <span className="line-clamp-2 text-sm font-semibold text-slate-800 leading-snug group-hover:text-brand-800">{p.name}</span><span className="text-xs text-slate-400 font-mono">{p.sku}</span>
                  </div>

                  <div className="mt-2.5 flex items-baseline justify-between border-t border-slate-100 pt-2">
                    <span className="text-base font-bold tabular-nums text-brand-700">{money(p.salePrice)}</span>
                    {p.outOfStock ? <Badge tone="red">Epuise</Badge> : p.lowStock ? <Badge tone="amber">{p.stock} {p.unit}</Badge> : <span className="text-xs text-slate-500">{p.stock} {p.unit}</span>}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Panier et encaissement */}
      <div ref={cartRef}>
        <Card title={`Panier (${cart.length} article${cart.length > 1 ? "s" : ""})`} className="lg:sticky lg:top-4 shadow-md" actions={
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-xs font-semibold text-brand-700 dark:text-brand-400 hover:underline lg:hidden px-2 py-1">+ Ajouter</button>
            {cart.length > 0 && <Button variant="ghost" size="sm" onClick={reset}>Vider</Button>}
          </div>
        }>
          {cart.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="Le panier est vide" text="Touchez un produit à gauche ou scannez un code-barres pour commencer la vente." />
          ) : (
            <div className="space-y-4">
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto pr-1 scroll-thin">
                <AnimatePresence initial={false}>
                  {cart.map((i) => (
                    <motion.li key={i.productId} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20, height: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        {/* Miniature de confirmation visuelle dans le panier */}
                        {i.imageUploadId ? (
                          <img src={fileUrl(i.imageUploadId)} alt="" className="size-11 shrink-0 rounded-lg object-cover border border-slate-200" />
                        ) : (
                          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400 border border-slate-200">
                            <Package className="size-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{i.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{i.sku} · {money(i.unitPrice)} / {i.unit}</p>
                        </div>
                        <button aria-label={`Retirer ${i.name}`} onClick={() => setCart((c) => c.filter((x) => x.productId !== i.productId))} className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 pl-13 sm:pl-0">
                        <div className="flex items-center gap-1.5">
                          <button aria-label="Diminuer la quantite" className="grid size-7 place-items-center rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95" onClick={() => setQty(i.productId, Math.max(0.001, Math.round((i.quantity - 1) * 1000) / 1000))}>
                            <Minus className="size-3.5" />
                          </button>
                          <input aria-label={`Quantite pour ${i.name}`} inputMode="decimal" value={i.quantity} onChange={(e) => { const v = Number(e.target.value.replace(",", ".")); if (Number.isFinite(v) && v > 0) setQty(i.productId, Math.round(v * 1000) / 1000); }} className="w-14 rounded-lg border border-slate-300 px-1 py-1 text-center text-sm font-semibold tabular-nums" />
                          <button aria-label="Augmenter la quantite" className="grid size-7 place-items-center rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95" onClick={() => setQty(i.productId, Math.round((i.quantity + 1) * 1000) / 1000)}>
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-slate-900">{money(Math.round(i.quantity * i.unitPrice) - i.discount)}</span>
                      </div>

                      {canDiscount && (
                        <div className="mt-1.5 flex items-center justify-end gap-2 text-xs text-slate-500">
                          <label htmlFor={`d-${i.productId}`}>Remise sur l'article :</label>
                          <input id={`d-${i.productId}`} inputMode="numeric" value={i.discount || ""} placeholder="0" onChange={(e) => setCart((c) => c.map((x) => (x.productId === i.productId ? { ...x, discount: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-right font-medium" />
                        </div>
                      )}
                      {i.stock < i.quantity && !business?.settings.allowNegativeStock && (
                        <p className="mt-1 text-xs font-medium text-red-600">Stock restant disponible : {i.stock}</p>
                      )}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>

              <div className="flex items-end gap-2 pt-2 border-t border-slate-100">
                <Select label="Client" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="flex-1">
                  <option value="">{business?.settings.allowAnonymousSales === false ? "— Choisir obligatoirement un client —" : "Client de passage (sans fiche client)"}</option>
                  {customers.items?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                {can("customers.manage") && <Button variant="secondary" aria-label="Nouveau client" title="Ajouter un nouveau client" onClick={() => setNewCust(true)}><UserPlus className="size-4" /></Button>}
              </div>

              {canDiscount && <MoneyInput label="Réduction globale (Rabais sur le total)" value={discount} onChange={setDiscount} />}

              {/* Résumé clair du montant */}
              <dl className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex justify-between"><dt className="text-slate-600">Sous-total</dt><dd className="font-medium tabular-nums">{money(t.subtotal)}</dd></div>
                {discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Réduction accordée</dt><dd className="font-semibold tabular-nums">-{money(discount)}</dd></div>}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-lg font-bold text-slate-900"><dt>Total à payer</dt><dd className="tabular-nums text-brand-700" data-testid="cart-total">{money(t.total)}</dd></div>
              </dl>
              {!t.ok && <p role="alert" className="text-sm font-medium text-red-600">{t.error}</p>}

              {/* Mode de règlement */}
              <fieldset className="space-y-2.5">
                <legend className="text-sm font-semibold text-slate-800">Mode de paiement</legend>
                {pays.map((p, idx) => (
                  <div key={p.id} className="flex items-end gap-2">
                    <Select label={idx === 0 ? "Mode" : "Autre moyen"} value={p.method} onChange={(e) => setPays((l) => l.map((x) => (x.id === p.id ? { ...x, method: e.target.value } : x)))} className="w-36">
                      {methods.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
                    </Select>
                    <MoneyInput label="Somme reçue" value={p.amount} onChange={(v) => setPays((l) => l.map((x) => (x.id === p.id ? { ...x, amount: v } : x)))} className="flex-1" />
                    {idx > 0 && <Button variant="ghost" aria-label="Supprimer ce mode de paiement" onClick={() => setPays((l) => l.filter((x) => x.id !== p.id))}><Trash2 className="size-4 text-red-500" /></Button>}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setPays((l) => l.map((x, i) => (i === 0 ? { ...x, amount: Math.max(0, t.total - l.slice(1).reduce((s, y) => s + y.amount, 0)) } : x)))}>
                    Payer la totalite
                  </Button>
                  {pays.length < 3 && <Button variant="ghost" size="sm" onClick={() => setPays((l) => [...l, { id: Date.now(), method: methods.find((m) => !l.some((x) => x.method === m)) ?? "cash", amount: 0 }])}>+ Partager le paiement</Button>}
                </div>
              </fieldset>

              <div className={cx("rounded-xl p-3 text-sm font-medium", remaining > 0 ? "bg-amber-50 text-amber-900 border border-amber-200" : "bg-emerald-50 text-emerald-900 border border-emerald-200")} aria-live="polite">
                {paid > t.total ? "Le montant reçu dépasse le total : rendez la monnaie au client." : remaining > 0 ? `Reste à payer (crédit accordé) : ${money(remaining)}` : "Vente réglée en totalité."}
              </div>

              {needCustomer && <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700">Choisissez un client : obligatoire pour une vente à crédit ou un acompte.</p>}
              {anonBlocked && <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700">Ce magasin n'autorise pas les ventes sans nom : choisissez un client.</p>}

              <Button size="lg" className="w-full text-base font-bold shadow-md" disabled={blocked} loading={busy} onClick={() => void submit()}>
                Valider la vente — {money(t.total)}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {cart.length > 0 && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] backdrop-blur shadow-2xl lg:hidden">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{cart.length} article{cart.length > 1 ? "s" : ""}</p>
            <p className="text-lg font-extrabold tabular-nums text-brand-600 dark:text-brand-400 leading-tight">{money(t.total)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={reset}>Vider</Button>
            <Button size="sm" onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth" })}>Voir le panier</Button>
          </div>
        </div>
      )}

      <BarcodeScannerModal open={scan} onClose={() => setScan(false)} onCode={(c) => void lookup(c)} />
      <QuickCustomer open={newCust} onClose={() => setNewCust(false)} onCreated={(id) => { setCustomerId(id); void qc.invalidateQueries({ queryKey: ["pos-customers"] }); }} />
      <ReceiptModal sale={receipt} business={business ?? undefined} onClose={() => setReceipt(null)} />
    </div>
  );
}

function QuickCustomer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [busy, setBusy] = useState(false); const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Ajouter un client rapidement" size="sm" footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button loading={busy} disabled={name.trim().length < 1} onClick={async () => {
      setBusy(true); try { const { data } = await api<Party>("POST", "/parties/customers", { name, phone: phone || undefined }); onCreated(data.id); setName(""); setPhone(""); onClose(); } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
    }}>Enregistrer le client</Button></>}>
      <div className="space-y-3">
        <Input label="Nom et prénom du client" placeholder="Ex : M. Koffi" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Numéro de téléphone (facultatif)" placeholder="Ex : 97 00 00 00" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
    </Modal>
  );
}
