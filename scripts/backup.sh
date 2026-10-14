#!/usr/bin/env bash
# ==============================================================================
# TASKA ERP - Skrip Backup Otomatis (Database MySQL & Dokumen Upload)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/apps/api/.env"

# Default configuration
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "=== MEMULAI PROSES BACKUP TASKA ERP ==="

# 1. Baca konfigurasi dari .env jika ada
if [[ -f "${ENV_FILE}" ]]; then
  log "Membaca konfigurasi database dari: ${ENV_FILE}"
  # Extract DATABASE_URL
  RAW_DB_URL="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"'\'' ' || true)"
  RAW_UPLOAD_DIR="$(grep -E '^UPLOAD_DIR=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"'\'' ' || true)"
else
  RAW_DB_URL=""
  RAW_UPLOAD_DIR=""
fi

# Parsing DATABASE_URL jika tidak dioverride oleh env var
if [[ -n "${RAW_DB_URL}" && -z "${DB_NAME:-}" ]]; then
  CRED_HOST="$(echo "${RAW_DB_URL}" | sed -E "s|^[a-zA-Z0-9]+://([^?]+).*|\1|")"
  CREDS="$(echo "${CRED_HOST}" | sed -E "s|@.*||")"
  HOST_PATH="$(echo "${CRED_HOST}" | sed -E "s|^[^@]+@||")"

  PARSED_USER="$(echo "${CREDS}" | cut -d: -f1)"
  PARSED_PASS="$(echo "${CREDS}" | cut -s -d: -f2-)"
  HOST_PORT="$(echo "${HOST_PATH}" | cut -d/ -f1)"
  PARSED_DB="$(echo "${HOST_PATH}" | cut -d/ -f2)"
  PARSED_HOST="$(echo "${HOST_PORT}" | cut -d: -f1)"
  PARSED_PORT="$(echo "${HOST_PORT}" | cut -s -d: -f2)"
fi

DB_USER="${DB_USER:-${PARSED_USER:-root}}"
DB_PASSWORD="${DB_PASSWORD:-${PARSED_PASS:-}}"
DB_HOST="${DB_HOST:-${PARSED_HOST:-127.0.0.1}}"
DB_PORT="${DB_PORT:-${PARSED_PORT:-3306}}"
DB_NAME="${DB_NAME:-${PARSED_DB:-taska}}"

# Resolusi path direktori upload
if [[ -n "${UPLOAD_DIR:-}" ]]; then
  TARGET_UPLOAD_DIR="${UPLOAD_DIR}"
elif [[ -n "${RAW_UPLOAD_DIR}" ]]; then
  if [[ "${RAW_UPLOAD_DIR}" = /* ]]; then
    TARGET_UPLOAD_DIR="${RAW_UPLOAD_DIR}"
  else
    TARGET_UPLOAD_DIR="${ROOT_DIR}/apps/api/${RAW_UPLOAD_DIR}"
  fi
else
  TARGET_UPLOAD_DIR="${ROOT_DIR}/apps/api/uploads"
fi

mkdir -p "${BACKUP_DIR}"

# 2. Backup Database MySQL
DB_BACKUP_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"
log "Membackup database '${DB_NAME}' dari ${DB_HOST}:${DB_PORT}..."

MYSQL_PWD_PARAM=""
if [[ -n "${DB_PASSWORD}" ]]; then
  export MYSQL_PWD="${DB_PASSWORD}"
fi

if command -v mysqldump &> /dev/null; then
  if mysqldump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --user="${DB_USER}" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    "${DB_NAME}" 2>/tmp/mysqldump_err.log | gzip > "${DB_BACKUP_FILE}"; then
    DB_SIZE="$(du -h "${DB_BACKUP_FILE}" | cut -f1)"
    log "✓ Backup database selesai: ${DB_BACKUP_FILE} (${DB_SIZE})"
  else
    rm -f "${DB_BACKUP_FILE}"
    log "⚠ Gagal membackup database '${DB_NAME}': $(cat /tmp/mysqldump_err.log 2>/dev/null || echo 'Koneksi database gagal')"
    rm -f /tmp/mysqldump_err.log
  fi
else
  log "⚠ Peringatan: Perintah 'mysqldump' tidak ditemukan. Lewati backup database."
fi

# 3. Backup Folder Dokumen Upload
if [[ -d "${TARGET_UPLOAD_DIR}" ]]; then
  UPLOADS_BACKUP_FILE="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
  log "Membackup dokumen upload dari: ${TARGET_UPLOAD_DIR}..."
  
  tar -czf "${UPLOADS_BACKUP_FILE}" -C "$(dirname "${TARGET_UPLOAD_DIR}")" "$(basename "${TARGET_UPLOAD_DIR}")"
  UPLOADS_SIZE="$(du -h "${UPLOADS_BACKUP_FILE}" | cut -f1)"
  log "✓ Backup uploads selesai: ${UPLOADS_BACKUP_FILE} (${UPLOADS_SIZE})"
else
  log "ℹ Folder upload '${TARGET_UPLOAD_DIR}' belum ada atau kosong. Lewati backup berkas."
fi

# 4. Retensi & Pembersihan Backup Lama
log "Menjalankan pembersihan backup yang lebih lama dari ${RETENTION_DAYS} hari..."
DELETED_COUNT=0
while IFS= read -r file; do
  if [[ -n "${file}" ]]; then
    rm -f "${file}"
    log "  Dihapus (kedaluwarsa): $(basename "${file}")"
    DELETED_COUNT=$((DELETED_COUNT + 1))
  fi
done < <(find "${BACKUP_DIR}" -type f \( -name "db_*.sql.gz" -o -name "uploads_*.tar.gz" \) -mtime "+${RETENTION_DAYS}" 2>/dev/null || true)

log "Pembersihan selesai (${DELETED_COUNT} file dihapus)."

log "=== BACKUP TASKA ERP SELESAI DENGAN SUKSES ==="
