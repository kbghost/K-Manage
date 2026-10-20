/** Lecture CSV simple (separateur , ou ;, guillemets doubles). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\ufeff/, ""); const first = clean.split(/\r?\n/, 1)[0] ?? ""; const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (inQ) { if (c === '"') { if (clean[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === sep) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && clean[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim() !== "")) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}
const ALIASES: Record<string, string> = {
  nom: "name", name: "name", produit: "name", sku: "sku", reference: "sku", ref: "sku", barcode: "barcode", "code-barres": "barcode", codebarres: "barcode", "code barres": "barcode",
  categorie: "category", category: "category", unite: "unit", unit: "unit", "prix achat": "costPrice", prixachat: "costPrice", costprice: "costPrice", "prix vente": "salePrice", prixvente: "salePrice", saleprice: "salePrice",
  stock: "stock", quantite: "stock", seuil: "alertThreshold", "seuil alerte": "alertThreshold", alertthreshold: "alertThreshold",
};
const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function csvToRows(text: string): Record<string, string>[] {
  const [head, ...body] = parseCsv(text); if (!head) return [];
  const keys = head.map((h) => ALIASES[norm(h)] ?? norm(h));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}
