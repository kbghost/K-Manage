import { forwardRef, useRef } from "react";
import { Printer } from "./icons";
import { fmtDateTime, methodLabel, money, qty } from "../lib/format";
import type { Business, Sale } from "../lib/types";
import { Button, Modal, cx } from "./ui";
import { fileUrl } from "../lib/api";

export function printReceiptContent(el: HTMLElement | null, paperWidth = "80mm") {
  if (!el) {
    window.print();
    return;
  }

  // Synchronisation avec receipt-print-root pour compatibilité impression standard / Ctrl+P
  const portalRoot = document.getElementById("receipt-print-root");
  if (portalRoot) {
    portalRoot.innerHTML = el.outerHTML;
  }

  // Impression via iframe invisible isolée (garantit zéro page blanche, thermique propre)
  const iframe = document.createElement("iframe");
  iframe.setAttribute("style", "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const widthCss = paperWidth === "58mm" ? "56mm" : paperWidth === "80mm" ? "76mm" : "190mm";
  const styles = `
    @page { margin: 0; size: ${paperWidth === "58mm" ? "58mm auto" : paperWidth === "80mm" ? "80mm auto" : "auto"}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      width: ${widthCss};
      margin: 0 auto;
      padding: 6px 4px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 13px; }
    .text-xs { font-size: 11px; }
    .my-2 { margin-top: 8px; margin-bottom: 8px; }
    .mb-1 { margin-bottom: 4px; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
    img { max-height: 52px; margin: 0 auto 6px auto; display: block; object-fit: contain; }
  `;

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Ticket de caisse</title><style>${styles}</style></head><body>${el.outerHTML}</body></html>`);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  }, 250);
}

export const Receipt = forwardRef<HTMLDivElement, { sale: Sale; business?: Business }>(function Receipt({ sale, business }, ref) {
  const b = business ?? sale.business; const paper = b?.receipt?.paperWidth ?? "80mm"; const tz = b?.timezone;
  const paid = (sale.payments ?? []).filter((p) => p.kind === "sale_payment");
  return (
    <div ref={ref} className={cx("print-area mx-auto bg-white p-3 font-mono text-[12px] leading-snug text-black", `receipt-${paper}`)} data-testid="receipt">
      <div className="text-center">
        {b?.logoUploadId && <img src={fileUrl(b.logoUploadId)} alt="" className="mx-auto mb-1 max-h-14" />}
        <p className="text-sm font-bold">{b?.name}</p>
        {b?.receipt?.header && <p>{b.receipt.header}</p>}{b?.address && <p>{b.address}</p>}{b?.phone && <p>Tel : {b.phone}</p>}{b?.receipt?.showTaxId && <p>IFU : {b.receipt.showTaxId}</p>}
      </div>
      <hr className="my-2 border-dashed border-black" />
      <p>Ticket : <b>{sale.number}</b>{sale.status === "cancelled" && <b> (ANNULÉ)</b>}</p>
      <p>Date : {fmtDateTime(sale.createdAt, tz)}</p>
      {sale.cashier && <p>Caissier : {sale.cashier}</p>}
      <p>Client : {sale.customerName ?? sale.customer?.name ?? "Client comptoir"}</p>
      <hr className="my-2 border-dashed border-black" />
      {sale.lines.map((l, i) => (
        <div key={i} className="mb-1">
          <p className="font-semibold">{l.name}</p>
          <p className="flex justify-between"><span>{qty(l.quantityMilli / 1000)} x {money(l.unitPrice)}</span><span>{money(l.total)}</span></p>
          {l.discount > 0 && <p className="flex justify-between"><span>  Remise</span><span>-{money(l.discount)}</span></p>}
          {l.refundedQtyMilli > 0 && <p className="flex justify-between"><span>  Remboursé : {qty(l.refundedQtyMilli / 1000)}</span><span>-{money(l.refundedValue)}</span></p>}
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      {sale.discount > 0 && <p className="flex justify-between"><span>Remise globale</span><span>-{money(sale.discount)}</span></p>}
      <p className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{money(sale.total)}</span></p>
      {sale.refundedTotal > 0 && <p className="flex justify-between"><span>Retours</span><span>-{money(sale.refundedTotal)}</span></p>}
      {paid.map((p) => <p key={p.id} className="flex justify-between"><span>Payé ({methodLabel(p.method)})</span><span>{money(p.amount)}</span></p>)}
      {sale.status === "completed" && sale.remaining > 0 && <p className="flex justify-between font-bold"><span>RESTE À PAYER</span><span>{money(sale.remaining)}</span></p>}
      <hr className="my-2 border-dashed border-black" />
      <p className="text-center">{b?.receipt?.footer ?? "Merci pour votre visite !"}</p>
    </div>
  );
});

export function ReceiptModal({ sale, business, onClose }: { sale: Sale | null; business?: Business; onClose: () => void }) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const paper = business?.receipt.paperWidth ?? sale?.business?.receipt.paperWidth ?? "80mm";

  return (
    <Modal open={!!sale} onClose={onClose} title={sale ? `Reçu ${sale.number}` : "Reçu"} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Fermer</Button><Button onClick={() => printReceiptContent(receiptRef.current, paper)}><Printer className="size-4" />Imprimer le reçu</Button></>}>
      <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 print:border-none print:bg-white print:p-0 print:max-h-none">{sale && <Receipt ref={receiptRef} sale={sale} business={business} />}</div>
      <p className="no-print mt-2 text-xs text-slate-500">Format d'impression : {paper} — modifiable dans Paramètres.</p>
    </Modal>
  );
}
