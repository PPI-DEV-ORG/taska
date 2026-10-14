#!/usr/bin/env bash
# ==============================================================================
# TASKA ERP - Skrip Restore Data (Database MySQL & Dokumen Upload)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/apps/api/.env"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# 1. Baca konfigurasi database dari .env
if [[ -f "${ENV_FILE}" ]]; then
  RAW_DB_URL="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"'\'' ' || true)"
  RAW_UPLOAD_DIR="$(grep -E '^UPLOAD_DIR=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"'\'' ' || true)"
else
  RAW_DB_URL=""
  RAW_UPLOAD_DIR=""
fi

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

usage() {
  echo "Penggunaan: $0 [--db <file_db.sql.gz>] [--uploads <file_uploads.tar.gz>] [--force]"
  echo ""
  echo "Opsi:"
  echo "  --db <file>        File arsip database MySQL (.sql.gz atau .sql)"
  echo "  --uploads <file>   File arsip folder upload (.tar.gz)"
  echo "  --force            Jalankan tanpa konfirmasi interaktif"
  echo "  -h, --help         Tampilkan panduan ini"
  exit 1
}

DB_FILE=""
UPLOADS_FILE=""
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db)
      DB_FILE="$2"
      shift 2
      ;;
    --uploads)
      UPLOADS_FILE="$2"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Argumen tidak dikenal: $1"
      usage
      ;;
  esac
done

if [[ -z "${DB_FILE}" && -z "${UPLOADS_FILE}" ]]; then
  echo "=== DAFTAR ARSIP BACKUP TERSEDIA DI ${BACKUP_DIR} ==="
  ls -lh "${BACKUP_DIR}" 2>/dev/null || echo "Belum ada file backup ditemukan."
  echo ""
  echo "Silakan tentukan file backup yang ingin di-restore:"
  echo "Contoh: $0 --db backups/db_20261014_120000.sql.gz --uploads backups/uploads_20261014_120000.tar.gz"
  exit 1
fi

if [[ "${FORCE}" != "true" ]]; then
  echo "PERINGATAN: Proses restore akan menimpa data yang ada di database '${DB_NAME}' dan/atau folder '${TARGET_UPLOAD_DIR}'."
  read -r -p "Apakah Anda yakin ingin melanjutkan? (y/N): " CONFIRM
  if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
    echo "Restore dibatalkan oleh pengguna."
    exit 0
  fi
fi

# Restore Database
if [[ -n "${DB_FILE}" ]]; then
  if [[ ! -f "${DB_FILE}" ]]; then
    log "ERROR: File database '${DB_FILE}' tidak ditemukan!"
    exit 1
  fi

  log "Memulai restore database ke '${DB_NAME}' (${DB_HOST}:${DB_PORT})..."
  if [[ -n "${DB_PASSWORD}" ]]; then
    export MYSQL_PWD="${DB_PASSWORD}"
  fi

  if [[ "${DB_FILE}" == *.gz ]]; then
    gunzip -c "${DB_FILE}" | mysql --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" "${DB_NAME}"
  else
    mysql --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" "${DB_NAME}" < "${DB_FILE}"
  fi
  log "✓ Database berhasil di-restore dari: ${DB_FILE}"
fi

# Restore Uploads
if [[ -n "${UPLOADS_FILE}" ]]; then
  if [[ ! -f "${UPLOADS_FILE}" ]]; then
    log "ERROR: File uploads '${UPLOADS_FILE}' tidak ditemukan!"
    exit 1
  fi

  log "Memulai restore folder dokumen ke: ${TARGET_UPLOAD_DIR}..."
  mkdir -p "$(dirname "${TARGET_UPLOAD_DIR}")"
  tar -xzf "${UPLOADS_FILE}" -C "$(dirname "${TARGET_UPLOAD_DIR}")"
  log "✓ Folder dokumen berhasil di-restore dari: ${UPLOADS_FILE}"
fi

log "=== PROSES RESTORE SELESAI DENGAN SUKSES ==="

