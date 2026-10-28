/**
 * Generator berkas PDF standar (PDF-1.4) murni client-side tanpa dependensi eksternal.
 * Menghasilkan file PDF tabel A4 Landscape resmi yang dapat langsung diunduh dan dibuka
 * di semua PDF viewer (Chrome, Adobe Acrobat, Edge, macOS Preview, LibreOffice).
 */

function escapePdfText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, " "); // sanitasi karakter non-ascii standar
}

export function generatePdfTable(options: {
  title: string;
  subtitle?: string;
  dateStr?: string;
  columns: string[];
  rows: string[][];
}): Uint8Array {
  const { title, subtitle = "PT GHINA MULTI PRIMA / TASKA ERP", dateStr = new Date().toISOString().slice(0, 10), columns, rows } = options;

  // A4 Landscape: width 842 pt, height 595 pt
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 36;
  const usableWidth = pageWidth - margin * 2; // 770 pt

  // Hitung lebar kolom proporsional
  const colCount = columns.length;
  const colWidth = usableWidth / colCount;

  const rowHeight = 20;
  const headerHeight = 22;

  let stream = "";
  // Inisialisasi transformasi koordinat
  stream += "1 0 0 1 0 0 cm\n";

  // Header Title
  stream += "BT\n";
  stream += "/F2 15 Tf\n";
  stream += `${margin} ${pageHeight - 36} Td\n`;
  stream += `(${escapePdfText(subtitle)}) Tj\n`;
  stream += "ET\n";

  stream += "BT\n";
  stream += "/F2 12 Tf\n";
  stream += `${margin} ${pageHeight - 54} Td\n`;
  stream += `(${escapePdfText(title)}) Tj\n`;
  stream += "ET\n";

  stream += "BT\n";
  stream += "/F1 9 Tf\n";
  stream += `${margin} ${pageHeight - 68} Td\n`;
  stream += `(Tanggal Ekspor: ${escapePdfText(dateStr)}) Tj\n`;
  stream += "ET\n";

  let y = pageHeight - 96;

  // Header Tabel (Background Abu-abu)
  stream += `0.92 0.94 0.96 rg\n`; // #ebf0f5
  stream += `${margin} ${y - headerHeight} ${usableWidth} ${headerHeight} re f\n`;
  stream += `0.75 0.8 0.85 RG 0.75 w\n`;
  stream += `${margin} ${y - headerHeight} ${usableWidth} ${headerHeight} re s\n`;

  // Teks Header Tabel
  for (let c = 0; c < colCount; c++) {
    const colName = columns[c] || "";
    const x = margin + c * colWidth + 5;
    stream += "BT\n";
    stream += "/F2 8.5 Tf\n";
    stream += `0 0 0 rg\n`;
    stream += `${x} ${y - headerHeight + 6} Td\n`;
    stream += `(${escapePdfText(colName.slice(0, 24))}) Tj\n`;
    stream += "ET\n";
  }

  y -= headerHeight;

  // Baris-baris Data
  const maxRowsPerPage = 22;
  const displayRows = rows.slice(0, maxRowsPerPage);

  for (let r = 0; r < displayRows.length; r++) {
    const row = displayRows[r];
    if (!row) continue;
    const isEven = r % 2 === 0;

    // Background bergantian (zebra striping)
    if (isEven) {
      stream += `0.98 0.98 0.99 rg\n`;
      stream += `${margin} ${y - rowHeight} ${usableWidth} ${rowHeight} re f\n`;
    }

    // Border bawah baris
    stream += `0.85 0.88 0.92 RG 0.5 w\n`;
    stream += `${margin} ${y - rowHeight} m ${margin + usableWidth} ${y - rowHeight} l S\n`;

    // Isi cell
    for (let c = 0; c < colCount; c++) {
      const val = row[c] != null ? String(row[c]) : "";
      const x = margin + c * colWidth + 5;
      stream += "BT\n";
      stream += "/F1 8 Tf\n";
      stream += `0.1 0.15 0.2 rg\n`;
      stream += `${x} ${y - rowHeight + 6} Td\n`;
      stream += `(${escapePdfText(val.slice(0, 26))}) Tj\n`;
      stream += "ET\n";
    }

    y -= rowHeight;
  }

  // Footer Dokumen
  stream += "BT\n";
  stream += "/F1 8 Tf\n";
  stream += `0.45 0.5 0.55 rg\n`;
  stream += `${margin} 25 Td\n`;
  stream += `(Dokumen resmi Taska ERP - Dicetak secara otomatis) Tj\n`;
  stream += "ET\n";

  const streamBytes = new TextEncoder().encode(stream);
  const streamLength = streamBytes.length;

  const objects: string[] = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`,
    `6 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj`,
  ];

  let pdfString = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdfString.length);
    pdfString += objects[i] + "\n";
  }

  const startxref = pdfString.length;
  pdfString += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdfString += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdfString += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;

  return new TextEncoder().encode(pdfString);
}

