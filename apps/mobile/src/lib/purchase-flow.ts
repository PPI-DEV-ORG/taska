import { evaluateFlow, type FlowResult, type FlowStepDef } from "@/lib/flow";

/**
 * Alur pembelian — harus selaras dengan aturan backend (apps/api/src/procurement/purchase-flow.ts):
 *  Diajukan -> Disetujui Finance -> [PO (supplier)] + [Bayar (tunai/ritel)] -> Dikirim (Procurement) -> Diterima (Gudang) -> [Lunas (tempo)]
 */

export type PurchaseKind = "SUPPLIER" | "RETAIL" | "GUDANG";

export type PurchaseFlowInput = {
  source: PurchaseKind;
  /** "KAS" | "UTANG" — hanya relevan untuk supplier. Ritel selalu dibayar dulu. */
  paymentMethod?: string | null;
  rawStatus: string;
  isPaid: boolean;
  poCount: number;
  poApproved: boolean;
  isShipped?: boolean;
  isReceived?: boolean;
  rejectReason?: string | null;
  isProjectConsumable?: boolean;
};

export const purchaseKind = (src?: string | null): PurchaseKind => {
  const s = String(src ?? "SUPPLIER").toUpperCase();
  return s === "RETAIL" ? "RETAIL" : s === "GUDANG" ? "GUDANG" : "SUPPLIER";
};

/** Bayar dulu sebelum barang dikirim: ritel selalu, supplier bila tunai. */
export function needsPrepayment(source: PurchaseKind, paymentMethod?: string | null) {
  if (source === "RETAIL") return true;
  if (source === "SUPPLIER") return String(paymentMethod ?? "UTANG").toUpperCase() !== "UTANG";
  return false;
}

export function purchaseSteps(source: PurchaseKind, paymentMethod?: string | null, isProjectConsumable?: boolean): FlowStepDef[] {
  if (source === "RETAIL" && isProjectConsumable) {
    return [
      { key: "request", label: "Diajukan", owner: "pemohon", hint: "Permintaan material khusus proyek dibuat." },
      { key: "approve", label: "Disetujui", owner: "finance", needs: ["request"], hint: "Finance menyetujui pembelian material proyek." },
      { key: "pay", label: "Dibayar & Selesai", owner: "finance", needs: ["approve"], hint: "Finance membayar & mengunggah bukti bayar. Material langsung masuk ke BOQ proyek." },
    ];
  }
  const prepay = needsPrepayment(source, paymentMethod);
  if (source === "GUDANG") {
    return [
      { key: "request", label: "Diajukan", owner: "pemohon", hint: "Pemohon mengajukan barang dari stok gudang." },
      { key: "approve", label: "Disetujui", owner: "finance", needs: ["request"], hint: "Finance menyetujui permintaan." },
      { key: "ship", label: "Diserahkan", owner: "gudang", needs: ["approve"], hint: "Gudang menyiapkan & menyerahkan barang." },
      { key: "receive", label: "Diterima", owner: "pemohon", needs: ["ship"], hint: "Pemohon / tim proyek mengonfirmasi barang sudah diterima." },
    ];
  }
  const steps: FlowStepDef[] = [
    { key: "request", label: "Diajukan", owner: "pemohon", hint: "Permintaan pembelian dibuat." },
    { key: "approve", label: "Disetujui", owner: "finance", needs: ["request"], hint: "Finance (dan Bos bila nilainya besar) menyetujui." },
  ];
  if (source === "SUPPLIER") {
    steps.push({ key: "po", label: "PO Pemasok", owner: "procurement", needs: ["approve"], hint: "Procurement membuat PO ke pemasok." });
  }
  if (prepay) {
    steps.push({ key: "pay", label: "Dibayar", owner: "finance", needs: ["approve"], hint: "Finance membayar & mengunggah bukti bayar." });
  }
  const beforeShip = ["approve", ...(source === "SUPPLIER" ? ["po"] : []), ...(prepay ? ["pay"] : [])];
  steps.push(
    { key: "ship", label: "Dikirim", owner: "procurement", needs: beforeShip, hint: "Procurement menandai barang sudah dikirim penjual." },
    { key: "receive", label: "Diterima", owner: "gudang", needs: ["ship"], hint: "Gudang mengecek fisik & menerima barang di menu Penerimaan." },
  );
  if (!prepay) {
    steps.push({ key: "settle", label: "Lunas", owner: "finance", needs: ["receive"], hint: "Finance melunasi tagihan (tempo)." });
  }
  return steps;
}

const AFTER_APPROVAL = ["DISETUJUI", "PO_DIBUAT", "DIBAYAR", "DIKIRIM", "DITERIMA"];

export function evaluatePurchase(input: PurchaseFlowInput): FlowResult {
  const { source, rawStatus: st, isProjectConsumable } = input;
  const defs = purchaseSteps(source, input.paymentMethod, isProjectConsumable);
  const done = new Set<string>(["request"]);
  if (AFTER_APPROVAL.includes(st)) done.add("approve");
  if (input.poCount > 0 || input.poApproved) done.add("po");
  if (input.isPaid || (isProjectConsumable && st === "DITERIMA")) done.add("pay");
  if (st === "DIKIRIM" || st === "DITERIMA" || input.isShipped || input.isReceived) done.add("ship");
  if (st === "DITERIMA" || input.isReceived) done.add("receive");
  if ((st === "DITERIMA" || input.isReceived) && input.isPaid) done.add("settle");
  const stopped =
    st === "DITOLAK"
      ? { label: "Ditolak", reason: input.rejectReason ?? undefined }
      : st === "DIBATALKAN"
      ? { label: "Dibatalkan" }
      : null;
  return evaluateFlow(defs, done, stopped);
}
