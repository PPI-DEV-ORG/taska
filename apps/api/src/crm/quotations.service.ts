import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { UploadService } from "../upload/upload.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { ReservationsService } from "../stock/reservations.service.js";
import { paginate, type PageQuery } from "../common/dto/page-query.js";
import { orderBy, pageSkip } from "../common/utils/query.js";
import type { ApprovalStatus } from "../generated/prisma/client.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import { QuotationDto, VersionDto } from "./dto.js";
import {
  buildQuotationPdf,
  buildQuotationXlsx,
  DEFAULT_QUOTATION_NOTES,
  parseQuotationXlsx,
  type QuotationItemData,
  type QuotationMeta,
} from "./quotation-excel.js";
import { quotationMetaFromRow, quotationMetaToData } from "./quotation-meta.js";
import { itemDiscountFields } from "./item-discount.js";

/** Harga penawaran sudah termasuk PPN bila grand total = total − diskon (PPN berada di dalam harga). */
function quotationPpnIncluded(row: { total: unknown; discount: unknown; ppn: unknown; grandTotal: unknown }): boolean {
  const net = Number(row.total || 0) - Number(row.discount || 0);
  return Number(row.ppn || 0) > 0 && net > 0 && Math.abs(Number(row.grandTotal || 0) - net) < 2;
}

const MANUAL_STATUSES = [
  "NOT_YET",
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SENT",
  "NEGOTIATION",
  "EXPIRED",
  "DONE",
  "REVISION",
];

function normalizeQuotationStatus(status?: string): string | undefined {
  if (!status) return undefined;
  if (status === "DONE") return "DRAFT";
  if (status === "REVISION") return "NEGOTIATION";
  return status;
}


/** Tarif PPh — sama dengan PPH_MODE_OPTIONS di aplikasi (modules/quotation/lib.ts). */
const PPH_RATES: Record<string, number> = { pph23: 0.02, pph4_2: 0.0175, pph21: 0.025, pph22: 0.015 };
@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly docnum: DocumentNumberService,
    private readonly approvals: ApprovalsService,
    private readonly upload: UploadService,
    private readonly reservations: ReservationsService,
    private readonly settings: SettingsService,
  ) {}

  private async resolveKopDefaults(meta?: any): Promise<{ kopText?: string; kopLogoDataUrl?: string }> {
    const company = await this.settings.getCompanyProfile().catch(() => null);
    const defaultKopText = company?.name
      ? `${company.name}${company.address ? `\n${company.address}` : ""}${company.phone ? ` · Telp: ${company.phone}` : ""}${company.email ? ` · Email: ${company.email}` : ""}`
      : undefined;
    const kopText = meta?.kopText?.trim() || defaultKopText;
    let kopLogoDataUrl: string | undefined;
    const logoId = Number((meta as any)?.kopLogoFileId || company?.logoFileId || 0);
    if (logoId > 0) {
      try {
        const logo = await this.upload.read(logoId);
        kopLogoDataUrl = `data:image/png;base64,${logo.buffer.toString("base64")}`;
      } catch {}
    }
    return { kopText, kopLogoDataUrl };
  }

  private normalizeItem(it: any, idx: number): QuotationItemData {
    const serialNumbers = Array.isArray(it.serialNumbers)
      ? it.serialNumbers.map((s: any) => String(s ?? "").trim()).filter(Boolean)
      : [];
    const serialUnitIds = Array.isArray(it.serialUnitIds)
      ? it.serialUnitIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];
    const hasSn = Boolean(it.hasSerial || serialNumbers.length > 0 || serialUnitIds.length > 0);
    const kind: "GOODS" | "SERVICE" =
      it.kind === "SERVICE"
        ? "SERVICE"
        : it.kind === "GOODS" || it.productId || it.sku || hasSn
          ? "GOODS"
          : "SERVICE";
    return {
      id: String(it.id ?? idx + 1),
      item: String(it.item ?? "").trim(),
      qty: Number(it.qty) || (serialNumbers.length > 0 ? serialNumbers.length : 1),
      satuan: String(it.satuan || "Unit").trim(),
      harga: Number(it.harga ?? it.price ?? 0) || 0,
      kind,
      ...(it.productId ? { productId: Number(it.productId) } : {}),
      ...(it.sku ? { sku: String(it.sku) } : {}),
      ...(hasSn ? { hasSerial: true } : {}),
      ...(serialUnitIds.length > 0 ? { serialUnitIds } : {}),
      ...(serialNumbers.length > 0 ? { serialNumbers } : {}),
      ...(it.outOfStockAutoSwap ? { outOfStockAutoSwap: true } : {}),
      ...(it.pphMode ? { pphMode: String(it.pphMode) } : {}),
      ...(it.tipePph ? { tipePph: String(it.tipePph) } : {}),
      ...itemDiscountFields(it),
    };
  }

  /** Metadata penawaran dibaca dari kolom tabel Quotation. */
  private async getMetaMap(ids: number[]): Promise<Map<number, QuotationMeta>> {
    const map = new Map<number, QuotationMeta>();
    if (!ids.length) return map;
    const rows = await this.prisma.main.quotation.findMany({ where: { id: { in: ids } } });
    for (const r of rows) map.set(r.id, quotationMetaFromRow(r));
    return map;
  }

  private async saveMeta(id: number, patch: Partial<QuotationMeta>, _userId?: number): Promise<QuotationMeta> {
    const data = quotationMetaToData(patch);
    try {
      const row = Object.keys(data).length
        ? await this.prisma.main.quotation.update({ where: { id }, data: data as never })
        : await this.prisma.main.quotation.findUnique({ where: { id } });
      return row ? quotationMetaFromRow(row) : { items: [], notes: DEFAULT_QUOTATION_NOTES };
    } catch (e) {
      console.warn("Gagal menyimpan metadata penawaran #" + id + ":", (e as Error).message);
      const row = await this.prisma.main.quotation.findUnique({ where: { id } });
      return row ? quotationMetaFromRow(row) : { items: [], notes: DEFAULT_QUOTATION_NOTES };
    }
  }

  private isExpired(validUntil: Date | null): boolean {
    if (!validUntil) return false;
    const end = new Date(validUntil);
    end.setHours(23, 59, 59, 999);
    return end.getTime() < Date.now();
  }

  private shape<T extends { id: number; status: string; validUntil: Date | null }>(
    row: T,
    meta?: QuotationMeta,
  ) {
    const status =
      row.status !== "NOT_YET" && this.isExpired(row.validUntil) ? "EXPIRED" : row.status;
    return {
      ...row,
      status,
      pph: Number((meta as any)?.pph ?? 0),
      pphMode: (meta as any)?.pphMode ?? "none",
      tipePph: (meta as any)?.tipePph ?? "Tanpa PPh",
      items: meta?.items ?? [],
      subject: meta?.subject ?? "",
      intro: meta?.intro ?? "",
      notesList: meta?.notes ?? DEFAULT_QUOTATION_NOTES,
      city: meta?.city ?? "Bekasi",
      kopText: meta?.kopText ?? "",
      customerAddress: meta?.customerAddress ?? "",
      signerName: meta?.signerName ?? "",
      signerTitle: meta?.signerTitle ?? "",
      latestFileId: meta?.latestFileId ?? null,
      latestFileName: meta?.latestFileName ?? null,
      stockConflictFlag: Boolean(meta?.stockConflictFlag),
      stockConflictMessage: meta?.stockConflictMessage ?? null,
      autoSwapLogs: meta?.autoSwapLogs ?? [],
      emergencyPrId: meta?.emergencyPrId ?? null,
      emergencyPrNumber: meta?.emergencyPrNumber ?? null,
    };
  }

  async list(q: PageQuery & { status?: string; leadId?: number; ownerId?: number }) {
    const where = {
      ...(q.status ? { status: normalizeQuotationStatus(q.status) as never } : {}),
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { lead: { name: { contains: q.q } } },
              { customer: { name: { contains: q.q } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.main.quotation.findMany({
        where,
        include: {
          lead: { select: { id: true, name: true, stage: true } },
          customer: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
          versions: { orderBy: { version: "desc" } },
          _count: { select: { versions: true, clientPOs: true } },
        },
        orderBy: orderBy(q.sort, q.dir, ["number", "createdAt"], "createdAt"),
        ...pageSkip(q),
      }),
      this.prisma.main.quotation.count({ where }),
    ]);
    const metaMap = await this.getMetaMap(rows.map((r) => r.id));
    const qIds = rows.map((r) => r.id);
    const versionFileIds = rows.flatMap((r: any) => (r.versions ?? []).map((v: any) => v.fileId)).filter((fid: any): fid is number => typeof fid === "number" && fid > 0);
    const files = qIds.length
      ? await this.prisma.main.file.findMany({
          where: {
            OR: [
              { refType: { in: ["quotation", "quotations", "penawaran"] }, refId: { in: qIds.map(String) } },
              ...(versionFileIds.length ? [{ id: { in: versionFileIds } }] : []),
            ],
          },
          select: { id: true, originalName: true, mimeType: true, size: true, kind: true, createdAt: true, refId: true },
          orderBy: { id: "desc" },
        })
      : [];
    const fileGroup = new Map<number, any[]>();
    for (const f of files) {
      const qId = Number(f.refId);
      if (qId) {
        if (!fileGroup.has(qId)) fileGroup.set(qId, []);
        fileGroup.get(qId)!.push(f);
      }
    }
    const items = rows.map((r) => ({
      ...this.shape(r, metaMap.get(r.id)),
      files: fileGroup.get(r.id) ?? [],
    }));
    return paginate(items, total, q);
  }

  async get(id: number) {
    const row = await this.prisma.main.quotation.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true, stage: true } },
        customer: true,
        owner: { select: { id: true, name: true } },
        versions: { orderBy: { version: "desc" } },
        clientPOs: true,
        followUps: { orderBy: { date: "desc" } },
      },
    });
    if (!row) throw new NotFoundException("Penawaran tidak ditemukan");
    const versionFileIds = (row.versions ?? [])
      .map((v: any) => v.fileId)
      .filter((fid: any): fid is number => typeof fid === "number" && fid > 0);
    const [approval, files, metaMap] = await Promise.all([
      Promise.resolve(null),
      this.prisma.main.file.findMany({
        where: {
          OR: [
            { refType: { in: ["quotation", "quotations", "penawaran"] }, refId: String(id) },
            ...(versionFileIds.length ? [{ id: { in: versionFileIds } }] : []),
          ],
        },
        orderBy: { id: "desc" },
        select: { id: true, originalName: true, mimeType: true, size: true, kind: true, createdAt: true },
      }),
      this.getMetaMap([id]),
    ]);
    const meta = metaMap.get(id);
    const latestFile = files[0];
    return {
      ...this.shape(row, {
        items: meta?.items ?? [],
        subject: meta?.subject,
        intro: meta?.intro,
        notes: meta?.notes,
        city: meta?.city,
        kopText: meta?.kopText,
        customerAddress: meta?.customerAddress,
        signerName: meta?.signerName,
        signerTitle: meta?.signerTitle,
        latestFileId: meta?.latestFileId ?? latestFile?.id ?? null,
        latestFileName: meta?.latestFileName ?? latestFile?.originalName ?? null,
        stockConflictFlag: meta?.stockConflictFlag,
        stockConflictMessage: meta?.stockConflictMessage,
        autoSwapLogs: meta?.autoSwapLogs,
        emergencyPrId: meta?.emergencyPrId,
        emergencyPrNumber: meta?.emergencyPrNumber,
      }),
      approval,
      files,
    };
  }

  /** Baris penawaran untuk lead (dibuat otomatis saat Qualification atau manual). */
  async createForLead(leadId: number | null | undefined, user: RequestUser, dto?: QuotationDto) {
    const lead = leadId
      ? await this.prisma.main.lead.findUnique({ where: { id: leadId } })
      : null;
    if (leadId && !lead) throw new NotFoundException("Lead tidak ditemukan");

    if (lead) {
      const existing = await this.prisma.main.quotation.findFirst({ where: { leadId: lead.id } });
      if (existing && !dto?.total && !dto?.grandTotal && (!dto?.items || dto.items.length === 0)) {
        return this.get(existing.id);
      }
    }

    const number = await this.docnum.next("penawaran");
    const items: QuotationItemData[] = Array.isArray(dto?.items)
      ? dto.items
          .filter((it) => String(it.item ?? "").trim().length > 0)
          .map((it, idx) => this.normalizeItem(it, idx))
      : [];
    const itemsSum = items.reduce((s, it) => s + it.qty * it.harga, 0);
    const total = itemsSum > 0 ? itemsSum : (dto?.total ?? dto?.grandTotal ?? (lead ? Number(lead.estimatedValue || 0) : 0));
    const discount = dto?.discount ?? 0;
    const netBeforeTax = Math.max(0, total - discount);
    const ppn = dto?.ppn !== undefined ? dto.ppn : Math.round(netBeforeTax * 0.11);
    const itemsPph = items.reduce((acc, it) => {
      const mode = (it as any).pphMode || "none";
      const rate = PPH_RATES[mode] ?? 0;
      return acc + Math.round((Number(it.qty) || 0) * (Number(it.harga) || 0) * rate);
    }, 0);
    const pph = dto?.pph !== undefined ? dto.pph : itemsPph;
    const grandTotal =
      dto?.grandTotal !== undefined
        ? dto.grandTotal
        : netBeforeTax + ppn; // nilai penawaran = DPP + PPN; PPh dipotong customer saat membayar
    const mappedStatus =
      normalizeQuotationStatus(dto?.status) ?? (grandTotal > 0 || items.length > 0 ? "DRAFT" : "NOT_YET");

    const row = await this.prisma.main.quotation.create({
      data: {
        number,
        leadId: lead ? lead.id : null,
        customerId: dto?.customerId ?? lead?.customerId ?? null,
        ownerId: lead ? lead.owner_id : user.id,
        total,
        ppn,
        discount,
        grandTotal,
        currentVersion: 0,
        validUntil: dto?.validUntil ? new Date(dto.validUntil) : undefined,
        status: mappedStatus as never,
      },
      include: {
        lead: { select: { id: true, name: true, stage: true } },
        customer: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    await this.saveMeta(
      row.id,
      {
        items,
        subject: dto?.subject,
        intro: dto?.intro,
        notes: dto?.notesList,
        city: dto?.city,
        kopText: dto?.kopText,
        customerAddress: dto?.customerAddress,
        signerName: dto?.signerName,
        signerTitle: dto?.signerTitle,
        pph,
        pphMode: dto?.pphMode ?? (pph > 0 ? "pph23" : "none"),
        tipePph: dto?.tipePph ?? (pph > 0 ? "PPh 23" : "Tanpa PPh"),
      },
      user?.id,
    );

    if (dto?.fileId) {
      const f = await this.attachFile(row.id, dto.fileId);
      await this.saveMeta(
        row.id,
        {
          latestFileId: dto.fileId,
          ...(f?.originalName ? { latestFileName: f.originalName } : {}),
        },
        user?.id,
      );
      // Dokumen yang diupload saat membuat penawaran = Versi 1 di riwayat
      await this.prisma.main.quotationVersion.create({
        data: {
          quotationId: row.id,
          version: 1,
          fileId: dto.fileId,
          total,
          ppn,
          discount,
          grandTotal,
          note: `Dokumen Penawaran: ${f?.originalName || "File"}`,
          createdById: user.id,
        },
      });
      await this.prisma.main.quotation.update({ where: { id: row.id }, data: { currentVersion: 1 } });
    }

    if (items.length > 0) {
      await this.reservations
        .syncDocumentReservations({
          quotationId: row.id,
          noteLabel: `Penawaran ${row.number}`,
          userId: user.id,
          markSerialReserved: false,
          items,
        })
        .catch(() => {});
    }

    await this.audit.log({
      actor: user,
      action: "BUAT_PENAWARAN",
      entityType: "quotation",
      entityId: row.id,
      detail: lead ? `${row.number} — ${lead.name}` : row.number,
    });
    this.notifications.dataChange("quotations", "create", row.id);
    if (lead) this.notifications.dataChange("leads", "update", lead.id);
    return this.get(row.id);
  }

  /** Isi detail penawaran (item, nilai, tanggal berlaku, file) & otomatis generate file Excel resmi. */
  async fill(id: number, dto: QuotationDto, user: RequestUser) {
    const row = await this.getEditable(id, user);
    const existingMeta = (await this.getMetaMap([id])).get(id);

    const items: QuotationItemData[] | undefined = Array.isArray(dto.items)
      ? dto.items
          .filter((it) => String(it.item ?? "").trim().length > 0)
          .map((it, idx) => this.normalizeItem(it, idx))
      : undefined;

    const activeItems = items ?? existingMeta?.items ?? [];
    const itemsSum = activeItems.reduce((s, it) => s + it.qty * it.harga, 0);

    const total =
      items !== undefined && itemsSum > 0
        ? itemsSum
        : dto.total !== undefined
          ? dto.total
          : Number(row.total);
    const discount = dto.discount !== undefined ? dto.discount : Number(row.discount);
    const netBeforeTax = Math.max(0, total - discount);
    const ppn =
      dto.ppn !== undefined
        ? dto.ppn
        : Math.round(netBeforeTax * 0.11);
    const itemsPph = activeItems.reduce((acc, it) => {
      const mode = (it as any).pphMode || "none";
      const rate = PPH_RATES[mode] ?? 0;
      return acc + Math.round((Number(it.qty) || 0) * (Number(it.harga) || 0) * rate);
    }, 0);
    const pph = dto.pph !== undefined ? dto.pph : (itemsPph > 0 ? itemsPph : Number((existingMeta as any)?.pph ?? 0));
    const grandTotal =
      dto.grandTotal !== undefined
        ? dto.grandTotal
        : netBeforeTax + ppn; // nilai penawaran = DPP + PPN; PPh dipotong customer saat membayar

    const mappedStatus = normalizeQuotationStatus(dto.status);
    const nextVersion =
      dto.currentVersion !== undefined
        ? dto.currentVersion
        : row.currentVersion === 0 && (total > 0 || activeItems.length > 0)
          ? 1
          : row.currentVersion;

    const data = {
      ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
      ...(dto.leadId !== undefined ? { leadId: dto.leadId } : {}),
      ...(dto.validUntil !== undefined ? { validUntil: dto.validUntil && String(dto.validUntil).trim() !== "" ? new Date(dto.validUntil) : null } : {}),
      total,
      ppn,
      discount,
      grandTotal,
      currentVersion: nextVersion,
      ...(mappedStatus
        ? { status: mappedStatus as never }
        : row.status === "NOT_YET" && (total > 0 || activeItems.length > 0 || dto.fileId)
          ? { status: "DRAFT" as const }
          : {}),
    };

    const updated = await this.prisma.main.quotation.update({
      where: { id },
      data,
      include: {
        lead: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    // Sinkronkan nilai perkiraan ke Lead terkait
    if (total > 0 && updated.leadId) {
      await this.prisma.main.lead
        .update({
          where: { id: updated.leadId },
          data: { estimatedValue: total },
        })
        .catch(() => {});
    }

    if (dto.fileId) {
      const f = await this.attachFile(id, dto.fileId);
      await this.saveMeta(
        id,
        {
          ...(items !== undefined ? { items } : {}),
          ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
          ...(dto.intro !== undefined ? { intro: dto.intro } : {}),
          ...(dto.notesList !== undefined ? { notes: dto.notesList } : {}),
          ...(dto.city !== undefined ? { city: dto.city } : {}),
          ...(dto.kopText !== undefined ? { kopText: dto.kopText } : {}),
          ...(dto.customerAddress !== undefined ? { customerAddress: dto.customerAddress } : {}),
          ...(dto.signerName !== undefined ? { signerName: dto.signerName } : {}),
          ...(dto.signerTitle !== undefined ? { signerTitle: dto.signerTitle } : {}),
          ...(dto.pph !== undefined || pph !== undefined ? { pph: dto.pph ?? pph } : {}),
          ...(dto.pphMode !== undefined ? { pphMode: dto.pphMode } : {}),
          ...(dto.tipePph !== undefined ? { tipePph: dto.tipePph } : {}),
          latestFileId: dto.fileId,
          ...(f?.originalName ? { latestFileName: f.originalName } : {}),
        },
        user.id,
      );

      // Pastikan ada versi yang mengikat fileId ini
      const vCount = await this.prisma.main.quotationVersion.count({ where: { quotationId: id } });
      if (vCount === 0) {
        await this.prisma.main.quotationVersion.create({
          data: {
            quotationId: id,
            version: 1,
            fileId: dto.fileId,
            total,
            ppn,
            discount,
            grandTotal,
            note: `Dokumen Penawaran Manual: ${f?.originalName || "File"}`,
            createdById: user.id,
          },
        });
        await this.prisma.main.quotation.update({
          where: { id },
          data: { currentVersion: 1 },
        });
      } else {
        const latestVer = await this.prisma.main.quotationVersion.findFirst({
          where: { quotationId: id },
          orderBy: { version: "desc" },
        });
        if (latestVer && !latestVer.fileId) {
          await this.prisma.main.quotationVersion.update({
            where: { id: latestVer.id },
            data: { fileId: dto.fileId },
          });
        }
      }
    } else if (dto.fileId === null) {
      await this.saveMeta(
        id,
        {
          latestFileId: null,
          latestFileName: null,
        },
        user.id,
      );
      await this.prisma.main.quotationVersion.updateMany({
        where: { quotationId: id },
        data: { fileId: null },
      }).catch(() => {});
    }

    if (
      items !== undefined ||
      dto.total !== undefined ||
      dto.discount !== undefined ||
      dto.subject !== undefined ||
      dto.intro !== undefined ||
      dto.notesList !== undefined ||
      dto.kopText !== undefined ||
      dto.customerAddress !== undefined ||
      dto.city !== undefined ||
      dto.signerName !== undefined ||
      dto.signerTitle !== undefined ||
      dto.pph !== undefined ||
      dto.pphMode !== undefined ||
      dto.tipePph !== undefined
    ) {
      await this.saveMeta(
        id,
        {
          items: activeItems,
          subject: dto.subject ?? existingMeta?.subject,
          intro: dto.intro ?? existingMeta?.intro,
          notes: dto.notesList ?? existingMeta?.notes,
          city: dto.city ?? existingMeta?.city,
          kopText: dto.kopText ?? existingMeta?.kopText,
          customerAddress: dto.customerAddress ?? existingMeta?.customerAddress,
          signerName: dto.signerName ?? existingMeta?.signerName,
          signerTitle: dto.signerTitle ?? existingMeta?.signerTitle,
          pph: dto.pph ?? (existingMeta as any)?.pph,
          pphMode: dto.pphMode ?? (existingMeta as any)?.pphMode,
          tipePph: dto.tipePph ?? (existingMeta as any)?.tipePph,
        } as any,
        user.id,
      );
    }

    if (items !== undefined) {
      await this.reservations
        .syncDocumentReservations({
          quotationId: id,
          noteLabel: `Penawaran ${updated.number}`,
          userId: user.id,
          markSerialReserved: false,
          items: activeItems,
        })
        .catch(() => {});
    }

    await this.audit.log({
      actor: user,
      action: "ISI_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: `${updated.number} total=${updated.grandTotal}`,
    });
    this.notifications.dataChange("quotations", "update", id);
    if (updated.leadId) this.notifications.dataChange("leads", "update", updated.leadId);
    return this.get(id);
  }

  /** Generate file Excel (.xlsx) resmi untuk penawaran, simpan ke File & QuotationMeta. */
  private async generateAndAttachExcel(
    id: number,
    metaPatch: Partial<QuotationMeta>,
    user?: RequestUser,
  ) {
    const row = await this.prisma.main.quotation.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, address: true } },
        owner: { select: { id: true, name: true } },
      },
    });
    if (!row) return;

    const mergedMeta = await this.saveMeta(id, metaPatch, user?.id);
    const buffer = await buildQuotationXlsx({
      quoteNo: row.number,
      date: row.createdAt,
      city: mergedMeta.city || "Bekasi",
      customerName: row.customer?.name || "-",
      customerAddress: mergedMeta.customerAddress || row.customer?.address || "Di Tempat",
      leadName: row.lead?.name || "-",
      kopText: mergedMeta.kopText,
      subject: mergedMeta.subject,
      intro: mergedMeta.intro,
      items: mergedMeta.items,
      total: Number(row.total),
      ppn: Number(row.ppn),
      discount: Number(row.discount),
      grandTotal: Number(row.grandTotal),
      ppnIncluded: quotationPpnIncluded(row),
      notes: mergedMeta.notes,
      signerName: mergedMeta.signerName || row.owner?.name || "Sales",
      signerTitle: mergedMeta.signerTitle,
    });

    const filename = `Penawaran-${row.number.replace(/\//g, "-")}.xlsx`;
    const savedFile = await this.upload.saveBufferDirect(
      buffer,
      filename,
      "xlsx",
      user?.id ?? row.ownerId,
      "quotation",
      String(id),
    );

    await this.saveMeta(
      id,
      {
        latestFileId: savedFile.id,
        latestFileName: savedFile.originalName,
      },
      user?.id,
    );

    const ver = row.currentVersion;
    if (ver > 0) {
      await this.prisma.main.quotationVersion
        .upsert({
          where: { quotationId_version: { quotationId: id, version: ver } },
          update: {
            fileId: savedFile.id,
            total: row.total,
            ppn: row.ppn,
            discount: row.discount,
            grandTotal: row.grandTotal,
          },
          create: {
            quotationId: id,
            version: ver,
            fileId: savedFile.id,
            total: row.total,
            ppn: row.ppn,
            discount: row.discount,
            grandTotal: row.grandTotal,
            note: `Auto-generated Excel v${ver}`,
            createdById: user?.id ?? row.ownerId,
          },
        })
        .catch(() => {});
    }
  }

  /** Download file Excel (.xlsx) penawaran yang selalu sinkron dengan data terbaru. */
  async exportExcel(id: number): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.prisma.main.quotation.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, address: true } },
        owner: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException("Penawaran tidak ditemukan");

    const meta = (await this.getMetaMap([id])).get(id);
    const kop = await this.resolveKopDefaults(meta);
    const buffer = await buildQuotationXlsx({
      quoteNo: row.number,
      date: row.createdAt,
      city: meta?.city || "Bekasi",
      customerName: row.customer?.name || "-",
      customerAddress: meta?.customerAddress || row.customer?.address || "Di Tempat",
      leadName: row.lead?.name || "-",
      kopText: kop.kopText,
      subject: meta?.subject,
      intro: meta?.intro,
      items: meta?.items ?? [],
      total: Number(row.total),
      ppn: Number(row.ppn),
      discount: Number(row.discount),
      grandTotal: Number(row.grandTotal),
      ppnIncluded: quotationPpnIncluded(row),
      notes: meta?.notes ?? DEFAULT_QUOTATION_NOTES,
      signerName: meta?.signerName || row.owner?.name || "Sales",
      signerTitle: meta?.signerTitle,
    });

    const filename = `Penawaran-${row.number.replace(/\//g, "-")}.xlsx`;
    return { buffer, filename };
  }

  /** Download file PDF penawaran resmi yang identik dengan format Excel. */
  async exportPdf(id: number): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.prisma.main.quotation.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, address: true } },
        owner: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException("Penawaran tidak ditemukan");

    const meta = (await this.getMetaMap([id])).get(id);
    const kop = await this.resolveKopDefaults(meta);
    const buffer = await buildQuotationPdf({
      quoteNo: row.number,
      date: row.createdAt,
      city: meta?.city || "Bekasi",
      customerName: row.customer?.name || "-",
      customerAddress: meta?.customerAddress || row.customer?.address || "Di Tempat",
      leadName: row.lead?.name || "-",
      kopText: kop.kopText,
      kopLogoUrl: (meta as any)?.kopLogoUrl,
      kopLogoDataUrl: kop.kopLogoDataUrl,
      subject: meta?.subject,
      intro: meta?.intro,
      items: meta?.items ?? [],
      total: Number(row.total),
      ppn: Number(row.ppn),
      discount: Number(row.discount),
      grandTotal: Number(row.grandTotal),
      ppnIncluded: quotationPpnIncluded(row),
      notes: meta?.notes ?? DEFAULT_QUOTATION_NOTES,
      signerName: meta?.signerName || row.owner?.name || "Sales",
      signerTitle: meta?.signerTitle,
    });

    const filename = `Penawaran-${row.number.replace(/\//g, "-")}.pdf`;
    return { buffer, filename };
  }

  /** Download template Excel (.xlsx) dari Lead / parameter sebelum atau saat penawaran dibuat. */
  async exportTemplateExcel(query: {
    leadId?: number;
    customer?: string;
    lead?: string;
    nomor?: string;
    signer?: string;
  }): Promise<{ buffer: Buffer; filename: string }> {
    if (query.leadId) {
      const existing = await this.prisma.main.quotation.findFirst({
        where: { leadId: Number(query.leadId) },
      });
      if (existing) {
        return this.exportExcel(existing.id);
      }
      const leadRow = await this.prisma.main.lead.findUnique({
        where: { id: Number(query.leadId) },
        include: {
          customer: { select: { name: true } },
          owner: { select: { name: true } },
        },
      });
      if (leadRow) {
        const suggestedNo = await this.docnum.suggest("penawaran");
        const kop = await this.resolveKopDefaults();
        const buffer = await buildQuotationXlsx({
          quoteNo: query.nomor || suggestedNo,
          date: new Date(),
          city: "Bekasi",
          customerName: leadRow.customer?.name || query.customer || "-",
          leadName: leadRow.name,
          total: Number(leadRow.estimatedValue) || 0,
          signerName: leadRow.owner?.name || query.signer || "Sales",
          kopText: kop.kopText,
          kopLogoDataUrl: kop.kopLogoDataUrl,
        });
        const safeName = leadRow.name.replace(/[^a-zA-Z0-9_-]/g, "-");
        return { buffer, filename: `Template-Penawaran-${safeName}.xlsx` };
      }
    }

    const suggestedNo = query.nomor || (await this.docnum.suggest("penawaran"));
    const kop = await this.resolveKopDefaults();
    const buffer = await buildQuotationXlsx({
      quoteNo: suggestedNo,
      date: new Date(),
      city: "Bekasi",
      customerName: query.customer || "-",
      leadName: query.lead || "Pekerjaan",
      signerName: query.signer || "Sales",
      kopText: kop.kopText,
      kopLogoDataUrl: kop.kopLogoDataUrl,
    });
    return {
      buffer,
      filename: `Template-Penawaran-${suggestedNo.replace(/\//g, "-")}.xlsx`,
    };
  }

  /** Download template PDF dari Lead / parameter sebelum atau saat penawaran dibuat. */
  async exportTemplatePdf(query: {
    leadId?: number;
    customer?: string;
    lead?: string;
    nomor?: string;
    signer?: string;
  }): Promise<{ buffer: Buffer; filename: string }> {
    if (query.leadId) {
      const existing = await this.prisma.main.quotation.findFirst({
        where: { leadId: Number(query.leadId) },
      });
      if (existing) {
        return this.exportPdf(existing.id);
      }
      const leadRow = await this.prisma.main.lead.findUnique({
        where: { id: Number(query.leadId) },
        include: {
          customer: { select: { name: true } },
          owner: { select: { name: true } },
        },
      });
      if (leadRow) {
        const suggestedNo = await this.docnum.suggest("penawaran");
        const kop = await this.resolveKopDefaults();
        const buffer = await buildQuotationPdf({
          quoteNo: query.nomor || suggestedNo,
          date: new Date(),
          city: "Bekasi",
          customerName: leadRow.customer?.name || query.customer || "-",
          leadName: leadRow.name,
          total: Number(leadRow.estimatedValue) || 0,
          signerName: leadRow.owner?.name || query.signer || "Sales",
          kopText: kop.kopText,
          kopLogoDataUrl: kop.kopLogoDataUrl,
        });
        const safeName = leadRow.name.replace(/[^a-zA-Z0-9_-]/g, "-");
        return { buffer, filename: `Template-Penawaran-${safeName}.pdf` };
      }
    }

    const suggestedNo = query.nomor || (await this.docnum.suggest("penawaran"));
    const kop = await this.resolveKopDefaults();
    const buffer = await buildQuotationPdf({
      quoteNo: suggestedNo,
      date: new Date(),
      city: "Bekasi",
      customerName: query.customer || "-",
      leadName: query.lead || "Pekerjaan",
      signerName: query.signer || "Sales",
      kopText: kop.kopText,
      kopLogoDataUrl: kop.kopLogoDataUrl,
    });
    return {
      buffer,
      filename: `Template-Penawaran-${suggestedNo.replace(/\//g, "-")}.pdf`,
    };
  }

  /**
   * Upload file Excel (.xlsx) penawaran oleh Sales:
   * - Simpan file asli ke penyimpanan & link ke Quotation
   * - Parse isi tabel Item / Jasa, TOTAL, PPN, DISC, GRAND TOTAL, Subject, Notes dari Excel
   * - Update data Quotation & Lead otomatis, ubah status menjadi DRAFT ("Done" di UI)
   */
  async uploadExcel(
    id: number,
    buffer: Buffer,
    originalName: string | undefined,
    user: RequestUser,
  ) {
    const row = await this.getEditable(id, user);
    const filename = originalName || `Penawaran-${row.number.replace(/\//g, "-")}.xlsx`;
    const isExcel = filename.toLowerCase().endsWith(".xlsx");

    let parsed: Awaited<ReturnType<typeof parseQuotationXlsx>> | null = null;
    if (isExcel) {
      try {
        parsed = await parseQuotationXlsx(buffer);
      } catch {
        parsed = null;
      }
    }

    const savedFile = await this.upload.saveBufferDirect(
      buffer,
      filename,
      isExcel ? "xlsx" : "pdf",
      user.id,
      "quotation",
      String(id),
    );

    const existingMeta = (await this.getMetaMap([id])).get(id);
    const items =
      parsed && parsed.items.length > 0 ? parsed.items : (existingMeta?.items ?? []);
    const total =
      parsed && parsed.total > 0 ? parsed.total : Number(row.total);
    const discount =
      parsed && parsed.discount >= 0 ? parsed.discount : Number(row.discount);
    const netBeforeTax = Math.max(0, total - discount);
    const ppn =
      parsed && parsed.ppn !== undefined
        ? parsed.ppn
        : Math.round(netBeforeTax * 0.11);
    const grandTotal =
      parsed && parsed.grandTotal > 0
        ? parsed.grandTotal
        : netBeforeTax + ppn;

    // Upload pertama mengisi Versi 1 yang masih kosong / auto-generate; berikutnya = versi baru.
    const claim = await this.claimableFirstVersion(id);
    const nextVer = claim ? 1 : await this.nextVersionNumber(id);
    const verData = { fileId: savedFile.id, total, ppn, discount, grandTotal, note: `Upload file ${savedFile.originalName}` };
    if (claim) {
      await this.prisma.main.quotationVersion.update({ where: { id: claim.id }, data: verData });
    } else {
      await this.prisma.main.quotationVersion.create({
        data: { quotationId: id, version: nextVer, ...verData, createdById: user.id },
      });
    }

    await this.prisma.main.quotation.update({
      where: { id },
      data: {
        currentVersion: nextVer,
        total,
        ppn,
        discount,
        grandTotal,
        ...(row.status === "NOT_YET" ? { status: "DRAFT" } : {}),
      },
    });

    if (total > 0 && row.leadId) {
      await this.prisma.main.lead
        .update({
          where: { id: row.leadId },
          data: { estimatedValue: total },
        })
        .catch(() => {});
    }

    await this.saveMeta(
      id,
      {
        items,
        ...(parsed?.subject ? { subject: parsed.subject } : {}),
        ...(parsed?.intro ? { intro: parsed.intro } : {}),
        ...(parsed?.notes && parsed.notes.length > 0 ? { notes: parsed.notes } : {}),
        ...(parsed?.signerName ? { signerName: parsed.signerName } : {}),
        latestFileId: savedFile.id,
        latestFileName: savedFile.originalName,
      },
      user.id,
    );

    await this.audit.log({
      actor: user,
      action: "UPLOAD_EXCEL_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: `${row.number} v${nextVer} (${items.length} item, total=${grandTotal})`,
    });

    this.notifications.dataChange("quotations", "update", id);
    if (row.leadId) this.notifications.dataChange("leads", "update", row.leadId);
    return this.get(id);
  }

  private async getEditable(id: number, user: RequestUser) {
    const row = await this.prisma.main.quotation.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!row) throw new NotFoundException("Penawaran tidak ditemukan");
    if (["SUPER_ADMIN", "ADMIN", "BOS", "PM", "FINANCE", "SALES"].includes(user.role) || row.ownerId === user.id) return row;
    throw new ForbiddenException("Hanya pemilik penawaran, PM, atau Admin yang boleh mengubahnya");
  }

  /** Ajukan ke persetujuan Finance/Bos (PRD #14). */
  async submit(id: number, user: RequestUser) {
    const row = await this.getEditable(id, user);
    const updated = await this.prisma.main.quotation.update({
      where: { id },
      data: { status: "PENDING_APPROVAL" },
    });
    await this.audit.log({
      actor: user,
      action: "AJUKAN_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: row.number,
    });
    this.notifications.dataChange("quotations", "status", updated.id);
    return updated;
  }

  /** Kirim ke client. */
  async send(id: number, user: RequestUser) {
    const row = await this.getEditable(id, user);
    const updated = await this.prisma.main.quotation.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });
    if (row.currentVersion > 0) {
      await this.prisma.main.quotationVersion
        .updateMany({
          where: { quotationId: id, version: row.currentVersion },
          data: { note: `[STATUS:Terkirim] Versi ${row.currentVersion}` },
        })
        .catch(() => {});
    }
    await this.audit.log({
      actor: user,
      action: "KIRIM_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: row.number,
    });
    this.notifications.dataChange("quotations", "status", updated.id);
    this.notifications.dataChange("quotations", "update", updated.id);
    return updated;
  }

  /** Status diubah manual dan boleh loncat (PRD #2) — selalu dicatat. */
  async setStatus(id: number, status: string, user: RequestUser) {
    const mapped = normalizeQuotationStatus(status) ?? status;
    if (!MANUAL_STATUSES.includes(mapped) && !MANUAL_STATUSES.includes(status)) {
      throw new BadRequestException(`Status tidak dikenal: ${status}`);
    }
    const row = await this.getEditable(id, user);
    if (mapped === "SENT") return this.send(id, user);
    if (mapped === "PENDING_APPROVAL") return this.submit(id, user);

    const updated = await this.prisma.main.quotation.update({
      where: { id },
      data: { status: mapped as never },
    });
    // Update status versi aktif saat ini
    const statusLabel = mapped === "APPROVED" ? "Disetujui" : mapped === "REJECTED" ? "Ditolak" : mapped === "SENT" ? "Terkirim" : mapped;
    await this.prisma.main.quotationVersion.updateMany({
      where: { quotationId: id, version: row.currentVersion },
      data: { note: `[STATUS:${statusLabel}] Versi ${row.currentVersion}` },
    }).catch(() => {});

    if (mapped === "REJECTED" || mapped === "EXPIRED") {
      await this.reservations.releaseForDocument({ quotationId: id }).catch(() => {});
    }

    await this.audit.log({
      actor: user,
      action: "UBAH_STATUS_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: `${row.number}: ${row.status} → ${mapped}`,
    });
    this.notifications.dataChange("quotations", "status", updated.id);
    return updated;
  }

  /**
   * Versi 1 yang belum berisi dokumen dari user (masih kosong / hanya Excel hasil generate otomatis)
   * dipakai oleh upload dokumen pertama, supaya upload pertama = Versi 1 (bukan langsung Versi 2).
   */
  private async claimableFirstVersion(quotationId: number) {
    const versions = await this.prisma.main.quotationVersion.findMany({
      where: { quotationId },
      orderBy: { version: "asc" },
      select: { id: true, version: true, fileId: true, note: true },
    });
    const v = versions[0];
    if (versions.length === 1 && v && v.version === 1 && (!v.fileId || /^Auto-generated/i.test(v.note || ""))) return v;
    return null;
  }

  /** Nomor versi berikutnya diambil dari riwayat yang benar-benar ada (bukan currentVersion yang bisa naik tanpa riwayat). */
  private async nextVersionNumber(quotationId: number) {
    const agg = await this.prisma.main.quotationVersion.aggregate({ where: { quotationId }, _max: { version: true } });
    return (agg._max.version ?? 0) + 1;
  }

  /** Revisi = versi baru, riwayat tidak boleh hilang (PRD #14). */
  async addVersion(id: number, dto: VersionDto, user: RequestUser) {
    const row = await this.getEditable(id, user);

    // Upload dokumen pertama mengisi Versi 1 yang masih kosong / auto-generate
    const v1WithoutFile = dto.fileId ? await this.claimableFirstVersion(id) : null;
    const totalVersions = await this.prisma.main.quotationVersion.count({ where: { quotationId: id } });

    if (totalVersions === 1 && v1WithoutFile && dto.fileId) {
      await this.prisma.main.quotationVersion.update({
        where: { id: v1WithoutFile.id },
        data: {
          fileId: dto.fileId,
          total: dto.total ?? row.total,
          ppn: dto.ppn ?? row.ppn,
          discount: dto.discount ?? row.discount,
          grandTotal: dto.grandTotal ?? row.grandTotal,
          note: dto.note?.trim() ? `[STATUS:Menunggu] ${dto.note.trim()}` : v1WithoutFile.note,
        },
      });
      await this.prisma.main.quotation.update({ where: { id }, data: { currentVersion: 1 } });
      const f = await this.attachFile(id, dto.fileId);
      await this.saveMeta(
        id,
        {
          latestFileId: dto.fileId,
          ...(f?.originalName ? { latestFileName: f.originalName } : {}),
        },
        user.id,
      );
      this.notifications.dataChange("quotations", "update", id);
      return this.get(id);
    }

    const version = await this.nextVersionNumber(id);

    // Bekukan status versi sebelumnya jika ada
    if (version > 1) {
      const prevStatusLabel = row.status === "REJECTED" ? "Ditolak" : row.status === "APPROVED" ? "Disetujui" : "Ditolak";
      await this.prisma.main.quotationVersion.updateMany({
        where: { quotationId: id, version: version - 1 },
        data: { note: `[STATUS:${prevStatusLabel}] Versi ${version - 1}` },
      }).catch(() => {});
    }

    const versionNote = dto.note?.trim()
      ? `[STATUS:Menunggu] ${dto.note.trim()}`
      : `[STATUS:Menunggu] Revisi v${version}`;

    await this.prisma.main.quotationVersion.create({
      data: {
        quotationId: id,
        version,
        fileId: dto.fileId,
        total: dto.total ?? row.total,
        ppn: dto.ppn ?? row.ppn,
        discount: dto.discount ?? row.discount,
        grandTotal: dto.grandTotal ?? row.grandTotal,
        note: versionNote,
        createdById: user.id,
      },
    });
    const updated = await this.prisma.main.quotation.update({
      where: { id },
      data: {
        currentVersion: version,
        total: dto.total ?? row.total,
        ppn: dto.ppn ?? row.ppn,
        discount: dto.discount ?? row.discount,
        grandTotal: dto.grandTotal ?? row.grandTotal,
        status: "PENDING_APPROVAL",
      },
      include: { versions: { orderBy: { version: "desc" } } },
    });
    if (dto.fileId) {
      const f = await this.attachFile(id, dto.fileId);
      await this.saveMeta(
        id,
        {
          latestFileId: dto.fileId,
          ...(f?.originalName ? { latestFileName: f.originalName } : {}),
        },
        user.id,
      );
    }
    await this.audit.log({
      actor: user,
      action: "REVISI_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: `${row.number} v${version}`,
    });
    this.notifications.dataChange("quotations", "update", id);
    return updated;
  }

  async deleteVersion(id: number, versionId: number, user: RequestUser) {
    await this.getEditable(id, user);
    const ver = await this.prisma.main.quotationVersion.findFirst({
      where: { id: versionId, quotationId: id },
    });
    if (!ver) throw new NotFoundException("Versi penawaran tidak ditemukan");

    if (ver.fileId) {
      await this.prisma.main.file.delete({ where: { id: ver.fileId } }).catch(() => {});
    }

    await this.prisma.main.quotationVersion.delete({ where: { id: versionId } });

    const remaining = await this.prisma.main.quotationVersion.findMany({
      where: { quotationId: id },
      orderBy: { version: "desc" },
    });

    const maxVer = remaining[0];
    const currentQ = await this.prisma.main.quotation.findUnique({
      where: { id },
      select: { total: true, ppn: true, discount: true, grandTotal: true, currentVersion: true },
    });

    await this.prisma.main.quotation.update({
      where: { id },
      data: {
        currentVersion: maxVer ? maxVer.version : (currentQ?.currentVersion ?? 0),
        total: maxVer ? maxVer.total : (currentQ?.total ?? 0),
        ppn: maxVer ? maxVer.ppn : (currentQ?.ppn ?? 0),
        discount: maxVer ? maxVer.discount : (currentQ?.discount ?? 0),
        grandTotal: maxVer ? maxVer.grandTotal : (currentQ?.grandTotal ?? 0),
      },
    });

    await this.saveMeta(
      id,
      {
        latestFileId: maxVer?.fileId ?? null,
      },
      user.id,
    );

    await this.audit.log({
      actor: user,
      action: "HAPUS_REVISI_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: `Menghapus versi ${ver.version} (ID: ${ver.id})`,
    });

    this.notifications.dataChange("quotations", "update", id);
    return this.get(id);
  }

  async remove(id: number, user: RequestUser) {
    const row = await this.getEditable(id, user);
    await this.reservations.releaseForDocument({ quotationId: id }).catch(() => {});
    await this.prisma.main.$transaction(async (tx) => {
      await tx.approval.deleteMany({ where: { kind: "PENAWARAN", entityId: id } });
      await tx.followUp.deleteMany({ where: { quotationId: id } });
      await tx.quotationVersion.deleteMany({ where: { quotationId: id } });
      await tx.quotation.delete({ where: { id } });
    });
    await this.audit.log({
      actor: user,
      action: "HAPUS_PENAWARAN",
      entityType: "quotation",
      entityId: id,
      detail: `${row.number} dihapus`,
    });
    this.notifications.dataChange("quotations", "delete", id);
    return { id, deleted: true };
  }

  private async attachFile(quotationId: number, fileId: number) {
    return this.prisma.main.file
      .update({
        where: { id: fileId },
        data: { refType: "quotation", refId: String(quotationId) },
      })
      .catch(() => null);
  }

  private async onApprovalDecision(entityId: number, status: ApprovalStatus) {
    const row = await this.prisma.main.quotation.findUnique({ where: { id: entityId } });
    if (!row || row.status !== "PENDING_APPROVAL") return;
    const next = status === "DISETUJUI" ? "APPROVED" : "REJECTED";
    await this.prisma.main.quotation.update({ where: { id: entityId }, data: { status: next } });
    await this.notifications.notify({
      userIds: [row.ownerId],
      kind: "APPROVAL",
      text: `Penawaran ${row.number}: ${next === "APPROVED" ? "disetujui Finance" : "ditolak"}`,
      href: `/quotations/${entityId}`,
    });
  }

  /** Nomor otomatis untuk pratinjau form. */
  suggestNumber() {
    return this.docnum.suggest("penawaran");
  }

  async assertUniqueNumber(value: string, excludeId?: number) {
    const dup = await this.prisma.main.quotation.findFirst({
      where: { number: value, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (dup) throw new ConflictException(`Nomor ${value} sudah dipakai`);
  }
}
