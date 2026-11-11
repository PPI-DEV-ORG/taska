import { BadRequestException, ForbiddenException } from "@nestjs/common";

/**
 * Aturan alur pembelian (single source of truth).
 *
 * Alur pembelian (source RETAIL / SUPPLIER):
 *   1. Request barang dibuat (Procurement / Gudang / Admin / PM)        -> DIAJUKAN
 *   2. Finance (+Bos bila di atas ambang) menyetujui                    -> DISETUJUI
 *   3a. SUPPLIER: Procurement membuat PO (PO_DIBUAT)
 *   3b. Tunai / langsung / ritel: Finance membayar                      -> DIBAYAR
 *   4. Procurement menandai barang dikirim                              -> DIKIRIM
 *        (syarat: SUPPLIER harus punya PO disetujui; tunai/ritel harus sudah dibayar)
 *   5. Gudang menerima barang lewat Penerimaan Barang                   -> DITERIMA
 *
 * Request ambil dari stok gudang (source GUDANG) tidak melewati PO/pembayaran:
 *   DIAJUKAN -> DISETUJUI -> DIKIRIM (Gudang menyerahkan) -> DITERIMA (pemohon/Gudang)
 */

export const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];
/** Peran yang boleh membuat request barang. */
export const REQUEST_CREATOR_ROLES = ["SUPER_ADMIN", "ADMIN", "BOS", "PROCUREMENT", "GUDANG", "PM"];
export const FINANCE_ROLES = [...ADMIN_ROLES, "BOS", "FINANCE"];
export const PROCUREMENT_ROLES = [...ADMIN_ROLES, "PROCUREMENT"];
export const WAREHOUSE_ROLES = [...ADMIN_ROLES, "GUDANG"];

export type PrFlowRow = {
  status: string;
  requesterId?: number;
  procurementSource?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentProofFileId?: number | null;
  otherNote?: string | null;
};

export type PrFlowContext = {
  /** Jumlah PO supplier yang belum dibatalkan / ditolak. */
  activePoCount: number;
  /** Ada PO yang sudah disetujui. */
  hasApprovedPo: boolean;
  /** Request ini sudah punya bukti/status bayar (termasuk dari body saat ini). */
  paymentProofProvided?: boolean;
  /** Belanja ritel / online material non-master / pakai habis proyek (tanpa master produk). */
  isProjectConsumable?: boolean;
};

export const isPurchaseSource = (src?: string | null) => {
  const s = String(src ?? "SUPPLIER").toUpperCase();
  return s === "RETAIL" || s === "SUPPLIER";
};

export const isSupplierSource = (src?: string | null) => String(src ?? "SUPPLIER").toUpperCase() === "SUPPLIER";

/** Pembelian tunai/langsung wajib dibayar Finance sebelum barang dikirim. Utang (tempo) dibayar belakangan. */
export function needsPrepayment(pr: Pick<PrFlowRow, "procurementSource" | "paymentMethod">) {
  if (!isPurchaseSource(pr.procurementSource)) return false;
  if (String(pr.procurementSource ?? "").toUpperCase() === "RETAIL") return true;
  return String(pr.paymentMethod ?? "UTANG").toUpperCase() !== "UTANG";
}

export function isPaid(pr: PrFlowRow) {
  // Satu sumber: paymentStatus. Status DIBAYAR selalu ikut menyetelnya.
  return pr.status === "DIBAYAR" || String(pr.paymentStatus ?? "").toUpperCase() === "DIBAYAR";
}

/** Status pembelian yang masih boleh dibuatkan PO supplier. */
export const PO_ELIGIBLE_STATUSES = ["DISETUJUI", "PO_DIBUAT", "DIBAYAR"];

const forbid = (msg: string) => new ForbiddenException(msg);
const invalid = (msg: string) => new BadRequestException(msg);

function requireRole(role: string, allowed: string[], msg: string) {
  if (!allowed.includes(role)) throw forbid(msg);
}

/**
 * Validasi perubahan status request barang secara manual (endpoint /requests/:id/status).
 * DISETUJUI / DITOLAK tidak lewat sini: keduanya wajib lewat modul Persetujuan.
 * PO_DIBUAT hanya diubah sistem saat PO dibuat.
 */
export function assertPrTransition(
  pr: PrFlowRow,
  target: string,
  user: { id: number; role: string },
  ctx: PrFlowContext,
): void {
  const from = pr.status;
  const purchase = isPurchaseSource(pr.procurementSource);
  const to = target;

  if (to === "DISETUJUI" || to === "DITOLAK") {
    throw invalid("Persetujuan request dilakukan Finance lewat menu Persetujuan");
  }
  if (to === "PO_DIBUAT") {
    throw invalid("Status PO Dibuat otomatis berubah saat PO supplier dibuat");
  }

  // Pembayaran bisa dicatat setelah barang diterima (utang), tanpa mengubah status DITERIMA.
  if (to === "DIBAYAR" || to === "LUNAS") {
    if (!purchase) throw invalid("Request ambil stok gudang tidak memerlukan pembayaran");
    requireRole(user.role, FINANCE_ROLES, "Hanya Finance yang dapat mencatat pembayaran");
    if (!["DISETUJUI", "PO_DIBUAT", "DIKIRIM", "DITERIMA"].includes(from)) {
      throw invalid(`Request berstatus ${from} belum bisa dibayar — harus disetujui Finance terlebih dahulu`);
    }
    if (isPaid(pr) && pr.status === "DIBAYAR") throw invalid("Request ini sudah dibayar");
    if (!ctx.paymentProofProvided && !pr.paymentProofFileId) {
      throw invalid("Bukti pembayaran wajib dilampirkan");
    }
    return;
  }

  if (from === to) return;

  if (from === "DITOLAK" || from === "DIBATALKAN") {
    if (to !== "DIAJUKAN") {
      throw invalid(`Request sudah ${from === "DITOLAK" ? "ditolak" : "dibatalkan"} dan tidak bisa diproses lagi`);
    }
  }

  switch (to) {
    case "DIAJUKAN": {
      if (isPaid(pr)) throw invalid("Request yang sudah dibayar tidak bisa diajukan ulang");
      if (from === "DIKIRIM" || from === "DITERIMA") {
        throw invalid("Request yang barangnya sudah dikirim/diterima tidak bisa dikembalikan ke Diajukan");
      }
      return;
    }
    case "CEK_STOK": {
      requireRole(user.role, [...WAREHOUSE_ROLES, "PROCUREMENT"], "Cek stok dilakukan Gudang / Procurement");
      if (from !== "DIAJUKAN") throw invalid("Cek stok hanya untuk request yang berstatus Diajukan");
      return;
    }
    case "DIKIRIM": {
      if (!["DISETUJUI", "PO_DIBUAT", "DIBAYAR"].includes(from)) {
        throw invalid(
          from === "DIAJUKAN" || from === "CEK_STOK"
            ? "Request belum disetujui Finance, belum bisa dikirim"
            : `Request berstatus ${from} tidak bisa ditandai dikirim`,
        );
      }
      if (!purchase) {
        requireRole(user.role, WAREHOUSE_ROLES, "Hanya Gudang yang dapat menyerahkan barang stok");
        return;
      }
      requireRole(user.role, PROCUREMENT_ROLES, "Hanya Procurement yang dapat menandai barang dikirim");
      if (isSupplierSource(pr.procurementSource)) {
        if (ctx.activePoCount === 0) throw invalid("Buat PO supplier dulu sebelum menandai barang dikirim");
        if (!ctx.hasApprovedPo) throw invalid("PO supplier belum disetujui");
      }
      if (needsPrepayment(pr) && !isPaid(pr)) {
        throw invalid("Pembelian tunai/langsung harus dibayar Finance sebelum barang dikirim");
      }
      return;
    }
    case "DITERIMA": {
      if (purchase) {
        if (!ctx.isProjectConsumable) {
          throw invalid("Penerimaan barang pembelian dikonfirmasi Gudang lewat menu Penerimaan Barang");
        }
        requireRole(user.role, FINANCE_ROLES, "Hanya Finance yang dapat mengonfirmasi pembayaran dan penerimaan material proyek");
        if (!ctx.paymentProofProvided && !pr.paymentProofFileId) {
          throw invalid("Bukti pembayaran wajib dilampirkan");
        }
        return;
      }
      if (from !== "DIKIRIM") throw invalid("Barang belum diserahkan, belum bisa dikonfirmasi diterima");
      if (user.role !== "GUDANG" && !ADMIN_ROLES.includes(user.role) && user.id !== pr.requesterId) {
        throw forbid("Hanya pemohon atau Gudang yang dapat mengonfirmasi penerimaan");
      }
      return;
    }
    case "DIBATALKAN": {
      const owner = user.id === pr.requesterId;
      if (!owner && ![...FINANCE_ROLES, "PROCUREMENT"].includes(user.role)) {
        throw forbid("Hanya pemohon, Procurement, atau Finance yang dapat membatalkan request");
      }
      if (!["DIAJUKAN", "CEK_STOK", "DISETUJUI", "PO_DIBUAT"].includes(from) || isPaid(pr)) {
        throw invalid("Request yang sudah dibayar / dikirim / diterima tidak bisa dibatalkan");
      }
      if (ctx.activePoCount > 0) throw invalid("Batalkan PO supplier terkait terlebih dahulu");
      return;
    }
    default:
      throw invalid(`Status ${to} tidak dikenal`);
  }
}

/** Request hanya boleh diedit pemohon (atau admin) selama belum disetujui. */
export function assertPrEditable(pr: PrFlowRow, user: { id: number; role: string }) {
  if (!["DIAJUKAN", "CEK_STOK", "DITOLAK"].includes(pr.status)) {
    throw invalid("Request yang sudah disetujui / berjalan tidak bisa diubah");
  }
  if (pr.requesterId !== user.id && ![...ADMIN_ROLES, "BOS"].includes(user.role)) {
    throw forbid("Hanya pemohon yang dapat mengubah request ini");
  }
}

/** Validasi pembuatan PO supplier dari sebuah request. */
export function assertPoCanBeCreatedFromPr(pr: PrFlowRow) {
  if (!isSupplierSource(pr.procurementSource)) {
    throw invalid("Request ini pembelian ritel / stok gudang, tidak memakai PO supplier");
  }
  if (!PO_ELIGIBLE_STATUSES.includes(pr.status)) {
    throw invalid(
      pr.status === "DIAJUKAN" || pr.status === "CEK_STOK"
        ? "Request belum disetujui Finance, PO belum bisa dibuat"
        : `Request berstatus ${pr.status} tidak bisa dibuatkan PO`,
    );
  }
}

/** Validasi perubahan status pengiriman PO (DI_SUPPLIER -> DIKIRIM; SAMPAI hanya lewat Penerimaan Gudang). */
export function assertPoShipmentTransition(
  po: { status: string; shipmentStatus: string },
  target: string,
  user: { role: string },
  linkedPr?: PrFlowRow | null,
) {
  requireRole(user.role, PROCUREMENT_ROLES, "Hanya Procurement yang dapat mengubah status pengiriman");
  if (target === "SAMPAI") {
    throw invalid("Barang tiba dikonfirmasi Gudang lewat menu Penerimaan Barang");
  }
  if (target === po.shipmentStatus) return;
  if (target === "DI_SUPPLIER") {
    throw invalid("Status pengiriman tidak bisa dikembalikan ke Di Supplier");
  }
  if (po.shipmentStatus === "SAMPAI") throw invalid("Barang sudah tiba, status pengiriman tidak bisa diubah");
  if (po.status !== "DISETUJUI") {
    throw invalid("PO harus disetujui terlebih dahulu sebelum ditandai dikirim");
  }
  if (linkedPr) {
    if (["DIAJUKAN", "CEK_STOK", "DITOLAK", "DIBATALKAN"].includes(linkedPr.status)) {
      throw invalid(`Request terkait berstatus ${linkedPr.status}, PO belum bisa dikirim`);
    }
    if (needsPrepayment(linkedPr) && !isPaid(linkedPr)) {
      throw invalid("Pembelian tunai/langsung harus dibayar Finance sebelum barang dikirim");
    }
  }
}

/** Penerimaan barang pembelian hanya bisa dilakukan setelah Procurement menandai DIKIRIM. */
export function assertReceivable(pr: PrFlowRow | null | undefined) {
  if (!pr) return;
  if (!isPurchaseSource(pr.procurementSource)) return;
  if (pr.status === "DIKIRIM") return;
  if (pr.status === "DITERIMA") throw invalid("Barang untuk request ini sudah diterima");
  throw invalid(
    pr.status === "DIBATALKAN" || pr.status === "DITOLAK"
      ? `Request berstatus ${pr.status}, barang tidak bisa diterima`
      : "Procurement belum menandai barang dikirim, penerimaan belum bisa dilakukan",
  );
}
