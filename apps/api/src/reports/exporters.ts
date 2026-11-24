import ExcelJS from "exceljs";
import { AlignmentType, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { renderPdf } from "../common/pdf.js";

type Cell = string | number | null | undefined;

export type ReportData = {
  title: string;
  columns: string[];
  /** Nilai `number` dianggap nominal: tetap angka di Excel (bisa dijumlah), diformat ribuan di PDF/Word. */
  rows: Array<Array<Cell>>;
  /** Ringkasan; bagian yang dipisah " | " ditampilkan sebagai poin-poin di atas tabel. */
  note?: string;
  /** Kolom teks panjang yang boleh membungkus di PDF (indeks kolom). Default: kolom teks terpanjang. */
  wrapCols?: number[];
};

/** Kop laporan (profil perusahaan dari Pengaturan). */
export type ReportCompany = { name?: string; address?: string; npwp?: string };

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

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const idNum = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });

function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  return isNum(v) ? idNum(v) : String(v);
}

/**
 * Teks rupiah utuh ("Rp 1.250.000", "(Rp 500.000)", "-Rp 7.500", "Rp 0") -> angka.
 * Laporan lama masih mengirim nominal sebagai teks; dengan ini nominalnya tetap angka di Excel & rata kanan.
 * Teks campuran (mis. "Rp 1.000 (25%)") dibiarkan apa adanya.
 */
export function parseRupiah(v: Cell): Cell {
  if (typeof v !== "string") return v;
  const m = v.trim().match(/^(\()?\s*(-)?\s*Rp\.?\s*(-)?\s*([\d.]+)(?:,(\d{1,2}))?\s*(\))?$/i);
  if (!m) return v;
  const [, open, minusA, minusB, int, dec, close] = m;
  if (Boolean(open) !== Boolean(close)) return v;
  const n = Number(`${int!.replace(/\./g, "")}${dec ? `.${dec}` : ""}`);
  if (!Number.isFinite(n)) return v;
  return open || minusA || minusB ? -n : n;
}

const TOTAL_MARK = Symbol("totalRow");

/**
 * Tandai baris ringkasan (total / subtotal) agar dicetak tebal — tanpa menaruh penanda di isi sel.
 * (Dulu dipakai "=" di kolom Kode Akun, dan tanda itu ikut tercetak di file export.)
 */
export function totalRow(...cells: Cell[]): ReportData["rows"][number] {
  return Object.assign(cells, { [TOTAL_MARK]: true });
}

function isTotalRow(r: ReportData["rows"][number]): boolean {
  return Boolean((r as any)[TOTAL_MARK]) || String(r[0] ?? "").trim().toUpperCase() === "TOTAL";
}

/** Rapikan data sebelum ditulis: nominal teks -> angka, penanda total tetap ikut. */
function normalize(data: ReportData): ReportData {
  const rows = data.rows.map((r) => {
    const out = r.map(parseRupiah);
    return isTotalRow(r) ? totalRow(...out) : out;
  });
  return { ...data, rows };
}

/** Kolom yang (hampir) seluruh isinya angka -> rata kanan. */
function numericCols(data: ReportData): Set<number> {
  const set = new Set<number>();
  data.columns.forEach((_, i) => {
    const vals = data.rows.map((r) => r[i]).filter((v) => v !== null && v !== undefined && v !== "");
    if (vals.length && vals.filter(isNum).length / vals.length >= 0.6) set.add(i);
  });
  return set;
}

/** Poin ringkasan dari `note` ("A: 1 | B: 2" -> ["A: 1", "B: 2"]). */
function summaryLines(note?: string): string[] {
  return (note ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

const printedAt = () => new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

/** Nama sheet Excel: maks 31 karakter, tanpa * ? : \ / [ ] (dulu judul "Neraca / ..." membuat export gagal). */
export function sheetName(title: string): string {
  const clean = title.replace(/[*?:\\/[\]]/g, "-").replace(/\s+/g, " ").trim();
  return (clean.slice(0, 31).trim() || "Laporan").replace(/^'|'$/g, "");
}

export async function toXlsx(raw: ReportData, company?: ReportCompany): Promise<Buffer> {
  const data = normalize(raw);
  const wb = new ExcelJS.Workbook();
  wb.creator = company?.name || "Akuntra";
  const ws = wb.addWorksheet(sheetName(data.title), {
    pageSetup: {
      paperSize: 9, // A4
      orientation: data.columns.length > 5 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  const nums = numericCols(data);
  const lastCol = Math.max(data.columns.length, 1);
  const mergeAcross = (rowNo: number) => {
    if (lastCol > 1) ws.mergeCells(rowNo, 1, rowNo, lastCol);
  };

  // ── Kop ──
  if (company?.name) {
    const r = ws.addRow([company.name]);
    r.font = { bold: true, size: 12 };
    mergeAcross(r.number);
    const sub = [company.address, company.npwp ? `NPWP ${company.npwp}` : ""].filter(Boolean).join(" · ");
    if (sub) {
      const s = ws.addRow([sub]);
      s.font = { size: 9, color: { argb: "FF666666" } };
      mergeAcross(s.number);
    }
  }
  const titleRow = ws.addRow([data.title]);
  titleRow.font = { bold: true, size: 14 };
  mergeAcross(titleRow.number);
  const printed = ws.addRow([`Dicetak ${printedAt()}`]);
  printed.font = { size: 9, color: { argb: "FF777777" } };
  mergeAcross(printed.number);

  // ── Ringkasan ──
  const lines = summaryLines(data.note);
  if (lines.length) {
    ws.addRow([]);
    const h = ws.addRow(["Ringkasan"]);
    h.font = { bold: true };
    for (const l of lines) {
      const r = ws.addRow([`• ${l}`]);
      mergeAcross(r.number);
    }
  }
  ws.addRow([]);

  // ── Tabel ──
  const header = ws.addRow(data.columns);
  const headerRowNo = header.number;
  header.height = 20;
  header.eachCell((c, col) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
    c.alignment = { vertical: "middle", horizontal: nums.has(col - 1) ? "right" : "left", wrapText: true };
  });

  data.rows.forEach((r, idx) => {
    const row = ws.addRow(r.map((v) => (v === null || v === undefined ? "" : v)));
    const total = isTotalRow(r);
    for (let col = 1; col <= lastCol; col++) {
      const c = row.getCell(col);
      if (isNum(r[col - 1])) {
        c.numFmt = "#,##0;[Red]-#,##0";
        c.alignment = { horizontal: "right" };
      }
      if (total) {
        c.font = { bold: true };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF5" } };
      } else if (idx % 2 === 1) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F9FB" } };
      }
    }
  });

  if (data.rows.length) {
    ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: headerRowNo, column: lastCol } };
  }
  ws.views = [{ state: "frozen", ySplit: headerRowNo }];
  data.columns.forEach((_, i) => {
    const values = [data.columns[i] ?? "", ...data.rows.map((r) => cell(r[i]))];
    const max = values.reduce((m, v) => Math.max(m, v.length), 8);
    ws.getColumn(i + 1).width = Math.min(Math.max(max + 2, 10), 60);
  });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function toPdf(raw: ReportData, company?: ReportCompany): Promise<Buffer> {
  const data = normalize(raw);
  const landscape = data.columns.length > 5;
  const nums = numericCols(data);
  // Kolom teks terpanjang dibuat lebar fleksibel (*) agar membungkus, bukan terpotong keluar halaman
  const wrap = new Set(
    data.wrapCols ??
      (() => {
        let best = -1;
        let bestLen = 0;
        data.columns.forEach((_, i) => {
          if (nums.has(i)) return;
          const len = Math.max(...data.rows.map((r) => cell(r[i]).length), 0);
          if (len > bestLen) {
            bestLen = len;
            best = i;
          }
        });
        return best >= 0 ? [best] : [];
      })(),
  );
  const head = data.columns.map((c, i) => ({
    text: c,
    bold: true,
    color: "#FFFFFF",
    fillColor: "#1F3A5F",
    alignment: nums.has(i) ? "right" : "left",
  }));
  const body = data.rows.map((r, idx) => {
    const total = isTotalRow(r);
    return data.columns.map((_, i) => ({
      text: cell(r[i]),
      bold: total,
      alignment: nums.has(i) || isNum(r[i]) ? "right" : "left",
      color: isNum(r[i]) && r[i] < 0 ? "#B42318" : undefined,
      fillColor: total ? "#E8EEF5" : idx % 2 === 1 ? "#F7F9FB" : undefined,
    }));
  });
  const lines = summaryLines(data.note);
  const companySub = [company?.address, company?.npwp ? `NPWP ${company.npwp}` : ""].filter(Boolean).join(" · ");

  return renderPdf({
    pageSize: "A4",
    pageOrientation: landscape ? "landscape" : "portrait",
    pageMargins: [28, 36, 28, 40],
    content: [
      ...(company?.name
        ? [
            { text: company.name, fontSize: 11, bold: true },
            ...(companySub ? [{ text: companySub, fontSize: 8, color: "#666666" }] : []),
            { canvas: [{ type: "line", x1: 0, y1: 4, x2: landscape ? 786 : 539, y2: 4, lineWidth: 0.8, lineColor: "#1F3A5F" }], margin: [0, 0, 0, 8] },
          ]
        : []),
      { text: data.title, fontSize: 14, bold: true, alignment: "center", color: "#1F3A5F" },
      { text: `Dicetak ${printedAt()}`, fontSize: 8, alignment: "center", color: "#777777", margin: [0, 2, 0, 10] },
      ...(lines.length
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [{ text: "Ringkasan", bold: true, fontSize: 9, color: "#1F3A5F" }],
                  [{ ul: lines, fontSize: 8.5 }],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: (i: number) => (i === 0 ? 2 : 0),
                vLineColor: () => "#1F3A5F",
                fillColor: () => "#F3F6FA",
                paddingLeft: () => 8,
                paddingTop: () => 4,
                paddingBottom: () => 4,
              },
              margin: [0, 0, 0, 10],
            },
          ]
        : []),
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: data.columns.map((_, i) => (wrap.has(i) ? "*" : "auto")),
          body: [head, ...body],
        },
        fontSize: landscape ? 7 : 8,
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.3),
          vLineWidth: () => 0,
          hLineColor: (i: number) => (i <= 1 ? "#1F3A5F" : "#D9DEE5"),
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
      ...(data.rows.length === 0 ? [{ text: "Tidak ada data pada periode ini.", italics: true, fontSize: 9, color: "#777777", margin: [0, 8, 0, 0] }] : []),
    ],
    footer: (page: number, pages: number) => ({
      columns: [
        { text: company?.name || data.title, fontSize: 7, color: "#777777", margin: [28, 0, 0, 0] },
        { text: `Halaman ${page} / ${pages}`, fontSize: 7, color: "#777777", alignment: "right", margin: [0, 0, 28, 0] },
      ],
    }),
  } as any);
}

export async function toDocx(raw: ReportData, company?: ReportCompany): Promise<Buffer> {
  const data = normalize(raw);
  const nums = numericCols(data);
  const headerRow = new TableRow({
    tableHeader: true,
    children: data.columns.map(
      (c, i) =>
        new TableCell({
          shading: { fill: "1F3A5F" },
          children: [
            new Paragraph({
              alignment: nums.has(i) ? AlignmentType.RIGHT : AlignmentType.LEFT,
              children: [new TextRun({ text: c, bold: true, color: "FFFFFF" })],
            }),
          ],
        }),
    ),
  });
  const rows = data.rows.map((r) => {
    const total = isTotalRow(r);
    return new TableRow({
      children: data.columns.map(
        (_, i) =>
          new TableCell({
            ...(total ? { shading: { fill: "E8EEF5" } } : {}),
            children: [
              new Paragraph({
                alignment: nums.has(i) || isNum(r[i]) ? AlignmentType.RIGHT : AlignmentType.LEFT,
                children: [new TextRun({ text: cell(r[i]), bold: total })],
              }),
            ],
          }),
      ),
    });
  });
  const lines = summaryLines(data.note);
  const doc = new Document({
    sections: [
      {
        children: [
          ...(company?.name ? [new Paragraph({ children: [new TextRun({ text: company.name, bold: true })] })] : []),
          new Paragraph({ text: data.title, heading: "Title" }),
          new Paragraph({ children: [new TextRun({ text: `Dicetak ${printedAt()}`, size: 16, color: "777777" })] }),
          ...(lines.length ? [new Paragraph({ children: [new TextRun({ text: "Ringkasan", bold: true })] })] : []),
          ...lines.map((l) => new Paragraph({ text: l, bullet: { level: 0 } })),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...rows],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
