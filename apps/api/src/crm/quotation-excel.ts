import ExcelJS from "exceljs";

export type QuotationItemData = {
  id: string;
  item: string;
  qty: number;
  satuan: string;
  harga: number;
  kind?: "GOODS" | "SERVICE";
  productId?: number;
  sku?: string;
  hasSerial?: boolean;
  serialUnitIds?: number[];
  serialNumbers?: string[];
  outOfStockAutoSwap?: boolean;
};

export type QuotationMeta = {
  items: QuotationItemData[];
  subject?: string;
  intro?: string;
  notes?: string[];
  city?: string;
  kopText?: string;
  customerAddress?: string;
  signerName?: string;
  signerTitle?: string;
  pph?: number;
  pphMode?: string;
  tipePph?: string;
  latestFileId?: number | null;
  latestFileName?: string | null;
  stockConflictFlag?: boolean;
  stockConflictMessage?: string | null;
  autoSwapLogs?: Array<{
    date: string;
    productId: number;
    productName: string;
    oldSn: string;
    newSn: string | null;
    triggeredByInvoice: string;
  }>;
  emergencyPrId?: number | null;
  emergencyPrNumber?: string | null;
};

export const DEFAULT_QUOTATION_NOTES = [
  "Penawaran ini berlaku 1 bulan",
  "Penambahan material/jasa dikenakan harga sesuai nilai jual material/jasa tersebut",
  "Garansi DVR dan Kamera 1 Tahun, Harddisk dan PSU 6 Bulan dan Instalasi 3 Bulan",
];

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatTanggalIndo(dateInput?: Date | string | null): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getDate()} ${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`;
  }
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

export async function buildQuotationXlsx(params: {
  quoteNo: string;
  date?: Date | string | null;
  city?: string;
  customerName?: string;
  customerAddress?: string;
  leadName?: string;
  kopText?: string;
  kopLogoUrl?: string;
  subject?: string;
  intro?: string;
  items?: QuotationItemData[];
  total?: number;
  ppn?: number;
  pph?: number;
  pphMode?: string;
  tipePph?: string;
  discount?: number;
  grandTotal?: number;
  dpLabel?: string;
  dpAmount?: number;
  notes?: string[];
  signerName?: string;
  signerTitle?: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Penawaran", {
    views: [{ showGridLines: true }],
  });

  ws.columns = [
    { key: "no", width: 6 },
    { key: "item", width: 48 },
    { key: "qty", width: 10 },
    { key: "satuan", width: 12 },
    { key: "harga", width: 18 },
    { key: "total", width: 18 },
  ];

  const serifFont: Partial<ExcelJS.Font> = { name: "Times New Roman", size: 11 };
  const serifBold: Partial<ExcelJS.Font> = { name: "Times New Roman", size: 11, bold: true };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  // 1. KOP SURAT (Rows 1-4, Merged A1:F4)
  ws.mergeCells("A1:F4");
  const kopCell = ws.getCell("A1");
  kopCell.value = params.kopText?.trim() || "KOP SURAT";
  kopCell.font = { name: "Calibri", size: 11, bold: true };
  kopCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  for (let r = 1; r <= 4; r++) {
    for (let c = 1; c <= 6; c++) {
      ws.getCell(r, c).border = {
        top: r === 1 ? { style: "thin", color: { argb: "FFBFBFBF" } } : undefined,
        bottom: r === 4 ? { style: "thin", color: { argb: "FFBFBFBF" } } : undefined,
        left: c === 1 ? { style: "thin", color: { argb: "FFBFBFBF" } } : undefined,
        right: c === 6 ? { style: "thin", color: { argb: "FFBFBFBF" } } : undefined,
      };
    }
  }

  // 2. Lokasi & Tanggal (Row 6, Right-aligned E6:F6)
  const city = params.city?.trim() || "Bekasi";
  ws.mergeCells("D6:F6");
  const dateCell = ws.getCell("D6");
  dateCell.value = `${city}, ${formatTanggalIndo(params.date)}`;
  dateCell.font = serifBold;
  dateCell.alignment = { horizontal: "right", vertical: "middle" };

  // 3. Kepada Yth (Rows 7-9)
  const c7 = ws.getCell("A7");
  c7.value = "Kepada Yth.";
  c7.font = serifFont;

  const c8 = ws.getCell("B8");
  c8.value = params.customerName?.trim() || "-";
  c8.font = serifFont;

  const c9 = ws.getCell("B9");
  c9.value = params.customerAddress?.trim() || "Di Tempat";
  c9.font = serifBold;

  // 4. Subject & Quote No (Rows 11-12)
  const leadTitle = params.leadName?.trim() || "Pekerjaan";
  const subjectText =
    params.subject?.trim() || `Penawaran Pengadaan Barang & Jasa Instalasi ${leadTitle}`;
  const c11 = ws.getCell("A11");
  c11.value = `Subject : ${subjectText}`;
  c11.font = serifFont;

  const c12 = ws.getCell("A12");
  c12.value = `Quote No. : ${params.quoteNo}`;
  c12.font = serifFont;

  // 5. Pembuka (Rows 14-15)
  const c14 = ws.getCell("A14");
  c14.value = "Dengan hormat,";
  c14.font = serifFont;

  const introText =
    params.intro?.trim() ||
    `Sesuai permintaan Bapak / Ibu sebelumnya, berikut penawaran dari kami terkait pengadaan Barang & Jasa Instalasi ${leadTitle}`;
  const c15 = ws.getCell("A15");
  c15.value = introText;
  c15.font = serifFont;

  // 6. Table Header (Row 17)
  const headerRowIdx = 17;
  const headerRow = ws.getRow(headerRowIdx);
  headerRow.height = 24;
  const headers = ["No.", "Item / Jasa", "QTY", "Satuan", "Harga", "Total"];
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF000000" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00FFFF" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };
  });

  // 7. Item Rows (Starting at Row 18)
  const rawItems = Array.isArray(params.items) ? params.items : [];
  const effectiveItems: QuotationItemData[] =
    rawItems.length > 0
      ? rawItems
      : [
          {
            id: "1",
            item: params.leadName ? `Pengadaan & Instalasi ${params.leadName}` : "",
            qty: 1,
            satuan: "Lot",
            harga: Number(params.total) || 0,
          },
        ];

  const firstItemRow = 18;
  let calcSum = 0;

  effectiveItems.forEach((it, idx) => {
    const rIdx = firstItemRow + idx;
    const row = ws.getRow(rIdx);
    const qty = Number(it.qty) || 1;
    const harga = Number(it.harga) || 0;
    const lineTotal = qty * harga;
    calcSum += lineTotal;

    const cNo = row.getCell(1);
    cNo.value = idx + 1;
    cNo.alignment = { horizontal: "center", vertical: "middle" };

    const cItem = row.getCell(2);
    const snSuffix =
      Array.isArray(it.serialNumbers) &&
      it.serialNumbers.length > 0 &&
      !it.serialNumbers.every((sn) => (it.item || "").includes(sn))
        ? ` (SN: ${it.serialNumbers.join(", ")})`
        : "";
    cItem.value = `${it.item || ""}${snSuffix}`;
    cItem.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    const cQty = row.getCell(3);
    cQty.value = qty;
    cQty.alignment = { horizontal: "center", vertical: "middle" };

    const cSatuan = row.getCell(4);
    cSatuan.value = it.satuan || "Unit";
    cSatuan.alignment = { horizontal: "center", vertical: "middle" };

    const cHarga = row.getCell(5);
    cHarga.value = harga;
    cHarga.numFmt = '"Rp"* #,##0';
    cHarga.alignment = { horizontal: "right", vertical: "middle" };

    const cTotal = row.getCell(6);
    cTotal.value = { formula: `C${rIdx}*E${rIdx}`, result: lineTotal };
    cTotal.numFmt = '"Rp"* #,##0';
    cTotal.alignment = { horizontal: "right", vertical: "middle" };

    for (let c = 1; c <= 6; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Calibri", size: 10 };
      cell.border = thinBorder;
    }
  });

  const lastItemRow = firstItemRow + effectiveItems.length - 1;
  const finalTotal = rawItems.length > 0 ? calcSum : Number(params.total ?? calcSum) || 0;
  const finalDisc = Number(params.discount ?? 0) || 0;
  const netBeforeTax = Math.max(0, finalTotal - finalDisc);
  const finalPpn =
    params.ppn !== undefined ? Number(params.ppn) : Math.round(netBeforeTax * 0.11);
  const finalPph = params.pph !== undefined ? Number(params.pph) : 0;
  const finalGrandTotal =
    params.grandTotal !== undefined && Number(params.grandTotal) > 0
      ? Number(params.grandTotal)
      : Math.max(0, netBeforeTax + finalPpn - finalPph);

  // 8. Summary Rows (TOTAL, PPN (11%), optional DISC, optional PPH, GRAND TOTAL)
  let currRow = lastItemRow + 1;

  // TOTAL
  const totalRowIdx = currRow++;
  const lblTotal = ws.getCell(totalRowIdx, 5);
  lblTotal.value = "TOTAL";
  lblTotal.font = { name: "Calibri", size: 10, bold: true };
  lblTotal.alignment = { horizontal: "right", vertical: "middle" };
  lblTotal.border = thinBorder;

  const valTotal = ws.getCell(totalRowIdx, 6);
  valTotal.value = { formula: `SUM(F${firstItemRow}:F${lastItemRow})`, result: finalTotal };
  valTotal.font = { name: "Calibri", size: 10, bold: true };
  valTotal.numFmt = '"Rp"* #,##0';
  valTotal.alignment = { horizontal: "right", vertical: "middle" };
  valTotal.border = thinBorder;

  // DISC (jika ada diskon > 0)
  let discRowIdx: number | null = null;
  if (finalDisc > 0) {
    discRowIdx = currRow++;
    const lblDisc = ws.getCell(discRowIdx, 5);
    lblDisc.value = "DISC";
    lblDisc.font = { name: "Calibri", size: 10, bold: true };
    lblDisc.alignment = { horizontal: "right", vertical: "middle" };
    lblDisc.border = thinBorder;

    const valDisc = ws.getCell(discRowIdx, 6);
    valDisc.value = finalDisc;
    valDisc.font = { name: "Calibri", size: 10, bold: true };
    valDisc.numFmt = '"Rp"* #,##0';
    valDisc.alignment = { horizontal: "right", vertical: "middle" };
    valDisc.border = thinBorder;
  }

  // PPN (11%)
  const ppnRowIdx = currRow++;
  const lblPpn = ws.getCell(ppnRowIdx, 5);
  lblPpn.value = finalPpn > 0 ? "PPN (11%)" : "PPN";
  lblPpn.font = { name: "Calibri", size: 10, bold: true };
  lblPpn.alignment = { horizontal: "right", vertical: "middle" };
  lblPpn.border = thinBorder;

  const valPpn = ws.getCell(ppnRowIdx, 6);
  if (finalPpn > 0) {
    const formulaStr = discRowIdx ? `(F${totalRowIdx}-F${discRowIdx})*0.11` : `F${totalRowIdx}*0.11`;
    valPpn.value = { formula: formulaStr, result: finalPpn };
  } else {
    valPpn.value = 0;
  }
  valPpn.font = { name: "Calibri", size: 10, bold: true };
  valPpn.numFmt = "#,##0.00";
  valPpn.alignment = { horizontal: "right", vertical: "middle" };
  valPpn.border = thinBorder;

  // PPH (jika ada potongan PPh > 0)
  let pphRowIdx: number | null = null;
  if (finalPph > 0) {
    pphRowIdx = currRow++;
    const lblPph = ws.getCell(pphRowIdx, 5);
    lblPph.value = params.tipePph ? `POTONGAN ${params.tipePph.toUpperCase()}` : "POTONGAN PPH";
    lblPph.font = { name: "Calibri", size: 10, bold: true };
    lblPph.alignment = { horizontal: "right", vertical: "middle" };
    lblPph.border = thinBorder;

    const valPph = ws.getCell(pphRowIdx, 6);
    valPph.value = -finalPph;
    valPph.font = { name: "Calibri", size: 10, bold: true };
    valPph.numFmt = '"Rp"* #,##0';
    valPph.alignment = { horizontal: "right", vertical: "middle" };
    valPph.border = thinBorder;
  }

  // GRAND TOTAL
  const grandRowIdx = currRow++;
  const lblGrand = ws.getCell(grandRowIdx, 5);
  lblGrand.value = "GRAND TOTAL";
  lblGrand.font = { name: "Calibri", size: 10, bold: true };
  lblGrand.alignment = { horizontal: "right", vertical: "middle" };
  lblGrand.border = thinBorder;

  const valGrand = ws.getCell(grandRowIdx, 6);
  let grandFormula = discRowIdx
    ? `F${totalRowIdx}-F${discRowIdx}+F${ppnRowIdx}`
    : `F${totalRowIdx}+F${ppnRowIdx}`;
  if (pphRowIdx) {
    grandFormula += `+F${pphRowIdx}`; // valPph bernilai negatif
  }
  valGrand.value = {
    formula: grandFormula,
    result: finalGrandTotal,
  };
  valGrand.font = { name: "Calibri", size: 10, bold: true };
  valGrand.numFmt = "#,##0.00";
  valGrand.alignment = { horizontal: "right", vertical: "middle" };
  valGrand.border = thinBorder;

  // DP / Termin Row (jika ada skema DP atau Termin)
  if (params.dpLabel && params.dpAmount !== undefined) {
    const dpRowIdx = currRow++;
    const lblDp = ws.getCell(dpRowIdx, 5);
    lblDp.value = params.dpLabel.endsWith(":") ? params.dpLabel : `${params.dpLabel}    :`;
    lblDp.font = { name: "Calibri", size: 10, bold: true };
    lblDp.alignment = { horizontal: "right", vertical: "middle" };
    lblDp.border = thinBorder;

    const valDp = ws.getCell(dpRowIdx, 6);
    valDp.value = Number(params.dpAmount);
    valDp.font = { name: "Calibri", size: 10, bold: true };
    valDp.numFmt = "#,##0.00";
    valDp.alignment = { horizontal: "right", vertical: "middle" };
    valDp.border = thinBorder;
  }

  // 9. Notes Section
  const notesRowIdx = currRow++;
  const cNotes = ws.getCell(notesRowIdx, 1);
  cNotes.value = "Notes:";
  cNotes.font = serifFont;

  const notesList =
    Array.isArray(params.notes) && params.notes.length > 0 ? params.notes : DEFAULT_QUOTATION_NOTES;
  notesList.forEach((nText, idx) => {
    const r = currRow++;
    const isBankInfo = /^(pembayaran|bank|no\.\s*rek|nama|alamat|bekasi)/i.test(nText.trim());
    if (!isBankInfo) {
      const cNum = ws.getCell(r, 1);
      cNum.value = idx + 1;
      cNum.font = serifFont;
      cNum.alignment = { horizontal: "center" };
    }

    if (isBankInfo && nText.includes(" : ")) {
      const parts = nText.split(" : ");
      const cLabel = ws.getCell(r, 2);
      cLabel.value = parts[0].trim();
      cLabel.font = serifFont;

      const cVal = ws.getCell(r, 3);
      cVal.value = `: ${parts.slice(1).join(" : ").trim()}`;
      cVal.font = serifFont;
    } else {
      const cTxt = ws.getCell(r, 2);
      cTxt.value = nText;
      cTxt.font = serifFont;
    }
  });

  // Blank row
  currRow++;

  // 10. Contact Info Block
  const contacts: Array<{ text: string; link?: boolean }> = [
    { text: "Telp : 021 2284 3608" },
    { text: "WA   : 0859 5959 8852 / 0821 2345 9144" },
    { text: "Email : cs@ghinamultiprima.co.id", link: true },
    { text: "Email : iip.miftahullah@gmail.com", link: true },
    { text: "www.ghinamultiprima.co.id", link: true },
  ];
  contacts.forEach((ct) => {
    const r = currRow++;
    const cell = ws.getCell(r, 1);
    cell.value = ct.text;
    cell.font = ct.link
      ? {
          name: "Times New Roman",
          size: 11,
          underline: true,
          color: { argb: ct.text.startsWith("Email") ? "FF0000FF" : "FF000000" },
        }
      : serifFont;
  });

  // Blank row
  currRow++;

  // 11. Closing Paragraph
  const closeRow = currRow++;
  const cClose = ws.getCell(closeRow, 1);
  cClose.value =
    "Sekian surat penawaran ini kami buat dengan harapan agar Bapak bisa bekerjasama dengan perusahaan kami. Kami tunggu tanggapan dan kabar baik";
  cClose.font = serifFont;

  // Blank row
  currRow++;

  // 12. TTD
  const ttdRow = currRow++;
  const cTtd = ws.getCell(ttdRow, 1);
  cTtd.value = "TTD";
  cTtd.font = { name: "Calibri", size: 10 };

  currRow += 2;
  const signerRow = currRow++;
  const cSigner = ws.getCell(signerRow, 1);
  cSigner.value = params.signerName?.trim() || "Sales";
  cSigner.font = serifFont;

  if (params.signerTitle?.trim()) {
    const cTitle = ws.getCell(currRow++, 1);
    cTitle.value = params.signerTitle.trim();
    cTitle.font = serifFont;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function readCellText(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val == null) return "";
  if (typeof val === "object") {
    if ("result" in val && val.result != null) return String(val.result).trim();
    if ("text" in val && val.text != null) return String(val.text).trim();
    if ("richText" in val && Array.isArray(val.richText)) {
      return val.richText.map((rt) => rt.text).join("").trim();
    }
  }
  return String(val).trim();
}

function readCellNumber(cell: ExcelJS.Cell): number {
  const val = cell.value;
  if (val == null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "object" && "result" in val && val.result != null) {
    if (typeof val.result === "number") return Number.isFinite(val.result) ? val.result : 0;
    const cleaned = String(val.result).replace(/[^0-9.-]/g, "");
    return Number(cleaned) || 0;
  }
  const str = readCellText(cell);
  // Handle "Rp 1,000" or "1.000.000" or "3,330.00"
  const withoutRp = str.replace(/rp/gi, "").trim();
  if (!withoutRp) return 0;
  // If ends with .00 or ,00 decimal
  const normalized = withoutRp
    .replace(/\.[0]{2}$/, "")
    .replace(/,[0]{2}$/, "")
    .replace(/[^0-9-]/g, "");
  return Number(normalized) || 0;
}

export async function parseQuotationXlsx(buffer: Buffer): Promise<{
  items: QuotationItemData[];
  total: number;
  ppn: number;
  discount: number;
  grandTotal: number;
  subject?: string;
  intro?: string;
  notes?: string[];
  customerName?: string;
  signerName?: string;
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { items: [], total: 0, ppn: 0, discount: 0, grandTotal: 0 };
  }

  let subject: string | undefined;
  let intro: string | undefined;
  let customerName: string | undefined;
  let signerName: string | undefined;
  let headerRowIdx = -1;

  let colNo = 1;
  let colItem = 2;
  let colQty = 3;
  let colSatuan = 4;
  let colHarga = 5;
  let colTotal = 6;

  const maxRow = Math.min(ws.rowCount, 300);

  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const aText = readCellText(row.getCell(1));
    const bText = readCellText(row.getCell(2));

    if (/^kepada\s+yth/i.test(aText)) {
      const nextRow = ws.getRow(r + 1);
      const cand = readCellText(nextRow.getCell(2)) || readCellText(nextRow.getCell(1));
      if (cand && !/^di\s+tempat/i.test(cand)) customerName = cand;
    }

    if (/^subject\s*:/i.test(aText)) {
      subject = aText.replace(/^subject\s*:\s*/i, "").trim();
    } else if (/^subject\s*:/i.test(bText)) {
      subject = bText.replace(/^subject\s*:\s*/i, "").trim();
    }

    if (/^sesuai\s+permintaan/i.test(aText)) {
      intro = aText.trim();
    }

    // Detect table header row ("Item / Jasa", "QTY", "Harga")
    if (headerRowIdx === -1) {
      const rowTexts: string[] = [];
      for (let c = 1; c <= 10; c++) {
        rowTexts.push(readCellText(row.getCell(c)).toLowerCase());
      }
      const hasItem = rowTexts.some((t) => t.includes("item") || t.includes("jasa") || t.includes("deskripsi") || t.includes("nama barang"));
      const hasQtyOrHarga = rowTexts.some((t) => t === "qty" || t.includes("harga") || t.includes("jumlah"));
      if (hasItem && hasQtyOrHarga) {
        headerRowIdx = r;
        rowTexts.forEach((t, idx) => {
          const colNum = idx + 1;
          if (t === "no" || t === "no.") colNo = colNum;
          else if (t.includes("item") || t.includes("jasa") || t.includes("deskripsi") || t.includes("barang")) colItem = colNum;
          else if (t === "qty" || t.includes("kuantitas") || t.includes("jumlah")) colQty = colNum;
          else if (t.includes("satuan") || t === "unit" || t === "uom") colSatuan = colNum;
          else if (t.includes("harga")) colHarga = colNum;
          else if (t.includes("total") || t.includes("subtotal")) colTotal = colNum;
        });
      }
    }
  }

  const items: QuotationItemData[] = [];
  const notes: string[] = [];
  let parsedTotal: number | undefined;
  let parsedPpn: number | undefined;
  let parsedDisc: number | undefined;
  let parsedGrandTotal: number | undefined;

  if (headerRowIdx > 0) {
    let inNotes = false;
    let inTtd = false;

    for (let r = headerRowIdx + 1; r <= maxRow; r++) {
      const row = ws.getRow(r);
      const aText = readCellText(row.getCell(colNo));
      const itemText = readCellText(row.getCell(colItem));
      const labelColText = readCellText(row.getCell(colHarga));
      const totalVal = readCellNumber(row.getCell(colTotal));

      if (/^notes\s*:/i.test(aText) || /^catatan\s*:/i.test(aText)) {
        inNotes = true;
        continue;
      }

      if (/^ttd$/i.test(aText)) {
        inNotes = false;
        inTtd = true;
        continue;
      }

      if (inTtd) {
        const cand = aText || itemText;
        if (cand && !signerName) signerName = cand;
        continue;
      }

      if (inNotes) {
        if (/^(telp|wa\s*:|email|www\.|sekian\s+surat)/i.test(aText)) {
          inNotes = false;
          continue;
        }
        if (itemText && (/^\d+$/.test(aText) || aText === "-")) {
          notes.push(itemText);
        } else if (aText && !itemText) {
          notes.push(aText.replace(/^\d+\.\s*/, ""));
        }
        continue;
      }

      // Collect all text in row to reliably detect summary labels
      const rowTexts: string[] = [];
      for (let c = 1; c <= 12; c++) {
        const txt = readCellText(row.getCell(c));
        if (txt) rowTexts.push(txt);
      }
      const joinedRow = rowTexts.join(" ").toUpperCase().trim();

      const findSummaryNum = (): number => {
        let v = readCellNumber(row.getCell(colTotal));
        if (v > 0) return v;
        for (let c = Math.max(colTotal, 10); c >= 1; c--) {
          const val = readCellNumber(row.getCell(c));
          if (val > 0) return val;
        }
        return 0;
      };

      if (
        joinedRow.includes("GRAND TOTAL") ||
        joinedRow.includes("TOTAL AFTER DISC") ||
        joinedRow.includes("TOTAL SETELAH DISKON") ||
        joinedRow.includes("TOTAL AKHIR")
      ) {
        const val = findSummaryNum();
        if (val > 0) parsedGrandTotal = val;
        continue;
      }
      if (joinedRow.includes("PPN") || joinedRow.includes("VAT") || joinedRow.includes("PAJAK")) {
        const val = findSummaryNum();
        parsedPpn = val;
        continue;
      }
      if (
        joinedRow.includes("DISC") ||
        joinedRow.includes("DISKON") ||
        joinedRow.includes("POTONGAN")
      ) {
        const val = findSummaryNum();
        parsedDisc = val;
        continue;
      }
      if (
        joinedRow.includes("SUBTOTAL") ||
        joinedRow.includes("SUB TOTAL") ||
        /\bTOTAL\b/.test(joinedRow)
      ) {
        const val = findSummaryNum();
        if (val > 0) parsedTotal = val;
        continue;
      }

      // Regular item row
      if (itemText && !/^(telp|wa\s*:|email|www\.|sekian\s+surat)/i.test(itemText)) {
        const qty = readCellNumber(row.getCell(colQty)) || 1;
        const satuan = readCellText(row.getCell(colSatuan)) || "Unit";
        let harga = readCellNumber(row.getCell(colHarga));
        if (harga === 0 && totalVal > 0 && qty > 0) {
          harga = Math.round(totalVal / qty);
        }
        items.push({
          id: String(items.length + 1),
          item: itemText,
          qty,
          satuan,
          harga,
        });
      }
    }
  }

  const itemsSum = items.reduce((acc, it) => acc + it.qty * it.harga, 0);
  const total = (parsedTotal !== undefined && parsedTotal > 0) ? parsedTotal : itemsSum;
  const discount = parsedDisc ?? 0;
  const netBeforeTax = Math.max(0, total - discount);

  let ppn = 0;
  let grandTotal = 0;

  if (parsedGrandTotal !== undefined && parsedGrandTotal > 0) {
    grandTotal = parsedGrandTotal;
    if (parsedPpn !== undefined) {
      ppn = parsedPpn;
    } else {
      ppn = grandTotal > netBeforeTax ? grandTotal - netBeforeTax : 0;
    }
  } else if (parsedPpn !== undefined && parsedPpn > 0) {
    ppn = parsedPpn;
    grandTotal = netBeforeTax + ppn;
  } else {
    ppn = 0;
    grandTotal = netBeforeTax;
  }

  return {
    items,
    total,
    ppn,
    discount,
    grandTotal,
    ...(subject ? { subject } : {}),
    ...(intro ? { intro } : {}),
    ...(notes.length > 0 ? { notes } : {}),
    ...(customerName ? { customerName } : {}),
    ...(signerName ? { signerName } : {}),
  };
}

export async function buildQuotationPdf(params: {
  quoteNo: string;
  date?: Date | string | null;
  city?: string;
  customerName?: string;
  customerAddress?: string;
  leadName?: string;
  kopText?: string;
  kopLogoUrl?: string;
  subject?: string;
  intro?: string;
  items?: QuotationItemData[];
  total?: number;
  ppn?: number;
  pph?: number;
  pphMode?: string;
  tipePph?: string;
  discount?: number;
  grandTotal?: number;
  dpLabel?: string;
  dpAmount?: number;
  notes?: string[];
  signerName?: string;
  signerTitle?: string;
}): Promise<Buffer> {
  const { renderPdf } = await import("../common/pdf.js");

  const rawItems = Array.isArray(params.items) ? params.items : [];
  const effectiveItems: QuotationItemData[] =
    rawItems.length > 0
      ? rawItems
      : [
          {
            id: "1",
            item: params.leadName ? `Pengadaan & Instalasi ${params.leadName}` : "Pekerjaan",
            qty: 1,
            satuan: "Lot",
            harga: Number(params.total) || 0,
          },
        ];

  let calcSum = 0;
  const tableBody: any[] = [
    [
      { text: "No.", bold: true, alignment: "center", fillColor: "#00ffff", fontSize: 9 },
      { text: "Item / Jasa", bold: true, alignment: "center", fillColor: "#00ffff", fontSize: 9 },
      { text: "QTY", bold: true, alignment: "center", fillColor: "#00ffff", fontSize: 9 },
      { text: "Satuan", bold: true, alignment: "center", fillColor: "#00ffff", fontSize: 9 },
      { text: "Harga", bold: true, alignment: "center", fillColor: "#00ffff", fontSize: 9 },
      { text: "Total", bold: true, alignment: "center", fillColor: "#00ffff", fontSize: 9 },
    ],
  ];

  effectiveItems.forEach((it, idx) => {
    const qty = Number(it.qty) || 1;
    const harga = Number(it.harga) || 0;
    const lineTotal = qty * harga;
    calcSum += lineTotal;

    const snSuffix =
      Array.isArray(it.serialNumbers) &&
      it.serialNumbers.length > 0 &&
      !it.serialNumbers.every((sn) => (it.item || "").includes(sn))
        ? `\nSN: ${it.serialNumbers.join(", ")}`
        : "";

    tableBody.push([
      { text: String(idx + 1), alignment: "center", fontSize: 9 },
      { text: `${it.item || "-"}${snSuffix}`, fontSize: 9 },
      { text: String(qty), alignment: "center", fontSize: 9 },
      { text: it.satuan || "Unit", alignment: "center", fontSize: 9 },
      { text: `Rp ${harga.toLocaleString("id-ID")}`, alignment: "right", fontSize: 9 },
      { text: `Rp ${lineTotal.toLocaleString("id-ID")}`, alignment: "right", fontSize: 9 },
    ]);
  });

  const finalTotal = rawItems.length > 0 ? calcSum : Number(params.total ?? calcSum) || 0;
  const finalDisc = Number(params.discount ?? 0) || 0;
  const netBeforeTax = Math.max(0, finalTotal - finalDisc);
  const finalPpn =
    params.ppn !== undefined
      ? Number(params.ppn)
      : Math.round(netBeforeTax * 0.11);
  const finalPph = params.pph !== undefined ? Number(params.pph) : 0;
  const finalGrandTotal =
    params.grandTotal !== undefined && Number(params.grandTotal) > 0
      ? Number(params.grandTotal)
      : Math.max(0, netBeforeTax + finalPpn - finalPph);

  tableBody.push([
    { text: "", colSpan: 4, border: [false, true, false, false] },
    {},
    {},
    {},
    { text: "TOTAL", bold: true, alignment: "right", fontSize: 9 },
    { text: `Rp ${finalTotal.toLocaleString("id-ID")}`, bold: true, alignment: "right", fontSize: 9 },
  ]);

  if (finalDisc > 0) {
    tableBody.push([
      { text: "", colSpan: 4, border: [false, false, false, false] },
      {},
      {},
      {},
      { text: "DISC", bold: true, alignment: "right", fontSize: 9 },
      { text: `Rp ${finalDisc.toLocaleString("id-ID")}`, bold: true, alignment: "right", fontSize: 9 },
    ]);
  }

  tableBody.push([
    { text: "", colSpan: 4, border: [false, false, false, false] },
    {},
    {},
    {},
    { text: finalPpn > 0 ? "PPN (11%)" : "PPN", bold: true, alignment: "right", fontSize: 9 },
    { text: `Rp ${finalPpn.toLocaleString("id-ID")}`, bold: true, alignment: "right", fontSize: 9 },
  ]);

  if (finalPph > 0) {
    tableBody.push([
      { text: "", colSpan: 4, border: [false, false, false, false] },
      {},
      {},
      {},
      { text: params.tipePph ? `POTONGAN ${params.tipePph.toUpperCase()}` : "POTONGAN PPH", bold: true, alignment: "right", fontSize: 9 },
      { text: `- Rp ${finalPph.toLocaleString("id-ID")}`, bold: true, alignment: "right", fontSize: 9 },
    ]);
  }

  tableBody.push([
    { text: "", colSpan: 4, border: [false, false, false, false] },
    {},
    {},
    {},
    { text: "GRAND TOTAL", bold: true, alignment: "right", fontSize: 9 },
    { text: `Rp ${finalGrandTotal.toLocaleString("id-ID")}`, bold: true, alignment: "right", fontSize: 9 },
  ]);

  if (params.dpLabel && params.dpAmount !== undefined) {
    const formattedDpLabel = params.dpLabel.endsWith(":") ? params.dpLabel : `${params.dpLabel}    :`;
    tableBody.push([
      { text: "", colSpan: 4, border: [false, false, false, false] },
      {},
      {},
      {},
      { text: formattedDpLabel, bold: true, alignment: "right", fontSize: 9 },
      { text: `Rp ${Number(params.dpAmount).toLocaleString("id-ID")}`, bold: true, alignment: "right", fontSize: 9 },
    ]);
  }

  const city = params.city?.trim() || "Bekasi";
  const dateStr = `${city}, ${formatTanggalIndo(params.date)}`;
  const leadTitle = params.leadName?.trim() || "Pekerjaan";
  const subjectText =
    params.subject?.trim() || `Penawaran Pengadaan Barang & Jasa Instalasi (${leadTitle})`;
  const introText =
    params.intro?.trim() ||
    `Sesuai permintaan Bapak / Ibu sebelumnya, berikut penawaran dari kami terkait pengadaan Barang & Jasa Instalasi :`;
  const notesList =
    Array.isArray(params.notes) && params.notes.length > 0 ? params.notes : DEFAULT_QUOTATION_NOTES;

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [35, 30, 35, 30],
    content: [
      // KOP SURAT
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: params.kopText?.trim() || "KOP SURAT",
                fontSize: params.kopText ? 10 : 14,
                bold: true,
                alignment: "center",
                margin: [0, 8, 0, 8],
                color: "#111827",
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => "#9ca3af",
          vLineColor: () => "#9ca3af",
        },
        margin: [0, 0, 0, 10],
      },
      // Tanggal Kanan
      {
        text: dateStr,
        fontSize: 10,
        bold: true,
        alignment: "right",
        margin: [0, 0, 0, 6],
      },
      // Kepada Yth
      {
        text: [
          { text: "Kepada Yth.\n", bold: true, fontSize: 10 },
          { text: `${params.customerName || "Nama Customer"}\n`, bold: true, fontSize: 10 },
          { text: `${params.customerAddress?.trim() || "Di Tempat"}\n\n`, bold: true, fontSize: 10 },
        ],
        margin: [0, 0, 0, 2],
      },
      // Subject & Quote No
      {
        text: [
          { text: `Subject : ${subjectText}\n`, bold: true, fontSize: 10 },
          { text: `Quote No. : ${params.quoteNo}\n\n`, bold: true, fontSize: 10 },
        ],
        margin: [0, 0, 0, 2],
      },
      // Pembuka
      {
        text: [
          { text: "Dengan hormat,\n", fontSize: 10 },
          { text: `${introText}\n\n`, fontSize: 10 },
        ],
        margin: [0, 0, 0, 4],
      },
      // Tabel Items
      {
        table: {
          headerRows: 1,
          widths: [24, "*", 30, 45, 75, 75],
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: any) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#000000",
          vLineColor: () => "#000000",
        },
        margin: [0, 0, 0, 10],
      },
      // Notes
      {
        text: "Notes:",
        fontSize: 10,
        bold: true,
        margin: [0, 4, 0, 2],
      },
      ...notesList.map((n) => {
        const isBankInfo = /^(pembayaran|bank|no\.\s*rek|nama|alamat|bekasi)/i.test(n.trim());
        return {
          text: isBankInfo ? n : `• ${n}`,
          fontSize: 9,
          margin: [isBankInfo ? 4 : 10, 1, 0, 1],
          bold: /^(pembayaran|nama)/i.test(n.trim()),
        };
      }),
      // Kontak
      {
        text: [
          { text: "Untuk pertanyaan lebih lanjut bisa hubungi kami melalui :\n", fontSize: 9 },
          { text: "Telp    : 021 2284 3608\n", fontSize: 9 },
          { text: "WA      : 0859 5959 8852 / 0821 2345 9144\n", fontSize: 9 },
          { text: "Email  : cs@ghinamultiprima.co.id\n", fontSize: 9, color: "#1d4ed8" },
          { text: "www.ghinamultiprima.co.id\n\n", fontSize: 9, bold: true, color: "#1d4ed8" },
        ],
        margin: [0, 0, 0, 4],
      },
      // Penutup & TTD
      {
        text: "Sekian surat penawaran ini kami buat dengan harapan agar Bapak/Ibu bisa bekerjasama dengan perusahaan kami. Kami tunggu tanggapan dan kabar baik.",
        fontSize: 9,
        margin: [0, 0, 0, 10],
      },
      {
        columns: [
          {
            width: 150,
            stack: [
              { text: "TTD,\n\n\n\n", fontSize: 9 },
              {
                text: params.signerName || "Nama Sales",
                fontSize: 10,
                bold: true,
                decoration: "underline",
              },
              ...(params.signerTitle?.trim()
                ? [{ text: params.signerTitle.trim(), fontSize: 9, margin: [0, 2, 0, 0] }]
                : []),
            ],
          },
        ],
      },
    ],
  };

  return renderPdf(docDefinition);
}

