# Panduan Skrip Backup & Restore Otomatis - TASKA ERP

Dokumentasi ini menjelaskan cara kerja dan konfigurasi otomatisasi pencadangan data (MySQL & File Dokumen Upload) serta prosedur pemulihan (restore) data TASKA ERP pada server on-premise kantor.

---

## 1. File yang Tersedia

- `backup.sh`: Skrip pencadangan otomatis (dump database MySQL `.sql.gz`, arsip upload `.tar.gz`, pembersihan retensi berkala).
- `restore.sh`: Skrip pemulihan database dan berkas unggahan dari arsip backup.

---

## 2. Izin Eksekusi

Sebelum digunakan, pastikan skrip memiliki izin eksekusi (`chmod +x`):

```bash
chmod +x scripts/backup.sh scripts/restore.sh
```

---

## 3. Cara Menjalankan Backup Manual

Jalankan perintah berikut dari direktori root proyek:

```bash
./scripts/backup.sh
```

Arsip hasil backup akan disimpan di direktori `backups/`:
- `backups/db_YYYYMMDD_HHMMSS.sql.gz`: Dump database MySQL terkompresi.
- `backups/uploads_YYYYMMDD_HHMMSS.tar.gz`: Seluruh dokumen bukti transfer, foto struk, dokumen proyek, dan lampiran.

### Variabel Lingkungan Opsional:
Skrip secara otomatis membaca kredensial dari `apps/api/.env`. Namun Anda juga dapat menentukannya secara manual:

```bash
BACKUP_DIR="/var/backups/taska" RETENTION_DAYS=30 ./scripts/backup.sh
```

---

## 4. Konfigurasi Otomatis via Crontab (Linux)

Untuk menjalankan backup harian secara otomatis (misalnya setiap jam 02:00 pagi setiap hari):

1. Buka konfigurasi crontab:
   ```bash
   crontab -e
   ```

2. Tambahkan baris jadwal berikut:
   ```cron
   # Backup harian TASKA ERP jam 02:00 pagi & simpan catatan log
   0 2 * * * /bin/bash /home/samtek/taska/scripts/backup.sh >> /home/samtek/taska/backups/backup.log 2>&1
   ```

3. Simpan dan keluar (`:wq` di vi/vim atau `Ctrl+O`, `Ctrl+X` di nano).

---

## 5. Kebijakan Retensi (Rotasi Backup)

- Default masa simpan: **14 hari**.
- Setiap kali `backup.sh` berjalan, arsip `.sql.gz` dan `.tar.gz` yang berumur lebih dari 14 hari akan dihapus secara otomatis untuk mencegah kepenuhan disk server lokal.
- Untuk mengubah masa retensi menjadi 30 hari, sesuaikan variabel `RETENTION_DAYS=30` di pemanggilan skrip atau di dalam file `backup.sh`.

---

## 6. Prosedur Restore Data

Untuk memulihkan data dari backup:

```bash
# 1. Melihat daftar arsip yang tersedia
./scripts/restore.sh

# 2. Restore Database saja
./scripts/restore.sh --db backups/db_20261014_020000.sql.gz

# 3. Restore Dokumen Upload saja
./scripts/restore.sh --uploads backups/uploads_20261014_020000.tar.gz

# 4. Restore Keduanya sekaligus tanpa prompt konfirmasi
./scripts/restore.sh --db backups/db_20261014_020000.sql.gz --uploads backups/uploads_20261014_020000.tar.gz --force
```

