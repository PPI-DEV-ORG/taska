# TASKA — Enterprise ERP & CRM System

TASKA adalah sistem terpadu **Enterprise Resource Planning (ERP)** dan **Customer Relationship Management (CRM)** yang dirancang untuk industri integrasi sistem IT, kontraktor jaringan/CCTV, infrastruktur teknologi, dan pengadaan perangkat keras.

Sistem ini menghubungkan seluruh rantai operasional perusahaan: mulai dari penangkapan prospek (Leads), survey lokasi, pembuatan penawaran resmi (Quotation), Purchase Order (PO Client & Supplier), eksekusi proyek 7-tahap, manajemen stok fisik ber-Serial Number (SN), pengiriman Surat Jalan (DO), penagihan Invoice, hingga pencatatan Akuntansi & COA otomatis.

---

## DAFTAR ISI
1. [Panduan Setup & Instalasi](#1-panduan-setup--instalasi)
2. [Cara Pakai Aplikasi per Modul](#2-cara-pakai-aplikasi-per-modul)
3. [Alur Bisnis Aplikasi (End-to-End Workflows)](#3-alur-bisnis-aplikasi-end-to-end-workflows)
4. [Struktur Folder & Teknologi](#4-struktur-folder--teknologi)

---

## 1. PANDUAN SETUP & INSTALASI

### 1.1. Prasyarat Sistem
Pastikan lingkungan pengembangan Anda telah terpasang:
- **Node.js**: Versi `>= 24.0.0`
- **Package Manager**: `pnpm` (versi 9/10/11)
- **Database**: **MySQL** versi `>= 8.0` atau **MariaDB** versi `>= 10.5`
- **Git**

### 1.2. Kloning & Pemasangan Dependensi
```bash
git clone <repository-url> taska
cd taska

# Install seluruh dependensi monorepo
pnpm install
```

### 1.3. Konfigurasi Environment Variables

#### Backend (`apps/api/.env`)
Salin file konfigurasi contoh atau buat file `apps/api/.env`:
```env
# Koneksi Database Utama
DATABASE_URL="mysql://root:password@127.0.0.1:3306/taska?connection_limit=20"

# Koneksi Database Arsip (Penyimpanan transaksi > 2 tahun)
ARCHIVE_DATABASE_URL="mysql://root:password@127.0.0.1:3306/taska_archive?connection_limit=5"

# Konfigurasi Keamanan JWT
JWT_SECRET="ganti-dengan-kunci-rahasia-minimal-64-karakter-hex"
JWT_ACCESS_TTL="12h"
JWT_REFRESH_TTL="7d"

# Port Server API
PORT=3030

# Direktori Penyimpanan Berkas Upload
UPLOAD_DIR="./uploads"
```

> **Catatan Database:** Pastikan Anda telah membuat database di MySQL sebelum menjalankan migrasi:
> ```sql
> CREATE DATABASE taska CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> CREATE DATABASE taska_archive CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> ```

#### Frontend Mobile & Web (`apps/mobile/.env`)
Buat file `apps/mobile/.env`:
```env
EXPO_PUBLIC_API_URL=http://localhost:3030/api
```

### 1.4. Migrasi Database & Seeding Data Awal
Jalankan migrasi Prisma dan seed data awal (Master Akun COA, User Default, Role, dsb.):
```bash
# Generate Prisma Client & Migrate Schema
cd apps/api
pnpm db:migrate

# Jalankan Seeding Data Awal
pnpm db:seed

# Kembali ke root
cd ../..
```

### 1.5. Menjalankan Aplikasi

#### Opsi 1: Jalankan Sekaligus (Rekomendasi)
Dari root direktori project:
```bash
pnpm dev
```
Perintah ini akan menjalankan:
- **Backend API**: `http://localhost:3030`
- **Frontend Web / Expo**: `http://localhost:8081`

#### Opsi 2: Jalankan Secara Terpisah
- **Jalankan Backend:**
  ```bash
  cd apps/api
  pnpm start:dev
  ```
- **Jalankan Frontend (Expo Web/Mobile):**
  ```bash
  cd apps/mobile
  pnpm web      # Untuk membuka di Browser Web
  # atau
  pnpm android  # Untuk emulator / device Android
  ```

### 1.6. Akun Login Bawaan (Seed Default)
Gunakan kredensial berikut untuk login pertama kali:
- **Super Admin**: `superadmin@taska.co.id` | Password: `taska123`
- **Admin**: `admin@taska.co.id` | Password: `taska123`
- **Direksi / BOS**: `hendra@taska.co.id` | Password: `taska123`

---

## 2. CARA PAKAI APLIKASI PER MODUL

### 2.1. Matriks Peran Pengguna (Role-Based Access Control)
Sistem membatasi akses setiap fitur sesuai peran kerja:
- **SUPER_ADMIN & ADMIN**: Kontrol penuh master data, manajemen akun pengguna, gudang, dan audit log.
- **BOS / DIREKSI**: Hak approval tertinggi untuk transaksi komersial dan pencairan dana di atas Rp 10.000.000.
- **SALES**: Pengelolaan prospek (Leads), follow-up pelanggan, dan penyusunan penawaran (Quotation).
- **PROJECT MANAGER (PM)**: Perencanaan & pemantauan 7-tahap proyek, evaluasi teknis BOQ, kontrol progres proyek, dan pelaporan BAST.
- **TEKNISI / SE**: Penerimaan tugas lapangan, pengisian hasil survey, eksekusi instalasi fisik/software, dan upload dokumentasi.
- **PROCUREMENT**: Pembuatan Request Barang (PR), pengelolaan vendor/supplier, perbandingan harga modal, dan penerbitan PO Supplier.
- **FINANCE**: Approval diskon/margin penawaran, penagihan invoice, approval klaim biaya operasional, dan monitoring buku besar COA & Laba Rugi.
- **GUDANG**: Penerimaan fisik (Receiving), pencatatan nomor seri unik (SN FIFO), stok opname, dan pengeluaran barang via Surat Jalan (DO).

---

### 2.2. Panduan Penggunaan Modul Utama

#### A. CRM & Leads (Prospek)
1. **Catat Prospek Baru:** Buka menu **Leads**, klik **Buat Lead**. Masukkan data PIC pelanggan, perusahaan, kebutuhan pengadaan, dan estimasi nilai transaksi.
2. **Kelola Pipeline:** Geser atau ubah status prospek melalui tahap: `Prospecting` $\rightarrow$ `Qualification` $\rightarrow$ `Proposal` $\rightarrow$ `Negotiation` $\rightarrow$ `Won` / `Lost`.
3. **Konversi Cepat:** Dari detail Lead yang berstatus *Won*, klik **Jadikan Project** untuk membuka proyek baru tanpa input ulang.

#### B. Survey Lapangan
1. **Jadwalkan Survey:** Klik **Buat Survey**, tentukan lead/proyek terkait, teknisi pelaksana, dan waktu kunjungan.
2. **Catat Hasil Survey:** Teknisi mengunggah foto lokasi, denah, dan catatan kendala teknis.
3. **Cetak PDF:** Gunakan tombol **Cetak Hasil Survey** untuk menghasilkan laporan resmi sebagai dasar penyusunan BOQ.

#### C. Penawaran Harga (Quotations)
1. **Penyusunan Item:**
   - **Barang Master (SN):** Pilih barang dari katalog master. Sistem dapat menetapkan nomor SN otomatis via metode FIFO.
   - **Barang Non-SN / Curah:** Untuk material seperti kabel atau pipa.
   - **Jasa:** Untuk biaya instalasi, testing, atau konfigurasi (tidak memotong stok fisik).
2. **Kalkulasi Pajak & Diskon:** Tentukan diskon (persen atau nominal), jenis PPN (Include, Exclude, atau Non-PPN), dan PPh (23/Final).
3. **Template Excel:** Tersedia tombol **Download Template Penawaran (.xlsx)** dan **Upload Excel** untuk input puluhan barang sekaligus secara otomatis.
4. **Approval Penawaran:** Penawaran di atas Rp 10.000.000 otomatis meminta persetujuan Finance dan Direksi sebelum diterbitkan.

#### D. PO Client (Sales Order / SO)
1. Saat penawaran disepakati klien, catat nomor PO Client resmi pelanggan dan lampirkan dokumen kontrak/SPK.
2. PO Client menjadi dasar komersial resmi untuk penerbitan Invoice Uang Muka (DP) dan penguncian komitmen barang.

#### E. Manajemen Proyek (Alur Terpadu 7 Tahap)
Buka menu **Projects**, pilih proyek untuk masuk ke ruang kerja terpadu:
1. **Tahap 1: BOQ (Bill of Quantities)**
   - *BOQ Kontrak Awal (Terkunci/Read-Only):* Terhubung langsung dari penawaran resmi untuk menjaga integritas kontrak.
   - *Barang & Jasa Tambahan (Fleksibel):* Catat kebutuhan darurat lapangan yang timbul selama eksekusi.
   - *Auto-PR:* Tombol untuk langsung membuat pengajuan pembelian jika stok fisik gudang kurang dari kebutuhan BOQ.
2. **Tahap 2: Survey Lokasi:** Akses cepat ke data survey dan denah kerja.
3. **Tahap 3: Penawaran Terkait:** Riwayat versi penawaran komersial yang berlaku.
4. **Tahap 4: PO Project:** Monitoring PO dari klien dan PO pengadaan ke supplier.
5. **Tahap 5: Progress Lapangan:** Input persentase progres aktual secara manual oleh Project Manager.
6. **Tahap 6: Invoice Project:** Akses penerbitan tagihan termin/pelunasan (khusus Finance & Manajemen).
7. **Tahap 7: BAST (Berita Acara Serah Terima):** Cetak dokumen BAST resmi setelah pekerjaan selesai 100%.

#### F. Pengadaan Barang (Purchase Request & PO Supplier)
1. **Request Barang (PR):**
   - Pilih jenis pengadaan: `Kebutuhan Project`, `Stok Gudang`, atau `Operasional Lainnya`.
   - Pilih opsi pembayaran: **Kas / Tunai (Ritel)** atau **Tempo / Kredit ke Supplier**.
   - Tambah barang dari master katalog atau gunakan opsi **Barang Non-Master (Beli Ritel / Manual)**.
2. **Approval Finansial:** Finance memeriksa nominal. Jika tunai, Finance mengunggah bukti transfer kas kecil.
3. **Penerbitan PO Supplier:** Procurement menerbitkan PO resmi ke supplier terpilih. Tersedia tag pencarian jenis barang pada supplier dan status perpajakan (PKP / Non-PKP).

#### G. Gudang, Stok & Penerimaan (Receiving)
1. **Penerimaan Barang (Receiving):** Saat barang dari supplier tiba, bagian Gudang memeriksa fisik, mencocokkan PO, dan meregistrasikan Serial Number (SN) tiap unit ke dalam sistem.
2. **Katalog Master & Serial Unit:** Pantau riwayat perpindahan tiap unit (Lokasi Gudang, Status Terpasang, Rusak, atau Retur).
3. **Stok Opname:** Audit berkala untuk mencocokkan stok buku dengan fisik lapangan.

#### H. Pengiriman Barang (Surat Jalan / Delivery Order)
1. **Buat Surat Jalan:** Pilih tujuan pengiriman, proyek terkait, atau Sales Order (SO).
2. **Scan & Input Barang:** Scan barcode Serial Number atau pilih barang yang dibawa tim teknisi.
3. **Kirim Barang:** Klik **Simpan & Kirim Barang (Dikirim)**. Sistem langsung memotong stok gudang dan mencatat pengeluaran barang di pembukuan COA.
4. **Tanda Terima:** Setelah serah terima di lokasi klien, unggah scan DO bertanda tangan dan foto penerima untuk mengubah status menjadi **Diterima**.

#### I. Invoice, Kwitansi & Akuntansi (COA)
1. **Penerbitan Invoice:** Buat tagihan DP, Termin, atau Pelunasan. Sistem menghitung DPP, PPN 11%, dan PPh secara presisi.
2. **Pencatatan Pembayaran:** Input pembayaran yang diterima klien (Transfer Bank atau Tunai). Sistem otomatis mencatat pelunasan piutang dan menerbitkan **Kwitansi Resmi**.
3. **Ekspor CSV e-Faktur Pajak:** Ekspor data invoice langsung ke skema impor aplikasi e-Faktur DJP.
4. **Buku Besar & COA:** Sistem otomatis memposting jurnal akuntansi tanpa input manual (Piutang, Kas/Bank, Hutang Usaha, Persediaan 1200, dan Beban Pokok HPP 5101/5102).
5. **Laba Rugi Proyek (P&L):** Analisa laba bersih proyek secara real-time berdasarkan realisasi tagihan invoice dikurangi biaya pengadaan material, Surat Jalan, dan operasional reimburse.

---

## 3. ALUR BISNIS APLIKASI (END-TO-END WORKFLOWS)

### 3.1. Alur Utama Proyek (Lead-to-Cash)

```
[Leads / Prospek Masuk]
         │
         ▼
[Survey Lokasi Lapangan] (Opsional)
         │
         ▼
[Penyusunan Penawaran / Quotation] ──(Approval Finance & Bos)──> [Kirim ke Pelanggan]
         │
         ▼
[Penerimaan PO Client / Sales Order]
         │
         ├─────────────────────────────────────────┐
         ▼                                         ▼
[Inisialisasi Project (7 Tahap)]          [Invoice Uang Muka (DP)]
         │                                         │
         ▼                                         ▼
[Alokasi Material / Auto-PR ke Gudang]     [Pembayaran Diterima (Kwitansi)]
         │
         ▼
[Surat Jalan (DO) & Pengiriman Barang] ──(Potong Stok & Jurnal HPP)
         │
         ▼
[Eksekusi Instalasi & Progress Task]
         │
         ▼
[Invoice Pelunasan / Termin] ──> [Pembayaran Lunas]
         │
         ▼
[Penerbitan Dokumen BAST & Tutup Proyek]
```

### 3.2. Alur Pengadaan Barang (Procurement Flow)
1. **Pengajuan (PR):** PM atau Teknisi mengajukan Purchase Request untuk material proyek yang belum tersedia di gudang.
2. **Persetujuan:** Diverifikasi oleh Finance dan BOS (jika > Rp 10 jt).
3. **Pembelian:**
   - *Jalur Kredit:* Procurement membuat PO Supplier resmi $\rightarrow$ Vendor mengirim barang.
   - *Jalur Tunai / Kasir Ritel:* Finance mencairkan dana kas kecil $\rightarrow$ Tim membeli langsung di toko ritel.
4. **Penerimaan di Gudang (Receiving):** Gudang memeriksa kondisi fisik, mencatat nomor seri (SN), dan barang resmi masuk ke kartu stok inventory.

### 3.3. Alur Pengiriman Barang Keluar (Surat Jalan Flow)
1. Admin Gudang membuat Surat Jalan dengan menautkan ke Project / Sales Order.
2. Gudang melakukan scan barcode SN dari fisik barang.
3. Petugas mengklik tombol **Simpan & Kirim Barang**.
4. Status surat jalan berubah menjadi **Dikirim**, unit barang terpotong dari gudang, dan sistem otomatis menjurnal **Debit 5101 (HPP Proyek) / Kredit 1200 (Persediaan Gudang)**.
5. Tim tiba di lokasi klien, meminta tanda tangan penerima, lalu mengunggah foto bukti serah terima $\rightarrow$ Status berubah menjadi **Diterima**.

---

## 4. STRUKTUR FOLDER & TEKNOLOGI

```
taska/
├── apps/
│   ├── api/                    # Backend NestJS (REST API, Prisma ORM, Websockets)
│   │   ├── prisma/             # Schema database Prisma & script seeding
│   │   ├── src/
│   │   │   ├── auth/           # Otentikasi JWT & Role Guards
│   │   │   ├── crm/            # Modul Leads, Follow-up, Customers
│   │   │   ├── projects/       # Modul Project, Tasks, BOQ
│   │   │   ├── procurement/    # Modul PR, PO Supplier, Vendor
│   │   │   ├── stock/          # Modul Inventory, Serial Number FIFO, Opname
│   │   │   ├── delivery/       # Modul Surat Jalan & Serah Terima
│   │   │   ├── finance/        # Modul Invoices, Payments, Kwitansi, e-Faktur
│   │   │   └── reports/        # Export PDF, Excel, & Analisa P&L
│   │   └── uploads/            # Direktori penyimpanan berkas fisik
│   │
│   └── mobile/                 # Frontend React Native / Expo (Web & Mobile UI)
│       ├── src/
│       │   ├── app/            # File-based routing (Expo Router)
│       │   ├── components/     # UI Component library (Radix/Primitives + NativeWind)
│       │   ├── modules/        # Komponen modular per domain bisnis
│       │   ├── lib/            # Accounting engine, kalkulasi pajak, formatters
│       │   └── store/          # Global application state
│
├── packages/                   # Paket pendukung bersama (config, types)
├── package.json                # Root pnpm scripts & dependencies
├── turbo.json                  # Turborepo task pipeline configuration
└── README.md                   # Dokumentasi panduan sistem
```

---

## 5. BANTUAN & PENGEMBANGAN
Untuk pertanyaan teknis, kendala bug, atau permohonan fitur baru:
- Periksa audit log aktivitas di menu **Pengaturan $\rightarrow$ Audit Log**.
- Pastikan hak akses user sesuai dengan matriks RBAC.
- Laporkan tiket permasalahan ke tim pengembang internal dengan menyertakan tangkapan layar dan pesan error sistem.
