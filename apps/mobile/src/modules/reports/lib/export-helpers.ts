import { apiBase, getAccess } from "@/services/api";
import { generatePdfTable } from "@/lib/simple-pdf";
import { buildEfakturCsv } from "@/lib/efaktur";
import type { DownloadFormat } from "../types";

export const FINANCIAL_TYPES = new Set([
  "profit-loss",
  "income-statement",
  "balance-sheet",
  "cash-flow",
  "general-journal",
]);

export function generateCsvByType(type: string, title: string, fin: any, data: any, approvals: any[]): string {
  const headerPrefix = `LAPORAN RESMI PT GHINA MULTI PRIMA (TASKA ERP) - ${title.toUpperCase()}\nTanggal Ekspor: ${new Date().toISOString().slice(0, 10)}\n\n`;

  if (type === "income-statement" || title.includes("Laba Rugi Standar")) {
    const inc = fin.incomeStatement;
    const lines = [
      `"4101","Pendapatan Proyek & Integrasi Sistem (DPP Bersih)","Pendapatan","${inc.revenueDpp}"`,
      `"2102","PPN Keluaran Terpungut (11% — Titipan Pajak)","Informasi Pajak","${inc.ppnKeluaran}"`,
      `"-","Total Nilai Tagihan Kotor (Gross Invoiced)","Informasi Tagihan","${inc.revenueGross}"`,
      `"5101","Harga Pokok Penjualan / Pengadaan PO Supplier (HPP)","Beban Pokok (HPP)","-${inc.cogsTotal}"`,
      `"=","LABA KOTOR (GROSS PROFIT) — Margin ${inc.grossMarginPct}%","Subtotal","${inc.grossProfit}"`,
      ...inc.opexByCategory.map(
        (c: any) => `"6101","Beban Operasional: ${c.kategori} (${c.count} transaksi)","Beban Operasional (OPEX)","-${c.nominal}"`
      ),
      `"=","TOTAL BEBAN OPERASIONAL (OPEX)","Subtotal","-${inc.opexTotal}"`,
      `"=","LABA BERSIH OPERASIONAL (NET PROFIT) — Margin ${inc.netMarginPct}%","Total Akhir","${inc.netProfit}"`,
    ];
    return headerPrefix + "Kode Akun,Komponen Laporan Laba Rugi,Kelompok,Nominal (Rp)\n" + lines.join("\n");
  }

  if (type === "profit-loss" || title.includes("Untung-Rugi") || title.includes("P&L")) {
    const rows = fin.incomeStatement.projectRows.map(
      (r: any) =>
        `"${r.project}","${r.customer}","${r.revenueDpp}","${r.ppnKeluaran}","${r.paidCashIn}","${r.arOutstanding}","${r.cogsPo}","${r.opexExpense}","${r.netProfit}","${r.marginPct}%","${r.statusKesehatan}"`
    );
    return (
      headerPrefix +
      "Kode Project,Customer,Pendapatan DPP (Rp),PPN 11% (Rp),Kas Diterima (Rp),Sisa Piutang (Rp),HPP PO Supplier (Rp),Biaya Operasional (Rp),Laba Bersih (Rp),Margin (%),Status Kesehatan\n" +
      rows.join("\n")
    );
  }

  if (type === "balance-sheet" || title.includes("Neraca")) {
    const bs = fin.balanceSheet;
    const lines = [
      `"1101","Kas & Bank Operasional","ASET LANCAR (AKTIVA)","${bs.assets.kasDanBank}"`,
      `"1102","Piutang Usaha Pelanggan (Accounts Receivable)","ASET LANCAR (AKTIVA)","${bs.assets.piutangUsaha}"`,
      `"1103","Persediaan Barang Gudang (Inventory Valuation)","ASET LANCAR (AKTIVA)","${bs.assets.persediaanBarang}"`,
      `"1105","Uang Muka PPh / Pajak Dibayar Dimuka (Prepaid Tax)","ASET LANCAR (AKTIVA)","${bs.assets.uangMukaPph || 0}"`,
      `"=","TOTAL ASET (AKTIVA)","TOTAL AKTIVA","${bs.assets.totalAsetLancar}"`,
      `"2101","Hutang Usaha Supplier (Accounts Payable)","KEWAJIBAN JANGKA PENDEK","${bs.liabilities.hutangSupplier}"`,
      `"2102","Hutang PPN Keluaran (Output VAT)","KEWAJIBAN JANGKA PENDEK","${bs.liabilities.hutangPpnKeluaran}"`,
      `"2103","Hutang Biaya & Reimbursement Operasional","KEWAJIBAN JANGKA PENDEK","${bs.liabilities.hutangReimbursement}"`,
      `"=","TOTAL KEWAJIBAN (LIABILITAS)","SUBTOTAL KEWAJIBAN","${bs.liabilities.totalKewajiban}"`,
      `"3101","Modal Kerja & Cadangan Persediaan Awal","EKUITAS (MODAL)","${bs.equity.modalKerjaAwal}"`,
      `"3102","Laba Ditahan / Laba Bersih Tahun Berjalan","EKUITAS (MODAL)","${bs.equity.labaBerjalan}"`,
      `"=","TOTAL EKUITAS (MODAL)","SUBTOTAL EKUITAS","${bs.equity.totalEkuitas}"`,
      `"=","TOTAL KEWAJIBAN & EKUITAS (PASIVA)","TOTAL PASIVA","${bs.totalPasiva}"`,
    ];
    return headerPrefix + "Kode Akun,Pos Neraca,Kelompok,Saldo (Rp)\n" + lines.join("\n");
  }

  if (type === "cash-flow" || title.includes("Arus Kas")) {
    const cf = fin.cashFlow;
    const rows = [
      ...cf.items.map(
        (item: any) =>
          `"${item.tanggal}","${item.refNo}","${item.kategori}","${item.pihak}","${item.project}","${item.keterangan}","${item.masuk}","${item.keluar}"`
      ),
      `"TOTAL","REKAP","RINGKASAN ARUS KAS","-","-","Total Kas Masuk vs Kas Keluar (Bersih: Rp ${cf.netCashFlow.toLocaleString("id-ID")})","${cf.totalCashIn}","${cf.totalCashOut}"`,
    ];
    return (
      headerPrefix +
      "Tanggal,No Referensi,Kategori Arus Kas,Pihak Terkait,Project,Keterangan,Kas Masuk (Rp),Kas Keluar (Rp)\n" +
      rows.join("\n")
    );
  }

  if (type === "general-journal" || title.includes("Jurnal Umum")) {
    const rows = [
      ...fin.journalLines.map(
        (l: any) =>
          `"${l.journalNo}","${l.tanggal}","${l.refNo}","${l.sumber}","${l.project}","${l.kodeAkun}","${l.namaAkun}","${l.keterangan}","${l.debit}","${l.kredit}"`
      ),
      `"TOTAL","-","-","NERACA SALDO JURNAL","-","-","TOTAL DEBIT & KREDIT (BALANCE)","Status: ${fin.isJournalBalanced ? "SEIMBANG" : "SELISIH"}","${fin.totalDebit}","${fin.totalKredit}"`,
    ];
    return (
      headerPrefix +
      "No Jurnal,Tanggal,No Referensi,Sumber Transaksi,Project,Kode Akun,Nama Akun,Uraian / Keterangan,Debit (Rp),Kredit (Rp)\n" +
      rows.join("\n")
    );
  }

  if (title.includes("Pipeline") || title.includes("Leads")) {
    const rows = (data.leads || []).map(
      (l: any) =>
        `"${l.id}","${l.nama}","${l.perusahaan}","${l.sumber}","${l.nilai}","${l.peluang}%","${l.closing}","${l.pemilik}","${l.status}","${l.alasanLost || "-"}"`
    );
    return (
      headerPrefix +
      "ID,Nama Proyek,Perusahaan,Sumber,Nilai (Rp),Peluang,Est Closing,PIC Sales,Status,Alasan Lost\n" +
      rows.join("\n")
    );
  }

  if (title.includes("Follow-up")) {
    const rows = (data.followups || []).map(
      (f: any) =>
        `"${f.id}","${f.tanggal}","${f.lead}","${f.metode}","${f.catatan}","${f.berikutnya || "-"}","${f.status}"`
    );
    return headerPrefix + "ID,Tanggal,Lead,Metode,Catatan,Jadwal Berikutnya,Status\n" + rows.join("\n");
  }

  if (title.includes("Piutang") || title.includes("Invoice")) {
    const rows = (data.invoices || []).map(
      (inv: any) =>
        `"${inv.nomor}","${inv.customer}","${inv.jenis}","${inv.total}","${inv.terbayar}","${inv.total - inv.terbayar}","${inv.jatuhTempo}","${inv.status}"`
    );
    return (
      headerPrefix +
      "Nomor Invoice,Customer,Jenis Termin,Total Tagihan,Sudah Dibayar,Sisa Piutang,Jatuh Tempo,Status\n" +
      rows.join("\n")
    );
  }

  if (title.includes("Stok") || title.includes("Gudang")) {
    const rows = (data.products || []).map(
      (p: any) =>
        `"${p.sku}","${p.nama}","${p.kategori}","${p.satuan}","${p.hargaBeli}","${p.garansi}","${p.berSN ? "Ya" : "Tidak"}"`
    );
    return (
      headerPrefix +
      "SKU,Nama Produk,Kategori,Satuan,Harga Beli (Rp),Masa Garansi,Serial Number (SN)\n" +
      rows.join("\n")
    );
  }

  if (title.includes("Pengeluaran") || title.includes("Reimbursement")) {
    const rows = (data.expenses || []).map(
      (e: any) =>
        `"${e.id}","${e.tanggal}","${e.pelapor}","${e.kategori}","${e.nominal}","${e.project}","${e.alasan}","${e.status}"`
    );
    return (
      headerPrefix +
      "ID,Tanggal,Pelapor,Kategori,Nominal (Rp),Project Terkait,Keperluan,Status\n" +
      rows.join("\n")
    );
  }

  if (title.includes("Surat Jalan")) {
    const rows = (data["delivery-notes"] || []).map(
      (dn: any) =>
        `"${dn.nomor}","${dn.tanggal}","${dn.tujuan}","${dn.alasan}","${dn.project}","${dn.pembuat}","${dn.status}"`
    );
    return headerPrefix + "Nomor SJ,Tanggal,Tujuan,Alasan,Project,Pembuat,Status\n" + rows.join("\n");
  }

  if (title.includes("Persetujuan")) {
    const rows = (approvals || []).map(
      (ap: any) => `"${ap.id}","${ap.jenis}","${ap.judul}","${ap.pengaju}","${ap.nilai}","${ap.status}"`
    );
    return headerPrefix + "ID,Jenis,Judul,Pengaju,Nilai (Rp),Status\n" + rows.join("\n");
  }

  const rows = (data.projects || []).map(
    (pr: any) =>
      `"${pr.id}","${pr.nama}","${pr.customer}","${pr.pm}","${pr.progres}%","${pr.status}","${pr.pembayaran}","${pr.barang}"`
  );
  return (
    headerPrefix +
    "ID,Nama Proyek,Customer,PM,Progres,Status Proyek,Pembayaran,Status Barang\n" +
    rows.join("\n")
  );
}

export async function downloadReport({
  type,
  title,
  format,
  fin,
  data,
  approvals,
  canAccessFinancials,
  toast,
}: {
  type: string;
  title: string;
  format: DownloadFormat;
  fin: any;
  data: any;
  approvals: any[];
  canAccessFinancials: boolean;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
}) {
  if (FINANCIAL_TYPES.has(type) && !canAccessFinancials) {
    toast("Akses ditolak: Laporan Keuangan hanya untuk Finance, Admin, Bos, dan Super Admin", "danger");
    return;
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    toast(`Mengunduh ${title} (${format.toUpperCase()})`);
    return;
  }

  const safeName = title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  if (!title.includes("Piutang")) {
    try {
      const token = getAccess();
      const res = await fetch(`${apiBase()}/reports/${type}/export?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${safeName}-${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast(`Laporan ${title} berhasil diunduh (.${format})`);
        return;
      }
    } catch {}
  }

  const csvData = generateCsvByType(type, title, fin, data, approvals);

  if (format === "xlsx") {
    const blob = new Blob(["\uFEFF" + csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${safeName}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast(`Laporan ${title} berhasil diunduh (.csv)`);
  } else if (format === "pdf") {
    const lines = csvData.trim().split("\n").filter((l) => l.trim().length > 0);
    let foundHeader = false;
    let cols: string[] = [];
    const parsedRows: string[][] = [];
    for (const line of lines) {
      if (!foundHeader && line.includes(",")) {
        foundHeader = true;
        cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
      } else if (foundHeader) {
        const r = line.split('","').map((c) => c.replace(/^"|"$/g, "").trim());
        parsedRows.push(r);
      }
    }
    const pdfBytes = generatePdfTable({
      title,
      columns: cols,
      rows: parsedRows,
    });
    const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast(`Laporan ${title} berhasil diunduh (.pdf)`);
  } else {
    const lines = csvData.trim().split("\n").filter((l) => l.trim().length > 0);
    let tableRows = "";
    let foundHeader = false;
    for (const line of lines) {
      if (!foundHeader && line.includes(",")) {
        foundHeader = true;
        const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        tableRows += "<tr>" + cols.map((c) => `<th>${c}</th>`).join("") + "</tr>";
      } else if (foundHeader) {
        const cols = line.split('","').map((c) => c.replace(/^"|"$/g, "").trim());
        tableRows += "<tr>" + cols.map((c) => `<td>${c}</td>`).join("") + "</tr>";
      }
    }

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${title}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; padding: 20px; }
        h2 { font-size: 16pt; color: #0f172a; margin-bottom: 2px; }
        h3 { font-size: 13pt; color: #2563eb; margin-top: 0; margin-bottom: 12px; }
        p.meta { font-size: 9.5pt; color: #64748b; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; font-size: 10pt; }
        th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
        tr:nth-child(even) { background-color: #f8fafc; }
      </style>
      </head>
      <body>
        <h2>PT GHINA MULTI PRIMA / TASKA ERP</h2>
        <h3>${title}</h3>
        <p class="meta">Tanggal Ekspor: ${new Date().toISOString().slice(0, 10)}</p>
        <table>${tableRows}</table>
      </body>
      </html>
    `;
    const blob = new Blob(["\uFEFF" + htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${safeName}-${new Date().toISOString().slice(0, 10)}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast(`Laporan ${title} berhasil diunduh (.doc)`);
  }
}

export function downloadEfakturCsv({
  data,
  canAccessFinancials,
  toast,
}: {
  data: any;
  canAccessFinancials: boolean;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
}) {
  if (!canAccessFinancials) {
    toast("Akses ditolak: Ekspor E-Faktur hanya untuk Finance, Admin, Bos, dan Super Admin", "danger");
    return;
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    toast("Mengunduh CSV E-Faktur DJP");
    return;
  }
  try {
    const csvContent = buildEfakturCsv(data.invoices ?? [], data.customers ?? []);
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `efaktur-pajak-keluaran-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast("File CSV E-Faktur DJP berhasil diunduh!");
  } catch (e: any) {
    toast(e?.message ?? "Gagal mengekspor E-Faktur", "danger");
  }
}

