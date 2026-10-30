/**
 * Perapian teks audit log.
 *
 * Audit log menyimpan dua jenis data:
 *  - aksi kode dari service, mis. `BUAT_PO_SUPPLIER` + detail yang sudah ramah dibaca;
 *  - aksi otomatis dari AuditInterceptor, mis. `POST /api/sales-orders` + detail JSON mentah.
 *
 * Fungsi di sini mengubah keduanya menjadi kalimat singkat berbahasa Indonesia agar
 * tidak ada payload JSON mentah yang tampil di riwayat.
 */

const ACTION_LABELS: Record<string, string> = {
  // Persetujuan
  AJUKAN_PERSETUJUAN: "Mengajukan persetujuan",
  SETUJUI: "Menyetujui",
  DISETUJUI: "Menyetujui",
  TOLAK: "Menolak",
  DITOLAK: "Menolak",
  // Autentikasi
  LOGIN: "Masuk ke aplikasi",
  // Lead
  BUAT_LEAD: "Membuat lead",
  UBAH_STAGE: "Mengubah tahap lead",
  REASSIGN_LEAD: "Mengalihkan kepemilikan lead",
  HAPUS_LEAD: "Menghapus lead",
  // Penawaran
  BUAT_PENAWARAN: "Membuat penawaran",
  ISI_PENAWARAN: "Memperbarui rincian penawaran",
  UPLOAD_EXCEL_PENAWARAN: "Mengunggah Excel penawaran",
  AJUKAN_PENAWARAN: "Mengajukan penawaran",
  KIRIM_PENAWARAN: "Mengirim penawaran",
  UBAH_STATUS_PENAWARAN: "Mengubah status penawaran",
  REVISI_PENAWARAN: "Merevisi penawaran",
  HAPUS_PENAWARAN: "Menghapus penawaran",
  // Survey
  BUAT_SURVEY: "Membuat survey",
  UBAH_STATUS_SURVEY: "Mengubah status survey",
  LAMPIRAN_SURVEY: "Melampirkan file survey",
  HAPUS_SURVEY: "Menghapus survey",
  // PO client / Sales Order
  BUAT_PO_CLIENT: "Membuat PO client",
  UBAH_PO_CLIENT: "Memperbarui PO client",
  HAPUS_PO_CLIENT: "Menghapus PO client",
  // Invoice keluar
  BUAT_INVOICE_KELUAR: "Membuat invoice keluar",
  UBAH_INVOICE_KELUAR: "Memperbarui invoice keluar",
  BAYAR_INVOICE_KELUAR: "Mencatat pembayaran invoice keluar",
  UBAH_STATUS_INVOICE: "Mengubah status invoice",
  HAPUS_INVOICE_KELUAR: "Menghapus invoice keluar",
  KONFLIK_STOK_SN_INVOICE: "Konflik stok nomor seri pada invoice",
  AUTO_SWAP_SN_INVOICE: "Penyesuaian otomatis nomor seri invoice",
  // Alias log lama
  CATAT_PEMBAYARAN: "Mencatat pembayaran",
  BATALKAN_INVOICE: "Membatalkan invoice",
  BUAT_INVOICE: "Membuat invoice",
  UPDATE_INVOICE: "Memperbarui invoice",
  HAPUS_INVOICE: "Menghapus invoice",
  // Invoice masuk
  BUAT_INVOICE_MASUK: "Membuat invoice masuk",
  UBAH_INVOICE_MASUK: "Memperbarui invoice masuk",
  HAPUS_INVOICE_MASUK: "Menghapus invoice masuk",
  BAYAR_INVOICE_MASUK: "Mencatat pembayaran invoice masuk",
  UBAH_STATUS_INVOICE_MASUK: "Mengubah status invoice masuk",
  // Pengeluaran
  BUAT_PENGELUARAN: "Membuat pengeluaran",
  UBAH_PENGELUARAN: "Memperbarui pengeluaran",
  UBAH_STATUS_PENGELUARAN: "Mengubah status pengeluaran",
  HAPUS_PENGELUARAN: "Menghapus pengeluaran",
  // Project
  BUAT_PROJECT: "Membuat project",
  UBAH_PROJECT: "Memperbarui project",
  HAPUS_PROJECT: "Menghapus project",
  UBAH_STATUS_PROJECT: "Mengubah status project",
  REASSIGN_PROJECT: "Mengalihkan project",
  TAMBAH_ANGGOTA_PROJECT: "Menambahkan anggota project",
  HAPUS_ANGGOTA_PROJECT: "Menghapus anggota project",
  TAMBAH_KEBUTUHAN_BARANG: "Menambahkan kebutuhan barang",
  UBAH_KEBUTUHAN_BARANG: "Memperbarui kebutuhan barang",
  HAPUS_KEBUTUHAN_BARANG: "Menghapus kebutuhan barang",
  SYNC_BOQ_PENAWARAN: "Menyinkronkan BOQ penawaran",
  RETUR_MATERIAL_PROYEK: "Mengembalikan material project",
  // Tugas
  BUAT_TASK: "Membuat tugas",
  UBAH_TASK: "Memperbarui tugas",
  UBAH_STATUS_TASK: "Mengubah status tugas",
  REASSIGN_TASK: "Mengalihkan tugas",
  // Permintaan barang
  BUAT_REQUEST_BARANG: "Membuat permintaan barang",
  UBAH_STATUS_REQUEST: "Mengubah status permintaan barang",
  HAPUS_REQUEST_BARANG: "Menghapus permintaan barang",
  // PO supplier
  BUAT_PO_SUPPLIER: "Membuat PO supplier",
  UBAH_STATUS_PENGIRIMAN: "Mengubah status pengiriman",
  NYATAKAN_SIAP: "Menyatakan PO siap",
  BATALKAN_PO_SUPPLIER: "Membatalkan PO supplier",
  HAPUS_PO_SUPPLIER: "Menghapus PO supplier",
  // Penerimaan barang
  BUAT_PENERIMAAN: "Membuat penerimaan barang",
  HAPUS_PENERIMAAN: "Menghapus penerimaan barang",
  TERIMA_BARANG: "Menerima barang",
  LAPOR_BARANG_BERMASALAH: "Melaporkan barang bermasalah",
  // Surat jalan
  SCAN_BARANG_SURAT_JALAN: "Memindai barang surat jalan",
  UBAH_STATUS_SURAT_JALAN: "Mengubah status surat jalan",
  HAPUS_SURAT_JALAN: "Menghapus surat jalan",
  LAPORAN_SURAT_JALAN: "Melaporkan surat jalan",
  // Laporan kunjungan & POC
  BUAT_LAPORAN_KUNJUNGAN: "Membuat laporan kunjungan",
  UPDATE_LAPORAN_KUNJUNGAN: "Memperbarui laporan kunjungan",
  UPDATE_STATUS_KUNJUNGAN: "Mengubah status laporan kunjungan",
  DELETE_VISIT_REPORT: "Menghapus laporan kunjungan",
  BUAT_LAPORAN_POC: "Membuat laporan POC",
  UPDATE_LAPORAN_POC: "Memperbarui laporan POC",
  UPDATE_STATUS_POC: "Mengubah status laporan POC",
  HAPUS_LAPORAN_POC: "Menghapus laporan POC",
  // Follow-up
  BUAT_FOLLOW_UP: "Membuat follow-up",
  UBAH_FOLLOW_UP: "Memperbarui follow-up",
  // Agenda / kalender
  BUAT_AGENDA: "Membuat agenda",
  UPDATE_AGENDA: "Memperbarui agenda",
  HAPUS_AGENDA: "Menghapus agenda",
  UPDATE_STATUS_AGENDA: "Mengubah status agenda",
  PISAH_KEJADIAN_BERULANG: "Memisahkan kejadian berulang",
  HAPUS_KEJADIAN_BERULANG: "Menghapus kejadian berulang",
  UPDATE_STATUS_KEJADIAN: "Mengubah status kejadian",
  // Dokumentasi & impor
  LAMPIRKAN_FOTO_DOKUMENTASI: "Melampirkan foto dokumentasi",
  HAPUS_FOTO_DOKUMENTASI: "Menghapus foto dokumentasi",
  IMPORT_EXCEL: "Mengimpor data Excel",
};

const ENTITY_LABELS: Record<string, string> = {
  leads: "lead",
  quotations: "penawaran",
  surveys: "survey",
  "po-client": "PO client",
  "client-po": "PO client",
  "sales-orders": "sales order",
  "sales-order": "sales order",
  invoices: "invoice",
  "invoice-out": "invoice keluar",
  "invoice-in": "invoice masuk",
  projects: "project",
  tasks: "tugas",
  "purchase-requests": "permintaan barang",
  "supplier-pos": "PO supplier",
  "supplier-po": "PO supplier",
  receiving: "penerimaan barang",
  receivings: "penerimaan barang",
  "delivery-notes": "surat jalan",
  expenses: "pengeluaran",
  "damage-reports": "laporan kerusakan",
  customers: "customer",
  suppliers: "supplier",
  warehouses: "gudang",
  products: "barang",
  users: "pengguna",
  "audit-logs": "audit log",
  "follow-ups": "follow-up",
  "poc-reports": "laporan POC",
  "visit-reports": "laporan kunjungan",
  "calendar-events": "agenda",
  calendar: "agenda",
  approvals: "persetujuan",
  files: "file",
  stock: "stok",
  serials: "nomor seri",
  movements: "pergerakan stok",
  reservations: "reservasi",
  opname: "stok opname",
  "expense-categories": "kategori pengeluaran",
  "product-categories": "kategori barang",
  "cost-centers": "pusat biaya",
};

const PAYLOAD_LABELS: Record<string, string> = {
  number: "Nomor",
  nomor: "Nomor",
  soNumber: "No. SO",
  poNumber: "No. PO",
  invoiceNumber: "No. Invoice",
  requestNumber: "No. Permintaan",
  code: "Kode",
  kode: "Kode",
  sku: "SKU",
  name: "Nama",
  nama: "Nama",
  title: "Judul",
  judul: "Judul",
  subject: "Perihal",
  perihal: "Perihal",
  customerName: "Customer",
  customer: "Customer",
  clientName: "Klien",
  supplierName: "Supplier",
  supplier: "Supplier",
  projectName: "Project",
  project: "Project",
  amount: "Nilai",
  total: "Total",
  grandTotal: "Grand Total",
  nilai: "Nilai",
  nominal: "Nominal",
  price: "Harga",
  harga: "Harga",
  cost: "Biaya",
  biaya: "Biaya",
  qty: "Qty",
  quantity: "Qty",
  date: "Tanggal",
  tanggal: "Tanggal",
  dueDate: "Jatuh tempo",
  status: "Status",
  stage: "Tahap",
  notes: "Catatan",
  catatan: "Catatan",
  description: "Keterangan",
  keterangan: "Keterangan",
  address: "Alamat",
  alamat: "Alamat",
  phone: "Telepon",
  telepon: "Telepon",
  email: "Email",
  items: "Item",
  reason: "Alasan",
  alasan: "Alasan",
  purchasePrice: "Harga beli",
  minStock: "Stok minimum",
  unit: "Satuan",
  brand: "Merk",
  discount: "Diskon",
  ppn: "PPN",
  contactName: "Kontak",
  location: "Lokasi",
  scheduleAt: "Jadwal",
  paymentTerms: "Termin pembayaran",
  otherNote: "Catatan lain",
  conditionNote: "Catatan kondisi",
  purpose: "Tujuan",
  expectedDate: "Tanggal dibutuhkan",
};

/** Field yang nilainya langsung ditampilkan tanpa label (nomor dokumen/kode). */
const BARE_VALUE_KEYS = new Set([
  "number",
  "nomor",
  "soNumber",
  "poNumber",
  "invoiceNumber",
  "requestNumber",
  "code",
  "kode",
  "sku",
]);

const PRIORITY_KEYS = [
  "number",
  "nomor",
  "soNumber",
  "poNumber",
  "invoiceNumber",
  "requestNumber",
  "code",
  "kode",
  "sku",
  "name",
  "nama",
  "title",
  "judul",
  "subject",
  "perihal",
  "customerName",
  "customer",
  "clientName",
  "supplierName",
  "supplier",
  "projectName",
  "project",
  "amount",
  "total",
  "grandTotal",
  "nilai",
  "nominal",
  "price",
  "harga",
  "status",
];

const VERB_LABELS: Record<string, string> = {
  BUAT: "Membuat",
  POST: "Menambahkan",
  TAMBAH: "Menambahkan",
  UBAH: "Memperbarui",
  PATCH: "Memperbarui",
  PUT: "Memperbarui",
  UPDATE: "Memperbarui",
  HAPUS: "Menghapus",
  DELETE: "Menghapus",
  SETUJUI: "Menyetujui",
  BATALKAN: "Membatalkan",
  KIRIM: "Mengirim",
  AJUKAN: "Mengajukan",
  REVISI: "Merevisi",
  UPLOAD: "Mengunggah",
  IMPORT: "Mengimpor",
  LAMPIRKAN: "Melampirkan",
  SYNC: "Menyinkronkan",
  RETUR: "Mengembalikan",
  SCAN: "Memindai",
  TERIMA: "Menerima",
  LAPOR: "Melaporkan",
  NYATAKAN: "Menyatakan",
  PISAH: "Memisahkan",
  REASSIGN: "Mengalihkan",
  BAYAR: "Membayar",
  ISI: "Mengisi",
  CATAT: "Mencatat",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const MONEY_KEY =
  /(amount|total|price|nilai|nominal|harga|biaya|cost|subtotal|grand|ppn|diskon|discount|tax|balance|saldo)/i;
const SKIP_KEY =
  /(^id$|Id$|_id$|^createdAt$|^updatedAt$|^deletedAt$|password|token|secret)/;

function isBlankDetail(detail: string): boolean {
  return (
    !detail || ["{}", "[]", "null", "undefined"].includes(detail.toLowerCase())
  );
}

function isJsonLike(text: string): boolean {
  return /^[[{]/.test(text.trim());
}

function parseJson(text: string): any | null {
  if (!isJsonLike(text)) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Detail di database dipotong 191 karakter, jadi JSON bisa tidak lengkap.
    return null;
  }
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return value;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

function formatValue(key: string, value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length ? `${value.length} item` : null;
  if (typeof value === "object") return null;
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "number") {
    if (MONEY_KEY.test(key)) return `Rp ${value.toLocaleString("id-ID")}`;
    return String(value);
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}(T|$| )/.test(text)) return formatDate(text);
  return text;
}

/** Ringkas objek payload menjadi "Nomor · Customer · Rp ..." tanpa membocorkan JSON mentah. */
function summarizePayload(payload: any, maxParts = 4): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload))
    return payload.length ? `${payload.length} item` : null;

  const entries = Object.entries(payload as Record<string, any>).filter(
    ([key, value]) =>
      !SKIP_KEY.test(key) &&
      value !== null &&
      value !== undefined &&
      value !== "",
  );
  const ordered = [
    ...PRIORITY_KEYS.filter((key) => key in payload).map(
      (key) => [key, payload[key]] as [string, any],
    ),
    ...entries.filter(([key]) => !PRIORITY_KEYS.includes(key)),
  ];

  const parts: string[] = [];
  const seen = new Set<string>();
  for (const [key, value] of ordered) {
    if (parts.length >= maxParts) break;
    const label = PAYLOAD_LABELS[key];
    if (!label) continue;
    const shown = formatValue(key, value);
    if (!shown || seen.has(shown)) continue;
    seen.add(shown);
    parts.push(BARE_VALUE_KEYS.has(key) ? shown : `${label}: ${shown}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function entityLabel(path: string): string | null {
  const segment = path
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^api\//, "")
    .split("/")[0];
  const clean = (segment || "").toLowerCase();
  return ENTITY_LABELS[clean] ?? null;
}

function humanizeEnum(value: string): string {
  const text = String(value).replace(/_/g, " ").trim();
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function humanizeAction(action: string): string {
  const upper = action.toUpperCase();
  if (!/^[A-Z0-9_]+$/.test(upper)) return action;
  const words = upper.split("_").filter(Boolean);
  const [firstWord, ...rest] = words;
  if (!firstWord) return action;
  const first = VERB_LABELS[firstWord] ?? humanizeEnum(firstWord);
  return [first, ...rest.map((word) => word.toLowerCase())].join(" ");
}

/** Rapikan detail teks bebas dari service (bukan JSON). */
function beautifyDetail(detail: string): string {
  let text = detail
    .replace(/\b(?:null|undefined)\b/gi, "-")
    .replace(/\s{2,}/g, " ")
    .trim();
  text = text.replace(
    /Rp\s?(\d{3,})(?![\d.,])/g,
    (_, digits: string) => `Rp ${Number(digits).toLocaleString("id-ID")}`,
  );

  // Detail berupa perpindahan status/tahap, mis. "PROSPECTING → NEGOTIATION".
  if (/^[A-Z][A-Z0-9_]*(?:\s*(?:→|->)\s*[A-Z][A-Z0-9_]*)+$/.test(text)) {
    return text
      .split(/\s*(?:→|->)\s*/)
      .map(humanizeEnum)
      .join(" → ");
  }
  return text;
}

/** Ubah detail mentah menjadi teks yang aman ditampilkan. */
function cleanDetail(detail: string): string {
  if (!detail) return "";
  const parsed = parseJson(detail);
  if (parsed) return summarizePayload(parsed) ?? "";
  // JSON terpotong / tidak valid: jangan pernah tampilkan potongan payload mentah.
  if (isJsonLike(detail)) return "";
  return beautifyDetail(detail);
}

function statusChangeText(payload: Record<string, any>): string {
  const status = humanizeEnum(String(payload.status ?? ""));
  if (!status) return "";
  const note = payload.note ?? payload.reason;
  return `Mengubah status menjadi ${status}${note ? ` (${note})` : ""}`;
}

export function formatAuditAction(
  action?: string | null,
  detail?: string | null,
): string {
  const rawAction = String(action ?? "").trim();
  const rawDetail = String(detail ?? "").trim();
  const detailText = isBlankDetail(rawDetail) ? "" : rawDetail;
  const parsed = parseJson(detailText);

  // Aksi otomatis AuditInterceptor: "POST /api/sales-orders", "DELETE /api/supplier-pos/4"
  const http = /^(POST|PUT|PATCH|DELETE)\s+(\S+)/i.exec(rawAction);
  if (http) {
    const method = String(http[1]).toUpperCase();
    const path = String(http[2]).replace(/\/+$/, "");
    const entity = entityLabel(path);

    if (method === "DELETE") {
      return entity ? `Menghapus ${entity}` : "Menghapus data";
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const isDecisionPath = /\/(decide|approve|reject)$/i.test(path);
      if (isDecisionPath && typeof parsed.approve === "boolean") {
        const reason = parsed.reason ?? parsed.note;
        return `${parsed.approve ? "Menyetujui" : "Menolak"}${reason ? `: ${reason}` : ""}`;
      }
      const isStatusPath = /\/status$/i.test(path);
      if (parsed.status && isStatusPath) return statusChangeText(parsed);
      if (method === "PATCH" || method === "PUT") {
        if (parsed.status) return statusChangeText(parsed);
        const summary = summarizePayload(parsed);
        return summary ? `Mengedit data: ${summary}` : "Mengedit data";
      }
      const summary = summarizePayload(parsed);
      const base = entity ? `Menambahkan ${entity}` : "Menambahkan data";
      return summary ? `${base}: ${summary}` : base;
    }

    if (method === "PATCH" || method === "PUT") return "Mengedit data";
    return entity ? `Menambahkan ${entity}` : "Menambahkan data";
  }

  // Detail berupa JSON walau aksinya berupa kode (mis. log lama/manual).
  const detailLabel = cleanDetail(detailText);

  const label =
    ACTION_LABELS[rawAction] ?? ACTION_LABELS[rawAction.toUpperCase()];
  if (label) return detailLabel ? `${label}: ${detailLabel}` : label;

  if (/^LAPORAN_WA_/i.test(rawAction)) {
    return detailLabel
      ? `Mencatat percakapan WhatsApp: ${detailLabel}`
      : "Mencatat percakapan WhatsApp";
  }

  if (!rawAction) {
    const summary = parsed ? summarizePayload(parsed) : null;
    if (summary) return `Menyimpan data: ${summary}`;
    return detailLabel || "Melakukan perubahan data";
  }

  // Kode aksi tak dikenal: ubah bentuk UPPER_SNAKE_CASE menjadi kalimat biasa.
  const human = humanizeAction(rawAction);
  return detailLabel ? `${human}: ${detailLabel}` : human;
}
