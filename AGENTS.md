# AGENTS.md — Akuntra
## Stack
- Monorepo Turborepo + pnpm
- API: NestJS + Prisma + MySQL (DB utama + DB arsip) di `apps/api`
- Klien: Expo React Native (web dan mobile satu kode) + NativeWind + komponen bergaya shadcn di `apps/mobile`
- RBAC dengan banyak role.
- Peta struktur kode, daftar modul, pola komponen, dan catatan build lengkap ada di `CODEBASE.md` — baca dulu sebelum mencari file atau menambah modul baru.

## Cara berkomunikasi
- Balas dalam bahasa Indonesia, singkat, langsung ke inti. Tanpa basa-basi, tanpa mengulang pertanyaan, tanpa merangkum langkah yang sudah terlihat.
- Jangan setuju hanya untuk menyenangkan. Jika ide saya kurang tepat, berisiko, atau ada cara lebih baik, katakan jelas: apa masalahnya, kenapa, dan solusi yang kamu sarankan. Setelah itu ikuti keputusan saya.
- Jika saya bertanya atau minta saran, beri satu jawaban yang menurutmu paling benar, lengkap dengan alasan singkat. Jangan menyodorkan daftar opsi tanpa rekomendasi. Jika tidak yakin, katakan tidak yakin dan bagian mana yang belum diverifikasi. Jangan menebak lalu menyajikannya sebagai fakta.
- Jika permintaan ambigu dan salah tebak itu mahal, tanyakan satu pertanyaan singkat. Jika murah diulang, kerjakan dengan asumsi terbaik dan sebutkan asumsinya.

## Mode kerja

**Bug fix: langsung kerjakan**
1. Reproduksi atau lokalisasi penyebab dengan `grep` dan baca file terkait saja. Jangan memindai seluruh repo.
2. Perbaiki akar masalah dengan diff sekecil mungkin. Jangan refactor, rename, atau merapikan kode di luar bug.
3. Bila ada tes yang relevan, tambah atau perbarui satu tes yang mengunci bug itu.
4. Laporkan: penyebab, file yang diubah, cara memeriksa. Jika bug menandakan masalah lebih luas, sebutkan, tapi jangan diperbaiki tanpa persetujuan.

**Fitur baru: rencana dulu, lapor, tunggu persetujuan**
1. Baca kode yang berhubungan, lalu tulis rencana pendek: tujuan, file dan tabel yang terpengaruh, perubahan skema, dampak ke alur dan role yang ada, risiko, dan hal yang belum jelas.
2. Kritisi permintaan: apa yang kurang, bentrok, atau bisa lebih sederhana.
3. Berhenti dan tunggu jawaban saya. Jangan menulis kode fitur sebelum rencana disetujui — kecuali permintaan sudah disertai PRD/spesifikasi jelas dan diminta langsung dikerjakan.
4. Setelah disetujui, kerjakan sesuai rencana. Jika di tengah jalan ada penyimpangan, berhenti dan lapor.

**Pertanyaan atau review:** jawab dari kode yang benar-benar dibaca, sebutkan file dan baris bila relevan. Jangan mengubah file kecuali diminta.

## Efisiensi
- Baca hanya yang perlu. Gunakan pencarian terarah, bukan membaca banyak file penuh.
- Jangan membuat file dokumentasi, README, atau catatan yang tidak diminta.
- Jangan menjalankan install, build, migrasi, atau seluruh test suite kecuali diminta atau memang perlu untuk memverifikasi perubahan. Jalankan tes yang relevan saja.
- Jangan menambah dependency baru tanpa izin. Pakai yang sudah ada di repo.
- Ikuti pola, penamaan, dan struktur kode yang sudah ada. Jangan memperkenalkan gaya baru.

## Aturan keras (tidak boleh dilanggar)
- **Database:** perubahan skema wajib lewat file migrasi di `apps/api/prisma/migrations/` lalu jalankan `prisma migrate deploy` dan `prisma generate` (hindari `db push` agar tidak terjadi *migration drift*). Dilarang `db:fresh`, `migrate reset`, `drop`, atau perintah lain yang menghapus data. Data tidak boleh hilang.
- **Akuntansi:** semua jurnal hanya lewat `PostingService`. Dilarang `journalEntry.create` atau `journalLine.create` di luar `posting.service.ts`. Dilarang menulis literal kode akun di service dokumen; baca dari `AccountMapping`. Jurnal tidak dihapus, hanya dibalik (`reverse`) atau diposting ulang (`repost`). Periode CLOSED menolak posting dengan HTTP 409.
- **Transaksi:** perubahan dokumen dan jurnalnya harus dalam satu `$transaction`. Notifikasi dan audit dijalankan setelah commit.
- **Akses data:** pembatasan role ditegakkan di API, bukan hanya disembunyikan di UI. Harga beli, harga perolehan, dan nilai sensitif tidak dikirim ke role yang tidak berhak.
- **Git:** jangan commit, push, force-push, atau ubah history tanpa diminta. Jangan menyentuh perubahan lokal yang belum saya commit.
- **Rahasia:** jangan membaca, mencetak, atau menulis `.env`, kredensial, atau token ke output dan commit.
- **Data uji vs data nyata:** jangan menjalankan skrip yang mengubah data pada database selain yang saya sebut.

## Standar kode
- TypeScript ketat. Tanpa `any` kecuali terpaksa dan diberi alasan.
- Validasi input di DTO. Pesan error untuk pengguna dalam bahasa Indonesia, jelas dan bisa ditindaklanjuti.
- Nilai uang tidak memakai float. Rupiah utuh di jurnal.
- Semua tanggal bisnis, batas hari, dan scheduler menggunakan WIB (`UTC+7`), bukan UTC mentah.
- UI: sederhana untuk pengguna non-teknis, pakai komponen yang sudah ada, kompatibel Web & Native (Expo), dan lolos aturan ESLint React 19.
- Komentar hanya untuk "kenapa", bukan "apa".

## Sebelum menyatakan selesai
- Pastikan perubahan benar-benar diperiksa:
  - API (`apps/api`): `tsc --noEmit`, `oxlint <path>`, `vitest run <spec>`.
  - Mobile (`apps/mobile`): `tsc --noEmit`, `eslint <files>`.
  - Jangan jalankan full build (`pnpm build`, `expo export`, `nest build`) kecuali diminta.
- Jika tidak bisa diverifikasi, katakan terus terang. Jangan menulis "sudah beres" tanpa bukti.
- Format laporan akhir, maksimal 6 baris: apa yang diubah, file utama, cara mengecek, risiko atau hal yang perlu keputusan saya.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->