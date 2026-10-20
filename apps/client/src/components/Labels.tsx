import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "./icons";
import { money } from "../lib/format";
import type { Product } from "../lib/types";
import { Button, Modal } from "./ui";

function Bar({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => { try { if (ref.current) JsBarcode(ref.current, value, { format: "CODE128", height: 36, width: 1.4, fontSize: 11, margin: 0 }); } catch { /* valeur non encodable */ } }, [value]);
  return <svg ref={ref} role="img" aria-label={`Code-barres ${value}`} />;
}
/** Etiquettes imprimables (code CODE128 : code-barres du produit, sinon son SKU). */
export function LabelsModal({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const [copies, setCopies] = useState(1);
  const labels = products.flatMap((p) => Array.from({ length: copies }, () => p));
  return (
    <Modal open={products.length > 0} onClose={onClose} title={`Etiquettes (${labels.length})`} size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Fermer</Button><Button onClick={() => window.print()}><Printer className="size-4" />Imprimer</Button></>}>
      <div className="no-print mb-3 flex items-center gap-2 text-sm"><label htmlFor="copies">Exemplaires par produit</label><input id="copies" type="number" min={1} max={50} value={copies} onChange={(e) => setCopies(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} className="w-20 rounded border border-slate-300 px-2 py-1" /></div>
      <div className="print-area grid grid-cols-2 gap-2 sm:grid-cols-3">
        {labels.map((p, i) => (
          <div key={i} className="break-inside-avoid rounded border border-dashed border-slate-400 p-2 text-center">
            <p className="truncate text-xs font-semibold">{p.name}</p><div className="flex justify-center"><Bar value={p.barcode ?? p.sku} /></div><p className="text-sm font-bold">{money(p.salePrice)}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}
