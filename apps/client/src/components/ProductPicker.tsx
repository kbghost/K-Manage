import { useState } from "react";
import { useList } from "../lib/hooks";
import type { Product } from "../lib/types";
import { fileUrl } from "../lib/api";
import { inputCls, Spinner } from "./ui";
import { qty } from "../lib/format";
import { Package } from "./icons";

/** Recherche et sélection visuelle d'un produit actif. */
export function ProductPicker({ label = "Article", value, onChange }: { label?: string; value: Product | null; onChange: (p: Product | null) => void }) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const list = useList<Product>("picker", "/catalog/products", { q, limit: 10, sort: "name" }, open);
  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="pp">{label}</label>
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            {value.imageUploadId ? (
              <img src={fileUrl(value.imageUploadId)} alt="" className="size-10 rounded-lg object-cover border border-slate-200" />
            ) : (
              <div className="grid size-10 place-items-center rounded-lg bg-slate-200 text-slate-500">
                <Package className="size-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{value.name}</p>
              <p className="text-xs text-slate-500">Réf : {value.sku} · Stock en rayon : {qty(value.stock)} {value.unit}</p>
            </div>
          </div>
          <button type="button" className="text-sm font-medium text-brand-700 underline hover:text-brand-800 shrink-0" onClick={() => { onChange(null); setQ(""); }}>
            Changer
          </button>
        </div>
      ) : (
        <>
          <input id="pp" className={inputCls} value={q} placeholder="Rechercher par nom, référence ou code-barres..." autoComplete="off" onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
          {open && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl" role="listbox">
              {list.loading ? (
                <li className="p-3"><Spinner label="Recherche..." /></li>
              ) : !list.items?.length ? (
                <li className="px-3 py-3 text-center text-sm text-slate-500">Aucun produit ne correspond à votre recherche.</li>
              ) : (
                list.items.map((p) => (
                  <li key={p.id}>
                    <button type="button" role="option" aria-selected={false} className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { onChange(p); setOpen(false); }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {p.imageUploadId ? (
                          <img src={fileUrl(p.imageUploadId)} alt="" className="size-9 rounded-lg object-cover border border-slate-100 shrink-0" />
                        ) : (
                          <div className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-400 shrink-0">
                            <Package className="size-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.sku}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">{qty(p.stock)} {p.unit}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
