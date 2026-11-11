import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import { Prisma } from "../generated/prisma/client.js";
import type { InvoiceIn, Role } from "../generated/prisma/client.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { InvoiceInDto, PaymentDto } from "./dto.js";

type StatusFilter = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "BATAL";

@Injectable()
export class InvoiceInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly docnum: DocumentNumberService,
    private readonly approvals: ApprovalsService,
    private readonly notifications: NotificationsService,
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
          supplierPo: { select: { id: true, number: true } },
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

    if (!supplier && dto.supplierName?.trim()) {
      const cleanName = dto.supplierName.trim();
      supplier = await this.prisma.main.supplier.findFirst({
        where: { name: cleanName },
      });
      if (!supplier) {
        supplier = await this.prisma.main.supplier.create({
          data: {
            name: cleanName,
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
    const payFileId = dto.paymentFileId ?? dto.transferFileId;

    if (!dto.fileId) {
      throw new BadRequestException("File faktur pemasok wajib diunggah");
    }
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
        status: isPaid ? "PAID" : "UNPAID",
        paidAmount: isPaid ? dto.total : 0,
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

    if (isPaid) {
      const finalReference = dto.coaAccount
        ? `[AKUN:${dto.coaAccount}] ${dto.paymentReference || `LUNAS-${number || row.id}`}`.trim()
        : (dto.paymentReference || `LUNAS-${number || row.id}`);

      await this.prisma.main.payment.create({
        data: {
          invoiceInId: row.id,
          amount: dto.total,
          date: dto.date ? new Date(dto.date) : new Date(),
          method: (dto.paymentMethod as any) ?? "TRANSFER",
          reference: finalReference,
          fileId: payFileId,
          createdById: user.id,
        },
      });
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

    if (isPaid) {
      await this.syncLinkedRequest(row.supplierPoId, payFileId);
    }

    await this.audit.log({
      actor: user,
      action: isPaid ? "BUAT_DAN_LUNASI_INVOICE_MASUK" : "BUAT_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: row.id,
      detail: `total Rp${dto.total} — ${supplier.name}${isPaid ? " (Langsung Lunas)" : ""}`,
    });
    return { ...(await this.sync(row)), ...meta };
  }

  async update(id: number, dto: InvoiceInDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");

    let resolvedSupplierId = dto.supplierId;
    if (!resolvedSupplierId && dto.supplierName?.trim()) {
      const cleanName = dto.supplierName.trim();
      let supp = await this.prisma.main.supplier.findFirst({ where: { name: cleanName } });
      if (!supp) {
        supp = await this.prisma.main.supplier.create({
          data: {
            name: cleanName,
            status: "AKTIF",
            notes: dto.category ? `Vendor Tagihan: ${dto.category}` : "Vendor Tagihan Masuk Langsung",
          },
        });
      }
      resolvedSupplierId = supp.id;
    }

    const payFileId = dto.paymentFileId ?? dto.transferFileId;

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
    return this.get(id);
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    await this.prisma.main.payment.deleteMany({ where: { invoiceInId: id } });
    await this.prisma.main.approval.deleteMany({ where: { kind: "INVOICE_IN", entityId: id } });
    await this.prisma.main.invoiceIn.delete({ where: { id } });

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

  async addPayment(id: number, dto: PaymentDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    if (row.status === "BATAL") throw new BadRequestException("Invoice dibatalkan");
    const approval = await this.approvals.getFor("INVOICE_IN", id);
    if (approval && approval.status !== "DISETUJUI") {
      const allowedRoles = ["SUPER_ADMIN", "FINANCE", "BOS", "ADMIN", "PROCUREMENT"];
      if (allowedRoles.includes(user.role)) {
        await this.approvals.decide(approval.id, user, true, "Disetujui otomatis saat pembayaran dicatat").catch(() => {});
      } else {
        throw new BadRequestException("Invoice supplier harus disetujui Finance/Bos sebelum dibayar");
      }
    }
    const paymentsBefore = await this.prisma.main.payment.findMany({ where: { invoiceInId: id } });
    const paidBefore = paymentsBefore.reduce((s, p) => s + Number(p.amount), 0);
    if (paidBefore >= Number(row.total) && Number(row.total) > 0) {
      return this.sync(row);
    }
    if (paidBefore + Number(dto.amount) > Number(row.total)) {
      throw new BadRequestException(
        `Total bayar melebihi tagihan invoice supplier (sisa Rp${Number(row.total) - paidBefore})`,
      );
    }

    if (!dto.fileId) {
      throw new BadRequestException("Bukti transfer / pembayaran wajib diunggah");
    }

    const finalReference = dto.coaAccount
      ? (dto.reference?.includes(`[AKUN:`) ? dto.reference : `[AKUN:${dto.coaAccount}] ${dto.reference || ""}`.trim())
      : dto.reference;

    await this.prisma.main.payment.create({
      data: {
        invoiceInId: id,
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : new Date(),
        method: dto.method ?? "TRANSFER",
        reference: finalReference,
        fileId: dto.fileId,
        createdById: user.id,
      },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "payment", refId: `in-${id}` },
      }).catch(() => {});
    }

    const payments = await this.prisma.main.payment.findMany({ where: { invoiceInId: id } });
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const updated = await this.prisma.main.invoiceIn.update({
      where: { id },
      data: { paidAmount: paid, ...(dto.fileId ? { transferFileId: dto.fileId } : {}) },
      include: { supplier: true, payments: { orderBy: { date: "desc" } } },
    });

    const effectiveProofFileId = dto.fileId ?? row.transferFileId;
    if ((paid >= Number(row.total) && Number(row.total) > 0) || effectiveProofFileId) {
      await this.syncLinkedRequest(row.supplierPoId, effectiveProofFileId);
    }

    await this.audit.log({
      actor: user,
      action: "BAYAR_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: `Rp${dto.amount} — ${row.supplierId ? `supplier #${row.supplierId}` : ""}`,
    });
    return this.sync(updated);
  }

  async setStatus(id: number, status: string, user: RequestUser) {
    if (!["UNPAID", "BATAL"].includes(status)) {
      throw new BadRequestException(`Status tidak dikenal: ${status}`);
    }
    const row = await this.prisma.main.invoiceIn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice supplier tidak ditemukan");
    const updated = await this.prisma.main.invoiceIn.update({ where: { id }, data: { status: status as never } });

    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_INVOICE_MASUK",
      entityType: "invoice-in",
      entityId: id,
      detail: `${row.status} → ${status}`,
    });
    return this.sync(updated);
  }

  suggestNumber() {
    return this.docnum.suggest("invoiceIn");
  }
}
