import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { renderPdf } from "../common/pdf.js";

export type ReportData = {
  title: string;
  columns: string[];
  rows: Array<Array<string | number | null | undefined>>;
  note?: string;
};

const EXT: Record<string, { mime: string; ext: string }> = {
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" },
  pdf: { mime: "application/pdf", ext: "pdf" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
  },
};

export function exportMeta(format: string, title: string) {
  const meta = EXT[format];
  if (!meta) throw new Error(`Format ${format} tidak didukung`);
  const safe = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { ...meta, filename: `${safe}.${meta.ext}` };
}

function cell(v: string | number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

export async function toXlsx(data: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(data.title.slice(0, 31) || "Laporan");
  const titleRow = ws.addRow([data.title]);
  titleRow.font = { bold: true, size: 14 };
  if (data.note) ws.addRow([data.note]);
  ws.addRow([]);
  const header = ws.addRow(data.columns);
  header.eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    c.border = { bottom: { style: "thin" } };
  });
  for (const r of data.rows) ws.addRow(r.map(cell));
  ws.columns.forEach((col, i) => {
    const values = [data.columns[i], ...data.rows.map((r) => cell(r[i]))];
    const max = values.reduce((m, v) => Math.max(m, v.length), 8);
    col.width = Math.min(Math.max(max + 2, 10), 50);
  });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function toPdf(data: ReportData): Promise<Buffer> {
  const landscape = data.columns.length > 5;
  const head = data.columns.map((c) => ({ text: c, bold: true }));
  const body = data.rows.map((r) => r.map((v) => ({ text: cell(v) })));
  return renderPdf({
    pageSize: "A4",
    pageOrientation: landscape ? "landscape" : "portrait",
    pageMargins: [30, 40, 30, 40],
    content: [
      { text: data.title, fontSize: 14, bold: true, alignment: "center" },
      ...(data.note ? [{ text: data.note, fontSize: 9, alignment: "center", margin: [0, 2, 0, 8] }] : []),
      { text: "", margin: [0, 0, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: data.columns.map(() => "auto"),
          body: [head, ...body],
        },
        fontSize: landscape ? 7 : 8,
        layout: "lightHorizontalLines",
      },
      {
        text: `Dicetak ${new Date().toLocaleString("id-ID")} — ${data.rows.length} baris`,
        fontSize: 8,
        margin: [0, 8, 0, 0],
        color: "#666666",
      },
    ],
  });
}

export async function toDocx(data: ReportData): Promise<Buffer> {
  const headerRow = new TableRow({
    children: data.columns.map(
      (c) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })],
        }),
    ),
  });
  const rows = data.rows.map(
    (r) =>
      new TableRow({
        children: r.map(
          (v) =>
            new TableCell({
              children: [new Paragraph(cell(v))],
            }),
        ),
      }),
  );
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: data.title, heading: "Title" }),
          ...(data.note ? [new Paragraph({ text: data.note })] : []),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...rows],
          }),
          new Paragraph({ text: `Dicetak ${new Date().toLocaleString("id-ID")} — ${data.rows.length} baris` }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
