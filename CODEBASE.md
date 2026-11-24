# CODEBASE.md — Peta Struktur Kode Akuntra ERP

Dokumen ini adalah peta arsitektur untuk AI agent agar tahu lokasi file, pola yang dipakai, dan batasan teknis sebelum mengubah kode. Selalu ikuti aturan keras di `AGENTS.md`.

---

## 1. Struktur Monorepo

```
taska/
├── apps/
│   ├── api/                  # Backend NestJS 12 + Prisma 7 (MariaDB/MySQL) + Socket.IO + Baileys WA
│   └── mobile/               # Frontend Expo 58 (React Native + Web) + Expo Router + NativeWind v4
├── packages/
│   ├── eslint-config/        # Konfigurasi ESLint bersama (base, expo, next, react-internal)
│   └── typescript-config/    # Konfigurasi TS bersama (base, expo, nextjs, react-library)
├── e2e/                      # Playwright E2E tests (config di playwright.config.ts)
├── scripts/                  # Skrip utilitas monorepo
├── .npmrc                    # WAJIB: node-linker=hoisted (untuk kompatibilitas Metro/Expo di pnpm)
├── package.json              # Root scripts: dev, build, build:app (APK), lint, check-types, test:e2e
├── pnpm-workspace.yaml       # Workspace: apps/*, packages/*
└── turbo.json                # Pipeline Turborepo
```

---

## 2. Backend (`apps/api`)

### Titik Masuk & Konfigurasi
- `src/main.ts` — bootstrap NestJS, prefix API, CORS, ValidationPipe.
- `src/app.module.ts` — registrasi seluruh modul bisnis & global guards/providers.
- `src/generated/` — hasil generate Prisma Client (jangan edit manual).
- `prisma/schema.prisma` — skema DB utama; perubahan **wajib** lewat `prisma/migrations/` + `prisma migrate deploy` + `prisma generate`.
- `prisma/archive/` — skema DB arsip terpisah.
- `prisma/seed.ts` — seed data awal (jangan jalankan `db:fresh`/`db:reset` pada DB nyata).

### Infrastruktur & Utilitas Bersama (`src/common/`, `src/prisma/`, `src/rbac/`)
- `src/prisma/` — `PrismaService` & koneksi DB utama/arsip.
- `src/common/decimal.ts` — helper aritmetika uang/desimal (jangan pakai float mentah).
- `src/common/pdf.ts` — generator PDF berbasis `pdfmake`.
- `src/common/decorators/`, `guards/`, `filters/`, `interceptors/`, `dto/`, `utils/` — decorator user/role, JWT & RBAC guards, exception filters, timezone WIB (`UTC+7`).
- `src/auth/` — autentikasi JWT & Passport.
- `src/rbac/` — definisi permission & pembatasan role di layer API.
- `src/audit/` — pencatatan audit log (panggil **setelah** `$transaction` commit).
- `src/notifications/` — notifikasi in-app & realtime Socket.IO (panggil **setelah** `$transaction` commit).
- `src/whatsapp/` — integrasi WhatsApp via `@whiskeysockets/baileys` (notifikasi personal & grup).
- `src/document-number/` — generator nomor dokumen otomatis per prefix/periode.

### Peta Modul Bisnis (`apps/api/src/*`)
| Folder | Tanggung Jawab |
|---|---|
| `accounting/` | COA, `AccountMapping`, periode akuntansi, dan **`PostingService`** (satu-satunya tempat membuat/membalik jurnal). |
| `approvals/` | Alur persetujuan dokumen lintas modul. |
| `calendar/` | Agenda & jadwal kegiatan + reminder WA. |
| `contracts/` | Manajemen kontrak vendor/pelanggan, versi dokumen, SLA, reminder masa berlaku. |
| `crm/` | Lead, follow-up, quotation, sales order, survey. |
| `dashboard/` | Agregasi KPI, agenda hari ini, ringkasan proyek/keuangan. |
| `delivery/` | Surat jalan (delivery note) & pengiriman (shipments). |
| `documentation/` | Foto dokumentasi & bukti PDF kegiatan lapangan. |
| `drive/` | **Dokumen Umum** (folder virtual di DB + file fisik di active storage provider di bawah `general-drive/YYYY/MM/`). Hapus folder/file menghapus DB & file fisik permanen. |
| `file-management/` | **Manajemen File ERP** (`FileProviderService` untuk `LOCAL`, `WEBDAV`, `NAS_MOUNT`, `S3`; migrasi & audit file). Hapus file lepas menghapus fisik di semua storage provider. |
| `finance/` | Faktur masuk/keluar, pembayaran, kas/bank, kasbon (cash advance), pengeluaran (expenses). |
| `fixed-assets/` | Aset tetap & penyusutan. |
| `hr/` | Karyawan, absensi (kamera live + GPS + geofencing), rekap absensi WA. |
| `imports/` | Import data massal (Excel). |
| `maintenance/` | Laporan maintenance & jadwal perawatan. |
| `master/` | Master data (pelanggan, supplier, produk/jasa, gudang, kategori, deal type). |
| `poc/` | Laporan POC / demo teknis. |
| `procurement/` | Purchase Request (PR), Supplier PO, penerimaan barang (receiving). |
| `projects/` | Proyek berjalan, progres, tugas terkait proyek. |
| `reports/` | Laporan keuangan (Laba Rugi, Neraca, Arus Kas, Jurnal) & rekap operasional. |
| `settings/` | Pengaturan perusahaan, integrasi, preferensi sistem. |
| `stock/` | Stok multi-gudang, serial number (SN), transfer, penggantian, stok opname. |
| `subscriptions/` | Langganan/berkala (subscriptions) & tagihan berulang. |
| `upload/` | Endpoint upload file dasar & penyajian file. |
| `users/` | Manajemen user & assignment role. |
| `visits/` | Laporan kunjungan (visit) lapangan. |

### Aturan Kritis Backend
1. **Akuntansi:** dilarang `journalEntry.create` / `journalLine.create` di luar `src/accounting/posting.service.ts`. Jangan hardcode kode akun; baca dari `AccountMapping`.
2. **Transaksi:** mutasi dokumen + posting jurnal wajib dalam satu `prisma.$transaction`. Notifikasi, WA, dan audit dijalankan setelah transaksi commit.
3. **Storage:** upload baru selalu lewat `FileProviderService` (`src/file-management/`), bukan `fs.writeFile` mentah ke `uploads/`.
4. **Keamanan Data:** filter kolom sensitif (harga beli/HPP/margin) di API berdasarkan role, bukan hanya disembunyikan di UI.

---

## 3. Frontend (`apps/mobile`)

Satu codebase Expo React Native untuk **Web** dan **Android/iOS**.

### Struktur Folder (`apps/mobile/src/`)
```
src/
├── app/                      # Expo Router (file-based routing)
│   ├── _layout.tsx           # Root layout (theme, providers, auth gate)
│   ├── login.tsx             # Halaman login
│   ├── index.tsx             # Redirect entry
│   └── (app)/                # Semua halaman setelah login (wrapped AppShell)
│       ├── _layout.tsx       # Shell layout (sidebar web / bottom tabs mobile)
│       ├── [module]/         # Dynamic fallback route untuk modul berbasis metadata
│       └── *.tsx / <dir>/    # Route khusus tiap modul (dashboard, hr, contracts, general-files, dll.)
├── modules/                  # Implementasi UI & logic per modul bisnis (30 folder)
│   ├── shared/               # Panel bersama: documentation-photos-panel, follow-up-panel, sales-chain-panel, line
│   └── <nama-modul>/         # Screen list/detail/form spesifik modul
├── screens/                  # Template screen generik (module-index, module-list, module-detail, module-extras)
├── components/
│   ├── ui/                   # Primitif UI bergaya shadcn/RN Primitives (button, card, dialog, tabs, select, dll.)
│   └── akuntra/              # Komponen domain ERP siap pakai (app-shell, data-table, status-badge, file-uploader, camera-capture-modal, document-viewer, product-select, supplier-select, flow-tracker, toast, dll.)
├── constants/
│   ├── modules.ts            # Daftar definisi modul, navigasi, icon, dan label
│   └── role-matrix.ts        # Matriks visibilitas menu/aksi per role (pendamping RBAC API)
├── services/
│   ├── api.ts                # HTTP client ke API (`EXPO_PUBLIC_API_URL`) + auth header
│   ├── adapters.ts & adapters/ # Mapping payload API <-> view model UI
│   ├── socket.ts             # Koneksi Socket.IO realtime
│   └── notify.ts             # Helper notifikasi lokal/push
├── store/
│   └── app-store.tsx         # Global state (session user, theme, preferensi, cache ringan)
├── hooks/
│   └── use-breakpoint.ts     # Deteksi ukuran layar responsif (mobile vs tablet vs desktop)
├── lib/                      # Utilitas murni (format rupiah/tanggal, flow status, efaktur, simple-pdf, labels, utils)
├── tokens/                   # Design tokens (warna, spacing)
└── utils/                    # Utilitas perangkat (gps-location.ts)
```

### Aturan Kritis Frontend
1. **Pakai komponen yang sudah ada:** gunakan `src/components/ui/*` dan `src/components/akuntra/*` sebelum membuat komponen baru.
2. **Mobile-first & Web-compatible:**
   - Setiap bar aksi/tombol, tab, dan filter wajib mendukung layar sempit (`flex-wrap`, `ScrollView horizontal` dengan indikator/padding aman, atau layout bertumpuk di mobile menggunakan `use-breakpoint.ts`). Hindari overflow horizontal yang memotong tombol/teks.
   - Jangan memakai API khusus DOM (`window`, `document`) tanpa guard `Platform.OS === "web"`.
   - Patuhi aturan ESLint React 19 (tidak mutasi ref di render, dependency hooks bersih).
3. **Konfigurasi Build & Babel (JANGAN UBAH SEMBARANGAN):**
   - `apps/mobile/babel.config.js` menggunakan `["babel-preset-expo", { jsxImportSource: "nativewind" }]` + plugin langsung `require("react-native-css-interop/dist/babel-plugin").default`. **Jangan** mengembalikan preset `"nativewind/babel"` karena membutuhkan `@babel/plugin-transform-react-jsx` yang tidak ada di Expo 58 dan akan menggagalkan EAS Android Gradle build.
   - `apps/mobile/metro.config.js` mengonfigurasi monorepo `watchFolders`, `nodeModulesPaths`, dan `blockList` (mengabaikan `apps/api`, `ERP_FILE`, `.turbo`).
   - `apps/mobile/app.json` & `apps/mobile/eas.json` sudah dikonfigurasi untuk build `.apk` (`package: id.co.ghinamultiprima.akuntra`, script `pnpm run build:app`).

---

## 4. Aturan Penamaan (Naming Conventions)

| Elemen | Konvensi | Contoh Benar |
|---|---|---|
| Folder (API & Mobile) | `kebab-case` | `fixed-assets/`, `file-management/`, `delivery-note/` |
| File TypeScript / React | `kebab-case` | `contract-form-dialog.tsx`, `drive-access.service.ts` |
| File NestJS | `<fitur>.{module,controller,service,rules,util,calc}.ts` & `dto.ts` | `contracts.service.ts`, `payroll.calc.ts`, `dto.ts` |
| File Unit Test | `<nama-file>.spec.ts` (sebelah file aslinya) | `drive.service.spec.ts`, `payroll.calc.spec.ts` |
| Class / Komponen React / Type | `PascalCase` | `ContractsService`, `ContractFormDialog`, `RequestUser` |
| Hook React | File `use-<nama>.ts`, fungsi `use<Nama>` | `use-breakpoint.ts` → `useBreakpoint` |
| Konstanta / Enum value | `UPPER_SNAKE_CASE` | `SUPER_ADMIN`, `PERMANENT_DELETE`, `NAS_MOUNT` |
| Prisma Model | `PascalCase` singular | `model DriveFolder`, `model PurchaseRequest` |
| Prisma Tabel & Kolom DB | `@@map("snake_case_plural")`, field `camelCase` | `@@map("drive_folders")` |
| Folder Migrasi Prisma | `YYYYMMDDHHMMSS_<deskripsi_snake_case>/migration.sql` | `20261124094500_attendance_photo_gps/migration.sql` |
| Route Expo Router | `kebab-case`, dinamis `[id].tsx` | `src/app/(app)/contracts/index.tsx`, `[id].tsx` |
| Endpoint REST API | `kebab-case` plural | `/api/purchase-requests`, `/api/file-management` |

---

## 5. Kalau Buat Apa, Taruh di Mana?

### Backend (`apps/api`)
| Mau membuat... | Taruh di... |
|---|---|
| Modul domain baru | `apps/api/src/<nama-modul>/` (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto.ts`) lalu daftarkan di `apps/api/src/app.module.ts` |
| Validasi input request | `apps/api/src/<modul>/dto.ts` (pakai `class-validator`, pesan error bahasa Indonesia) |
| Aturan bisnis murni / kalkulasi (mudah di-unit-test) | `apps/api/src/<modul>/<modul>.rules.ts` atau `<nama>.calc.ts` |
| Perubahan tabel / kolom DB | Edit `apps/api/prisma/schema.prisma` + buat file SQL di `apps/api/prisma/migrations/<timestamp>_<nama>/migration.sql` |
| Helper lintas modul (guard, decorator, timezone WIB, decimal, PDF) | `apps/api/src/common/<kategori>/` |
| Posting / pembalikan jurnal akuntansi | **Hanya** lewat `PostingService` di `apps/api/src/accounting/posting.service.ts` |
| Unit test backend | `apps/api/src/<modul>/<nama>.spec.ts` |

### Frontend (`apps/mobile`)
| Mau membuat... | Taruh di... |
|---|---|
| Halaman / URL baru | File tipis di `apps/mobile/src/app/(app)/<modul>.tsx` (atau `<modul>/index.tsx` & `[id].tsx`) yang hanya merender screen dari `src/modules/` |
| Screen, dialog, form, utils, types spesifik satu modul | `apps/mobile/src/modules/<modul>/` (`<modul>-screen.tsx`, `<entitas>-form-dialog.tsx`, `types.ts`, `<entitas>-utils.ts`) |
| Panel bisnis yang dipakai di 2+ modul (misal foto dokumentasi, follow-up) | `apps/mobile/src/modules/shared/<nama>-panel.tsx` |
| Komponen bisnis ERP lintas modul (table, uploader, picker, badge) | `apps/mobile/src/components/akuntra/<nama>.tsx` |
| Primitif UI dasar (button, dialog, tabs, input, select) | `apps/mobile/src/components/ui/<nama>.tsx` |
| Registrasi menu navigasi & hak akses UI per role | `apps/mobile/src/constants/modules.ts` & `apps/mobile/src/constants/role-matrix.ts` |
| Fungsi panggil API & mapping data | `apps/mobile/src/services/api.ts` & `apps/mobile/src/services/adapters/` |
| Utilitas murni (format Rupiah/tanggal, status flow, PDF) | `apps/mobile/src/lib/<nama>.ts` |
| Custom hook lintas modul | `apps/mobile/src/hooks/use-<nama>.ts` |

---

## 6. Kalau Buat Apa, Harus Gimana? (Playbook Wajib)

1. **Buat Endpoint API Baru:**
   - Pasang guard autentikasi & RBAC di controller; jangan andalkan penyembunyian tombol di UI.
   - Validasi body/query di `dto.ts` dengan pesan error bahasa Indonesia yang jelas.
   - Untuk role non-berhak, strip field sensitif (harga beli, HPP, harga perolehan, margin) di service sebelum return response.
2. **Buat / Ubah Tabel Database:**
   - Ubah `prisma/schema.prisma`, buat file migrasi SQL di `apps/api/prisma/migrations/`, lalu jalankan `prisma migrate deploy` dan `prisma generate`.
   - **Dilarang** `prisma db push`, `db:fresh`, `db:reset`, atau `DROP TABLE` yang menghapus data.
3. **Buat Transaksi Dokumen + Jurnal Akuntansi:**
   - Bungkus perubahan dokumen dan pemanggilan `PostingService` dalam **satu** `prisma.$transaction`.
   - Jangan tulis kode akun literal di service; baca dari `AccountMapping`.
   - Jangan hapus jurnal; gunakan `reverse` / `repost`. Hormati status periode `CLOSED` (tolak dengan HTTP 409).
   - Jalankan notifikasi, kirim WhatsApp, dan audit log **setelah** `$transaction` commit.
4. **Buat Fitur Upload / Hapus File:**
   - Simpan file lewat `FileProviderService.getDefaultProvider()` (bukan `fs.writeFile` langsung ke `uploads/`).
   - Saat menghapus file lepas atau folder di Dokumen Umum, hapus record DB sekaligus hapus file fisik di storage provider lewat `adapter.delete()` agar penyimpanan benar-benar bersih.
5. **Buat Tanggal Bisnis / Scheduler / Rekap:**
   - Gunakan helper WIB (`UTC+7`) untuk batas hari, filter tanggal, dan cron scheduler — jangan pakai `new Date().toISOString().slice(0, 10)` (UTC mentah).
6. **Buat Nilai Uang / Perhitungan Finansial:**
   - Gunakan `Decimal` / `src/common/decimal.ts`, jangan pakai aritmetika float JS mentah. Rupiah di jurnal harus bilangan bulat utuh.
7. **Buat Halaman / Modal / Toolbar / Tab di Mobile (`apps/mobile`):**
   - Route di `src/app/(app)/` cukup jadi wrapper tipis; taruh state & UI di `src/modules/<modul>/`.
   - Pakai komponen dari `src/components/ui/` dan `src/components/akuntra/`.
   - Pastikan **mobile-friendly di semua lebar layar**: tombol header & filter wajib `flex-wrap` atau tertata rapi tanpa overflow; tab panjang pakai `ScrollView horizontal` atau wrap; teks dalam card diberi `flex-1` / `min-w-0` agar tidak keluar kotak.
   - Pastikan jalan di **Web & Android/iOS** (cek `Platform.OS === "web"` sebelum akses DOM/browser API) dan lolos ESLint React 19.
8. **Buat / Tambah Modul Baru (End-to-End):**
   - Sesuai `AGENTS.md`: **tulis rencana singkat dulu & tunggu persetujuan user** sebelum menulis kode (kecuali user sudah memberi spesifikasi lengkap dan meminta langsung dikerjakan).

---

## 7. Perintah Verifikasi

> **Catatan Windows PowerShell:** `npx` sering terblokir ExecutionPolicy; panggil binary langsung lewat `node` atau `.cmd`.

### API (`cd apps/api`)
- Typecheck: `node ../../node_modules/typescript/bin/tsc --noEmit`
- Lint file tertentu: `.\node_modules\.bin\oxlint.cmd src/<path>`
- Unit test file tertentu: `node node_modules/vitest/vitest.mjs run src/<path>.spec.ts`

### Mobile (`cd apps/mobile`)
- Typecheck: `node ../../node_modules/typescript/bin/tsc --noEmit`
- Lint file tertentu: `.\node_modules\.bin\eslint.cmd src/<path>`

### Build APK (jika diminta user)
- Dari root atau `apps/mobile`: `pnpm run build:app`

---

## 8. Checklist Anti-Melenceng untuk AI Agent

Sebelum mengedit kode, pastikan:
1. **Cari di peta ini dulu**, lalu baca hanya file yang relevan — jangan memindai seluruh repo.
2. **Cek apakah modul pakai screen generik atau khusus:** cek `src/app/(app)/` dan `src/modules/<modul>/` sebelum menyentuh `src/screens/module-*.tsx` (perubahan di `src/screens/` berdampak ke banyak modul sekaligus).
3. **Fitur baru = rencana dulu** (tunggu persetujuan user); **Bug fix = langsung perbaiki** dengan diff minimal.
4. **Jangan menyentuh file rahasia** (`.env`), **jangan commit/push** tanpa diminta, **jangan menambah dependency** tanpa izin.
