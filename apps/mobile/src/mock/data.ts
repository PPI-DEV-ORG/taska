import { daysFromNow as d, hoursAgo } from "@/lib/format";

export type Role =
  | "admin"
  | "bos"
  | "sales"
  | "pm"
  | "teknisi"
  | "procurement"
  | "finance"
  | "gudang"
  | "se";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin / Bos",
  bos: "Admin / Bos",
  sales: "Sales",
  pm: "Project Manager",
  teknisi: "Teknisi",
  procurement: "Procurement",
  finance: "Finance",
  gudang: "Gudang",
  se: "Software Engineer",
};

export type Row = { id: string; [k: string]: any };
export type User = Row & { name: string; role: Role; email: string };

function rows(keys: string[], data: any[][]): Row[] {
  return data.map((t) => {
    const o: any = {};
    keys.forEach((k, i) => (o[k] = t[i]));
    return o as Row;
  });
}

export const USERS: User[] = [
  { id: "U-01", name: "Hendra Wijaya", role: "bos", email: "hendra@taska.co.id", status: "Aktif", gudang: "-" },
  { id: "U-02", name: "Dewi Lestari", role: "sales", email: "dewi@taska.co.id", status: "Aktif", gudang: "-" },
  { id: "U-03", name: "Budi Santoso", role: "pm", email: "budi@taska.co.id", status: "Aktif", gudang: "-" },
  { id: "U-04", name: "Agus Prasetyo", role: "teknisi", email: "agus@taska.co.id", status: "Aktif", gudang: "-" },
  { id: "U-05", name: "Rina Marlina", role: "procurement", email: "rina@taska.co.id", status: "Aktif", gudang: "-" },
  { id: "U-06", name: "Siti Rahayu", role: "finance", email: "siti@taska.co.id", status: "Aktif", gudang: "-" },
  { id: "U-07", name: "Eko Saputra", role: "gudang", email: "eko@taska.co.id", status: "Aktif", gudang: "Gudang Pusat Jakarta" },
  { id: "U-08", name: "Andi Kurniawan", role: "se", email: "andi@taska.co.id", status: "Aktif", gudang: "-" },
].map((u) => ({ ...u, role: u.role as Role }));

export const WAREHOUSES = rows(
  ["id", "nama", "kota", "staf", "status"],
  [
    ["W-01", "Gudang Pusat Jakarta", "Jakarta", "Eko Saputra", "Aktif"],
    ["W-02", "Gudang Bekasi", "Bekasi", "Eko Saputra", "Aktif"],
    ["W-03", "Gudang Surabaya", "Surabaya", "Belum ditugaskan", "Aktif"],
  ],
);

export const CUSTOMERS = rows(
  ["id", "nama", "kota", "kontak", "email", "telepon", "catatan", "status"],
  [
    ["C-01", "PT Nusantara Jaya", "Jakarta", "Bambang Hartono", "bambang@nusantarajaya.co.id", "0812-3456-7801", "Customer korporat utama untuk CCTV & sistem jaringan", "Aktif"],
    ["C-02", "CV Karya Mandiri", "Bekasi", "Lina Susanti", "lina@karyamandiri.com", "0813-2200-1145", "Kebutuhan rutin maintenance dan switch LAN", "Aktif"],
    ["C-03", "PT Bumi Sentosa", "Surabaya", "Hadi Gunawan", "hadi@bumisentosa.id", "0857-7788-9012", "Proyek smart office & server mini", "Aktif"],
    ["C-04", "PT Sinar Medan Teknik", "Medan", "Rudi Siregar", "rudi@sinarmedan.com", "0821-6000-3321", "Pengiriman via ekspedisi laut / kargo", "Aktif"],
    ["C-05", "RS Harapan Sehat", "Jakarta", "dr. Maya Putri", "maya.putri@rsharapansehat.org", "0811-9988-2210", "SOP instalasi steril dan nurse call", "Aktif"],
    ["C-06", "Hotel Grand Mahkota", "Surabaya", "Tommy Wibowo", "tommy@grandmahkota.com", "0878-1200-4455", "Sistem door lock kartu RFID Mifare", "Aktif"],
    ["C-07", "Sekolah Global Cendekia", "Bekasi", "Ibu Ratna", "ratna@cendekia.sch.id", "0856-3300-7781", "WiFi kampus & fingerprint presensi guru", "Aktif"],
    ["C-08", "PT Logistik Prima", "Jakarta", "Yusuf Ramadhan", "yusuf@logistikprima.co.id", "0819-4410-9902", "CCTV gudang 24 jam & sistem gate portal", "Aktif"],
  ],
);

export const SUPPLIERS = rows(
  ["id", "nama", "kota", "payment", "status"],
  [
    ["S-01", "PT Hikvision Distribusi Indonesia", "Jakarta", "Net 30", "Aktif"],
    ["S-02", "CV Kabel Nusantara", "Bekasi", "Net 14", "Aktif"],
    ["S-03", "PT Ubiquiti Mitra Network", "Jakarta", "Net 30", "Aktif"],
    ["S-04", "UD Sinar Teknik Surabaya", "Surabaya", "Tunai", "Aktif"],
  ],
);

export const LEAD_SOURCES = ["Sosial media", "Website", "Cold call", "Referral", "Event", "Distributor", "Lainnya"];
export const LOST_REASONS = [
  "Belum ada follow-up",
  "Client tidak ada kabar",
  "Sales atau PM lupa",
  "Harga tidak cocok",
  "Dibatalkan client",
  "Kalah spesifikasi kompetitor",
  "Lainnya",
];
export const EXPENSE_CATEGORIES = [
  "Makan & Minum",
  "Bensin & Tol",
  "Transportasi & Taksi",
  "Akomodasi & Penginapan",
  "Perlengkapan Lapangan",
  "Material / Beli Langsung",
  "Parkir & Operasional",
  "Lainnya",
];
export const COST_CENTERS = [
  "CC-PROJECT (Beban Project Klien)",
  "CC-SALES (Beban Pemasaran & Penjualan)",
  "CC-OPS (Operasional Kantor & IT)",
  "CC-GUDANG (Logistik & Inventori)",
  "CC-MGMT (Manajemen & Legal)",
];
export const LEAD_STAGES = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Won", "Lost"];

export const LEADS = rows(
  ["id", "nama", "perusahaan", "sumber", "nilai", "peluang", "closing", "pemilik", "status", "sepi", "tipe", "kontak", "alasanLost"],
  [
    ["L-001", "CCTV & NVR Gedung A", "PT Nusantara Jaya", "Referral", 185000000, 70, d(21), "Dewi Lestari", "Negotiation", 2, "Partner", "Bambang Hartono", ""],
    ["L-002", "Jaringan WiFi Kampus", "Sekolah Global Cendekia", "Website", 96500000, 50, d(30), "Dewi Lestari", "Proposal", 5, "End user", "Ibu Ratna", ""],
    ["L-003", "Server Rack Mini Data Center", "PT Bumi Sentosa", "Event", 320000000, 40, d(45), "Dewi Lestari", "Qualification", 9, "End user", "Hadi Gunawan", ""],
    ["L-004", "Access Control Hotel", "Hotel Grand Mahkota", "Referral", 142000000, 100, d(-5), "Hendra Wijaya", "Won", 1, "End user", "Tommy Wibowo", ""],
    ["L-005", "Cabling Gudang Logistik", "PT Logistik Prima", "Cold call", 58000000, 30, d(40), "Dewi Lestari", "Prospecting", 12, "End user", "Yusuf Ramadhan", ""],
    ["L-006", "Nurse Call Rumah Sakit", "RS Harapan Sehat", "Distributor", 275000000, 60, d(35), "Dewi Lestari", "Proposal", 3, "Partner", "dr. Maya Putri", ""],
    ["L-007", "CCTV Pabrik Medan", "PT Sinar Medan Teknik", "Sosial media", 118000000, 0, d(-3), "Dewi Lestari", "Lost", 20, "End user", "Rudi Siregar", "Client tidak ada kabar"],
    ["L-008", "Maintenance Jaringan Tahunan", "CV Karya Mandiri", "Referral", 36000000, 100, d(-9), "Dewi Lestari", "Won", 4, "End user", "Lina Susanti", ""],
    ["L-009", "Videotron Lobby", "PT Nusantara Jaya", "Event", 210000000, 35, d(50), "Dewi Lestari", "Qualification", 4, "Partner", "Bambang Hartono", ""],
    ["L-010", "Internet Dedicated Cabang", "CV Karya Mandiri", "Website", 24000000, 25, d(25), "Dewi Lestari", "Prospecting", 1, "End user", "Lina Susanti", ""],
    ["L-011", "Intercom Apartemen", "PT Bumi Sentosa", "Distributor", 164000000, 55, d(28), "Dewi Lestari", "Negotiation", 6, "Partner", "Hadi Gunawan", ""],
    ["L-012", "Fingerprint Sekolah", "Sekolah Global Cendekia", "Cold call", 28500000, 0, d(-10), "Dewi Lestari", "Lost", 31, "End user", "Ibu Ratna", "Belum ada follow-up"],
    ["L-013", "UPS Rumah Sakit", "RS Harapan Sehat", "Referral", 88000000, 65, d(18), "Dewi Lestari", "Proposal", 2, "End user", "dr. Maya Putri", ""],
    ["L-014", "Sistem Parkir Mal", "PT Logistik Prima", "Sosial media", 395000000, 45, d(60), "Dewi Lestari", "Qualification", 8, "Partner", "Yusuf Ramadhan", ""],
    ["L-015", "CCTV Ruko Bekasi", "CV Karya Mandiri", "Sosial media", 32000000, 75, d(10), "Dewi Lestari", "Negotiation", 0, "End user", "Lina Susanti", ""],
  ],
);

export const QUOTATIONS = rows(
  ["id", "nomor", "lead", "customer", "nilai", "total", "ppn", "disc", "totalAfterDisc", "status", "versi", "berlaku", "pemilik", "dibuat", "fileUploaded"],
  [
    ["Q-001", "PNW/2026/10/001", "CCTV & NVR Gedung A", "PT Nusantara Jaya", 185000000, 185000000, 20350000, 5000000, 200350000, "Menunggu persetujuan", 2, d(14), "Dewi Lestari", d(-2), true],
    ["Q-002", "PNW/2026/10/002", "Jaringan WiFi Kampus", "Sekolah Global Cendekia", 96500000, 96500000, 10615000, 0, 107115000, "Draft", 1, d(21), "Dewi Lestari", d(-1), true],
    ["Q-003", "PNW/2026/09/014", "Access Control Hotel", "Hotel Grand Mahkota", 142000000, 142000000, 15620000, 0, 157620000, "Disetujui", 3, d(5), "Hendra Wijaya", d(-30), true],
    ["Q-004", "PNW/2026/09/011", "Nurse Call Rumah Sakit", "RS Harapan Sehat", 275000000, 275000000, 30250000, 10000000, 295250000, "Terkirim", 1, d(3), "Dewi Lestari", d(-14), true],
    ["Q-005", "PNW/2026/08/020", "CCTV Pabrik Medan", "PT Sinar Medan Teknik", 118000000, 118000000, 12980000, 0, 130980000, "Kedaluwarsa", 1, d(-12), "Dewi Lestari", d(-45), true],
    ["Q-006", "PNW/2026/10/003", "Intercom Apartemen", "PT Bumi Sentosa", 164000000, 164000000, 18040000, 4000000, 178040000, "Revisi", 2, d(10), "Dewi Lestari", d(-6), true],
    ["Q-007", "PNW/2026/09/016", "Maintenance Jaringan Tahunan", "CV Karya Mandiri", 36000000, 36000000, 3960000, 0, 39960000, "Disetujui", 1, d(-3), "Dewi Lestari", d(-25), true],
    ["Q-008", "PNW/2026/09/018", "Fingerprint Sekolah", "Sekolah Global Cendekia", 28500000, 28500000, 3135000, 0, 31635000, "Ditolak", 1, d(-8), "Dewi Lestari", d(-28), true],
    ["Q-009", "PNW/2026/10/004", "Server Rack Mini Data Center", "PT Bumi Sentosa", 320000000, 320000000, 35200000, 0, 355200000, "Not Yet", 1, d(14), "Dewi Lestari", d(0), false],
    ["Q-010", "PNW/2026/10/005", "Videotron Lobby", "PT Nusantara Jaya", 210000000, 210000000, 23100000, 0, 233100000, "Not Yet", 1, d(14), "Dewi Lestari", d(0), false],
  ],
);

export const SURVEYS = rows(
  ["id", "lead", "customer", "lokasi", "jadwal", "tim", "status", "biaya"],
  [
    ["SV-001", "CCTV & NVR Gedung A", "PT Nusantara Jaya", "Jl. Sudirman No. 45, Jakarta", d(1), "Budi Santoso + Agus Prasetyo", "Dijadwalkan", 0],
    ["SV-002", "Jaringan WiFi Kampus", "Sekolah Global Cendekia", "Jl. Ahmad Yani, Bekasi", d(0), "Agus Prasetyo", "Berjalan", 185000],
    ["SV-003", "Nurse Call Rumah Sakit", "RS Harapan Sehat", "Jl. Kebon Jeruk, Jakarta", d(-6), "Budi Santoso + Agus Prasetyo", "Selesai", 320000],
    ["SV-004", "Server Rack Mini Data Center", "PT Bumi Sentosa", "Rungkut Industri, Surabaya", d(4), "Andi Kurniawan", "Diminta", 0],
    ["SV-005", "Sistem Parkir Mal", "PT Logistik Prima", "Jl. Gatot Subroto, Jakarta", d(6), "Andi Kurniawan + Agus Prasetyo", "Diminta", 0],
    ["SV-006", "Intercom Apartemen", "PT Bumi Sentosa", "Gubeng, Surabaya", d(-12), "Agus Prasetyo", "Selesai", 540000],
  ],
);

export const PO_CLIENT = rows(
  ["id", "nomor", "customer", "penawaran", "nilai", "tanggal", "status", "totalInvoice"],
  [
    ["PO-C01", "PO/HGM/2026/044", "Hotel Grand Mahkota", "PNW/2026/09/014", 142000000, d(-5), "Diterima", 142000000],
    ["PO-C02", "PO-KM-0925", "CV Karya Mandiri", "PNW/2026/09/016", 36000000, d(-9), "Diterima", 36000000],
    ["PO-C03", "4500112233", "PT Nusantara Jaya", "PNW/2025/12/030", 410000000, d(-90), "Diterima", 430000000],
    ["PO-C04", "RSHS/PO/2026/17", "RS Harapan Sehat", "PNW/2026/03/008", 225000000, d(-120), "Diterima", 225000000],
    ["PO-C05", "BS-PO-0826", "PT Bumi Sentosa", "PNW/2026/06/019", 98000000, d(-60), "Diterima", 98000000],
  ],
);

export const INVOICES = rows(
  ["id", "nomor", "po", "customer", "jenis", "nilai", "ppn", "total", "terbayar", "jatuhTempo", "status", "tanggal"],
  [
    ["INV-001", "INV/2026/10/021", "PO/HGM/2026/044", "Hotel Grand Mahkota", "DP 50%", 71000000, 7810000, 78810000, 78810000, d(-2), "Lunas", d(-5)],
    ["INV-002", "INV/2026/10/022", "PO-KM-0925", "CV Karya Mandiri", "Pelunasan", 36000000, 3960000, 39960000, 20000000, d(7), "Dibayar sebagian", d(-8)],
    ["INV-003", "INV/2026/07/009", "4500112233", "PT Nusantara Jaya", "Termin 1", 205000000, 22550000, 227550000, 0, d(-45), "Terlambat", d(-75)],
    ["INV-004", "INV/2026/07/010", "4500112233", "PT Nusantara Jaya", "Termin 2", 205000000, 22550000, 227550000, 100000000, d(-20), "Terlambat", d(-50)],
    ["INV-005", "INV/2026/04/003", "RSHS/PO/2026/17", "RS Harapan Sehat", "Pelunasan", 225000000, 24750000, 249750000, 249750000, d(-90), "Lunas", d(-110)],
    ["INV-006", "INV/2026/08/013", "BS-PO-0826", "PT Bumi Sentosa", "DP 35%", 34300000, 3773000, 38073000, 0, d(6), "Terkirim", d(-8)],
    ["INV-007", "INV/2026/10/023", "PO/HGM/2026/044", "Hotel Grand Mahkota", "Termin 2", 71000000, 7810000, 78810000, 0, d(25), "Belum dikirim", d(0)],
    ["INV-008", "INV/2026/08/015", "BS-PO-0826", "PT Bumi Sentosa", "Pelunasan", 63700000, 7007000, 70707000, 0, d(15), "Belum dikirim", d(-1)],
  ],
);

export const PROJECTS = rows(
  ["id", "nama", "jenis", "customer", "pm", "tim", "progres", "pembayaran", "status", "mulai", "selesai", "barang"],
  [
    ["P-001", "Access Control Hotel Grand Mahkota", "Customer", "Hotel Grand Mahkota", "Budi Santoso", "Agus Prasetyo, Andi Kurniawan", 45, "Belum lunas", "Berjalan", d(-4), d(35), "Dipesan"],
    ["P-002", "Maintenance Jaringan CV Karya Mandiri", "Maintenance", "CV Karya Mandiri", "Budi Santoso", "Agus Prasetyo", 20, "Belum lunas", "Berjalan", d(-8), d(350), "Di gudang"],
    ["P-003", "Instalasi CCTV Nusantara Tower", "Customer", "PT Nusantara Jaya", "Budi Santoso", "Agus Prasetyo", 80, "Belum lunas", "Terlambat", d(-100), d(-7), "Dikirim"],
    ["P-004", "Nurse Call RS Harapan Sehat", "Customer", "RS Harapan Sehat", "Budi Santoso", "Agus Prasetyo, Andi Kurniawan", 100, "Lunas", "Selesai", d(-130), d(-25), "Di gudang"],
    ["P-005", "Aplikasi Inventori Internal", "Internal", "-", "Budi Santoso", "Andi Kurniawan", 35, "Lunas", "Berjalan", d(-30), d(60), "Diminta"],
    ["P-006", "Smart Gate Produk R&D", "Product/R&D", "-", "Budi Santoso", "Andi Kurniawan, Agus Prasetyo", 60, "Lunas", "Berjalan", d(-45), d(40), "Dipesan"],
  ],
);

export const TASKS = rows(
  ["id", "project", "parent", "nama", "pic", "tenggat", "status", "perluBarang"],
  [
    ["T-01", "P-001", "", "Survey ulang lokasi", "Agus Prasetyo", d(-2), "DONE", false],
    ["T-02", "P-001", "", "Instalasi access controller", "Agus Prasetyo", d(5), "IN PROGRESS", true],
    ["T-03", "P-001", "T-02", "Tarik kabel lantai 1-3", "Agus Prasetyo", d(3), "IN PROGRESS", true],
    ["T-04", "P-001", "T-02", "Pasang reader pintu kamar", "Agus Prasetyo", d(9), "TODO", true],
    ["T-05", "P-001", "", "Integrasi software tamu", "Andi Kurniawan", d(14), "TODO", false],
    ["T-06", "P-003", "", "Kalibrasi 32 kamera", "Agus Prasetyo", d(-3), "BLOCKED", false],
    ["T-07", "P-005", "", "Rancang modul stok", "Andi Kurniawan", d(2), "IN PROGRESS", false],
    ["T-08", "P-005", "", "Uji coba scan SN", "Andi Kurniawan", d(-1), "TODO", false],
    ["T-09", "P-006", "", "Firmware smart gate v2", "Andi Kurniawan", d(8), "IN PROGRESS", false],
    ["T-10", "P-002", "", "Cek berkala switch lantai 2", "Agus Prasetyo", d(0), "TODO", false],
  ],
);

export const PRODUCTS = rows(
  ["id", "sku", "nama", "satuan", "berSN", "garansi", "min", "hargaBeli", "kategori"],
  [
    ["PR-01", "CAM-DS2CD-4MP", "Kamera IP Dome 4MP Hikvision", "pcs", true, "24 bln", 5, 1450000, "CCTV"],
    ["PR-02", "CAM-DS2CD-8MP", "Kamera IP Bullet 8MP Hikvision", "pcs", true, "24 bln", 5, 2350000, "CCTV"],
    ["PR-03", "NVR-32CH", "NVR 32 Channel", "pcs", true, "24 bln", 2, 8900000, "CCTV"],
    ["PR-04", "NVR-16CH", "NVR 16 Channel", "pcs", true, "24 bln", 2, 4900000, "CCTV"],
    ["PR-05", "HDD-4TB-SV", "Harddisk Surveillance 4TB", "pcs", true, "12 bln", 4, 1750000, "CCTV"],
    ["PR-06", "SW-POE-24", "Switch PoE 24 Port", "pcs", true, "36 bln", 2, 6200000, "Jaringan"],
    ["PR-07", "AP-UNIFI-6", "Access Point UniFi 6 Lite", "pcs", true, "12 bln", 6, 1850000, "Jaringan"],
    ["PR-08", "RTR-ER-X", "Router EdgeRouter X", "pcs", true, "12 bln", 2, 1250000, "Jaringan"],
    ["PR-09", "ACC-CTRL-4D", "Access Controller 4 Pintu", "pcs", true, "24 bln", 2, 3100000, "Access Control"],
    ["PR-10", "ACC-RDR-FP", "Reader Fingerprint", "pcs", true, "12 bln", 6, 1350000, "Access Control"],
    ["PR-11", "UPS-1KVA", "UPS 1 KVA", "pcs", true, "12 bln", 2, 2100000, "Power"],
    ["PR-12", "SRV-RACK-42U", "Rack Server 42U", "pcs", false, "12 bln", 1, 9800000, "Server"],
    ["PR-13", "CBL-UTP-C6", "Kabel LAN UTP Cat6 (per meter)", "meter", false, "-", 500, 6500, "Kabel"],
    ["PR-14", "CBL-PWR-2C", "Kabel Power 2x1,5 mm (per meter)", "meter", false, "-", 300, 9500, "Kabel"],
    ["PR-15", "CON-RJ45", "Konektor RJ45 (box 100)", "box", false, "-", 10, 85000, "Aksesori"],
    ["PR-16", "CBL-PLASTIK", "Cable Duct 2 cm (batang)", "pcs", false, "-", 100, 18000, "Aksesori"],
    ["PR-17", "BRK-CAM", "Bracket Kamera", "pcs", false, "-", 40, 24000, "Aksesori"],
    ["PR-18", "ROLL-FO-4C", "Kabel Fiber Optic 4 Core (roll)", "roll", false, "-", 3, 2750000, "Kabel"],
    ["PR-19", "PWR-12V-5A", "Adaptor 12V 5A", "pcs", false, "6 bln", 20, 55000, "Aksesori"],
    ["PR-20", "SCR-MNT-BOX", "Box Panel Outdoor", "pcs", false, "-", 8, 185000, "Aksesori"],
  ],
);

/** Stok per gudang: [W-01, W-02, W-03] */
export const STOCK_QTY: Record<string, [number, number, number]> = {
  "PR-01": [12, 6, 3], "PR-02": [8, 4, 0], "PR-03": [3, 1, 1], "PR-04": [2, 2, 0], "PR-05": [9, 3, 2],
  "PR-06": [4, 1, 0], "PR-07": [14, 6, 4], "PR-08": [3, 0, 1], "PR-09": [2, 1, 0], "PR-10": [4, 2, 0],
  "PR-11": [2, 1, 1], "PR-12": [1, 0, 0], "PR-13": [1850, 600, 300], "PR-14": [420, 180, 0], "PR-15": [14, 6, 2],
  "PR-16": [160, 60, 20], "PR-17": [85, 40, 12], "PR-18": [5, 2, 0], "PR-19": [32, 18, 6], "PR-20": [9, 4, 2],
};

const snProducts = ["PR-01", "PR-02", "PR-03", "PR-06", "PR-07", "PR-09", "PR-10"];
const snStatus = ["Di gudang", "Di gudang", "Reserved", "Dikirim", "Terpasang", "Di gudang"];
export const SERIALS: Row[] = snProducts.flatMap((pid, i) =>
  Array.from({ length: 5 }, (_, j) => ({
    id: `SN-${i}${j}`,
    sn: `${pid.replace("PR-", "SN")}${String(2600 + i * 37 + j * 11)}X${j}`,
    produk: PRODUCTS.find((p) => p.id === pid)!.nama,
    status: snStatus[(i + j) % snStatus.length] ?? "Di gudang",
    gudang: WAREHOUSES[(i + j) % 3]?.nama ?? "Gudang Pusat Jakarta",
    project: snStatus[(i + j) % snStatus.length] === "Di gudang" ? "-" : (PROJECTS[(i + j) % 3]?.nama ?? "-"),
    garansi: d(300 + j * 20),
  })),
);

export const MOVEMENTS = rows(
  ["id", "tanggal", "jenis", "kategori", "produk", "qty", "gudang", "project"],
  [
    ["M-01", d(0), "Masuk", "Penerimaan supplier", "Switch PoE 24 Port", 2, "Gudang Pusat Jakarta", "-"],
    ["M-02", d(-1), "Keluar", "Keluar ke project", "Kamera IP Dome 4MP Hikvision", 8, "Gudang Pusat Jakarta", "Access Control Hotel Grand Mahkota"],
    ["M-03", d(-1), "Transfer", "Transfer antar gudang", "Kabel LAN UTP Cat6 (per meter)", 300, "Gudang Bekasi", "-"],
    ["M-04", d(-2), "Masuk", "Retur dari project", "Access Controller 4 Pintu", 1, "Gudang Pusat Jakarta", "Nurse Call RS Harapan Sehat"],
    ["M-05", d(-3), "Keluar", "Keluar ke project", "NVR 32 Channel", 1, "Gudang Pusat Jakarta", "Instalasi CCTV Nusantara Tower"],
    ["M-06", d(-4), "Masuk", "Penerimaan supplier", "Kabel LAN UTP Cat6 (per meter)", 1000, "Gudang Pusat Jakarta", "-"],
    ["M-07", d(-5), "Keluar", "Penggantian unit", "Kamera IP Bullet 8MP Hikvision", 1, "Gudang Bekasi", "Instalasi CCTV Nusantara Tower"],
    ["M-08", d(-6), "Masuk", "Penyesuaian opname", "Konektor RJ45 (box 100)", 2, "Gudang Surabaya", "-"],
    ["M-09", d(-7), "Keluar", "Barang terpakai langsung", "Box Panel Outdoor", 2, "Gudang Pusat Jakarta", "Maintenance Jaringan CV Karya Mandiri"],
    ["M-10", d(-8), "Transfer", "Transfer antar gudang", "Access Point UniFi 6 Lite", 4, "Gudang Surabaya", "-"],
  ],
);

export const RESERVATIONS = rows(
  ["id", "project", "produk", "qty"],
  [
    ["R-01", "Access Control Hotel Grand Mahkota", "Access Controller 4 Pintu", 2],
    ["R-02", "Access Control Hotel Grand Mahkota", "Reader Fingerprint", 4],
    ["R-03", "Maintenance Jaringan CV Karya Mandiri", "Switch PoE 24 Port", 1],
    ["R-04", "Smart Gate Produk R&D", "Router EdgeRouter X", 2],
  ],
);

export const PURCHASE_REQUESTS = rows(
  ["id", "nomor", "tanggal", "project", "jenisBiaya", "pemohon", "item", "estimasi", "status", "tujuan"],
  [
    ["RB-001", "RB/2026/10/011", d(0), "Access Control Hotel Grand Mahkota", "Project", "Budi Santoso", "Reader Fingerprint x 6", 8100000, "Diajukan", "Kekurangan stok untuk lantai 4-6"],
    ["RB-002", "RB/2026/10/010", d(-1), "Instalasi CCTV Nusantara Tower", "Project", "Budi Santoso", "Kamera IP Dome 4MP x 10", 14500000, "Cek stok", "Tambahan titik kamera"],
    ["RB-003", "RB/2026/10/008", d(-3), "-", "Stok", "Eko Saputra", "Kabel LAN UTP Cat6 x 2000 m", 13000000, "Disetujui", "Stok gudang menipis"],
    ["RB-004", "RB/2026/10/006", d(-5), "Smart Gate Produk R&D", "Project", "Budi Santoso", "Router EdgeRouter X x 2", 2500000, "PO dibuat", "Prototipe gate"],
    ["RB-005", "RB/2026/09/031", d(-9), "Maintenance Jaringan CV Karya Mandiri", "Project", "Budi Santoso", "Switch PoE 24 Port x 1", 6200000, "Dikirim", "Ganti switch rusak"],
    ["RB-006", "RB/2026/09/029", d(-12), "-", "Internal", "Siti Rahayu", "Adaptor 12V 5A x 20", 1100000, "Diterima", "Perlengkapan kantor"],
    ["RB-007", "RB/2026/09/025", d(-15), "Nurse Call RS Harapan Sehat", "Project", "Budi Santoso", "Access Controller 4 Pintu x 4", 12400000, "Diterima", "Pintu ruang obat"],
  ],
);

export const SUPPLIER_POS = rows(
  ["id", "nomor", "supplier", "tanggal", "eta", "total", "persetujuan", "pengiriman", "status", "item"],
  [
    ["SP-001", "PO/2026/10/017", "CV Kabel Nusantara", d(-2), d(2), 13000000, "Disetujui", "Dikirim", "Dikirim", "Kabel LAN UTP Cat6 x 2000 m"],
    ["SP-002", "PO/2026/10/016", "PT Ubiquiti Mitra Network", d(-5), d(1), 2500000, "Disetujui", "Di Supplier", "Di Supplier", "Router EdgeRouter X x 2"],
    ["SP-003", "PO/2026/09/031", "PT Hikvision Distribusi Indonesia", d(-9), d(-3), 6200000, "Disetujui", "Di Supplier", "Terlambat", "Switch PoE 24 Port x 1"],
    ["SP-004", "PO/2026/10/018", "PT Hikvision Distribusi Indonesia", d(0), d(10), 145000000, "Menunggu persetujuan", "Di Supplier", "Menunggu persetujuan", "Kamera IP Bullet 8MP x 40, NVR 32CH x 3"],
    ["SP-005", "PO/2026/09/025", "PT Hikvision Distribusi Indonesia", d(-15), d(-8), 12400000, "Disetujui", "Sampai", "Sampai", "Access Controller 4 Pintu x 4"],
    ["SP-006", "PO/2026/09/020", "UD Sinar Teknik Surabaya", d(-20), d(-12), 1100000, "Disetujui", "Sampai", "Sampai", "Adaptor 12V 5A x 20"],
  ],
);

export const RECEIVING = rows(
  ["id", "nomor", "po", "supplier", "tanggal", "penerima", "status", "item"],
  [
    ["RC-001", "TB/2026/10/004", "PO/2026/09/031", "PT Hikvision Distribusi Indonesia", d(0), "Eko Saputra", "Menunggu penerimaan", "Switch PoE 24 Port x 1"],
    ["RC-002", "TB/2026/10/003", "PO/2026/10/017", "CV Kabel Nusantara", d(-1), "Eko Saputra", "Diterima sebagian", "Kabel LAN UTP Cat6 1000 dari 2000 m"],
    ["RC-003", "TB/2026/09/019", "PO/2026/09/025", "PT Hikvision Distribusi Indonesia", d(-8), "Eko Saputra", "Diterima", "Access Controller 4 Pintu x 4"],
    ["RC-004", "TB/2026/09/012", "PO/2026/09/020", "UD Sinar Teknik Surabaya", d(-12), "Eko Saputra", "Diterima", "Adaptor 12V 5A x 20"],
  ],
);

export const DAMAGE_REPORTS = rows(
  ["id", "tanggal", "produk", "jenis", "po", "pelapor", "status", "keterangan"],
  [
    ["DR-001", d(-2), "Reader Fingerprint", "Rusak", "PO/2026/09/025", "Eko Saputra", "Diproses", "Layar mati sejak dibuka dari kardus"],
    ["DR-002", d(-8), "Kamera IP Dome 4MP", "Salah barang", "PO/2026/09/012", "Eko Saputra", "Selesai", "Dikirim tipe 2MP, dipesan 4MP"],
    ["DR-003", d(-1), "Kabel LAN UTP Cat6", "Kurang", "PO/2026/10/017", "Eko Saputra", "Dilaporkan", "Kurang 2 roll dari surat jalan supplier"],
  ],
);

export const OPNAME = rows(
  ["id", "tanggal", "gudang", "petugas", "selisih", "status"],
  [
    ["OP-001", d(-3), "Gudang Bekasi", "Eko Saputra", -3, "Menunggu persetujuan"],
    ["OP-002", d(-30), "Gudang Pusat Jakarta", "Eko Saputra", 0, "Disetujui"],
    ["OP-003", d(-35), "Gudang Surabaya", "Eko Saputra", 2, "Disetujui"],
  ],
);

export const DELIVERY_NOTES = rows(
  ["id", "nomor", "tanggal", "tujuan", "alasan", "project", "pembuat", "barang", "status", "persetujuan"],
  [
    ["SJ-001", "SJ/2026/10/031", d(0), "Hotel Grand Mahkota, Surabaya", "Instalasi reader lantai 3", "Access Control Hotel Grand Mahkota", "Agus Prasetyo", "Reader Fingerprint x 4", "Pending", "Menunggu persetujuan"],
    ["SJ-002", "SJ/2026/10/030", d(-1), "PT Nusantara Jaya, Jakarta", "Kalibrasi kamera", "Instalasi CCTV Nusantara Tower", "Agus Prasetyo", "-", "Dikirim", "Disetujui"],
    ["SJ-003", "SJ/2026/10/029", d(-2), "RS Harapan Sehat, Jakarta", "Survey ulang ruang obat", "Nurse Call RS Harapan Sehat", "Budi Santoso", "-", "Diterima", "Disetujui"],
    ["SJ-004", "SJ/2026/10/028", d(-3), "CV Karya Mandiri, Bekasi", "Ganti switch lantai 2", "Maintenance Jaringan CV Karya Mandiri", "Agus Prasetyo", "Switch PoE 24 Port x 1", "Diterima", "Disetujui"],
    ["SJ-005", "SJ/2026/10/027", d(-4), "PT Bumi Sentosa, Surabaya", "Meeting teknis penawaran", "-", "Dewi Lestari", "-", "Diterima", "Disetujui"],
    ["SJ-006", "SJ/2026/10/026", d(-5), "Gudang Bekasi", "Transfer kabel antar gudang", "-", "Eko Saputra", "Kabel LAN UTP Cat6 x 300 m", "Dikirim", "Disetujui"],
    ["SJ-007", "SJ/2026/10/025", d(-6), "Sekolah Global Cendekia, Bekasi", "Survey area WiFi", "-", "Agus Prasetyo", "-", "Diterima", "Disetujui"],
    ["SJ-008", "SJ/2026/10/024", d(-8), "PT Logistik Prima, Jakarta", "Antar contoh kamera", "-", "Dewi Lestari", "Kamera IP Dome 4MP x 1", "Dibatalkan", "Disetujui"],
    ["SJ-009", "SJ/2026/10/023", d(-9), "Hotel Grand Mahkota, Surabaya", "Pasang access controller", "Access Control Hotel Grand Mahkota", "Andi Kurniawan", "Access Controller 4 Pintu x 2", "Diterima", "Disetujui"],
    ["SJ-010", "SJ/2026/10/022", d(-10), "RS Harapan Sehat, Jakarta", "Meeting progres", "Nurse Call RS Harapan Sehat", "Budi Santoso", "-", "Diterima", "Disetujui"],
  ],
);

export const EXPENSES = rows(
  ["id", "tanggal", "pelapor", "kategori", "nominal", "project", "alasan", "status"],
  [
    ["EX-001", d(0), "Agus Prasetyo", "Bensin", 150000, "Access Control Hotel Grand Mahkota", "Ke lokasi Surabaya", "Dilaporkan"],
    ["EX-002", d(-1), "Agus Prasetyo", "Makan", 85000, "Instalasi CCTV Nusantara Tower", "Makan siang di lokasi", "Dilaporkan"],
    ["EX-003", d(-2), "Budi Santoso", "Transport", 420000, "Nurse Call RS Harapan Sehat", "Taksi online ke RS", "Disetujui"],
    ["EX-004", d(-3), "Andi Kurniawan", "Perlengkapan", 12500000, "Smart Gate Produk R&D", "Beli modul sensor", "Dilaporkan"],
    ["EX-005", d(-4), "Dewi Lestari", "Transport", 275000, "-", "Meeting client Surabaya", "Dibayar"],
    ["EX-006", d(-5), "Agus Prasetyo", "Bensin", 200000, "Maintenance Jaringan CV Karya Mandiri", "Ke Bekasi", "Dibayar"],
    ["EX-007", d(-6), "Eko Saputra", "Parkir & tol", 98000, "-", "Antar barang transfer gudang", "Disetujui"],
    ["EX-008", d(-7), "Budi Santoso", "Makan", 310000, "Instalasi CCTV Nusantara Tower", "Rapat dengan klien", "Ditolak"],
    ["EX-009", d(-8), "Agus Prasetyo", "Perlengkapan", 640000, "Instalasi CCTV Nusantara Tower", "Beli konektor dan isolasi", "Dibayar"],
    ["EX-010", d(-9), "Rina Marlina", "Transport", 130000, "-", "Ambil barang di supplier", "Dibayar"],
    ["EX-011", d(-10), "Andi Kurniawan", "Makan", 72000, "Aplikasi Inventori Internal", "Lembur", "Disetujui"],
    ["EX-012", d(-11), "Agus Prasetyo", "Penginapan", 850000, "Access Control Hotel Grand Mahkota", "Menginap 1 malam di Surabaya", "Dibayar"],
  ],
);

export const AUDIT_LOG = rows(
  ["id", "waktu", "pengguna", "aksi", "jenis", "refId"],
  [
    ["AL-01", hoursAgo(0.5), "Dewi Lestari", "Mengubah status ke Negotiation", "Lead", "L-001"],
    ["AL-02", hoursAgo(1), "Budi Santoso", "Membuat request barang", "Request barang", "RB-001"],
    ["AL-03", hoursAgo(2), "Siti Rahayu", "Menyetujui pengeluaran", "Pengeluaran", "EX-003"],
    ["AL-04", hoursAgo(3), "Eko Saputra", "Menerima barang sebagian", "Penerimaan", "RC-002"],
    ["AL-05", hoursAgo(5), "Rina Marlina", "Mengubah pengiriman ke Dikirim", "PO supplier", "SP-001"],
    ["AL-06", hoursAgo(7), "Agus Prasetyo", "Membuat surat jalan", "Surat jalan", "SJ-001"],
    ["AL-07", hoursAgo(20), "Hendra Wijaya", "Memindahkan lead ke Dewi Lestari", "Lead", "L-014"],
    ["AL-08", hoursAgo(26), "Siti Rahayu", "Mengubah status ke Lunas", "Invoice", "INV-001"],
    ["AL-09", hoursAgo(30), "Dewi Lestari", "Menandai Lost: Client tidak ada kabar", "Lead", "L-007"],
    ["AL-10", hoursAgo(48), "Eko Saputra", "Mengajukan opname Gudang Bekasi", "Opname", "OP-001"],
    ["AL-11", hoursAgo(50), "Budi Santoso", "Membuat project", "Project", "P-001"],
    ["AL-12", hoursAgo(72), "Siti Rahayu", "Mencatat pembayaran Rp 20.000.000", "Invoice", "INV-002"],
    ["AL-13", hoursAgo(80), "Hendra Wijaya", "Menambah akun pengguna", "Pengguna", "U-08"],
    ["AL-14", hoursAgo(96), "Eko Saputra", "Mengganti unit pengganti SN rusak", "Stok", "SN-12"],
    ["AL-15", hoursAgo(120), "Rina Marlina", "Membuat PO supplier", "PO supplier", "SP-002"],
  ],
);

export type Approval = {
  id: string;
  jenis: string;
  judul: string;
  pengaju: string;
  nilai: number;
  jam: number;
  module: string;
  refId: string;
  status: "Menunggu" | "Disetujui" | "Ditolak";
  alasan?: string;
};

export const APPROVALS: Approval[] = [
  { id: "AP-01", jenis: "Penawaran", judul: "Penawaran CCTV & NVR Gedung A (v2)", pengaju: "Dewi Lestari", nilai: 185000000, jam: 20, module: "quotations", refId: "Q-001", status: "Menunggu" },
  { id: "AP-02", jenis: "PO supplier", judul: "PO Kamera & NVR PT Hikvision", pengaju: "Rina Marlina", nilai: 145000000, jam: 6, module: "supplier-pos", refId: "SP-004", status: "Menunggu" },
  { id: "AP-03", jenis: "Pengeluaran", judul: "Beli modul sensor Smart Gate", pengaju: "Andi Kurniawan", nilai: 12500000, jam: 52, module: "expenses", refId: "EX-004", status: "Menunggu" },
  { id: "AP-04", jenis: "Opname", judul: "Penyesuaian opname Gudang Bekasi", pengaju: "Eko Saputra", nilai: 4250000, jam: 70, module: "opname", refId: "OP-001", status: "Menunggu" },
  { id: "AP-05", jenis: "Request barang", judul: "Reader Fingerprint x 6 untuk Hotel Grand Mahkota", pengaju: "Budi Santoso", nilai: 8100000, jam: 3, module: "purchase-requests", refId: "RB-001", status: "Menunggu" },
  { id: "AP-06", jenis: "Surat jalan", judul: "Surat jalan instalasi reader lantai 3", pengaju: "Agus Prasetyo", nilai: 0, jam: 5, module: "delivery-notes", refId: "SJ-001", status: "Menunggu" },
  { id: "AP-07", jenis: "Pengeluaran", judul: "Bensin ke lokasi Surabaya", pengaju: "Agus Prasetyo", nilai: 150000, jam: 2, module: "expenses", refId: "EX-001", status: "Menunggu" },
];

export type Notif = {
  id: string;
  jenis: "approval" | "stok" | "pengiriman" | "lead" | "tugas" | "surat";
  teks: string;
  waktu: string;
  baca: boolean;
  href: string;
  roles: Role[] | "all";
};

export const NOTIFS: Notif[] = [
  { id: "N-01", jenis: "approval", teks: "Request barang Project Hotel Grand Mahkota menunggu persetujuan Anda", waktu: hoursAgo(3), baca: false, href: "/approvals", roles: ["bos", "finance"] },
  { id: "N-02", jenis: "approval", teks: "PO Kamera & NVR Rp 145.000.000 menunggu persetujuan Anda", waktu: hoursAgo(6), baca: false, href: "/approvals", roles: ["bos", "finance"] },
  { id: "N-03", jenis: "pengiriman", teks: "Kabel LAN dari CV Kabel Nusantara sedang dikirim", waktu: hoursAgo(5), baca: false, href: "/supplier-pos/SP-001", roles: ["procurement", "gudang", "pm", "bos"] },
  { id: "N-04", jenis: "lead", teks: "Lead Server Rack Mini Data Center belum ditindaklanjuti 9 hari", waktu: hoursAgo(8), baca: false, href: "/leads/L-003", roles: ["sales", "bos"] },
  { id: "N-05", jenis: "tugas", teks: "Tugas Instalasi access controller jatuh tempo 5 hari lagi", waktu: hoursAgo(10), baca: false, href: "/projects/P-001", roles: ["teknisi", "se", "pm"] },
  { id: "N-06", jenis: "stok", teks: "Stok Kabel LAN UTP Cat6 di bawah minimum", waktu: hoursAgo(27), baca: true, href: "/stock", roles: ["gudang", "procurement", "bos"] },
  { id: "N-07", jenis: "surat", teks: "Surat jalan SJ/2026/10/030 sudah dikirim", waktu: hoursAgo(30), baca: true, href: "/delivery-notes/SJ-002", roles: "all" },
  { id: "N-08", jenis: "approval", teks: "Pengeluaran Anda Rp 420.000 disetujui Finance", waktu: hoursAgo(50), baca: true, href: "/expenses/EX-003", roles: ["pm", "teknisi", "se", "sales", "gudang", "procurement"] },
];
