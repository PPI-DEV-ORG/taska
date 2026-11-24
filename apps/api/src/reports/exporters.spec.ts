import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { sheetName, toPdf, toXlsx, totalRow, type ReportData } from "./exporters.js";

const balanceSheet: ReportData = {
  title: "Laporan Posisi Keuangan / Neraca (Balance Sheet)",
  columns: ["Kode Akun", "Nama Akun Neraca", "Kelompok Pos", "Saldo (Rp)"],
  note: "Per 24 November 2026",
  rows: [
    ["1000.01", "Kas Kecil", "AKTIVA — ASET LANCAR", 1500000],
    totalRow("", "TOTAL AKTIVA (ASET PERUSAHAAN)", "TOTAL AKTIVA", 1500000),
  ],
};

const journal: ReportData = {
  title: "Laporan Jurnal Umum (General Journal)",
  columns: ["No. Jurnal", "Tanggal", "No. Referensi", "Project", "Kode Akun", "Nama Akun", "Uraian / Keterangan", "Debit (Rp)", "Kredit (Rp)"],
  rows: [
    ["JU/2026/11/0001", "24/11/2026", "PC/1", "-", "6202", "Beban", "Uraian panjang ".repeat(20), 250000, 0],
    ["TOTAL", "", "", "", "", "", "SEIMBANG (BALANCED)", 250000, 250000],
  ],
  wrapCols: [6],
};

describe("export laporan keuangan", () => {
  it("nama sheet aman dari karakter terlarang Excel (judul Neraca / Arus Kas dulu gagal)", () => {
    expect(sheetName("Laporan Posisi Keuangan / Neraca (Balance Sheet)")).not.toMatch(/[*?:\\/[\]]/);
    expect(sheetName("Laporan Arus Kas / Cash Flow Statement").length).toBeLessThanOrEqual(31);
    expect(sheetName("")).toBe("Laporan");
  });

  it("Excel: judul dengan '/' tidak gagal & nominal tersimpan sebagai angka", async () => {
    const buf = await toXlsx(balanceSheet);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.worksheets[0]!;
    const values: unknown[] = [];
    ws.eachRow((row) => values.push(row.getCell(4).value));
    expect(values).toContain(1500000);
    expect(values.filter((v) => typeof v === "number").length).toBe(2);
  });

  it("PDF: jurnal 9 kolom dengan uraian panjang berhasil dibuat", async () => {
    const pdf = await toPdf(journal);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
