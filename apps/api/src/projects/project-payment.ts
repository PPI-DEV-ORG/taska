import type { PrismaClient } from "../generated/prisma/client.js";
import { computeProjectPaymentStatus, type ProjectPaymentStatus } from "../finance/settlement.js";

type Db = Pick<PrismaClient, "project" | "invoiceOut" | "clientPO">;

/**
 * Hitung & simpan status bayar project (Belum lunas / Lunas sebagian / Lunas).
 * Nilai kontrak: total SO (DPP + PPN) milik project / penawarannya; bila tidak ada SO, nilai penawaran.
 * Proforma invoice tidak dihitung (bukan tagihan resmi).
 */
export async function syncProjectPaymentStatus(db: Db, projectId: number): Promise<ProjectPaymentStatus | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, paymentStatus: true, quotationId: true, quotation: { select: { grandTotal: true } } },
  });
  if (!project) return null;

  const [invoices, sos] = await Promise.all([
    db.invoiceOut.findMany({
      where: { projectId, isProforma: false, status: { not: "BATAL" } },
      select: { amount: true, ppn: true, total: true, pph: true, paidAmount: true, status: true, type: true },
    }),
    db.clientPO.findMany({
      where: {
        OR: [{ projectId }, ...(project.quotationId ? [{ quotationId: project.quotationId }] : [])],
      },
      select: { amount: true, ppn: true },
    }),
  ]);

  const soContract = sos.reduce((s, so) => s + Number(so.amount || 0) + Number(so.ppn || 0), 0);
  const quoteContract = Number(project.quotation?.grandTotal || 0);
  const { status } = computeProjectPaymentStatus(invoices, soContract > 0 ? soContract : quoteContract);

  if (status !== project.paymentStatus) {
    await db.project.update({ where: { id: projectId }, data: { paymentStatus: status } }).catch(() => {});
  }
  return status;
}
