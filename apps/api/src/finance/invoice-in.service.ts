import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PostingService } from "../accounting/posting.service.js";
import { MappingService } from "../accounting/mapping.service.js";
import { PostingRules } from "../accounting/posting.rules.js";
import { PREPAID_OFFSET_REF, getDirectPrepayment } from "../accounting/purchase-payment.js";
import { assertCanPaySupplier } from "../procurement/purchase-flow.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import { Prisma } from "../generated/prisma/client.js";
import type { InvoiceIn, Role } from "../generated/prisma/client.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { InvoiceInDto, PaymentDto } from "./dto.js";
import { cleanName } from "../common/utils/names.js";

type StatusFilter = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "BATAL";

/** Label metode bayar dari UI (mis. "Kas", "Transfer Bank") -> enum PaymentMethod. */
function normalizeMethod(m?: string): "TRANSFER" | "TUNAI" | "QRIS" | "LAINNYA" {
  const v = String(m || "").toUpperCase().trim();
  if (v === "TRANSFER" || v === "TUNAI" || v === "QRIS" || v === "LAINNYA") return v;
  if (/KAS|TUNAI|CASH/.test(v)) return "TUNAI";
  if (/QRIS/.test(v)) return "QRIS";
  return "TRANSFER";
}

@Injectable()
export class InvoiceInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly docnum: DocumentNumberService,
    private readonly approvals: ApprovalsService,
    private readonly notifications: NotificationsService,
    private readonly postingService: PostingService,
    private readonly mappingService: MappingService,
  ) {}

  private compute(row: InvoiceIn): StatusFilter {
    if (row.status === "BATAL") return "BATAL";
    const total = Number(row.total);
    const paid = Number(row.paidAmount);
    if (paid >= total && total > 0) return "PAID";
    if (new Date(row.dueDate).getTime() < Date.now()) return "OVERDUE";
    if (paid > 0) return "PARTIAL";
    return "UNPAID";
  }

  private async sync(row: InvoiceIn) {
    const status = this.compute(row);
    if (status !== row.status) {
      await this.prisma.main.invoiceIn.update({ where: { id: row.id }, data: { status } });
    }
    return { ...row, status };
  }

  private async syncLinkedRequest(supplierPoId?: number | null, payFileId?: number | null) {
    if (!supplierPoId) return;
    try {
      const po = await this.prisma.main.supplierPO.findUnique({
        where: { id: supplierPoId },
        select: { id: true, requestId: true, shipmentStatus: true },
      });
      if (po?.requestId) {
        const pr = await this.prisma.main.purchaseRequest.findUnique({
          where: { id: po.requestId },
          select: { status: true },
        });
        const targetStatus =
          po.shipmentStatus === "SAMPAI"
            ? "DITERIMA"
            : po.shipmentStatus === "DIKIRIM"
              ? "DIKIRIM"
              : pr?.status === "DISETUJUI" || pr?.status === "PO_DIBUAT"
                ? "DIBAYAR"
                : undefined;

        await this.prisma.main.purchaseRequest.updateMany({
          where: { id: po.requestId },
          data: {
            paymentStatus: "DIBAYAR",
            ...(targetStatus ? { status: targetStatus as never } : {}),
            ...(payFileId ? { paymentProofFileId: payFileId } : {}),
          },
        });
        if (payFileId) {
          await this.prisma.main.file.update({
            where: { id: payFileId },
            data: { refType: "purchase_request_payment", refId: String(po.requestId) },
          }).catch(() => {});
        }
        this.notifications.dataChange("purchase-requests", "update", po.requestId);
        this.notifications.dataChange("purchase-requests", "status", po.requestId);
      }
      // Pelunasan lewat invoice menggantikan penanda manual (Lunas / Sampai belum lunas).
      await this.prisma.main.supplierPO.update({ where: { id: supplierPoId }, data: { manualStatus: null } }).catch(() => {});
      this.notifications.dataChange("supplier-pos", "status", supplierPoId);
      this.notifications.dataChange("supplier-pos", "update", supplierPoId);
    } catch (e) {
      console.warn("Gagal sinkron pelunasan ke purchase-request:", e);
    }
  }

  private where(q: PageQuery & { status?: string; supplierId?: number }) {
    return {
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.status === "OVERDUE"
        ? { status: { in: ["UNPAID", "PARTIAL"] as never }, dueDate: { lt: new Date() } }
        : q.status
          ? { status: q.status as never }
          : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { supplier: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };
  }

  /** Bentuk metadata (di-spread ke respons) dari kolom InvoiceIn. Berkas tidak ikut: itu sudah kolom fileId/transferFileId. */
  private rowToMeta(r: any): Record<string, any> {
    const str = (v: unknown) => (v == null || v === "" ? undefined : v);
    const meta: Record<string, any> = {
      notes: str(r.notes),
      category: str(r.category),
      debitAccount: str(r.debitAccount),
      date: r.date ? new Date(r.date).toISOString().slice(0, 10) : undefined,
      items: Array.isArray(r.items) ? r.items : undefined,
      coaAccount: str(r.coaAccount),
      pph: r.pph == null ? undefined : Number(r.pph),
      pphMode: str(r.pphMode),
      tipePph: str(r.tipePph),
    };
    for (const k of Object.keys(meta)) if (meta[k] === undefined) delete meta[k];
    return meta;
  }

  private async saveMeta(id: number, patch: Record<string, any>) {
    const data: Record<string, unknown> = {};
    const strOrNull = (v: unknown) => (v == null || v === "" ? null : String(v));
    for (const k of ["notes", "category", "debitAccount", "coaAccount", "pphMode", "tipePph"]) {
      if (patch[k] !== undefined) data[k] = strOrNull(patch[k]);
    }
    if (patch.pph !== undefined) data.pph = patch.pph == null || patch.pph === "" ? null : Number(patch.pph);
    if (patch.date !== undefined) data.date = patch.date ? new Date(patch.date) : null;
    if (patch.items !== undefined) data.items = patch.items == null ? Prisma.DbNull : (patch.items as Prisma.InputJsonValue);
    try {
      const row = Object.keys(data).length
        ? await this.prisma.main.invoiceIn.update({ where: { id }, data: data as never })
        : await this.prisma.main.invoiceIn.findUnique({ where: { id } });
      return row ? this.rowToMeta(row) : {};
    } catch (e) {
      console.warn("Gagal menyimpan metadata invoice masuk #" + id + ":", (e as Error).message);
      const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
      return row ? this.rowToMeta(row) : {};
    }
  }

  async list(q: PageQuery & { status?: string; supplierId?: number }) {
    const where = this.where(q);
    const [rows, total] = await Promise.all([
      this.prisma.main.invoiceIn.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          supplierPo: { select: { id: true, number: true, ppnMode: true } },
          payments: { orderBy: { date: "desc" } },
          _count: { select: { payments: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["dueDate", "createdAt"], "dueDate"),
        ...pageSkip(q),
      }),
      this.prisma.main.invoiceIn.count({ where }),
    ]);
    const synced = await Promise.all(rows.map((r) => this.sync(r)));
    const metaMap = new Map<number, any>(synced.map((r) => [r.id, this.rowToMeta(r)]));

    const fileIds = new Set<number>();
    for (const r of synced) {
      const m = metaMap.get(r.id) || {};
      const fid = r.fileId;
      const tfid = r.transferFileId;
      if (typeof fid === "number" && fid > 0) fileIds.add(fid);
      if (typeof tfid === "number" && tfid > 0) fileIds.add(tfid);
      for (const p of (r as any).payments ?? []) {
        if (typeof p.fileId === "number" && p.fileId > 0) fileIds.add(p.fileId);
      }
    }
    const files = fileIds.size
      ? await this.prisma.main.file.findMany({
          where: { id: { in: Array.from(fileIds) } },
          select: { id: true, originalName: true, size: true, mimeType: true },
        })
      : [];
    const fileMap = new Map(files.map((f) => [f.id, f]));

    const items = synced.map((r) => {
      const m = metaMap.get(r.id) || {};
      const paymentWithFile = ((r as any).payments ?? []).find((p: any) => p.fileId);
      const effectiveFileId = r.fileId ?? null;
      const effectiveTransferFileId =
        r.transferFileId ?? paymentWithFile?.fileId ?? null;
      return {
        ...r,
        ...m,
        fileId: effectiveFileId,
        file: effectiveFileId ? fileMap.get(Number(effectiveFileId)) ?? null : null,
        transferFileId: effectiveTransferFileId,
        transferFile: effectiveTransferFileId ? fileMap.get(Number(effectiveTransferFileId)) ?? null : null,
      };
    });
    return paginate(items, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.invoiceIn.findUnique({
      where: { id },
      include: { supplier: true, supplierPo: true, payments: { orderBy: { date: "desc" } } },
    });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    const [synced, approval] = await Promise.all([this.sync(row), this.approvals.getFor("INVOICE_IN", id)]);
    const m = this.rowToMeta(row);
    const paymentWithFile = ((synced as any).payments ?? []).find((p: any) => p.fileId);
    const effectiveFileId = synced.fileId ?? null;
    const effectiveTransferFileId =
      synced.transferFileId ?? paymentWithFile?.fileId ?? null;
    const [file, transferFile] = await Promise.all([
      effectiveFileId
        ? this.prisma.main.file.findUnique({
            where: { id: Number(effectiveFileId) },
            select: { id: true, originalName: true, size: true, mimeType: true },
          })
        : null,
      effectiveTransferFileId
        ? this.prisma.main.file.findUnique({
            where: { id: Number(effectiveTransferFileId) },
            select: { id: true, originalName: true, size: true, mimeType: true },
          })
        : null,
    ]);
    return {
      ...synced,
      ...m,
      fileId: effectiveFileId,
      file,
      transferFileId: effectiveTransferFileId,
      transferFile,
      approval,
    };
  }

  async create(dto: InvoiceInDto, user: RequestUser) {
    let supplier = dto.supplierId
      ? await this.prisma.main.supplier.findUnique({ where: { id: dto.supplierId } })
      : null;

    if (!supplier && cleanName(dto.supplierName)) {
      const supplierName = cleanName(dto.supplierName);
      // Cari dulu (tidak peka huruf besar/kecil); baru dibuat bila memang belum ada — nama supplier unik.
      supplier = await this.prisma.main.supplier.findFirst({
        where: { name: supplierName },
      });
      if (!supplier) {
        supplier = await this.prisma.main.supplier.create({
          data: {
            name: supplierName,
            status: "AKTIF",
            notes: dto.category ? `Vendor Tagihan: ${dto.category}` : "Vendor Tagihan Masuk Langsung",
          },
        });
      }
    }

    if (!supplier) {
      supplier = await this.prisma.main.supplier.findFirst({
        where: { name: "Vendor / Tagihan Operasional" },
      });
      if (!supplier) {
        supplier = await this.prisma.main.supplier.create({
          data: {
            name: "Vendor / Tagihan Operasional",
            status: "AKTIF",
            notes: "Vendor default untuk tagihan operasional masuk langsung",
          },
        });
      }
    }

    const number = dto.number?.trim() || null;
    if (number) {
      const dup = await this.prisma.main.invoiceIn.findFirst({ where: { number } });
      if (dup) throw new BadRequestException(`Nomor ${number} sudah dipakai`);
    }

    const isPaid = !!dto.paid;
    if (isPaid) assertCanPaySupplier(user.role);
    const payFileId = dto.paymentFileId ?? dto.transferFileId;

    if (!dto.fileId) {
      throw new BadRequestException("File faktur pemasok wajib diunggah");
    }
    await this.assertPpnWithinPo(dto.supplierPoId, Number(dto.ppn || 0));
    if (isPaid && !payFileId) {
      throw new BadRequestException("Bukti transfer / pembayaran wajib diunggah untuk status lunas");
    }

    const row = await this.prisma.main.invoiceIn.create({
      data: {
        number,
        supplierId: supplier.id,
        supplierPoId: dto.supplierPoId,
        amount: dto.amount,
        ppn: dto.ppn ?? 0,
        total: dto.total,
        dueDate: new Date(dto.dueDate),
        // Uang keluar hanya dicatat lewat recordPayment (baris Payment + jurnal kas) di bawah.
        status: "UNPAID",
        paidAmount: 0,
        fileId: dto.fileId,
        transferFileId: payFileId,
      },
      include: { supplier: true },
    });

    const meta = await this.saveMeta(row.id, {
      notes: dto.notes || undefined,
      category: dto.category || undefined,
      debitAccount: dto.debitAccount || undefined,
      date: dto.date || undefined,
      items: dto.items || undefined,
      coaAccount: dto.coaAccount || undefined,
      pph: dto.pph || undefined,
      pphMode: dto.pphMode || undefined,
      tipePph: dto.tipePph || undefined,
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "invoiceIn", refId: String(row.id) },
      }).catch(() => {});
    }
    if (payFileId) {
      await this.prisma.main.file.update({
        where: { id: payFileId },
        data: { refType: "payment", refId: `in-${row.id}` },
      }).catch(() => {});
    }

    const approval = await this.approvals.request({
      kind: "INVOICE_IN",
      entityId: row.id,
      title: `Invoice supplier ${supplier.name}${number ? ` (${number})` : ""}`,
      amount: Number(dto.total),
      requestedBy: user,
      href: `/invoice-in/${row.id}`,
      confirmRoles: isPaid ? [user.role as Role] : undefined,
    });
    if (isPaid && approval.status === "MENUNGGU") {
      await this.prisma.main.approval.update({
        where: { id: approval.id },
        data: { status: "DISETUJUI" },
      }).catch(() => {});
      await this.prisma.main.approvalStep.updateMany({
        where: { approvalId: approval.id },
        data: { status: "DISETUJUI", decidedById: user.id, decidedAt: new Date() },
      }).catch(() => {});
    }

    // Posting Akuntansi E5: Tagihan Supplier Masuk (Invoice In)
    await this.postInvoiceInJournalIfEligible(row.id, user.id);

    // Pembelian yang sudah dibayar di muka (Request Barang / PO ditandai lunas) -> kompensasi, bukan kas keluar lagi
    const offset = await this.applyPrepaidOffset(row.id, user);

    if (isPaid) {
      const fresh = await this.prisma.main.invoiceIn.findUniqueOrThrow({ where: { id: row.id } });
      const sisa = Math.round((Number(fresh.total) - Number(fresh.paidAmount)) * 100) / 100;
      if (sisa > 0) {
        await this.recordPayment(
          fresh,
          {
            amount: sisa,
            date: dto.date,
            method: (dto.paymentMethod as any) ?? "TRANSFER",
            reference: dto.paymentReference || `LUNAS-${number || row.id}`,
            coaAccount: dto.coaAccount,
            fileId: payFileId,
          },
          user,
        );
      } else if (offset > 0) {
        console.warn(`Invoice supplier #${row.id} lunas lewat kompensasi pembayaran di muka; tidak ada kas keluar tambahan.`);
      }
      await this.syncLinkedRequest(row.supplierPoId, payFileId);
    }

    await this.audit.log({
      actor: user,
      action: isPaid ? "BUAT_DAN_LUNASI_INVOICE_MASUK" : "BUAT_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: row.id,
      detail: `total Rp${dto.total} — ${supplier.name}${isPaid ? " (Langsung Lunas)" : ""}${offset > 0 ? ` — dikompensasi pembayaran di muka Rp${offset}` : ""}`,
    });
    const finalRow = await this.prisma.main.invoiceIn.findUniqueOrThrow({ where: { id: row.id }, include: { supplier: true } });
    return { ...(await this.sync(finalRow)), ...meta };
  }

  async update(id: number, dto: InvoiceInDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");

    let resolvedSupplierId = dto.supplierId;
    if (!resolvedSupplierId && cleanName(dto.supplierName)) {
      const supplierName = cleanName(dto.supplierName);
      let supp = await this.prisma.main.supplier.findFirst({ where: { name: supplierName } });
      if (!supp) {
        supp = await this.prisma.main.supplier.create({
          data: {
            name: supplierName,
            status: "AKTIF",
            notes: dto.category ? `Vendor Tagihan: ${dto.category}` : "Vendor Tagihan Masuk Langsung",
          },
        });
      }
      resolvedSupplierId = supp.id;
    }

    const payFileId = dto.paymentFileId ?? dto.transferFileId;

    const paid = Number(row.paidAmount);
    const newTotal = dto.total !== undefined ? Number(dto.total) : Number(row.total);
    if (paid > 0 && newTotal < paid) {
      throw new BadRequestException(
        `Total tagihan (Rp${newTotal.toLocaleString("id-ID")}) tidak boleh lebih kecil dari yang sudah dibayar (Rp${paid.toLocaleString("id-ID")}). Void pembayaran terlebih dahulu.`,
      );
    }
    if (
      (dto.ppn !== undefined && Number(dto.ppn) !== Number(row.ppn)) ||
      (dto.supplierPoId !== undefined && dto.supplierPoId !== row.supplierPoId)
    ) {
      await this.assertPpnWithinPo(
        dto.supplierPoId !== undefined ? dto.supplierPoId : row.supplierPoId,
        Number(dto.ppn !== undefined ? dto.ppn : row.ppn || 0),
        id,
      );
    }
    const financialChange =
      (dto.total !== undefined && Number(dto.total) !== Number(row.total)) ||
      (dto.amount !== undefined && Number(dto.amount) !== Number(row.amount)) ||
      (dto.ppn !== undefined && Number(dto.ppn) !== Number(row.ppn)) ||
      (dto.supplierPoId !== undefined && dto.supplierPoId !== row.supplierPoId) ||
      (dto.pph !== undefined && Number(dto.pph || 0) !== Number(row.pph || 0));
    if (financialChange) {
      const closed = await (this.prisma.main as any).journalEntry.findFirst({
        where: { sourceType: "InvoiceIn", sourceId: id, status: "POSTED", period: { status: "CLOSED" } },
        select: { number: true },
      });
      if (closed) {
        throw new BadRequestException(`Nilai tagihan tidak bisa diubah: jurnal ${closed.number} sudah masuk periode yang ditutup.`);
      }
    }

    const updated = await this.prisma.main.invoiceIn.update({
      where: { id },
      data: {
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(resolvedSupplierId !== undefined ? { supplierId: resolvedSupplierId } : {}),
        ...(dto.supplierPoId !== undefined ? { supplierPoId: dto.supplierPoId } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.ppn !== undefined ? { ppn: dto.ppn } : {}),
        ...(dto.total !== undefined ? { total: dto.total } : {}),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.fileId !== undefined ? { fileId: dto.fileId } : {}),
        ...(payFileId !== undefined ? { transferFileId: payFileId } : {}),
      },
      include: { supplier: true, supplierPo: true, payments: { orderBy: { date: "desc" } } },
    });
    const meta = await this.saveMeta(id, {
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.debitAccount !== undefined ? { debitAccount: dto.debitAccount } : {}),
      ...(dto.date !== undefined ? { date: dto.date } : {}),
      ...(dto.items !== undefined ? { items: dto.items } : {}),
      ...(dto.coaAccount !== undefined ? { coaAccount: dto.coaAccount } : {}),
      ...(dto.pph !== undefined ? { pph: dto.pph } : {}),
      ...(dto.pphMode !== undefined ? { pphMode: dto.pphMode } : {}),
      ...(dto.tipePph !== undefined ? { tipePph: dto.tipePph } : {}),
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "invoiceIn", refId: String(id) },
      }).catch(() => {});
    }
    if (payFileId) {
      await this.prisma.main.file.update({
        where: { id: payFileId },
        data: { refType: "payment", refId: `in-${id}` },
      }).catch(() => {});
      await this.prisma.main.payment.updateMany({
        where: { invoiceInId: id },
        data: { fileId: payFileId },
      }).catch(() => {});
    }

    await this.audit.log({
      actor: user,
      action: "UBAH_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: updated.number ?? `invoice #${id}`,
    });
    await this.postInvoiceInJournalIfEligible(id, user.id);
    return this.get(id);
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    const payCount = await this.prisma.main.payment.count({ where: { invoiceInId: id } });
    if (payCount > 0 || Number(row.paidAmount) > 0) {
      throw new BadRequestException(
        "Tagihan supplier yang sudah dibayar tidak bisa dihapus. Void pembayarannya dulu, atau batalkan tagihan.",
      );
    }
    await this.prisma.main.$transaction(async (tx) => {
      // Wajib berhasil: jangan sampai tagihan hilang tapi jurnal hutangnya tertinggal
      await this.postingService.reverseAllForSource("InvoiceIn", id, "Tagihan supplier dihapus", user.id, tx);
      await tx.approval.deleteMany({ where: { kind: "INVOICE_IN", entityId: id } });
      await tx.invoiceIn.delete({ where: { id } });
    });

    if (row.supplierPoId) {
      this.notifications.dataChange("supplier-pos", "status", row.supplierPoId);
      this.notifications.dataChange("supplier-pos", "update", row.supplierPoId);
    }

    await this.audit.log({
      actor: user,
      action: "HAPUS_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: row.number ?? `invoice #${id}`,
    });
    return { deleted: true, id };
  }

  /** Status setelah paidAmount berubah. */
  private statusAfterPayment(row: { total: unknown; paidAmount: unknown; dueDate: Date }): StatusFilter {
    const total = Number(row.total);
    const paid = Number(row.paidAmount);
    if (total > 0 && paid >= total) return "PAID";
    if (new Date(row.dueDate).getTime() < Date.now()) return "OVERDUE";
    if (paid > 0) return "PARTIAL";
    return "UNPAID";
  }

  /**
   * Inti pencatatan pembayaran tagihan supplier (dipakai addPayment & create "langsung lunas").
   * Baris Payment + jurnal (kas E6, atau kompensasi E6b) dalam SATU transaksi, dengan penjaga atomik
   * agar total pembayaran tidak pernah melebihi total tagihan (anti double click / double submit).
   */
  private async recordPayment(
    row: InvoiceIn,
    p: {
      amount: number;
      date?: string | Date;
      method?: string;
      reference?: string;
      coaAccount?: string;
      accountCode?: string;
      fileId?: number | null;
      /** Kompensasi pembayaran di muka (bukan kas). */
      offset?: { vatReversal: number; journals: string[] };
    },
    user: RequestUser,
  ) {
    const amount = Math.round(Number(p.amount) * 100) / 100;
    if (!(amount > 0)) throw new BadRequestException("Nominal pembayaran harus lebih dari 0");
    const total = Number(row.total);
    const maxPaidBefore = new Prisma.Decimal(total).minus(amount);
    const mappings = await this.mappingService.getAll();
    const chosenAccount = p.accountCode || p.coaAccount || mappings.CASH_DEFAULT || "1000.02";
    const payDate = p.date ? new Date(p.date) : new Date();
    const docNo = row.number || `INV-IN-${String(row.id).padStart(3, "0")}`;
    const reference = p.offset
      ? `${PREPAID_OFFSET_REF} ${p.offset.journals.join(", ")}`.trim()
      : p.coaAccount
        ? p.reference?.includes(`[AKUN:`)
          ? p.reference
          : `[AKUN:${p.coaAccount}] ${p.reference || ""}`.trim()
        : p.reference;

    return this.prisma.main.$transaction(
      async (tx) => {
        const guard = await tx.invoiceIn.updateMany({
          where: { id: row.id, status: { not: "BATAL" }, paidAmount: { lte: maxPaidBefore } },
          data: { paidAmount: { increment: amount } },
        });
        if (guard.count === 0) {
          throw new ConflictException(
            "Pembayaran tagihan ini baru saja dicatat oleh proses lain atau sisa tagihannya sudah berubah. Muat ulang lalu cek sisa tagihan.",
          );
        }
        const payment = await tx.payment.create({
          data: {
            invoiceInId: row.id,
            amount,
            date: payDate,
            method: p.offset ? "LAINNYA" : (normalizeMethod(p.method) as any),
            reference,
            accountCode: p.offset ? null : chosenAccount,
            fileId: p.fileId ?? undefined,
            createdById: user.id,
          },
        });
        await this.postingService.post(
          {
            sourceType: "Payment",
            sourceId: payment.id,
            event: "settled",
            source: "INVOICE_IN_PAYMENT",
            date: payDate,
            memo: p.offset
              ? `Kompensasi Tagihan Supplier #${row.number || row.id} dengan Pembayaran di Muka`
              : `Pembayaran Tagihan Supplier #${row.number || row.id}`,
            refNo: `${docNo}/PAY`,
            createdById: user.id,
            lines: p.offset
              ? PostingRules.buildPrepaidOffsetLines(
                  { number: docNo, amount, vatReversal: p.offset.vatReversal, supplierId: row.supplierId },
                  mappings,
                )
              : PostingRules.buildSupplierPaymentLines(
                  {
                    id: payment.id,
                    sourceType: "INVOICE_IN",
                    sourceId: row.id,
                    amount,
                    accountCode: chosenAccount,
                    partyType: "SUPPLIER",
                    partyId: row.supplierId || undefined,
                  },
                  mappings,
                ),
          },
          tx,
        );
        const fresh = await tx.invoiceIn.findUniqueOrThrow({ where: { id: row.id } });
        const updated = await tx.invoiceIn.update({
          where: { id: row.id },
          data: {
            status: this.statusAfterPayment(fresh) as never,
            ...(p.fileId && !p.offset ? { transferFileId: p.fileId } : {}),
          },
          include: { supplier: true, payments: { orderBy: { date: "desc" } } },
        });
        return { payment, updated };
      },
      { timeout: 20_000 },
    );
  }

  /**
   * Bila pembelian (PO / Request Barang) untuk tagihan ini sudah dibayar langsung di muka,
   * lunasi tagihan lewat kompensasi (Dr Hutang Cr GRNI) sebesar sisa pembayaran di muka yang belum terpakai.
   * Mengembalikan nominal yang dikompensasi.
   */
  private async applyPrepaidOffset(id: number, user: RequestUser): Promise<number> {
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row || !row.supplierPoId || row.status === "BATAL") return 0;
    const remaining = Math.round((Number(row.total) - Number(row.paidAmount)) * 100) / 100;
    if (remaining <= 0) return 0;
    const mappings = await this.mappingService.getAll();
    const prepaid = await getDirectPrepayment(this.prisma.main, { supplierPoId: row.supplierPoId }, mappings);
    const amount = Math.min(remaining, prepaid.available);
    if (amount <= 0) return 0;
    // Porsi PPN yang sudah diakui saat bayar di muka, dibatasi PPN tagihan ini (agar PPN Masukan tidak ganda)
    const vatReversal = Math.min(prepaid.vat, Number(row.ppn || 0), amount);
    await this.recordPayment(row, { amount, offset: { vatReversal, journals: prepaid.journals } }, user);
    await this.audit.log({
      actor: user,
      action: "KOMPENSASI_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: `Rp${amount} dikompensasi dengan pembayaran di muka (${prepaid.journals.join(", ")})`,
    });
    return amount;
  }

  async addPayment(id: number, dto: PaymentDto, user: RequestUser) {
    assertCanPaySupplier(user.role);
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    if (row.status === "BATAL") throw new BadRequestException("Invoice dibatalkan");
    const approval = await this.approvals.getFor("INVOICE_IN", id);
    if (approval && approval.status !== "DISETUJUI") {
      // Yang berhak membayar (hak Setujui PO Supplier) sekaligus menyetujui tagihannya.
      await this.approvals.decide(approval.id, user, true, "Disetujui otomatis saat pembayaran dicatat").catch(() => {});
    }

    // Cegah kas keluar dua kali: pakai dulu pembayaran di muka (PR / PO lunas) bila ada.
    const offset = await this.applyPrepaidOffset(id, user);
    const current = await this.prisma.main.invoiceIn.findUniqueOrThrow({ where: { id } });
    const total = Number(current.total);
    const paidBefore = Number(current.paidAmount);
    const remaining = Math.max(0, Math.round((total - paidBefore) * 100) / 100);
    if (remaining <= 0) {
      throw new BadRequestException(
        offset > 0
          ? `Tagihan ini sudah dibayar di muka (lewat Request Barang / PO Lunas) dan otomatis dikompensasi Rp${offset.toLocaleString("id-ID")}. Tidak perlu transfer lagi.`
          : `Tagihan ini sudah lunas (dibayar Rp${paidBefore.toLocaleString("id-ID")}). Pembayaran tidak dicatat agar tidak dobel.`,
      );
    }

    let amount = Math.round(Number(dto.amount) * 100) / 100;
    if (amount > remaining) {
      if (amount - remaining <= 1) amount = remaining;
      else {
        throw new BadRequestException(
          `Pembayaran Rp${amount.toLocaleString("id-ID")} melebihi sisa tagihan supplier Rp${remaining.toLocaleString("id-ID")}` +
            `${offset > 0 ? ` (Rp${offset.toLocaleString("id-ID")} sudah dikompensasi dengan pembayaran di muka)` : ""}.`,
        );
      }
    }

    if (!dto.fileId) {
      throw new BadRequestException("Bukti transfer / pembayaran wajib diunggah");
    }

    const { updated } = await this.recordPayment(
      current,
      {
        amount,
        date: dto.date,
        method: dto.method,
        reference: dto.reference,
        coaAccount: dto.coaAccount,
        accountCode: dto.paidAccountCode || dto.accountCode,
        fileId: dto.fileId,
      },
      user,
    );

    // Tagihan & jurnal penerbitannya harus ada
    await this.postInvoiceInJournalIfEligible(id, user.id);

    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "payment", refId: `in-${id}` },
      }).catch(() => {});
    }

    const paid = Number(updated.paidAmount);
    const effectiveProofFileId = dto.fileId ?? row.transferFileId;
    if ((paid >= total && total > 0) || effectiveProofFileId) {
      await this.syncLinkedRequest(row.supplierPoId, effectiveProofFileId);
    }

    await this.audit.log({
      actor: user,
      action: "BAYAR_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: `Rp${amount} — ${row.supplierId ? `supplier #${row.supplierId}` : ""}`,
    });
    return this.sync(updated);
  }

  /** Void pembayaran tagihan supplier yang salah / dobel: jurnal dibalik, sisa hutang kembali. */
  async voidPayment(id: number, paymentId: number, reason: string | undefined, user: RequestUser) {
    assertCanPaySupplier(user.role);
    const why = reason?.trim() || "Pembayaran dibatalkan (void)";
    const pay = await this.prisma.main.payment.findFirst({ where: { id: paymentId, invoiceInId: id } });
    if (!pay) throw new NotFoundException("Pembayaran tidak ditemukan pada tagihan ini");
    const row = await this.prisma.main.invoiceIn.findUniqueOrThrow({ where: { id } });

    const updated = await this.prisma.main.$transaction(
      async (tx) => {
        await this.postingService.reverseAllForSource("Payment", pay.id, why, user.id, tx);
        await tx.payment.delete({ where: { id: pay.id } });
        let fresh = await tx.invoiceIn.update({ where: { id }, data: { paidAmount: { decrement: pay.amount } } });
        if (Number(fresh.paidAmount) < 0) fresh = await tx.invoiceIn.update({ where: { id }, data: { paidAmount: 0 } });
        return tx.invoiceIn.update({
          where: { id },
          data: { status: (fresh.status === "BATAL" ? "BATAL" : this.statusAfterPayment(fresh)) as never },
          include: { supplier: true, payments: { orderBy: { date: "desc" } } },
        });
      },
      { timeout: 20_000 },
    );

    await this.audit.log({
      actor: user,
      action: "VOID_PEMBAYARAN_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: `${row.number ?? `#${id}`}: pembayaran #${pay.id} Rp${Number(pay.amount)} dibatalkan — ${why}`,
    });
    if (row.supplierPoId) this.notifications.dataChange("supplier-pos", "update", row.supplierPoId);
    return this.sync(updated);
  }

  async setStatus(id: number, status: string, user: RequestUser) {
    if (!["UNPAID", "BATAL"].includes(status)) {
      throw new BadRequestException(`Status tidak dikenal: ${status}`);
    }
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");

    if (status === "BATAL") {
      if (Number(row.paidAmount) > 0) {
        throw new BadRequestException(
          `Tagihan sudah dibayar Rp${Number(row.paidAmount).toLocaleString("id-ID")}. Void pembayarannya dulu sebelum membatalkan.`,
        );
      }
      // Balik jurnal hutang (event "issued"); wajib berhasil.
      await this.postingService.reverseAllForSource("InvoiceIn", id, "Invoice supplier dibatalkan", user.id);
    }

    const updated = await this.prisma.main.invoiceIn.update({
      where: { id },
      data: { status: (status === "BATAL" ? "BATAL" : this.statusAfterPayment(row)) as never },
    });

    if (status === "UNPAID" && row.status === "BATAL") {
      // Diaktifkan kembali -> jurnal hutang diposting lagi (versi baru)
      await this.postInvoiceInJournalIfEligible(id, user.id);
    }

    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: `${row.status} → ${updated.status}`,
    });
    return this.sync(updated);
  }

  /**
   * Tagihan supplier dari PO mengacu PPN PO: total PPN semua tagihan untuk satu PO tidak boleh melebihi PPN PO
   * (mencegah PPN dobel, mis. nilai yang sudah termasuk PPN diisi sebagai DPP lalu ditambah PPN lagi).
   */
  private async assertPpnWithinPo(supplierPoId: number | null | undefined, ppn: number, excludeInvoiceId?: number) {
    if (!supplierPoId || !(ppn > 0)) return;
    const po = await this.prisma.main.supplierPO.findUnique({
      where: { id: supplierPoId },
      select: { number: true, ppn: true, ppnMode: true },
    });
    const poPpn = Number(po?.ppn || 0);
    if (!po || !po.ppnMode || po.ppnMode === "none" || poPpn <= 0) return;
    const agg = await this.prisma.main.invoiceIn.aggregate({
      where: {
        supplierPoId,
        status: { not: "BATAL" as never },
        ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
      },
      _sum: { ppn: true },
    });
    const billed = Number(agg._sum.ppn || 0);
    if (billed + ppn > poPpn + 2) {
      const fmt = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
      throw new BadRequestException(
        `PPN tagihan ${fmt(ppn)} melebihi sisa PPN PO ${po.number} (${fmt(Math.max(0, poPpn - billed))} dari PPN PO ${fmt(poPpn)}). ` +
          `Isi nilai tagihan dengan DPP (sebelum PPN) — PPN mengikuti PO. Bila supplier memang menagih PPN berbeda, ubah PO-nya dulu.`,
      );
    }
  }

  suggestNumber() {
    return this.docnum.suggest("invoiceIn");
  }

  /**
   * Posting Jurnal Tagihan Supplier Masuk (E5). Memakai repost(): koreksi otomatis bila nilai tagihan berubah.
   */
  async postInvoiceInJournalIfEligible(id: number, userId?: number): Promise<void> {
    try {
      const row = await this.prisma.main.invoiceIn.findUnique({
        where: { id },
        include: { supplier: true },
      });
      if (!row || (row.status as string) === "BATAL") return;

      const mappings = await this.mappingService.getAll();
      const inLines = PostingRules.buildInvoiceInLines(
        {
          number: row.number || `INV-IN-${row.id}`,
          supplierId: row.supplierId,
          dpp: Number(row.amount),
          ppn: Number(row.ppn || 0),
          total: Number(row.total),
          isExpense: !row.supplierPoId,
          expenseAccountCode: row.debitAccount || row.coaAccount || undefined,
          pph: Number(row.pph || 0),
          pphMode: row.pphMode || row.tipePph,
        },
        mappings,
      );
      await this.postingService.repost({
        sourceType: "InvoiceIn",
        sourceId: row.id,
        event: "issued",
        source: "INVOICE_IN",
        date: row.date || row.createdAt || new Date(),
        memo: `Tagihan Supplier #${row.number || row.id} (${row.supplier?.name || "Supplier"})`,
        refNo: row.number || `INV-IN-${String(row.id).padStart(3, "0")}`,
        createdById: userId,
        lines: inLines,
      });
    } catch (err) {
      console.error(`Posting invoice in #${id} error:`, err);
    }
  }
}
