# PRD — Mini ERP Operasional

Oct 7, 2026 · @Reyner

## Ringkasan

Mini ERP ini menggantikan enam file Excel/Google Sheets yang dipakai untuk operasional, dan mengurus alur dari lead masuk sampai barang keluar ke project dalam satu sistem internal, dengan file bukti di setiap langkah penting.

- **Masalah:** data tersebar di banyak file, status diubah manual tanpa jejak, dan pelacakan lead, barang keluar, surat jalan, serta pengeluaran di lapangan sulit.
- **Pengguna:** maksimal 30 orang internal dalam 9 role: Admin, Bos (hanya melihat dan menyetujui), Sales, Project Manager, Teknisi, Procurement, Finance, Gudang, dan Software Engineer.
- **Sasaran fase 1:** alur utama berjalan end-to-end (lead, survey, penawaran, PO client, invoice, project, pengadaan, gudang, pengeluaran ke project), dengan hak akses per role dan audit log.
- **Skala:** sekitar 500 ribu baris data per tahun; mata uang Rupiah.

* **Ukuran berhasil:** semua data (lead, survey, pengeluaran, barang, surat jalan, project) tercatat dengan baik dan saling terhubung dari awal sampai akhir.
* **Pemakaian:** bisa dibuka dari semua perangkat dan jaringan lewat domain sendiri; antarmukanya dibuat sederhana agar mudah dipakai.
* **Persetujuan dokumen ini:** PM lebih dulu, lalu diteruskan ke Bos. Master data dipegang divisi pemiliknya; Admin untuk akun dan pengaturan.

## Ruang lingkup

Fase 1 mencakup seluruh alur utama; laporan untung-rugi project ditunda ke fase 2, dan bot WhatsApp dikerjakan belakangan.

**Fase 1**

- Master data (dikelola divisi pemiliknya): customer, lead source, dan alasan Lost oleh Sales; supplier oleh Procurement; barang oleh Gudang; kategori pengeluaran dan cost center oleh Finance; daftar gudang, data karyawan, user, dan role oleh Admin.
- Sales CRM: lead/opportunity, follow-up, alasan Lost, analisa konversi survey.
- Survey yang berjalan paralel dengan penawaran, dengan tim PM, Teknisi, atau SE, lengkap dengan dokumentasi dan laporan PDF.
- Penawaran berversi dengan persetujuan Finance atau Bos sebelum dikirim.
- Finance: PO client, invoice keluar, pembayaran, invoice supplier, persetujuan dan reimbursement pengeluaran.
- Project (dengan atau tanpa lead) dan task bertingkat, termasuk BAHP, BAST, dan DO.
- Procurement: request barang, cek stok, persetujuan, PO supplier, tracking pengiriman, penerimaan, laporan barang bermasalah.
- Gudang: stok multi-gudang, serial number, stok opname, retur, reserve project.
- Surat jalan untuk setiap urusan kerja di luar kantor (dengan atau tanpa barang), dibuat semua role, dengan tujuan, laporan hasil, dan dokumentasi.
- Pengeluaran harian (makan, bensin, dan sebagainya) yang boleh dilaporkan setelah kejadian.
- Dashboard dan laporan per role, dengan ekspor ke Excel, PDF, dan Word.
- Audit log, upload file, dan arsip data lama (dipindah setelah 2 tahun) ke database arsip, lengkap dengan halaman Archive per kategori.
- Satu aplikasi Expo (React Native) untuk mobile (Android dan iOS), web, dan desktop (Windows, macOS, Linux) dalam satu monorepo, dapat diakses dari semua jaringan, dengan penyimpanan sementara saat koneksi putus dan notifikasi realtime ke orang terkait.
- Import Excel untuk master data dan stok awal.

**Fase 2**

- Laporan untung-rugi per project (revenue dari invoice, biaya dari PO dan pengeluaran).
- Notifikasi email (notifikasi realtime di aplikasi sudah masuk fase 1).
- Tanda tangan digital pada surat jalan.
- Pemindahan penyimpanan file ke S3 atau MinIO.
- Bot WhatsApp dan agent AI lokal (Hermes) yang menyusun laporan PDF dari dokumentasi (dikerjakan belakangan secara paralel; untuk fase 1 foto dan dokumen tetap diupload manual di aplikasi).

**Di luar cakupan**

- Pengiriman email atau WhatsApp ke client dari aplikasi (email dan nomor telepon tampil sebagai tautan langsung ke aplikasi mail dan WA).
- Pembuatan dokumen invoice (dibuat di luar lalu diupload) dan pembuatan dokumen penawaran otomatis dari template.
- Perhitungan dan pelaporan pajak: dilakukan di luar ERP, ERP hanya menyimpan datanya.
- Multi-mata uang, payroll, dan akuntansi penuh.

## Role dan hak akses

Akses memakai RBAC: tiap role hanya melihat modulnya sendiri, dan Bos hanya melihat semua data dan menyetujui dokumen, tidak membuat atau mengubah data. Admin mengelola akun, role, dan pengaturan. Satu orang yang memegang dua role dibuatkan dua akun terpisah, tanpa penggabungan hak akses.

Kode akses: L = lihat, C = buat, U = ubah, A = approve. "Ringkas" atau "status" berarti tampilan read-only di titik serah-terima, bukan akses penuh ke modul itu.

| Modul | Bos | Sales | PM | Teknisi | Procurement | Finance | Gudang | SE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Master data | L | LCU (customer, lead source, alasan Lost) | L | - | LCU (supplier) | LCU (kategori pengeluaran, cost center) | LCU (barang) | - |
| Leads dan follow-up | L | LCU (semua lead dilihat, miliknya diubah) | LCU | - | - | L (ringkas, saat Won) | - | - |
| Survey dan biaya survey | L | C (permintaan) | LCUA | LCU | - | L | - | LCU |
| Penawaran | LA | LCU | LCU | - | - | LA | - | - |
| PO client dan invoice keluar | LA | - | L (status) | - | - | LCUA | - | - |
| Project dan task | L | - | LCU (miliknya) | LU (tugasnya) | L (kebutuhan) | L (status, pembayaran) | - | LU (tugasnya) |
| Request barang | LA | - | C | - | LU | C | C | - |
| PO supplier dan invoice masuk | LA | - | - | - | LCU | LCUA | - | - |
| Penerimaan dan laporan barang bermasalah | LA | - | L | - | LA | L | LCUA | - |
| Stok dan opname | LA | - | L (project) | L (yang diterimanya) | L | LA | LCU | - |
| Surat jalan | LA | C | C | C | C | LCA | LCU | C |
| Pengeluaran dan reimbursement | LA | C | C | C | C | LCUA | C | C |
| Audit log dan user | L | - | - | - | - | - | - | - |

Aturan tambahan:

- Software Engineer melihat project yang ditugaskan (PRD dan task), memperbarui task miliknya, boleh ikut tim survey, serta membuat surat jalan dan laporan pengeluaran.
- Semua role kecuali Bos (yang hanya melihat dan menyetujui) dapat membuat surat jalan dan laporan pengeluaran; tiap dokumen disetujui oleh divisi pemiliknya atau Bos (lihat tabel persetujuan di bawah).
- Pembelian, invoice, dan penawaran disetujui Finance atau Bos. Dokumen bernilai di atas sekitar Rp10 juta tetap tampil di dashboard Finance, tetapi wajib juga disetujui Bos.
- Pembuat PO atau invoice tidak meng-approve dokumennya sendiri.
- Harga beli, standard cost, dan margin hanya dilihat Procurement, Finance, PM, dan Bos.
- Admin dapat memindahkan (reassign) lead, project, dan task ke orang lain.
- Bila Finance dan Bos sama-sama tidak ada, dokumen dibiarkan menunggu; tidak ada pengganti approver.
- Perubahan status di luar urutan biasa diperbolehkan, tetapi selalu tercatat di audit log.

### Persetujuan per dokumen

Setiap dokumen disetujui oleh divisi pemiliknya atau Bos; Bos dapat menyetujui dokumen apa pun. Pemetaan di bawah sudah dikonfirmasi.

| Dokumen | Disetujui oleh (selain Bos) | Catatan |
| --- | --- | --- |
| Penawaran | Finance | sebelum dikirim ke client |
| Request barang, PO supplier, invoice masuk | Finance | pembuat tidak menyetujui dokumennya sendiri; di atas sekitar Rp10 juta wajib juga Bos |
| Penerimaan barang (surat barang masuk) | Gudang dan Procurement |  |
| Surat jalan | Finance | tujuan dan alasan wajib |
| Laporan pengeluaran dan reimbursement | Finance | di atas sekitar Rp10 juta wajib juga Bos |
| Stok opname dan penyesuaian | Finance | wajib juga Bos |
| Permintaan survey dari Sales | PM |  |

## Alur bisnis end-to-end

&#91;embedded content: penjualan sampai project · survey paralel\]

Survey berjalan paralel dengan penawaran dan tidak wajib. Penawaran harus disetujui Finance atau Bos sebelum dikirim ke client. PM membuat project setelah pembayaran pertama (DP, lunas, atau termin); project bertipe non-customer boleh dibuat langsung tanpa lead.

&#91;embedded content: eksekusi project · 3 jalur paralel\]

Barang, software, dan pemasangan berjalan bersamaan dan bertemu di handover, yang dilakukan setelah pembayaran lunas dan diatur di luar aplikasi. Pengiriman dari supplier dilacak manual (Di Supplier, Dikirim, Sampai) dengan bukti DO, dan surat jalan boleh dibuat oleh role mana pun.

## Kebutuhan fungsional

Setiap modul di bawah wajib menyimpan file bukti pada langkah yang disebut, dan semua perubahan status masuk audit log.

### Sales CRM

- Lead dan opportunity adalah satu data dengan stage: Prospecting, Qualification, Proposal, Negotiation, Won, Lost.
- Isi data: customer, lead source (social media, website, cold call, referral, event, distributor, other), tipe client (partner atau end user; satu nama saja dan bisa diubah sendiri bila kurang tepat), kebutuhan, PIC. Nilai estimasi, probabilitas, dan target tanggal closing bersifat opsional.
- Satu customer boleh punya banyak lead; customer ada di master data tersendiri dengan nama, PIC, telepon, email, alamat, dan catatan.
- Follow-up dicatat: tanggal, metode (email, telepon, WA, lainnya), catatan, tanggal follow-up berikutnya, status. Follow-up bisa tertaut ke lead atau penawaran. Aplikasi tidak mengirim pesan.
- Sales melihat semua lead, tetapi hanya pemilik lead atau Admin yang mengubah dan memindahkan kepemilikannya (reassign).
- Sales atau PM menandai lead "perlu survey"; status Won diubah manual oleh Sales atau PM setelah PO client masuk dan invoice terkirim.
- Lead yang Lost atau batal wajib diberi alasan dari daftar master, misalnya belum ada follow-up, client tidak ada kabar, Sales atau PM lupa, atau dibatalkan. Daftar alasan dikelola Sales.

### Survey

- Survey bersifat opsional dan berjalan paralel dengan penawaran. Bila kebutuhan client sudah jelas, lead langsung lanjut ke langkah berikutnya tanpa survey.
- Survey yang diminta Sales perlu persetujuan PM; yang diminta PM langsung berjalan, dan muncul di dashboard tim survey.
- Tim survey ditentukan PM dari data karyawan yang difilter per role: PM bersama Teknisi, Teknisi saja, atau tim SE saja, dan Teknisi boleh lebih dari satu orang. Survey dijadwalkan dengan tanggal dan jam; jadwal tiap teknisi bisa dilihat agar penjadwalan tidak bentrok (peringatan saja, tidak memblokir).
- Laporan survey: foto atau video, catatan teks, kebutuhan, lokasi, status. Dokumen lain boleh diupload (opsional). Foto dan dokumen diupload manual di aplikasi, lalu seluruh dokumentasi bisa dikumpulkan menjadi file laporan PDF.
- Tim survey mencatat pengeluaran survey (transport, makan, dan sejenisnya) sebagai laporan pengeluaran tertaut ke survey dan lead, lalu Finance menyetujuinya untuk reimbursement.
- Laporan analisa survey per periode: jumlah lead yang disurvey, berapa yang deal, sisanya karena apa (alasan Lost atau belum follow-up), dan total biaya survey.

### Penawaran

- Penawaran dibuat di luar aplikasi (misalnya Excel) lalu diupload. Nomor penawaran dibuat otomatis oleh sistem; aplikasi menyimpan nomor, tanggal, file, total, PPN, diskon, total setelah diskon, tanggal berlaku, dan status.
- Saat lead masuk tahap Qualification, baris penawaran untuk lead itu muncul otomatis di menu Penawaran (status Belum dibuat), dan detail lead menampilkan tombol Buat penawaran.
- Kolom baris penawaran: nomor (otomatis), file, total, PPN, diskon, total setelah diskon, dan status. Status: Belum dibuat, Sudah dibuat, Menunggu persetujuan, Disetujui, Ditolak, Terkirim, dan Expired (otomatis); status lain diubah manual dan boleh loncat.
- Pembuatan dokumen penawaran langsung di aplikasi dari template (dokumen digenerate dari data) diminta Finance dan diputuskan masuk fase 2; fase 1 memakai upload file Excel.
- Rancangan template (dari contoh dokumen Finance): kop surat perusahaan; kota dan tanggal; tujuan (customer dan alamat); subjek; nomor penawaran (contoh format 0249/GM/IX/2026: urutan, kode perusahaan, bulan Romawi, tahun); kalimat pembuka; tabel item (No, Item/Jasa, Qty, Satuan seperti Unit atau Lot, Harga, Total); TOTAL, diskon (bila ada), PPN (contoh 11%), GRAND TOTAL; catatan bernomor (masa berlaku, harga tambahan, garansi); kontak perusahaan (telepon, WA, email, website); kalimat penutup; tanda tangan dan nama penandatangan. PPN dan format nomor adalah pengaturan, dan nomor otomatis fase 1 memakai format yang sama.
- Penawaran harus disetujui Finance atau Bos sebelum dikirim ke client. Diskusi harga dengan Sales, PM, Finance, dan Bos terjadi di luar aplikasi; yang dicatat di aplikasi adalah hasil persetujuannya.
- Status: Draft, Sent, Negotiation, Approved, Rejected, Expired. Approved berarti client menyetujui. Expired otomatis dari tanggal berlaku; status lain diubah manual.
- Tiap revisi adalah versi baru (v1, v2, dan seterusnya) dengan file sendiri; riwayat versi tidak boleh hilang.
- Penawaran boleh disusun saat survey masih berjalan.

### Finance

- PO client: nomor, nilai, tanggal, file.
- Invoice keluar dibuat di luar aplikasi lalu diupload: nomor, PO atau project, deskripsi (misalnya DP 35% atau termin 50-50), jumlah, PPN, total, tanggal, jatuh tempo, file. Satu PO boleh punya banyak invoice.
- Pembayaran dicatat terpisah per invoice: tanggal, jumlah, metode, referensi, file bukti. Status invoice (Unpaid, Partial, Paid) dihitung dari total pembayaran; Overdue dihitung dari jatuh tempo.
- Invoice masuk dari supplier: file, jumlah, PPN, jatuh tempo, dan bukti transfer yang diupload Finance.
- Persetujuan pembelian dan invoice oleh Finance atau Bos. Dokumen bernilai di atas sekitar Rp10 juta tetap tampil di dashboard Finance, tetapi wajib juga disetujui Bos; angka ambang adalah pengaturan.
- Pajak (faktur pajak dan perhitungannya) dikerjakan di luar ERP; aplikasi hanya menyimpan data PPN pada invoice. Tarif PPN adalah pengaturan sistem.

### Project

- PM membuat project dari lead Won setelah pembayaran pertama (DP, lunas, atau termin) diterima. Project bertipe non-customer (PRODUCT/R&D, INTERNAL, MAINTENANCE, SUPPORT, OTHER) boleh dibuat langsung tanpa lead.
- Data project: nama, tipe, customer, satu PIC (PM), tim (banyak SE dan teknisi), tanggal mulai dan selesai, status, nomor penawaran asal, PRD (diupload PM). Satu orang boleh ada di banyak project.
- Beberapa project berjalan paralel; sebagian hanya melibatkan tim SE atau teknisi saja.
- Task bertingkat (parent dan child): nama, PIC, tanggal, prioritas, status (TODO, IN PROGRESS, BLOCKED, DONE), progres, penanda "perlu pembelian", serta file BAHP, BAST, dan DO.
- PM meneruskan project ke tim SE dan memantau progresnya; SE dan Teknisi bekerja paralel.
- PM mengisi sendiri daftar kebutuhan barang. Sistem mengecek stok, otomatis me-reserve yang tersedia, dan hanya kekurangannya menjadi request ke Procurement.
- Handover (serah terima dokumentasi) dilakukan setelah invoice berstatus lunas; aturan handover dikelola di luar aplikasi, jadi ERP hanya mencatat datanya dan menampilkan catatan "belum lunas" selama pembayaran belum 100% (penutupan tidak diblokir). PM menandai project selesai dan wajib mengupload dokumen pendukung.

### Procurement

- Request barang diajukan PM dari project, atau sebagai request stok oleh Procurement, Finance, PM, atau Gudang. Request stok masuk ke Procurement dulu, lalu diajukan ke atasan.
- Procurement mengecek stok. Bila barang ada, request diteruskan ke Gudang (barang apa, berapa, untuk project apa); bila tidak ada, Procurement mengajukan PO ke supplier.
- Data request: tanggal, pemohon, cost type, project dan task (wajib jika cost type PROJECT), supplier pilihan, kondisi barang (baru atau second), item, qty, estimasi harga, tujuan, bukti permintaan (WA, email, atau BOQ).
- Pembelian, termasuk pembelian untuk stok, disetujui Finance atau Bos sebelum PO dikirim ke supplier; di atas sekitar Rp10 juta wajib juga disetujui Bos.
- PO supplier dibuat Procurement atau Finance: supplier, tanggal, tanggal perkiraan tiba, payment terms, item, qty, harga, total, file PO. Datanya dicatat dari dokumen supplier, lalu filenya diupload.
- Alur pembayaran: invoice supplier diterima, Finance membayar dan mengupload bukti bayar, lalu informasi diteruskan ke Gudang bersama status pengiriman.
- Tracking pengiriman diubah manual oleh Procurement: Di Supplier, Dikirim, Sampai, dengan bukti Delivery Order. Gudang melihat barang yang akan datang.
- Penerimaan di gudang boleh parsial (qty dipesan dan qty diterima dicatat terpisah). Setelah semua barang project siap, Procurement menyatakan siap ke PM.
- Barang tidak sesuai atau rusak: Gudang membuat laporan barang bermasalah yang diterima Procurement, Bos, dan Finance.
- Pembelian langsung ke lokasi project tanpa lewat gudang tetap dicatat: datanya dibuat dan langsung masuk sebagai barang terpakai pada project itu. Pembelian ini juga perlu persetujuan Finance atau Bos.

### Gudang

- Master data barang dikelola orang Gudang; daftar gudang dikelola Admin dan master data lain oleh divisi pemiliknya. Jumlah gudang tidak dibatasi: Admin menambah gudang, dan setiap orang Gudang ditugaskan ke gudang tertentu.
- Barang ber-serial number: scan memakai barcode scanner fisik atau input manual; SN harus unik; setiap perubahan status SN tercatat (di gudang, reserved, dikirim, terpasang, retur, diganti).
- Barang tanpa SN (kabel dan sejenisnya): dicatat per SKU dan satuan (meter, pcs, roll, box), dengan jumlah bebas dan boleh pecahan.
- Pergerakan stok: IN, OUT, TRANSFER, dengan kategori (penerimaan supplier, keluar ke project atau instalasi, transfer, retur, barang terpakai langsung, penggantian, penyesuaian opname). Setiap barang masuk dan keluar tercatat lengkap: SN, tanggal, project, dan tujuan (instalasi, maintenance, atau ganti).
- Barang pengganti (misalnya unit rusak diganti) dicatat dengan alasan; SN lama dan SN baru terhubung.
- Stok opname dilakukan beberapa kali; selisihnya menjadi penyesuaian yang wajib disetujui Finance dan Bos.
- Tampilan agregat stok per SKU per gudang: masuk, keluar, transfer masuk, transfer keluar, saldo akhir, serta peringatan saat di bawah stok minimum.
- Reserve: barang yang dialokasikan ke satu project tidak bisa dipakai project lain. Transfer antar gudang dan retur dari project memakai surat jalan.

### Surat jalan

- Surat jalan dibuat setiap kali karyawan keluar untuk urusan pekerjaan, dengan atau tanpa barang: survey, meeting, bertemu client, mengantar barang, instalasi, maintenance, penggantian, dan sejenisnya. Tujuan dan alasan wajib dicatat. Keluar hanya untuk membeli makan atau jajan tidak perlu surat jalan.
- Semua role dapat membuat surat jalan (Sales, PM, SE, Teknisi, Procurement, Gudang, Finance; Bos hanya melihat dan menyetujui).
- Satu surat jalan boleh mencakup beberapa project atau lokasi (misalnya Jakarta Timur dan Jakarta Pusat pada hari yang sama), dengan tujuan dan alasan tiap lokasi.
- Persetujuan oleh Finance atau Bos. Surat jalan dibuat aplikasi (PDF), dicetak, ditandatangani, lalu hasil scan-nya diupload.
- Bila ada barang, Gudang menyiapkannya: barang ber-SN wajib di-scan dan ditandai keluar sebelum berangkat, dan hasilnya tercatat sebagai "unit dengan SN ini keluar tanggal sekian untuk project ini dengan tujuan ini".
- Status: Pending, Delivered, Received, Canceled. Bila surat jalan membawa barang, status Received diubah manual oleh penerima di lokasi (Teknisi).
- Setelah selesai, pembuat melaporkan hasilnya: laporan, dokumentasi (foto atau video) bila perlu, dan pengeluaran terkait. Semua tampil untuk Finance dan Bos.

### Pengeluaran dan reimbursement

- Semua role dapat melaporkan pengeluaran harian dan pengeluaran project atau survey (makan, bensin, transport, dan sebagainya): tanggal, kategori, deskripsi, jumlah, foto nota, serta tautan ke project, survey, surat jalan, atau cost center.
- Laporan boleh dibuat setelah pengeluaran terjadi (belanja dulu, nota diupload belakangan); tidak perlu PR lebih dulu.
- Disetujui Finance atau Bos. Finance melihat semua laporan di dashboard; di atas sekitar Rp10 juta wajib juga disetujui Bos.
- Status: Dilaporkan, Disetujui, Ditolak, Dibayar (Finance menyetujui lalu mengupload bukti transfer).
- Finance dapat melihat pengeluaran per project, per survey, per orang, dan per bulan.

### Sistem

- Dashboard per role: Sales (lead dan follow-up jatuh tempo), Teknisi dan SE (survey dan penugasan), PM (project, status pembayaran, request), Procurement (request menunggu, tracking PO), Finance (invoice jatuh tempo, pengeluaran, antrean persetujuan), Gudang (stok menipis, surat jalan pending), Bos (ringkasan dan antrean persetujuan).
- Laporan: jumlah lead per stage (berjalan, Won, Lost atau batal), lead yang perlu follow-up, project berjalan, surat jalan terbit, stok barang beserta barang masuk dan keluar, pengeluaran, dan dokumen yang menunggu persetujuan. Semua laporan bisa diekspor ke Excel, PDF, atau Word.
- Laporan PDF dokumentasi: data dari aplikasi digabung dengan foto dan keterangan yang diupload manual menjadi satu file PDF (survey, instalasi, surat jalan).
- Nomor penawaran dibuat otomatis; nomor dokumen lain boleh diinput manual dengan saran format otomatis. Sistem menjaga nomor unik per jenis dokumen.
- Arsip: data berumur lebih dari 2 tahun dipindahkan dengan aman ke database arsip; datanya hanya bisa dilihat di halaman Archive, per kategori.
- Koneksi putus: pengguna tetap bisa menulis dan menyimpan catatan; catatan itu tersimpan sementara di perangkat dan dikirim otomatis setelah sambungan pulih. Yang disimpan hanya catatan, laporan, dan draf; operasi stok dan scan SN divalidasi server saat tersambung.

* Notifikasi realtime: setiap data masuk, berpindah, atau diserahkan memunculkan notifikasi langsung ke orang yang bersangkutan, misalnya permintaan persetujuan, hasil persetujuan, penugasan survey atau project, request barang, perubahan status pengiriman, barang tiba, surat jalan, dan laporan baru. Notifikasi tampil di web dan mobile dan tersimpan sebagai daftar yang bisa ditandai sudah dibaca (usulan).

## Aturan bisnis dan validasi

1. **Bukti wajib.** Langkah penting (PO client, invoice, pembayaran, PO supplier, delivery order, tanda terima, surat jalan, nota pengeluaran, penutupan project) tidak bisa ditandai selesai tanpa file bukti.
2. **Status manual, boleh loncat.** Status diubah manual oleh role yang berwenang dan tidak dipaksa berurutan. Setiap perubahan tercatat; hanya Expired (penawaran) dan Overdue (invoice) yang dihitung otomatis.
3. **Tidak ada penghapusan.** Dokumen yang sudah dikirim atau disetujui hanya bisa dibatalkan (soft delete), tidak dihapus.
4. **Pemisahan tugas.** Pembuat PO atau invoice tidak meng-approve dokumennya sendiri.
5. **Ambang persetujuan.** Dokumen bernilai di atas sekitar Rp10 juta tampil di dashboard Finance tetapi wajib juga disetujui Bos; dihitung per dokumen; angka ambang adalah pengaturan, bukan kode.
6. **Tidak ada pengganti approver.** Bila Finance dan Bos sama-sama tidak ada, dokumen menunggu.
7. **Serial number unik.** Satu SN tidak boleh tercatat dua kali, dan SN yang sudah keluar tidak bisa keluar lagi sebelum diretur.
8. **Setiap barang keluar-masuk tercatat.** Lengkap dengan SN, tanggal, project, dan tujuan (instalasi, maintenance, atau ganti).
9. **Stok tidak boleh negatif.** Pengeluaran yang melebihi saldo di gudang asal ditolak.
10. **Reserve.** Barang yang di-reserve satu project tidak muncul sebagai stok tersedia untuk project lain; reserve dilepas otomatis saat project atau request dibatalkan.
11. **Penyesuaian stok dan barang pengganti.** Selisih opname dan penggantian unit wajib ada alasan; penyesuaian opname disetujui Finance dan Bos.
12. **Project wajib untuk cost type PROJECT.** Request, PO, dan pengeluaran dengan cost type PROJECT harus punya project (dan task bila ada). Cost type juga punya pilihan OTHER dengan keterangan wajib diisi.
13. **Pengeluaran boleh menyusul.** Laporan pengeluaran boleh dibuat setelah kejadian, tetapi wajib ada nota.
14. **Penawaran.** Disetujui Finance atau Bos sebelum dikirim; revisi tidak menimpa versi lama dan hanya versi terakhir dipakai sebagai acuan nilai.
15. **Invoice dan PO client.** Total invoice yang melebihi nilai PO client memicu peringatan, bukan penolakan.
16. **Alasan Lost.** Lead Lost atau batal wajib punya alasan dari daftar master.
17. **Kepemilikan.** Admin dapat memindahkan lead, project, dan task ke orang lain.
18. **Hak akses di server.** Semua pembatasan role dicek di backend pada setiap endpoint, bukan hanya disembunyikan di tampilan.
19. **Tipe dan ukuran file.** Foto png, jpg, jpeg maksimal 5 MB; dokumen pdf, docx, xlsx dan sejenisnya maksimal 15 MB. Tipe dicek dari isi file, bukan hanya ekstensi. Video maksimal 25 MB (durasi sekitar 5 menit).

## Model data

Entitas utama dan hubungannya; nama kolom final ditentukan saat desain skema.

| Entitas | Isi utama | Relasi |
| --- | --- | --- |
| User, Role | nama, email, role, status aktif; data karyawan ini juga menjadi pilihan anggota tim survey dan project (difilter per role) | satu user satu role; satu orang dengan dua role punya dua akun |
| Customer | nama, perusahaan, kontak, email, alamat, catatan, status | punya banyak Lead dan Project |
| Supplier | nama, kontak, payment terms, status | punya banyak PO supplier |
| Product | SKU, nama, tipe, kategori, satuan, ber-SN atau tidak, stok minimum, lama garansi | dipakai di request, PO, stok |
| Warehouse | nama, kota, status | punya banyak pergerakan stok |
| Master lain | lead source, alasan Lost, kategori pengeluaran, cost center | dipakai Lead, Expense |
| Lead | stage, source, tipe client, kebutuhan, nilai estimasi, PIC, alasan Lost | milik Customer; punya Follow-up, Survey, Quotation |
| Follow-up | tanggal, metode, catatan, tanggal berikutnya | tertaut ke Lead atau Quotation |
| Survey | lokasi, catatan, kebutuhan, status, tim (PM, Teknisi, SE), tanggal dan jam jadwal | milik Lead; punya banyak File dan Expense |
| Quotation, Quotation Version | nomor (otomatis), status, tanggal berlaku; per versi: file, total, PPN, diskon, total setelah diskon | Quotation milik Lead (barisnya dibuat otomatis saat Lead masuk Qualification); punya Approval |
| Client PO | nomor, nilai, tanggal, file | dari Quotation yang Approved |
| Invoice Out | nomor, deskripsi, jumlah, PPN, total, jatuh tempo, file | milik Client PO dan Project; punya banyak Payment |
| Payment | tanggal, jumlah, metode, referensi, file | milik Invoice Out atau Invoice In |
| Project | tipe, PIC, tanggal, status, PRD, catatan lunas | dari Lead Won atau dibuat langsung; punya Task, Project Member, kebutuhan barang |
| Task | nama, parent, PIC, status, progres, perlu pembelian, BAHP/BAST/DO | milik Project; bisa tertaut ke Request |
| Purchase Request, Item | cost type, kondisi, qty, estimasi, status, bukti | dari Project atau stok; punya Approval |
| Approval | siapa, kapan, keputusan, catatan | untuk Quotation, Request, PO supplier, Invoice, Expense, Surat Jalan, Opname |
| Supplier PO, Item | nomor, tanggal, payment terms, status pengiriman, file | dari Request; punya Receiving dan Invoice In |
| Invoice In | nomor supplier, jumlah, PPN, jatuh tempo, file | milik Supplier PO; punya Payment |
| Receiving, Item | tanggal, gudang, qty diterima, kondisi, file tanda terima | milik Supplier PO; menambah Stock Movement |
| Issue Report (barang bermasalah) | jenis (rusak, salah, kurang), keterangan, bukti | dari Receiving; diterima Procurement, Bos, Finance |
| Stock Movement | SKU, gudang asal dan tujuan, qty, jenis (IN/OUT/TRANSFER), kategori, tujuan, tanggal | tertaut ke Receiving, Surat Jalan, Project |
| Serial Unit | SN, SKU, status, gudang, project, tanggal garansi berakhir, diganti oleh | punya riwayat perubahan status |
| Stock Reservation | project, SKU, qty atau SN | menahan stok untuk satu project |
| Stock Opname | tanggal, gudang, selisih per SKU, alasan | menghasilkan penyesuaian Stock Movement setelah Approval |
| Delivery Note (Surat Jalan) | nomor, pembuat, jenis urusan (dengan atau tanpa barang), tujuan, alasan, status, penerima, file scan, laporan hasil | boleh mencakup beberapa Project; berisi baris Stock Movement; punya Expense |
| Expense | tanggal, kategori, jumlah, status, nota | milik pelapor; tertaut ke Project, Survey, Surat Jalan, atau cost center |
| File | path atau URL, tipe, ukuran, pengunggah | tertaut ke dokumen apa pun |
| Audit Log | user, aksi, jenis data, id data, waktu | tidak menyimpan nilai lama dan baru secara rinci |
| Notification | penerima, jenis, tautan ke dokumen, waktu, status dibaca | dibuat otomatis saat data masuk, berpindah, atau diserahkan |

## Kebutuhan non-fungsional

| Aspek | Kebutuhan |
| --- | --- |
| Skala | Maksimal 30 pengguna; sekitar 500 ribu baris per tahun (pergerakan stok, lead, surat jalan, dan sejenisnya), di luar audit log |
| Ketersediaan | Aplikasi paling lama mati satu jam. Saat aplikasi atau koneksi putus, pengguna tetap bisa menulis dan menyimpan catatan; catatan disimpan sementara di perangkat dan dikirim otomatis setelah sambungan pulih |
| Akses | Dibuka dari semua perangkat dan jaringan lewat domain di internet; HTTPS wajib |
| Performa | Indeks pada kolom pencarian dan relasi (SKU, SN, nomor dokumen, tanggal, status); pagination dan filter dilakukan di server; daftar besar tidak dimuat sekaligus |
| Audit log | Mencatat user, aksi, jenis data, id data, dan waktu; cukup ringkas karena volumenya besar |
| Retensi dan arsip | Data berumur lebih dari 2 tahun dipindahkan dengan aman ke database arsip dan hanya bisa dilihat di halaman Archive per kategori |
| File | Disimpan lokal di server, path atau URL disimpan di database; lewat lapisan abstraksi agar bisa pindah ke S3 atau MinIO; video maksimal 25 MB (sekitar 5 menit); nama file diacak; diakses lewat endpoint yang butuh login |
| Keamanan | Login dengan JWT; password ter-hash; token berumur terbatas; RBAC dicek di backend; validasi input; pembatasan percobaan login |
| Integritas data | Operasi stok dan penerimaan barang berjalan dalam satu transaksi database; nomor dokumen unik per jenis |
| Pencadangan | Backup MySQL dan folder file secara berkala dengan uji pemulihan (jadwal ditentukan saat deploy). Data penting tidak boleh hilang; hanya data yang bisa dibuat ulang, seperti surat jalan dan pengeluaran, boleh hilang sekitar 10 data. Usulan: backup harian ditambah binary log MySQL agar pemulihan mendekati kejadian terakhir |
| Pemindai barcode | Scanner fisik berfungsi sebagai keyboard, jadi kolom SN menerima input scan dan input manual |
| Ekspor | Laporan dapat diekspor ke Excel, PDF, dan Word |
| Lokalisasi | Bahasa Indonesia, mata uang Rupiah, zona waktu Asia/Jakarta |
| Tampilan | Antarmuka sederhana dan mudah dipakai; berjalan di semua perangkat |
| Notifikasi | Realtime ke orang terkait setiap data masuk, berpindah, atau diserahkan; tampil di web dan mobile |

## Arsitektur dan tech stack

&#91;embedded content: arsitektur · 3 lapisan\]

Aplikasi klien hanya bicara dengan API NestJS; MySQL dan penyimpanan file tidak diakses langsung dari klien.

- **Frontend:** Monorepo Turborepo dengan pnpm; satu aplikasi Expo (React Native) dengan NativeWind dan komponen bergaya shadcn, berjalan native di Android dan iOS serta di web (Windows, macOS, Linux lewat browser). Tipe, validasi, dan klien API dipakai bersama dengan backend. Aplikasi desktop native (usulan: dibungkus Electron atau Tauri dari build web Expo) dikerjakan setelah web dan mobile stabil; pustaka shadcn resmi hanya untuk web React, jadi untuk React Native dipakai padanannya (usulan: React Native Reusables).
- **Backend:** NestJS di atas Node.js, dengan modul per area bisnis, autentikasi JWT, dan pengecekan role di tiap endpoint.
- **Database:** MySQL utama dan database arsip untuk data berumur lebih dari 2 tahun; ORM Prisma di NestJS, dengan SQL langsung untuk laporan yang berat.
- **File:** disimpan lokal, path atau URL di database, lewat lapisan abstraksi agar mudah dipindah.
- **Koneksi putus:** catatan disimpan di perangkat dan dikirim saat sambungan pulih.
- **Akses publik:** dibuka lewat domain dengan HTTPS.
- **Bot WhatsApp dan agent AI lokal (Hermes):** dikerjakan belakangan secara paralel dan bukan concern fase 1; bila dipakai, bot lewat API yang sama dan tunduk pada hak akses yang sama.
- **Notifikasi realtime:** setiap data masuk, pindah, atau diserahkan memicu notifikasi ke orang yang bersangkutan (usulan: gateway WebSocket di NestJS untuk web dan Expo push untuk mobile).
- **Deploy:** belum diputuskan; kode disiapkan agar mudah dijalankan dengan Docker.

## Migrasi data

File Excel yang ada sekarang adalah data contoh, jadi belum ada migrasi data asli. Cara migrasi final (import Excel atau input manual) belum diputuskan; rekomendasinya adalah import untuk master data dan stok awal saja.

- **Diimport lewat template Excel:** customer, supplier, produk, gudang, saldo stok awal, dan serial number. Import memvalidasi tiap baris dan menghasilkan laporan baris yang gagal, tanpa menggagalkan baris lain.
- **Dimasukkan lewat aplikasi:** lead, project, PO, invoice, dan transaksi lain, karena struktur lamanya berbeda (misalnya lead dan opportunity yang tadinya dua sheet kini satu data).
- **Karyawan:** hanya nama, posisi, departemen, dan email yang dibawa untuk membuat akun; nomor rekening dan telepon tidak dimigrasikan.

Temuan pada data contoh yang perlu dibereskan sebelum import:

- Sebagian produk tidak punya tipe atau status, dan ada baris stok dengan satuan "SKU Not Found".
- Beberapa sheet hanya cermin IMPORTRANGE yang error (`#REF!`) dan dilewati.
- Aturan bernomor ("Rule 1" sampai "Rule 9") yang disebut di catatan kolom tidak ditemukan di file; jika ada, aturan itu dijadikan validasi.

## Asumsi dan pertanyaan terbuka

Poin berikut belum final: sebagian asumsi yang kuambil agar PRD lengkap, sebagian keputusan yang masih perlu dijawab Bos atau PM. Jawaban yang sudah masuk ada di bagian lain PRD.

| # | Poin | Asumsi saat ini |
| --- | --- | --- |
| 1 | Bot WhatsApp dan agent AI lokal (Hermes) untuk laporan PDF | Dikerjakan belakangan secara paralel dan bukan concern fase 1; laporan PDF dokumentasi sementara diupload manual di aplikasi atau dibuat lewat template |
| 2 | Pemetaan dokumen ke divisi penyetuju | Prinsip: divisi pemilik dokumen atau Bos. Pemetaan di tabel Persetujuan per dokumen (mis. surat jalan dan pengeluaran ke Finance) sudah dikonfirmasi |
| 3 | Invoice melebihi nilai PO client | Peringatan saja, tidak diblokir |
| 4 | Deploy | Belum diputuskan; kode disiapkan agar siap Docker |
| 12 | Role Admin terpisah dari Bos | Bos hanya melihat dan menyetujui. Admin mengelola akun, role, ambang persetujuan, daftar gudang, dan pemindahan kepemilikan; siapa pemegang role Admin belum ditentukan |
| 13 | Template penawaran otomatis | Diputuskan masuk fase 2; contoh dokumen sudah ada. Masih perlu dipastikan aturan nomor (apakah urutan di-reset tiap tahun atau bulan) dan siapa yang menjadi penandatangan |
| 14 | Teknisi sudah terjadwal di jam yang sama | Usulan: peringatan saja, tetap bisa dipilih; belum dikonfirmasi |
| 5 | Platform klien: Expo untuk mobile, web, dan desktop dalam satu monorepo | Diputuskan: Turborepo, pnpm, NestJS dengan Prisma, Expo, NativeWind, dan shadcn. Perlu dipastikan apakah desktop cukup lewat browser atau perlu aplikasi native, dan padanan shadcn untuk React Native |

## Rencana fase

Fase 1 dibangun dalam lima tahap berurutan; tiap tahap selesai bila alurnya bisa dicoba dengan data contoh. Perkiraan waktu belum dibuat karena jumlah pengembang dan jam kerja belum ditentukan.

1. **Fondasi:** autentikasi JWT, user dan role, RBAC, master data, upload file, penomoran dokumen, audit log, notifikasi realtime.
2. **Sales:** lead, follow-up, alasan Lost, survey paralel, penawaran berversi dan persetujuannya.
3. **Finance dan project:** PO client, invoice, pembayaran, project (dengan atau tanpa lead), task, kebutuhan barang, pengeluaran dan reimbursement.
4. **Procurement dan gudang:** request, persetujuan, PO supplier, tracking, penerimaan, laporan barang bermasalah, stok, serial number, surat jalan dari semua role, transfer, opname, reserve.
5. **Penyelesaian:** dashboard dan laporan per role dengan ekspor, laporan PDF dokumentasi, arsip data lama, import Excel, uji paralel dengan Excel, perbaikan.

Fase 2 dikerjakan setelah fase 1 dipakai: laporan untung-rugi, notifikasi email, tanda tangan digital, pembuatan dokumen penawaran dari template, penyimpanan file di cloud, dan bot WhatsApp yang dikerjakan belakangan secara paralel.

## Ukuran berhasil dan rollout

- **Ukuran berhasil:** semua data (lead, survey, pengeluaran, barang masuk dan keluar, surat jalan, invoice, project) tercatat dengan baik dan saling terhubung dari awal sampai akhir.
- **Indikator yang dipantau (usulan):** setiap barang keluar punya surat jalan, SN, dan tujuan; setiap pengeluaran punya nota dan alasan; setiap lead Lost punya alasan. Angka target menunggu keputusan Bos.
- **Persetujuan PRD:** PM menyetujui lebih dulu, lalu diteruskan ke Bos. Master data dikelola divisi pemiliknya; Admin untuk akun dan pengaturan.
- **Rollout:** Excel tetap dipakai paralel setelah fitur pencatatan utama berjalan. Penguji adalah tim internal, pelatihan dilakukan tim pengembang, dan antarmuka dibuat sederhana agar mudah dipakai.
- **Kapan Excel dimatikan:** belum ditentukan.

## Risiko dan ketergantungan

| Risiko | Dampak | Penanganan (usulan) |
| --- | --- | --- |
| Bot WhatsApp dan agent AI lokal: integrasi WA yang tidak stabil, kebutuhan perangkat keras model lokal, hasil laporan keliru | Laporan salah atau akun WA terblokir | Mulai dari laporan berbasis template di aplikasi; bot menyusul lewat API dan hak akses yang sama; hasil AI ditinjau manusia sebelum final; nomor pengirim dipetakan ke user |
| Aplikasi dibuka publik lewat domain | Data keuangan dan stok terbuka ke internet | HTTPS, pembatasan percobaan login, token berumur terbatas; pertimbangkan 2FA untuk Bos dan Finance (keputusan saat ini: cukup JWT) |
| Sinkronisasi catatan setelah koneksi putus | Data ganda atau konflik stok dan SN | Mode putus hanya untuk catatan dan laporan; operasi stok dan SN divalidasi server; SN bentrok ditolak |
| Dua database (utama dan arsip) | Data lama sulit dicari dan laporan lintas data tidak lengkap | Batas 2 tahun dan halaman Archive per kategori sudah diputuskan; pastikan pencarian dan laporan lintas database tetap konsisten |
| Data contoh berantakan | Import awal gagal atau salah | Import dengan validasi per baris dan laporan error |
| Status boleh loncat dan banyak persetujuan manual | Data tidak konsisten | Semua perubahan tercatat di audit log; peran dan ambang approver bisa diubah Admin |
