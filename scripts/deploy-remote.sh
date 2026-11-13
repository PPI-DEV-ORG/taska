#!/usr/bin/env bash
# ==============================================================================
# TASKA ERP - Bagian deploy yang berjalan DI SERVER (dipanggil oleh scripts/deploy.sh)
#
#   deploy-remote.sh setup                      siapkan folder & cek Node/pnpm/PM2
#   deploy-remote.sh release <tarball> <mode>   pasang rilis baru (mode: all | api | web)
#   deploy-remote.sh rollback                   kembali ke rilis sebelumnya
#
# Struktur di server (DEPLOY_PATH):
#   releases/<YYYYmmdd-HHMMSS>/   rilis (apps/api, web, ...)
#   current -> releases/<...>     rilis aktif (Nginx melayani current/web)
#   shared/api.env                .env API (permanen)
#   shared/uploads/               file upload (permanen)
#   shared/storage/               sesi WhatsApp dll. (permanen)
#   shared/backups/               backup database sebelum migrasi
# ==============================================================================
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:?DEPLOY_PATH wajib diisi}"
PM2_NAME="${PM2_NAME:-taska-api}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"
HEALTH_URL="${HEALTH_URL:-}"

RELEASES="${DEPLOY_PATH}/releases"
SHARED="${DEPLOY_PATH}/shared"
CURRENT="${DEPLOY_PATH}/current"

log() { echo "[server $(date '+%H:%M:%S')] $*"; }
die() { echo "[server] GAGAL: $*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "'$1' belum terpasang di server. $2"; }

api_port() {
  local p
  p="$(grep -E '^PORT=' "${SHARED}/api.env" 2>/dev/null | cut -d= -f2- | tr -d '"'\'' \r' || true)"
  echo "${p:-3030}"
}

# Tautkan data permanen ke dalam rilis
link_shared() {
  local rel="$1"
  mkdir -p "${SHARED}/uploads" "${SHARED}/storage" "${SHARED}/backups"
  ln -sfn "${SHARED}/api.env" "${rel}/apps/api/.env"
  rm -rf "${rel}/apps/api/uploads" "${rel}/apps/api/storage" "${rel}/apps/api/backups"
  ln -sfn "${SHARED}/uploads" "${rel}/apps/api/uploads"
  ln -sfn "${SHARED}/storage" "${rel}/apps/api/storage"
  ln -sfn "${SHARED}/backups" "${rel}/apps/api/backups"
}

switch_current() {
  local rel="$1"
  ln -sfn "${rel}" "${DEPLOY_PATH}/current.tmp"
  mv -Tf "${DEPLOY_PATH}/current.tmp" "${CURRENT}"
  log "Rilis aktif: $(basename "$(readlink -f "${CURRENT}")")"
}

# PM2 dihapus lalu dijalankan ulang dari path rilis yang baru (pm2 reload tidak mengganti path script).
restart_api() {
  local rel
  rel="$(readlink -f "${CURRENT}")"
  pm2 delete "${PM2_NAME}" >/dev/null 2>&1 || true
  NODE_ENV=production pm2 start "${rel}/apps/api/dist/main.js" \
    --name "${PM2_NAME}" --cwd "${rel}/apps/api" --time --update-env >/dev/null
  pm2 save >/dev/null
  log "API dijalankan ulang (PM2: ${PM2_NAME})"
}

health_check() {
  local url="${HEALTH_URL:-http://127.0.0.1:$(api_port)/api}"
  log "Cek kesehatan API: ${url}"
  for _ in $(seq 1 20); do
    if curl -fsS -o /dev/null --max-time 3 "${url}"; then
      log "API sehat"
      return 0
    fi
    sleep 2
  done
  return 1
}

previous_release() {
  local cur
  cur="$(readlink -f "${CURRENT}" 2>/dev/null || true)"
  ls -1d "${RELEASES}"/*/ 2>/dev/null | sed 's#/$##' | sort | awk -v c="${cur}" '$0 < c' | tail -1
}

cleanup_old() {
  local cur count
  cur="$(readlink -f "${CURRENT}")"
  count="$(ls -1d "${RELEASES}"/*/ 2>/dev/null | wc -l)"
  if (( count > KEEP_RELEASES )); then
    ls -1d "${RELEASES}"/*/ | sed 's#/$##' | sort | head -n $((count - KEEP_RELEASES)) | while read -r old; do
      [[ "${old}" == "${cur}" ]] && continue
      rm -rf "${old}"
      log "Hapus rilis lama: $(basename "${old}")"
    done
  fi
}

cmd_setup() {
  mkdir -p "${RELEASES}" "${SHARED}/uploads" "${SHARED}/storage" "${SHARED}/backups"
  need node "Pasang Node.js >= 24."
  need pnpm "Pasang: corepack enable && corepack prepare pnpm@latest --activate"
  need pm2 "Pasang: npm i -g pm2 && pm2 startup"
  need curl "Pasang: sudo apt install curl"
  log "Node $(node -v) · pnpm $(pnpm -v) · PM2 $(pm2 -v)"
  if [[ ! -f "${SHARED}/api.env" ]]; then
    cat > "${SHARED}/api.env" <<EOF
# .env API produksi — WAJIB diisi sebelum deploy pertama
DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/taska?connection_limit=20"
ARCHIVE_DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/taska_archive?connection_limit=5"
JWT_SECRET="GANTI-dengan-string-acak-minimal-64-karakter"
JWT_ACCESS_TTL="12h"
JWT_REFRESH_TTL="7d"
PORT=3030
UPLOAD_DIR="${SHARED}/uploads"
EOF
    chmod 600 "${SHARED}/api.env"
    log "Template dibuat: ${SHARED}/api.env  ->  EDIT dulu isinya (database, JWT_SECRET)."
  else
    log ".env sudah ada: ${SHARED}/api.env"
  fi
  log "Setup selesai."
}

cmd_release() {
  local tarball="$1" mode="$2"
  [[ -f "${tarball}" ]] || die "Arsip rilis tidak ditemukan: ${tarball}"
  [[ -f "${SHARED}/api.env" ]] || die "Belum ada ${SHARED}/api.env. Jalankan dulu: deploy setup"
  need pnpm "Jalankan: deploy setup"
  need pm2 "Jalankan: deploy setup"

  local name rel prev
  name="$(basename "${tarball}" .tar.gz)"
  rel="${RELEASES}/${name}"
  prev="$(readlink -f "${CURRENT}" 2>/dev/null || true)"

  log "Ekstrak rilis ${name} (mode: ${mode})"
  rm -rf "${rel}"
  mkdir -p "${rel}"
  tar -xzf "${tarball}" -C "${rel}"
  rm -f "${tarball}"

  # Bagian yang tidak ikut dibangun diambil dari rilis aktif
  if [[ "${mode}" == "api" ]]; then
    [[ -n "${prev}" && -d "${prev}/web" ]] && cp -a "${prev}/web" "${rel}/web" || log "Peringatan: belum ada web di rilis sebelumnya"
  fi
  if [[ "${mode}" == "web" ]]; then
    [[ -n "${prev}" && -d "${prev}/apps/api/dist" ]] || die "Mode web butuh API dari rilis sebelumnya, tapi belum ada. Deploy penuh dulu."
    mkdir -p "${rel}/apps/api"
    cp -a "${prev}/apps/api/." "${rel}/apps/api/"
    rm -rf "${rel}/apps/api/node_modules"
  fi

  link_shared "${rel}"

  if [[ "${mode}" != "web" ]]; then
    log "Pasang dependency API (pnpm)"
    (cd "${rel}" && CI=true pnpm install --frozen-lockfile --filter api --config.confirmModulesPurge=false)

    if [[ "${SKIP_BACKUP}" != "1" ]]; then
      log "Backup database sebelum migrasi"
      (cd "${rel}/apps/api" && pnpm run db:backup) || die "Backup database gagal (deploy dibatalkan). Pakai SKIP_BACKUP=1 bila yakin."
    fi

    log "Migrasi database (prisma migrate deploy)"
    (cd "${rel}/apps/api" && pnpm exec prisma migrate deploy)
  else
    (cd "${rel}" && CI=true pnpm install --frozen-lockfile --filter api --config.confirmModulesPurge=false >/dev/null)
  fi

  switch_current "${rel}"

  if [[ "${mode}" != "web" ]]; then
    restart_api
    if ! health_check; then
      log "API tidak sehat setelah deploy — rollback otomatis"
      if [[ -n "${prev}" && -d "${prev}" ]]; then
        switch_current "${prev}"
        restart_api
        health_check || true
      fi
      pm2 logs "${PM2_NAME}" --lines 40 --nostream || true
      die "Deploy dibatalkan, kembali ke rilis sebelumnya. (Migrasi database TIDAK dibatalkan otomatis.)"
    fi
  fi

  cleanup_old
  log "DEPLOY SELESAI: ${name}"
}

cmd_rollback() {
  need pm2 "Jalankan: deploy setup"
  local target
  target="$(previous_release)"
  [[ -n "${target}" ]] || die "Tidak ada rilis sebelumnya untuk rollback."
  log "Rollback ke $(basename "${target}")"
  switch_current "${target}"
  restart_api
  health_check || die "API belum sehat setelah rollback. Cek: pm2 logs ${PM2_NAME}"
  log "Rollback selesai. Catatan: migrasi database tidak dibatalkan; backup ada di ${SHARED}/backups"
}

case "${1:-}" in
  setup) cmd_setup ;;
  release) cmd_release "${2:?tarball}" "${3:-all}" ;;
  rollback) cmd_rollback ;;
  *) die "Perintah tidak dikenal: ${1:-<kosong>}" ;;
esac
