import type { Response } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export interface Column { key: string; label: string; align?: "left" | "right" }
export type Row = Record<string, string | number | boolean | null | undefined>;
export const FORMATS = ["json", "csv", "xlsx", "pdf"] as const;
export type Format = (typeof FORMATS)[number];

const cell = (v: Row[string]) => (v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "oui" : "non") : v);
/** Neutralise l'injection de formules dans les tableurs. */
const safeText = (v: Row[string]) => {
  const s = String(cell(v));
  return /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
};

export function toCsv(columns: Column[], rows: Row[]): string {
  const esc = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [columns.map((c) => esc(c.label)).join(";")];
  for (const r of rows) lines.push(columns.map((c) => esc(safeText(r[c.key]))).join(";"));
  return "\ufeff" + lines.join("\r\n");
}

export async function toXlsx(title: string, columns: Column[], rows: Row[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 30));
  ws.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(14, c.label.length + 4) }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    const o: Record<string, string | number> = {};
    for (const c of columns) { const v = r[c.key]; o[c.key] = typeof v === "number" ? v : safeText(v); }
    ws.addRow(o);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toPdf(title: string, columns: Column[], rows: Row[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "A4", layout: columns.length > 6 ? "landscape" : "portrait" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(16).text(title).moveDown(0.3);
    doc.fontSize(8).fillColor("#666").text(`Genere le ${new Date().toLocaleString("fr-FR")}`).fillColor("#000").moveDown();
    const width = doc.page.width - 72;
    const colW = width / columns.length;
    const drawRow = (vals: string[], bold = false) => {
      if (doc.y > doc.page.height - 60) doc.addPage();
      const y = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      let h = 0;
      vals.forEach((v, i) => {
        const opts = { width: colW - 4, align: columns[i]?.align ?? "left" } as const;
        h = Math.max(h, doc.heightOfString(v, opts));
        doc.text(v, 36 + i * colW, y, opts);
      });
      doc.y = y + h + 4;
    };
    drawRow(columns.map((c) => c.label), true);
    doc.moveTo(36, doc.y - 2).lineTo(36 + width, doc.y - 2).strokeColor("#999").stroke();
    for (const r of rows) drawRow(columns.map((c) => String(cell(r[c.key]))));
    doc.end();
  });
}

/** Repond au format demande (csv, xlsx, pdf). Renvoie false pour json (laisser l'appelant repondre). */
export async function sendTable(res: Response, format: Format, a: { title: string; filename: string; columns: Column[]; rows: Row[] }): Promise<boolean> {
  if (format === "json") return false;
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${a.filename}.csv"`);
    res.send(toCsv(a.columns, a.rows));
  } else if (format === "xlsx") {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${a.filename}.xlsx"`);
    res.send(await toXlsx(a.title, a.columns, a.rows));
  } else {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${a.filename}.pdf"`);
    res.send(await toPdf(a.title, a.columns, a.rows));
  }
  return true;
}
