import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildDrivePreview, classifyFileType, getExtension } from "./drive-preview.util.js";

describe("drive-preview.util", () => {
  it("extracts extension and classifies file types accurately", () => {
    expect(getExtension("Laporan_2026.XLSX")).toBe("xlsx");
    expect(classifyFileType("pdf", "application/pdf")).toBe("pdf");
    expect(classifyFileType("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("excel");
    expect(classifyFileType("csv", "text/csv")).toBe("excel");
    expect(classifyFileType("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("word");
    expect(classifyFileType("png", "image/png")).toBe("image");
    expect(classifyFileType("mp4", "video/mp4")).toBe("video");
    expect(classifyFileType("txt", "text/plain")).toBe("text");
  });

  it("parses XLSX spreadsheet into sheets and rows", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Anggaran");
    ws.addRow(["Item", "Qty", "Harga"]);
    ws.addRow(["Laptop", 2, 15000000]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const res = await buildDrivePreview(buf, "anggaran.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.kind).toBe("spreadsheet");
    if (res.kind === "spreadsheet") {
      expect(res.sheets).toHaveLength(1);
      expect(res.sheets[0]?.name).toBe("Anggaran");
      expect(res.sheets[0]?.rows[0]).toEqual(["Item", "Qty", "Harga"]);
      expect(res.sheets[0]?.rows[1]).toEqual(["Laptop", "2", "15000000"]);
    }
  });

  it("parses CSV into table rows", async () => {
    const csv = Buffer.from('Nama,Divisi,Catatan\n"Budi, S.T.",Operasional,Aktif\n', "utf8");
    const res = await buildDrivePreview(csv, "karyawan.csv", "text/csv");
    expect(res.kind).toBe("spreadsheet");
    if (res.kind === "spreadsheet") {
      expect(res.sheets[0]?.rows).toEqual([
        ["Nama", "Divisi", "Catatan"],
        ["Budi, S.T.", "Operasional", "Aktif"],
      ]);
    }
  });

  it("parses TXT text preview", async () => {
    const txt = Buffer.from("SOP Operasional\n1. Cek barang", "utf8");
    const res = await buildDrivePreview(txt, "sop.txt", "text/plain");
    expect(res.kind).toBe("text");
    if (res.kind === "text") {
      expect(res.content).toContain("SOP Operasional");
      expect(res.truncated).toBe(false);
    }
  });
});
