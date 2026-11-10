import { rupiah, tanggal } from "@/lib/format";
import { DEFAULT_COMPANY_PROFILE, type CompanyProfile } from "@/constants/modules";
import { apiBase } from "@/services/api";

export function escapeHtml(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readCachedCompanyProfile(): CompanyProfile {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    try {
      const raw = window.localStorage.getItem("taska.offline.company.v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_COMPANY_PROFILE, ...parsed };
      }
    } catch {}
  }
  return DEFAULT_COMPANY_PROFILE;
}

export interface PrintableOrderItem {
  name?: string;
  item?: string;
  nama?: string;
  productName?: string;
  qty: number;
  unit?: string;
  satuan?: string;
  price?: number;
  harga?: number;
  sn?: string | null;
  serialNumbers?: string[] | string | null;
}

export function printOrderDocument(opts: {
  docType: "SO" | "PO" | "DO";
  docNumber: string;
  refNumber?: string;
  date?: string;
  counterpartyLabel: string;
  counterpartyName: string;
  items: PrintableOrderItem[];
  totalAmount?: number;
  notes?: string;
  paymentTerms?: string;
  senderName?: string;
  recipientName?: string;
  companyName?: string;
  companyTagline?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyLogoUrl?: string;
}) {
  if (typeof window === "undefined") return;

  const profile = readCachedCompanyProfile();
  const compName = escapeHtml(opts.companyName || profile.name || "PT Samtek");
  const compTagline = escapeHtml(opts.companyTagline || profile.tagline || "TASKA ERP System");
  const compAddress = escapeHtml(opts.companyAddress ?? profile.address ?? "");
  const compPhone = escapeHtml(opts.companyPhone ?? profile.phone ?? "");
  const compSignatory = escapeHtml(opts.senderName || profile.signatoryName || profile.name || "PT Samtek");
  const logoUrl = opts.companyLogoUrl || (profile.logoFileId ? `${apiBase()}/files/${profile.logoFileId}` : "");

  const isSo = opts.docType === "SO";
  const isDo = opts.docType === "DO";
  const title = isDo
    ? "DELIVERY ORDER (DO) / SURAT JALAN"
    : isSo
      ? "SALES ORDER (SO)"
      : "PURCHASE ORDER (PO)";
  const subtitle = isDo
    ? "Dokumen Resmi Pengiriman & Serah Terima Barang (Wajib Ditandatangani Kedua Pihak)"
    : isSo
      ? "Dokumen Konfirmasi Pesanan & Acuan Pengiriman (Delivery Order)"
      : "Dokumen Resmi Pemesanan Barang / Jasa (Purchase Order)";
  const refLabel = isDo ? "Referensi No. SO / PO" : isSo ? "Referensi No. PO" : "Referensi No. SO";
  const totalAmount = Number(opts.totalAmount ?? 0);
  const safeDocNumber = escapeHtml(opts.docNumber || "-");
  const safeRefNumber = escapeHtml(opts.refNumber && opts.refNumber !== "-" ? opts.refNumber : "-");
  const safeCounterpartyLabel = escapeHtml(opts.counterpartyLabel);
  const safeCounterpartyName = escapeHtml(opts.counterpartyName || "-");
  const safeNotes = opts.notes ? escapeHtml(opts.notes).replace(/\n/g, "<br/>") : "";
  const safePaymentTerms = opts.paymentTerms ? escapeHtml(opts.paymentTerms) : "";
  const safeRecipient = escapeHtml(opts.recipientName || opts.counterpartyName || "Penerima & Cap/TTD");

  const rowsHtml =
    opts.items.length > 0
      ? opts.items
          .map((it, idx) => {
            const name = escapeHtml(it.item || it.name || it.nama || it.productName || "Barang / Jasa");
            const qty = Number(it.qty) || 1;
            const price = Number(it.harga ?? it.price ?? 0);
            const unit = escapeHtml(it.satuan || it.unit || "Unit");
            const rawSn =
              it.sn ||
              (Array.isArray(it.serialNumbers)
                ? it.serialNumbers.join(", ")
                : typeof it.serialNumbers === "string"
                  ? it.serialNumbers
                  : "");
            const sn = escapeHtml(rawSn);
            const sub = qty * price;
            if (isDo) {
              return `
                <tr>
                  <td style="text-align:center;">${idx + 1}</td>
                  <td><strong>${name}</strong></td>
                  <td>${sn ? `<span style="font-family:monospace;font-size:11.5px;">${sn}</span>` : "-"}</td>
                  <td style="text-align:center;font-weight:700;">${qty} ${unit}</td>
                  <td>Baik / Lengkap</td>
                </tr>
              `;
            }
            return `
              <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td>
                  <strong>${name}</strong>
                  ${sn ? `<div style="font-size:11px;color:#555;">SN: ${sn}</div>` : ""}
                </td>
                <td style="text-align:center;">${qty} ${unit}</td>
                <td style="text-align:right;">${price > 0 ? rupiah(price) : "-"}</td>
                <td style="text-align:right;font-weight:600;">${sub > 0 ? rupiah(sub) : "-"}</td>
              </tr>
            `;
          })
          .join("")
      : isDo
        ? `
        <tr>
          <td style="text-align:center;">1</td>
          <td>Pengiriman barang sesuai pesanan (${safeDocNumber})</td>
          <td>-</td>
          <td style="text-align:center;font-weight:700;">1 Paket</td>
          <td>Baik / Lengkap</td>
        </tr>
      `
        : `
        <tr>
          <td style="text-align:center;">1</td>
          <td>Pesanan sesuai kesepakatan (${safeDocNumber})</td>
          <td style="text-align:center;">1 Paket</td>
          <td style="text-align:right;">${rupiah(totalAmount)}</td>
          <td style="text-align:right;font-weight:600;">${rupiah(totalAmount)}</td>
        </tr>
      `;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} - ${safeDocNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 32px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
    .subtitle { font-size: 12px; color: #4b5563; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    .meta-item { margin-bottom: 4px; }
    .meta-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
    .meta-val { font-size: 13px; font-weight: 700; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #d1d5db; padding: 9px 10px; font-size: 12.5px; }
    th { background: #f3f4f6; text-transform: uppercase; font-size: 11px; letter-spacing: 0.4px; }
    .total-box { margin-top: 16px; display: flex; justify-content: flex-end; }
    .total-card { width: 280px; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: #f9fafb; }
    .sign-grid { margin-top: 44px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; }
    .sign-line { margin-top: 64px; border-top: 1px solid #374151; padding-top: 6px; font-weight: 600; }
    @media print {
      body { margin: 16px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${title}</div>
      <div class="subtitle">${subtitle}</div>
    </div>
    <div style="text-align:right;display:flex;align-items:center;gap:12px;">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" style="max-height:48px;max-width:120px;object-fit:contain;" />` : ""}
      <div>
        <div style="font-weight:800;font-size:15px;">${compName.toUpperCase()}</div>
        <div style="font-size:11px;color:#6b7280;">${compTagline}</div>
        ${compAddress ? `<div style="font-size:10.5px;color:#6b7280;">${compAddress}${compPhone ? ` · Telp: ${compPhone}` : ""}</div>` : ""}
      </div>
    </div>
  </div>

  <div class="meta-grid">
    <div>
      <div class="meta-item">
        <div class="meta-label">Nomor ${escapeHtml(opts.docType)}</div>
        <div class="meta-val">${safeDocNumber}</div>
      </div>
      <div class="meta-item" style="margin-top:8px;">
        <div class="meta-label">${refLabel}</div>
        <div class="meta-val">${safeRefNumber}</div>
      </div>
    </div>
    <div>
      <div class="meta-item">
        <div class="meta-label">${safeCounterpartyLabel}</div>
        <div class="meta-val">${safeCounterpartyName}</div>
      </div>
      <div class="meta-item" style="margin-top:8px;">
        <div class="meta-label">Tanggal Dokumen</div>
        <div class="meta-val">${opts.date ? escapeHtml(tanggal(opts.date)) : "-"}</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      ${
        isDo
          ? `<tr>
              <th style="width:42px;">No</th>
              <th>Deskripsi Barang</th>
              <th style="width:180px;">Serial Number (SN)</th>
              <th style="width:100px;">Qty</th>
              <th style="width:130px;">Kondisi / Ket</th>
            </tr>`
          : `<tr>
              <th style="width:42px;">No</th>
              <th>Deskripsi Barang / Jasa</th>
              <th style="width:90px;">Qty</th>
              <th style="width:130px;">Harga Satuan</th>
              <th style="width:140px;">Subtotal</th>
            </tr>`
      }
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  ${
    isDo
      ? ""
      : `<div class="total-box">
          <div class="total-card">
            <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;">
              <span>TOTAL NILAI</span>
              <span>${rupiah(totalAmount)}</span>
            </div>
            ${safePaymentTerms ? `<div style="font-size:11px;color:#4b5563;margin-top:6px;">Syarat Pembayaran: ${safePaymentTerms}</div>` : ""}
          </div>
        </div>`
  }

  ${
    safeNotes
      ? `<div style="margin-top:16px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;">
          <strong>Catatan / Instruksi:</strong><br/>${safeNotes}
         </div>`
      : ""
  }

  ${
    isDo
      ? `<div style="margin-top:44px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:28px;text-align:center;">
          <div>
            <div>Diserahkan Oleh (Gudang),</div>
            <div class="sign-line">${compSignatory}</div>
          </div>
          <div>
            <div>Dikirim / Dibawa Oleh,</div>
            <div class="sign-line">Kurir / Teknisi Pengirim</div>
          </div>
          <div>
            <div>Diterima Oleh (Pihak Kedua),</div>
            <div class="sign-line">${safeRecipient}</div>
          </div>
        </div>`
      : `<div class="sign-grid">
          <div>
            <div>Diterbitkan Oleh,</div>
            <div class="sign-line">${compName}</div>
          </div>
          <div>
            <div>Disetujui / Dikonfirmasi Oleh,</div>
            <div class="sign-line">${safeCounterpartyName !== "-" ? safeCounterpartyName : "Pihak Terkait"}</div>
          </div>
        </div>`
  }

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 250); };
  </script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}

