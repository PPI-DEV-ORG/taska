import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { InvoiceOut } from "../generated/prisma/client.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { InvoiceOutDto, PaymentDto } from "./dto.js";

type StatusFilter = "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE" | "BATAL";

@Injectable()
export class InvoiceOutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly docnum: DocumentNumberService,
  ) {}

  /** Status dihitung dari pembayaran + jatuh tempo (PRD: Unpaid/Partial/Paid/Overdue otomatis). */
  private compute(row: InvoiceOut): StatusFilter {
    if (row.status === "BATAL") return "BATAL";
    if (row.status === "DRAFT") return "DRAFT";
    const total = Number(row.total);
    const paid = Number(row.paidAmount);
    if (paid >= total && total > 0) return "PAID";
    const past = new Date(row.dueDate).getTime() < Date.now();
    if (past) return "OVERDUE";
    if (paid > 0) return "PARTIAL";
    return "SENT";
  }

  private async sync(row: InvoiceOut): Promise<InvoiceOut & { status: StatusFilter; warning?: string }> {
    const status = this.compute(row);
    if (status !== row.status) {
      await this.prisma.main.invoiceOut.update({ where: { id: row.id }, data: { status } });
    }
    return { ...row, status, ...(await this.warningFor(row)) };
  }

  private async warningFor(row: InvoiceOut): Promise<{ warning?: string }> {
    if (!row.clientPoId) return {};
    const po = await this.prisma.main.clientPO.findUnique({ where: { id: row.clientPoId } });
    if (!po) return {};
    const invoices = await this.prisma.main.invoiceOut.findMany({
      where: { clientPoId: row.clientPoId, status: { not: "BATAL" } },
      select: { total: true },
    });
    const sum = invoices.reduce((s, i) => s + Number(i.total), 0);
    if (sum > Number(po.amount)) {
      return { warning: `Total invoice Rp${sum} melebihi nilai PO client Rp${po.amount}` };
    }
    return {};
  }

  private async syncProjectPayment(projectId: number | null | undefined) {
    if (!projectId) return;
    const invoices = await this.prisma.main.invoiceOut.findMany({
      where: { projectId, status: { not: "BATAL" } },
      select: { total: true, paidAmount: true, status: true },
    });
    const allPaid =
      invoices.length > 0 &&
      invoices.every(
        (i) => (Number(i.paidAmount) >= Number(i.total) && Number(i.total) > 0) || i.status === "PAID",
      );
    await this.prisma.main.project
      .update({
        where: { id: projectId },
        data: { paymentStatus: allPaid ? "LUNAS" : "BELUM_LUNAS" },
      })
      .catch(() => {});
  }

  private where(
    q: PageQuery & { status?: string; customerId?: number; projectId?: number; clientPoId?: number; from?: string; to?: string },
  ) {
    const today = new Date();
    return {
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.clientPoId ? { clientPoId: q.clientPoId } : {}),
      ...(q.status === "OVERDUE"
        ? {
            status: { in: ["SENT", "PARTIAL"] as never },
            dueDate: { lt: today },
          }
        : q.status
          ? { status: q.status as never }
          : {}),
      ...(q.from || q.to
        ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
        : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { description: { contains: q.q } },
              { customer: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };
  }

  async list(
    q: PageQuery & { status?: string; customerId?: number; projectId?: number; clientPoId?: number; from?: string; to?: string },
    user?: RequestUser,
  ) {
    let salesScope: any = {};
    if (user && user.role === "SALES") {
      const [auditLogs, salesLeads] = await Promise.all([
        this.prisma.main.auditLog.findMany({
          where: { actorId: user.id, entityType: "invoice-out", action: "BUAT_INVOICE_KELUAR" },
          select: { entityId: true },
        }),
        this.prisma.main.lead.findMany({
          where: { owner_id: user.id },
          select: { id: true, customerId: true },
        }),
      ]);

      const createdIds = auditLogs.map((a) => Number(a.entityId)).filter((n) => !isNaN(n));
      const customerIds = salesLeads.map((l) => l.customerId).filter(Boolean) as number[];

      salesScope = {
        OR: [
          ...(createdIds.length > 0 ? [{ id: { in: createdIds } }] : []),
          { description: { contains: `[by:${user.id}]` } },
          ...(customerIds.length > 0 ? [{ customerId: { in: customerIds } }] : []),
          {
            project: {
              OR: [
                { picId: user.id },
                { members: { some: { userId: user.id } } },
                { quotation: { lead: { owner_id: user.id } } },
                ...(customerIds.length > 0 ? [{ customerId: { in: customerIds } }] : []),
              ],
            },
          },
        ],
      };
    }

    const where = {
      ...this.where(q),
      ...salesScope,
    };
    const [rows, total] = await Promise.all([
      this.prisma.main.invoiceOut.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          clientPo: { select: { id: true, number: true, amount: true } },
          project: { select: { id: true, name: true } },
          payments: { orderBy: { date: "desc" } },
        },
        orderBy: orderBy(q.sort, q.dir, ["date", "dueDate", "createdAt"], "dueDate"),
        ...pageSkip(q),
      }),
      this.prisma.main.invoiceOut.count({ where }),
    ]);
    const items = await Promise.all(rows.map((r) => this.sync(r)));
    return paginate(items, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.invoiceOut.findUnique({
      where: { id },
      include: {
        customer: true,
        clientPo: true,
        project: { select: { id: true, name: true } },
        payments: { orderBy: { date: "desc" } },
      },
    });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    return this.sync(row);
  }

  async create(dto: InvoiceOutDto, user: RequestUser) {
    const number = dto.number?.trim() || (await this.docnum.next("invoiceOut"));
    const dup = await this.prisma.main.invoiceOut.findFirst({ where: { number } });
    if (dup) throw new BadRequestException(`Nomor ${number} sudah dipakai`);

    const customer = dto.customerId
      ? await this.prisma.main.customer.findUnique({ where: { id: dto.customerId } })
      : await this.prisma.main.customer.findFirst();
    if (!customer) throw new NotFoundException("Customer tidak ditemukan");

    const amount = dto.amount ?? 0;
    const ppn = dto.ppn ?? 0;
    const total = dto.total ?? amount + ppn;
    const date = dto.date ? new Date(dto.date) : new Date();
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 30 * 86400000);

    const desc = dto.description?.trim();
    const creatorTag = `[by:${user.id}]`;
    const description = desc ? (desc.includes(creatorTag) ? desc : `${desc} ${creatorTag}`) : creatorTag;

    const row = await this.prisma.main.invoiceOut.create({
      data: {
        number,
        clientPoId: dto.clientPoId,
        projectId: dto.projectId,
        customerId: customer.id,
        description,
        type: dto.type ?? "TERMIN",
        amount,
        ppn,
        total,
        paidAmount: dto.paidAmount ?? (dto.status === "PAID" ? total : 0),
        date,
        dueDate,
        status: dto.status ?? "DRAFT",
      },
      include: { customer: true, clientPo: { select: { id: true, number: true, amount: true } } },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "invoiceOut", refId: String(row.id) },
      }).catch(() => {});
    }
    await this.audit.log({
      actor: user,
      action: "BUAT_INVOICE_KELUAR",
      entityType: "invoice-out",
      entityId: row.id,
      detail: `${number} total Rp${total} — ${customer.name}`,
    });
    await this.syncProjectPayment(row.projectId);
    return this.sync(row);
  }

  async update(id: number, dto: InvoiceOutDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");

    const amount = dto.amount ?? Number(row.amount);
    const ppn = dto.ppn ?? Number(row.ppn);
    const total = dto.total ?? (dto.amount !== undefined || dto.ppn !== undefined ? amount + ppn : Number(row.total));

    const updated = await this.prisma.main.invoiceOut.update({
      where: { id },
      data: {
        ...(dto.number ? { number: dto.number } : {}),
        clientPoId: dto.clientPoId !== undefined ? dto.clientPoId : row.clientPoId,
        projectId: dto.projectId !== undefined ? dto.projectId : row.projectId,
        customerId: dto.customerId ?? row.customerId,
        description: dto.description !== undefined ? dto.description : row.description,
        type: dto.type ?? row.type,
        amount,
        ppn,
        total,
        ...(dto.paidAmount !== undefined ? { paidAmount: dto.paidAmount } : dto.status === "PAID" ? { paidAmount: total } : {}),
        date: dto.date ? new Date(dto.date) : row.date,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : row.dueDate,
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: { customer: true, clientPo: { select: { id: true, number: true, amount: true } } },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "invoiceOut", refId: String(id) },
      }).catch(() => {});
    }
    await this.audit.log({
      actor: user,
      action: "UBAH_INVOICE_KELUAR",
      entityType: "invoice-out",
      entityId: id,
      detail: `${updated.number} → ${dto.status ?? updated.status}`,
    });
    await this.syncProjectPayment(updated.projectId);
    if (row.projectId && row.projectId !== updated.projectId) {
      await this.syncProjectPayment(row.projectId);
    }
    return this.sync(updated);
  }

  async addPayment(id: number, dto: PaymentDto, user: RequestUser) {
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    if (row.status === "BATAL") throw new BadRequestException("Invoice dibatalkan");
    const paymentsBefore = await this.prisma.main.payment.findMany({ where: { invoiceOutId: id } });
    const paidBefore = paymentsBefore.reduce((s, p) => s + Number(p.amount), 0);
    if (paidBefore + Number(dto.amount) > Number(row.total) && Number(row.total) > 0) {
      throw new BadRequestException(
        `Total bayar melebihi tagihan invoice (sisa Rp${Number(row.total) - paidBefore})`,
      );
    }

    await this.prisma.main.payment.create({
      data: {
        invoiceOutId: id,
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : new Date(),
        method: dto.method ?? "TRANSFER",
        reference: dto.reference,
        fileId: dto.fileId,
        createdById: user.id,
      },
    });
    if (dto.fileId) {
      await this.prisma.main.file.update({
        where: { id: dto.fileId },
        data: { refType: "payment", refId: String(id) },
      }).catch(() => {});
    }

    const payments = await this.prisma.main.payment.findMany({ where: { invoiceOutId: id } });
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const updated = await this.prisma.main.invoiceOut.update({
      where: { id },
      data: { paidAmount: paid },
      include: { customer: true, payments: { orderBy: { date: "desc" } } },
    });

    await this.audit.log({
      actor: user,
      action: "BAYAR_INVOICE_KELUAR",
      entityType: "invoice-out",
      entityId: id,
      detail: `Rp${dto.amount} (${row.number}) total bayar Rp${paid}`,
    });
    await this.syncProjectPayment(row.projectId);
    return this.sync(updated);
  }

  async setStatus(id: number, status: string, user: RequestUser) {
    if (!["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "BATAL"].includes(status)) {
      throw new BadRequestException(`Status tidak dikenal: ${status}`);
    }
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    const updated = await this.prisma.main.invoiceOut.update({
      where: { id },
      data: {
        status: status as never,
        ...(status === "PAID" ? { paidAmount: row.total } : {}),
        ...(status === "SENT" && Number(row.paidAmount) >= Number(row.total) ? { paidAmount: 0 } : {}),
      },
      include: { customer: true, clientPo: { select: { id: true, number: true, amount: true } } },
    });
    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_INVOICE",
      entityType: "invoice-out",
      entityId: id,
      detail: `${row.number}: ${row.status} → ${status}`,
    });
    await this.syncProjectPayment(row.projectId);
    return this.sync(updated);
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.prisma.main.invoiceOut.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Invoice tidak ditemukan");
    await this.prisma.main.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { invoiceOutId: id } });
      await tx.invoiceOut.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_INVOICE_KELUAR",
      entityType: "invoice-out",
      entityId: id,
      detail: `${row.number} dihapus`,
    });
    await this.syncProjectPayment(row.projectId);
    return { id, deleted: true };
  }

  suggestNumber() {
    return this.docnum.suggest("invoiceOut");
  }

  /**
   * Ekspor Faktur Pajak Keluaran ke format CSV baku aplikasi e-Faktur Direktorat Jenderal Pajak (DJP).
   * Format sesuai petunjuk teknis DJP:
   * Record FK (Faktur Keluaran) & Record OF (Objek Faktur)
   */
  async exportEfakturCsv(query: {
    from?: string;
    to?: string;
    month?: number;
    year?: number;
    customerId?: number;
    invoiceId?: number;
    nsfpStart?: string;
  }): Promise<{ csv: string; filename: string }> {
    const where: any = {
      status: { not: "BATAL" },
      ...(query.invoiceId ? { id: Number(query.invoiceId) } : {}),
      ...(query.customerId ? { customerId: Number(query.customerId) } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const invoices = await this.prisma.main.invoiceOut.findMany({
      where,
      include: {
        customer: true,
      },
      orderBy: { date: "asc" },
    });

    const header = [
      "FK,KD_JENIS_TRANSAKSI,FG_PENGGANTI,NOMOR_FAKTUR,MASA_PAJAK,TAHUN_PAJAK,TANGGAL_FAKTUR,NPWP,NAMA,ALAMAT_LENGKAP,JUMLAH_DPP,JUMLAH_PPN,JUMLAH_PPNBM,ID_KETERANGAN_TAMBAHAN,FG_UANG_MUKA,UANG_MUKA_DPP,UANG_MUKA_PPN,UANG_MUKA_PPNBM,REFERENSI,KODE_DOKUMEN_PENDUKUNG",
      "LT_NPWP,NAMA,ALAMAT_LENGKAP,NOMOR_TELEPON",
      "OF,KODE_OBJEK,NAMA,HARGA_SATUAN,JUMLAH_BARANG,HARGA_TOTAL,DISKON,DPP,PPN,TARIF_PPNBM,PPNBM",
    ];

    const lines: string[] = [header[0], header[2]];

    let currentNsfpNum = 1;
    let nsfpPrefix = "";
    if (query.nsfpStart) {
      const match = query.nsfpStart.match(/^(.*?)(\d{8})$/);
      if (match) {
        nsfpPrefix = match[1];
        currentNsfpNum = parseInt(match[2], 10);
      }
    }

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      const d = new Date(inv.date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear());
      const tanggalFaktur = `${day}/${month}/${year}`;
      const masaPajak = String(d.getMonth() + 1);

      let noFaktur = "";
      if (nsfpPrefix) {
        noFaktur = `${nsfpPrefix}${String(currentNsfpNum++).padStart(8, "0")}`;
      } else {
        noFaktur = `010000${year.slice(-2)}${String(i + 1).padStart(8, "0")}`;
      }

      let npwp = "0000000000000000";
      const notes = inv.customer?.notes || "";
      const npwpMatch = notes.match(/npwp\s*[:=]?\s*([0-9.\-]+)/i);
      if (npwpMatch) {
        const cleaned = npwpMatch[1].replace(/\D/g, "");
        if (cleaned.length >= 15) {
          npwp = cleaned.slice(0, 16);
        }
      }

      const nama = (inv.customer?.name || "Customer").replace(/"/g, '""');
      const alamat = (inv.customer?.address || inv.customer?.city || "Indonesia").replace(/"/g, '""');
      const dpp = Math.round(Number(inv.amount));
      const ppn = Math.round(Number(inv.ppn) || dpp * 0.11);
      const isDp = inv.type === "DP";
      const referensi = inv.number.replace(/"/g, '""');

      // FK row
      lines.push(
        `"FK","01","0","${noFaktur}","${masaPajak}","${year}","${tanggalFaktur}","${npwp}","${nama}","${alamat}",${dpp},${ppn},0,"",${isDp ? 1 : 0},0,0,0,"${referensi}",""`,
      );

      // OF row
      const itemDesc = (inv.description || "Pengadaan Barang & Jasa").replace(/"/g, '""');
      lines.push(
        `"OF","000000","${itemDesc}",${dpp},1,${dpp},0,${dpp},${ppn},0,0`,
      );
    }

    const periodStr =
      query.year && query.month
        ? `${query.year}-${String(query.month).padStart(2, "0")}`
        : new Date().toISOString().slice(0, 10);
    const filename = `efaktur-pajak-keluaran-${periodStr}.csv`;
    return { csv: lines.join("\r\n"), filename };
  }
}
