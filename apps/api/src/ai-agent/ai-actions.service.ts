import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { LeadsService } from "../crm/leads.service.js";
import { FollowUpsService } from "../crm/follow-ups.service.js";
import { QuotationsService } from "../crm/quotations.service.js";
import { InvoiceOutService } from "../finance/invoice-out.service.js";
import { ExpensesService } from "../finance/expenses.service.js";
import { CalendarService } from "../calendar/calendar.service.js";
import { TasksService } from "../projects/tasks.service.js";
import { CustomersService } from "../master/customers.service.js";
import { RequestsService } from "../procurement/requests.service.js";
import { can } from "../rbac/permissions.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type CreatableEntityType =
  | "lead"
  | "followup"
  | "quotation"
  | "invoice"
  | "calendar_event"
  | "task"
  | "customer"
  | "expense"
  | "purchase_request";

export const ENTITY_PERMISSION_MAP: Record<
  CreatableEntityType,
  { module: string; label: string }
> = {
  lead: { module: "leads", label: "Prospek / Lead" },
  followup: { module: "leads", label: "Follow-Up Prospek" },
  quotation: { module: "quotations", label: "Penawaran (Quotation)" },
  invoice: { module: "invoices", label: "Faktur Keluar (Invoice)" },
  calendar_event: { module: "calendar", label: "Agenda Kalender" },
  task: { module: "tasks", label: "Tugas Proyek" },
  customer: { module: "customers", label: "Pelanggan (Customer)" },
  expense: { module: "expenses", label: "Pengeluaran (Expense)" },
  purchase_request: { module: "requests", label: "Permintaan Barang (PR)" },
};

export interface AiPendingActionView {
  id: number;
  sessionId: number;
  entityType: CreatableEntityType;
  entityLabel: string;
  title: string;
  summary: Record<string, string>;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED";
  resultEntityId: string | null;
  resultHref: string | null;
  errorMessage: string | null;
  expiresAt: string;
  createdAt: string;
}

const ACTION_TTL_MS = 30 * 60 * 1000; // 30 menit

function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function asNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function parseReminderMinutes(v: unknown): number | undefined {
  const num = asNum(v);
  if (num != null && num >= 0) return Math.round(num);
  if (typeof v !== "string") return undefined;
  const s = v.toLowerCase().trim();
  const match = s.match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const val = Number(match[1]);
  if (!Number.isFinite(val)) return undefined;
  if (s.includes("hari") || s.includes("day")) return Math.round(val * 1440);
  if (s.includes("jam") || s.includes("hour")) return Math.round(val * 60);
  return Math.round(val);
}

function fmtRp(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

@Injectable()
export class AiActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly leads: LeadsService,
    private readonly followUps: FollowUpsService,
    private readonly quotations: QuotationsService,
    private readonly invoices: InvoiceOutService,
    private readonly expenses: ExpensesService,
    private readonly calendar: CalendarService,
    private readonly tasks: TasksService,
    private readonly customers: CustomersService,
    private readonly requests: RequestsService,
  ) {}

  getAllowedCreatableEntities(user: RequestUser): CreatableEntityType[] {
    return (Object.keys(ENTITY_PERMISSION_MAP) as CreatableEntityType[]).filter((entity) =>
      can(user.role, ENTITY_PERMISSION_MAP[entity].module, "C"),
    );
  }

  async listSessionActions(user: RequestUser, sessionId: number): Promise<AiPendingActionView[]> {
    const rows = await this.prisma.main.aiPendingAction.findMany({
      where: { sessionId, userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.toView(r));
  }

  private async resolveUsersByNames(
    rawNames: string[],
  ): Promise<{ matched: Array<{ id: number; name: string; role: string }>; unmatched: string[] }> {
    const cleaned = rawNames.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) return { matched: [], unmatched: [] };

    const activeUsers = await this.prisma.main.user.findMany({
      where: { status: "AKTIF" },
      select: { id: true, name: true, role: true, email: true },
    });

    const matchedMap = new Map<number, { id: number; name: string; role: string }>();
    const unmatched: string[] = [];

    for (const q of cleaned) {
      const qLower = q.toLowerCase();
      const qRole = q.toUpperCase().replace(/[\s-]+/g, "_");
      const found = activeUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(qLower) ||
          u.email.toLowerCase().includes(qLower) ||
          u.role.toUpperCase() === qRole,
      );
      if (found.length === 0) {
        unmatched.push(q);
      } else {
        for (const u of found) {
          matchedMap.set(u.id, { id: u.id, name: u.name, role: u.role });
        }
      }
    }

    return { matched: Array.from(matchedMap.values()), unmatched };
  }

  private extractNameList(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
    }
    if (typeof raw === "string" && raw.trim()) {
      return raw
        .split(/[,;&]|\bdan\b/i)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }

  private async resolveProject(data: Record<string, unknown>) {
    const id = asNum(data.projectId);
    if (id) {
      return this.prisma.main.project.findUnique({ where: { id }, select: { id: true, name: true } });
    }
    const q = asStr(data.projectName) ?? asStr(data.project);
    if (!q) return null;
    return this.prisma.main.project.findFirst({
      where: { name: { contains: q } },
      select: { id: true, name: true },
      orderBy: { id: "desc" },
    });
  }

  private async resolveCustomer(data: Record<string, unknown>) {
    const id = asNum(data.customerId);
    if (id) {
      return this.prisma.main.customer.findUnique({ where: { id }, select: { id: true, name: true } });
    }
    const q = asStr(data.customerName) ?? asStr(data.customer);
    if (!q) return null;
    return this.prisma.main.customer.findFirst({
      where: { OR: [{ name: { contains: q } }, { company: { contains: q } }] },
      select: { id: true, name: true },
      orderBy: { id: "desc" },
    });
  }

  private async resolveLead(data: Record<string, unknown>) {
    const id = asNum(data.leadId);
    if (id) {
      return this.prisma.main.lead.findUnique({ where: { id }, select: { id: true, name: true } });
    }
    const q = asStr(data.leadName) ?? asStr(data.lead);
    if (!q) return null;
    return this.prisma.main.lead.findFirst({
      where: { name: { contains: q } },
      select: { id: true, name: true },
      orderBy: { id: "desc" },
    });
  }

  private async resolveSupplier(data: Record<string, unknown>) {
    const id = asNum(data.supplierId);
    if (id) {
      return this.prisma.main.supplier.findUnique({ where: { id }, select: { id: true, name: true } });
    }
    const q = asStr(data.supplierName) ?? asStr(data.supplier);
    if (!q) return null;
    return this.prisma.main.supplier.findFirst({
      where: { name: { contains: q } },
      select: { id: true, name: true },
      orderBy: { id: "desc" },
    });
  }

  private async resolveExpenseCategory(data: Record<string, unknown>) {
    const id = asNum(data.categoryId);
    if (id) {
      return this.prisma.main.expenseCategory.findUnique({ where: { id }, select: { id: true, name: true } });
    }
    const q = asStr(data.categoryName) ?? asStr(data.category);
    if (!q) return null;
    return this.prisma.main.expenseCategory.findFirst({
      where: { name: { contains: q } },
      select: { id: true, name: true },
    });
  }

  async proposeCreate(
    user: RequestUser,
    sessionId: number,
    entityType: CreatableEntityType,
    rawData: Record<string, unknown>,
    attachments: Array<{ fileId: number; name: string }> = [],
  ): Promise<AiPendingActionView> {
    const meta = ENTITY_PERMISSION_MAP[entityType];
    if (!meta) {
      throw new BadRequestException(`Jenis dokumen "${entityType}" tidak didukung.`);
    }
    if (!can(user.role, meta.module, "C")) {
      throw new ForbiddenException(
        `Peran Anda tidak memiliki hak membuat ${meta.label}.`,
      );
    }

    const firstAttachment = attachments[0];
    const data: Record<string, unknown> = { ...rawData };
    if (firstAttachment) {
      if (entityType === "quotation" || entityType === "invoice" || entityType === "lead") {
        if (!asNum(data.fileId)) data.fileId = firstAttachment.fileId;
      }
      if (entityType === "expense") {
        if (!asNum(data.receiptFileId)) data.receiptFileId = firstAttachment.fileId;
      }
    }

    const summary: Record<string, string> = {};
    let title = `Buat ${meta.label}`;

    switch (entityType) {
      case "lead": {
        const name = asStr(data.name) ?? asStr(data.company) ?? "Prospek Baru";
        title = `Buat Prospek: ${name}`;
        summary["Nama Prospek"] = name;
        const cust = await this.resolveCustomer(data);
        if (cust) {
          data.customerId = cust.id;
          summary["Pelanggan Terkait"] = `${cust.name} (#${cust.id})`;
        }
        if (asStr(data.contactName)) summary["Kontak / PIC"] = asStr(data.contactName)!;
        if (asStr(data.need)) summary["Kebutuhan"] = asStr(data.need)!;
        if (asNum(data.estimatedValue)) summary["Nilai Estimasi"] = fmtRp(asNum(data.estimatedValue)!);
        if (asStr(data.stage)) summary["Stage"] = asStr(data.stage)!;
        if (asStr(data.targetClosing)) summary["Target Closing"] = asStr(data.targetClosing)!;
        break;
      }
      case "followup": {
        title = "Buat Follow-Up Prospek";
        const lead = await this.resolveLead(data);
        if (lead) {
          data.leadId = lead.id;
          summary["Prospek / Lead"] = `${lead.name} (#${lead.id})`;
        }
        if (asStr(data.date)) summary["Tanggal"] = asStr(data.date)!;
        if (asStr(data.nextDate)) summary["Jadwal Berikutnya"] = asStr(data.nextDate)!;
        if (asStr(data.method) ?? asStr(data.channel)) {
          summary["Metode"] = (asStr(data.method) ?? asStr(data.channel))!;
        }
        if (asStr(data.notes) ?? asStr(data.note)) {
          summary["Catatan"] = (asStr(data.notes) ?? asStr(data.note))!;
        }
        break;
      }
      case "quotation": {
        title = "Buat Penawaran (Quotation)";
        const lead = await this.resolveLead(data);
        if (lead) {
          data.leadId = lead.id;
          summary["Prospek / Lead"] = `${lead.name} (#${lead.id})`;
        }
        const cust = await this.resolveCustomer(data);
        if (cust) {
          data.customerId = cust.id;
          summary["Pelanggan"] = `${cust.name} (#${cust.id})`;
        }
        if (asNum(data.total)) summary["Subtotal / DPP"] = fmtRp(asNum(data.total)!);
        if (asNum(data.grandTotal)) summary["Grand Total"] = fmtRp(asNum(data.grandTotal)!);
        if (asStr(data.note)) summary["Catatan"] = asStr(data.note)!;
        break;
      }
      case "invoice": {
        title = "Buat Faktur Keluar (Invoice)";
        const cust = await this.resolveCustomer(data);
        if (cust) {
          data.customerId = cust.id;
          summary["Pelanggan"] = `${cust.name} (#${cust.id})`;
        }
        const proj = await this.resolveProject(data);
        if (proj) {
          data.projectId = proj.id;
          summary["Proyek Terkait"] = `${proj.name} (#${proj.id})`;
        }
        if (asNum(data.total) ?? asNum(data.amount)) {
          summary["Nilai Tagihan"] = fmtRp((asNum(data.total) ?? asNum(data.amount))!);
        }
        if (asStr(data.date)) summary["Tanggal Faktur"] = asStr(data.date)!;
        if (asStr(data.dueDate)) summary["Jatuh Tempo"] = asStr(data.dueDate)!;
        if (asStr(data.description) ?? asStr(data.note)) {
          summary["Keterangan"] = (asStr(data.description) ?? asStr(data.note))!;
        }
        break;
      }
      case "calendar_event": {
        const evTitle = asStr(data.title) ?? "Kegiatan Baru";
        title = `Buat Agenda: ${evTitle}`;
        summary["Judul"] = evTitle;
        if (asStr(data.startDate)) summary["Mulai"] = asStr(data.startDate)!;
        if (asStr(data.endDate)) summary["Selesai"] = asStr(data.endDate)!;
        if (asStr(data.location)) summary["Lokasi"] = asStr(data.location)!;
        if (asStr(data.description)) summary["Deskripsi"] = asStr(data.description)!;

        const reminderMin =
          parseReminderMinutes(data.reminderMinutes) ?? parseReminderMinutes(data.reminder);
        if (reminderMin != null && reminderMin > 0) {
          data.reminderMinutes = reminderMin;
          summary["Pengingat"] =
            reminderMin >= 1440 && reminderMin % 1440 === 0
              ? `${reminderMin / 1440} hari sebelum mulai`
              : reminderMin >= 60 && reminderMin % 60 === 0
                ? `${reminderMin / 60} jam sebelum mulai`
                : `${reminderMin} menit sebelum mulai`;
        }

        // Resolusi entitas terkait (Proyek, Pelanggan, Lead, Pemasok)
        const [proj, cust, lead, supp] = await Promise.all([
          this.resolveProject(data),
          this.resolveCustomer(data),
          this.resolveLead(data),
          this.resolveSupplier(data),
        ]);
        if (proj) {
          data.projectId = proj.id;
          summary["Proyek Terkait"] = `${proj.name} (#${proj.id})`;
        }
        if (cust) {
          data.customerId = cust.id;
          summary["Pelanggan Terkait"] = `${cust.name} (#${cust.id})`;
        }
        if (lead) {
          data.leadId = lead.id;
          summary["Lead Terkait"] = `${lead.name} (#${lead.id})`;
        }
        if (supp) {
          data.supplierId = supp.id;
          summary["Pemasok Terkait"] = `${supp.name} (#${supp.id})`;
        }

        // Resolusi penanggung jawab (assigneeName -> assigneeId)
        const assigneeName = asStr(data.assigneeName);
        if (assigneeName && !asNum(data.assigneeId)) {
          const { matched } = await this.resolveUsersByNames([assigneeName]);
          if (matched[0]) {
            data.assigneeId = matched[0].id;
            summary["Penanggung Jawab"] = `${matched[0].name} (${matched[0].role})`;
          }
        }

        // Resolusi peserta (attendeeIds / attendeeNames / attendees / participants)
        const rawAttendeeIds = Array.isArray(data.attendeeIds)
          ? data.attendeeIds.map((x) => asNum(x)).filter((x): x is number => x != null)
          : [];
        const rawAttendeeNames = [
          ...this.extractNameList(data.attendeeNames),
          ...this.extractNameList(data.attendees),
          ...this.extractNameList(data.participants),
        ];
        const { matched, unmatched } = await this.resolveUsersByNames(rawAttendeeNames);
        const finalIds = [...new Set([...rawAttendeeIds, ...matched.map((u) => u.id)])];
        if (finalIds.length > 0) {
          data.attendeeIds = finalIds;
          const labels =
            matched.length > 0
              ? matched.map((u) => `${u.name} (${u.role})`).join(", ")
              : `${finalIds.length} peserta`;
          summary["Peserta"] = labels;
        }
        if (unmatched.length > 0) {
          summary["Nama Belum Cocok"] = unmatched.join(", ");
        }
        break;
      }
      case "task": {
        const tName = asStr(data.name) ?? asStr(data.title) ?? "Tugas Baru";
        title = `Buat Tugas: ${tName}`;
        summary["Nama Tugas"] = tName;
        const proj = await this.resolveProject(data);
        if (proj) {
          data.projectId = proj.id;
          summary["Proyek"] = `${proj.name} (#${proj.id})`;
        }
        if (asStr(data.dueDate)) summary["Batas Waktu"] = asStr(data.dueDate)!;
        if (asStr(data.description)) summary["Deskripsi"] = asStr(data.description)!;
        const assigneeName = asStr(data.assigneeName);
        if (assigneeName && !asNum(data.assigneeId)) {
          const { matched } = await this.resolveUsersByNames([assigneeName]);
          if (matched[0]) {
            data.assigneeId = matched[0].id;
            summary["PIC / Penerima Tugas"] = `${matched[0].name} (${matched[0].role})`;
          }
        }
        break;
      }
      case "customer": {
        const cName = asStr(data.name) ?? "Pelanggan Baru";
        title = `Tambah Pelanggan: ${cName}`;
        summary["Nama Perusahaan/Pelanggan"] = cName;
        if (asStr(data.pic)) summary["PIC"] = asStr(data.pic)!;
        if (asStr(data.phone)) summary["Telepon"] = asStr(data.phone)!;
        if (asStr(data.email)) summary["Email"] = asStr(data.email)!;
        if (asStr(data.address)) summary["Alamat"] = asStr(data.address)!;
        break;
      }
      case "expense": {
        const desc = asStr(data.description) ?? "Pengeluaran Operasional";
        title = `Catat Pengeluaran: ${desc.slice(0, 50)}`;
        summary["Deskripsi"] = desc;
        if (asNum(data.amount)) summary["Nominal"] = fmtRp(asNum(data.amount)!);
        if (asStr(data.date)) summary["Tanggal"] = asStr(data.date)!;
        const [proj, cat] = await Promise.all([
          this.resolveProject(data),
          this.resolveExpenseCategory(data),
        ]);
        if (proj) {
          data.projectId = proj.id;
          summary["Proyek Terkait"] = `${proj.name} (#${proj.id})`;
        }
        if (cat) {
          data.categoryId = cat.id;
          summary["Kategori Biaya"] = cat.name;
        }
        break;
      }
      case "purchase_request": {
        title = "Buat Permintaan Barang (PR)";
        summary["Tipe Biaya"] = asStr(data.costType) ?? "STOK";
        summary["Sumber Pengadaan"] = asStr(data.procurementSource) ?? "SUPPLIER";
        const proj = await this.resolveProject(data);
        if (proj) {
          data.projectId = proj.id;
          summary["Proyek Terkait"] = `${proj.name} (#${proj.id})`;
        }
        if (asStr(data.note)) summary["Catatan"] = asStr(data.note)!;
        break;
      }
    }

    if (firstAttachment && (asNum(data.fileId) || asNum(data.receiptFileId))) {
      summary["Lampiran File"] = `${firstAttachment.name} (file #${firstAttachment.fileId})`;
    }

    const row = await this.prisma.main.aiPendingAction.create({
      data: {
        sessionId,
        userId: user.id,
        entityType,
        title: title.slice(0, 191),
        summaryJson: JSON.stringify(summary),
        payloadJson: JSON.stringify(data),
        status: "PENDING",
        expiresAt: new Date(Date.now() + ACTION_TTL_MS),
      },
    });

    return this.toView(row);
  }

  async confirmAction(user: RequestUser, actionId: number): Promise<AiPendingActionView> {
    const action = await this.prisma.main.aiPendingAction.findFirst({
      where: { id: actionId, userId: user.id },
    });
    if (!action) {
      throw new NotFoundException("Draft aksi tidak ditemukan.");
    }
    if (action.status !== "PENDING") {
      throw new BadRequestException(`Draft ini sudah berstatus ${action.status}.`);
    }
    if (action.expiresAt.getTime() < Date.now()) {
      await this.prisma.main.aiPendingAction.update({
        where: { id: action.id },
        data: { status: "CANCELLED", errorMessage: "Draft sudah kedaluwarsa." },
      });
      throw new BadRequestException("Draft sudah kedaluwarsa. Silakan minta AI menyiapkan draft baru.");
    }

    const entityType = action.entityType as CreatableEntityType;
    const meta = ENTITY_PERMISSION_MAP[entityType];
    if (!meta || !can(user.role, meta.module, "C")) {
      throw new ForbiddenException("Peran Anda tidak lagi memiliki izin untuk membuat dokumen ini.");
    }

    const payload = JSON.parse(action.payloadJson) as Record<string, unknown>;

    try {
      const created = await this.executeOfficialCreate(entityType, payload, user);
      const updated = await this.prisma.main.aiPendingAction.update({
        where: { id: action.id },
        data: {
          status: "CONFIRMED",
          resultEntityId: String(created.id),
          resultHref: created.href,
          errorMessage: null,
        },
      });

      void this.audit.log({
        actor: user,
        action: "AI_ACTION_CONFIRMED",
        entityType: meta.module,
        entityId: created.id,
        detail: `Dibuat lewat Asisten AI (${action.title})`,
      });

      return this.toView(updated);
    } catch (err) {
      const msg = (err as Error)?.message || "Gagal membuat dokumen.";
      await this.prisma.main.aiPendingAction.update({
        where: { id: action.id },
        data: { status: "FAILED", errorMessage: msg },
      });
      throw err;
    }
  }

  async cancelAction(user: RequestUser, actionId: number): Promise<AiPendingActionView> {
    const action = await this.prisma.main.aiPendingAction.findFirst({
      where: { id: actionId, userId: user.id },
    });
    if (!action) {
      throw new NotFoundException("Draft aksi tidak ditemukan.");
    }
    if (action.status !== "PENDING") {
      return this.toView(action);
    }
    const updated = await this.prisma.main.aiPendingAction.update({
      where: { id: action.id },
      data: { status: "CANCELLED" },
    });
    return this.toView(updated);
  }

  private async executeOfficialCreate(
    entityType: CreatableEntityType,
    data: Record<string, unknown>,
    user: RequestUser,
  ): Promise<{ id: number | string; href: string }> {
    switch (entityType) {
      case "lead": {
        const rawStage = (asStr(data.stage) || "PROSPECTING").toUpperCase();
        const normalizedStage =
          rawStage === "QUALIFIED"
            ? "QUALIFICATION"
            : ["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST"].includes(
                  rawStage,
                )
              ? rawStage
              : "PROSPECTING";
        const res = await this.leads.create(
          {
            name: asStr(data.name) ?? asStr(data.company) ?? "Lead Baru",
            contactName: asStr(data.contactName),
            need: asStr(data.need),
            estimatedValue: asNum(data.estimatedValue),
            targetClosing: asStr(data.targetClosing),
            stage: normalizedStage as never,
            customerId: asNum(data.customerId),
            fileId: asNum(data.fileId),
          } as never,
          user,
        );
        return { id: res.id, href: `/leads/${res.id}` };
      }

      case "followup": {
        const leadId = asNum(data.leadId);
        if (!leadId) throw new BadRequestException("ID Lead wajib diisi untuk membuat follow-up.");
        const rawMethod = (asStr(data.method) ?? asStr(data.channel) ?? "WA").toUpperCase();
        const method = rawMethod.includes("EMAIL")
          ? "EMAIL"
          : rawMethod.includes("TEL") || rawMethod.includes("PHONE") || rawMethod.includes("CALL")
            ? "TELEPON"
            : rawMethod.includes("WA") || rawMethod.includes("WHATSAPP")
              ? "WA"
              : "LAINNYA";
        const res = await this.followUps.create(
          {
            leadId,
            date: asStr(data.date) ?? new Date().toISOString().slice(0, 10),
            nextDate: asStr(data.nextDate),
            method,
            notes: asStr(data.notes) ?? asStr(data.note) ?? "Follow-up dari Asisten AI",
            status: "TERJADWAL",
          } as never,
          user,
        );
        return { id: res.id, href: `/leads/${leadId}` };
      }

      case "quotation": {
        const leadId = asNum(data.leadId);
        const res = await this.quotations.createForLead(leadId ?? null, user, {
          customerId: asNum(data.customerId),
          total: asNum(data.total),
          grandTotal: asNum(data.grandTotal),
          note: asStr(data.note),
          fileId: asNum(data.fileId),
          items: Array.isArray(data.items) ? (data.items as never) : undefined,
        } as never);
        const id = (res as { id?: number })?.id ?? 0;
        return { id, href: `/quotations/${id}` };
      }

      case "invoice": {
        const amt = asNum(data.amount) ?? asNum(data.total) ?? 0;
        const tot = asNum(data.total) ?? amt;
        const res = await this.invoices.create(
          {
            customerId: asNum(data.customerId),
            projectId: asNum(data.projectId),
            date: asStr(data.date) ?? new Date().toISOString().slice(0, 10),
            dueDate: asStr(data.dueDate),
            amount: amt,
            total: tot,
            description: asStr(data.description) ?? asStr(data.note),
            fileId: asNum(data.fileId),
            items: Array.isArray(data.items) ? (data.items as never) : undefined,
          } as never,
          user,
        );
        const id = (res as { id?: number })?.id ?? 0;
        return { id, href: `/invoices/${id}` };
      }

      case "calendar_event": {
        const attendeeIds = Array.isArray(data.attendeeIds)
          ? data.attendeeIds.map((x) => asNum(x)).filter((x): x is number => x != null)
          : undefined;
        const res = await this.calendar.create(
          {
            title: asStr(data.title) ?? "Kegiatan Baru",
            description: asStr(data.description),
            startDate: asStr(data.startDate) ?? new Date().toISOString(),
            endDate: asStr(data.endDate),
            isAllDay: data.isAllDay === true,
            location: asStr(data.location),
            category: asStr(data.category) ?? "MEETING",
            priority: asStr(data.priority) ?? "MEDIUM",
            reminderMinutes: parseReminderMinutes(data.reminderMinutes) ?? parseReminderMinutes(data.reminder) ?? null,
            recurrence: asStr(data.recurrence) ?? "NONE",
            recurrenceUntil: asStr(data.recurrenceUntil),
            assigneeId: asNum(data.assigneeId),
            attendeeIds,
            projectId: asNum(data.projectId),
            customerId: asNum(data.customerId),
            leadId: asNum(data.leadId),
            supplierId: asNum(data.supplierId),
          } as never,
          user,
        );
        const id = (res as { id?: number })?.id ?? 0;
        return { id, href: "/calendar" };
      }

      case "task": {
        const projectId = asNum(data.projectId);
        if (!projectId) {
          throw new BadRequestException("ID Proyek wajib diisi untuk membuat tugas proyek.");
        }
        const res = await this.tasks.create(
          projectId,
          {
            name: asStr(data.name) ?? asStr(data.title) ?? "Tugas Baru",
            description: asStr(data.description),
            dueDate: asStr(data.dueDate),
            assigneeId: asNum(data.assigneeId),
          } as never,
          user,
        );
        return { id: res.id, href: `/projects/${projectId}` };
      }

      case "customer": {
        const res = await this.customers.create({
          name: asStr(data.name) ?? "",
          pic: asStr(data.pic) ?? "-",
          phone: asStr(data.phone),
          email: asStr(data.email),
          address: asStr(data.address),
        } as never);
        return { id: res.id, href: `/customers/${res.id}` };
      }

      case "expense": {
        const res = await this.expenses.create(
          {
            description: asStr(data.description) ?? "Pengeluaran operasional",
            amount: asNum(data.amount) ?? 0,
            date: asStr(data.date) ?? new Date().toISOString().slice(0, 10),
            projectId: asNum(data.projectId),
            categoryId: asNum(data.categoryId),
            receiptFileId: asNum(data.receiptFileId),
          } as never,
          user,
        );
        const id = (res as { id?: number })?.id ?? 0;
        return { id, href: `/expenses/${id}` };
      }

      case "purchase_request": {
        const res = await this.requests.create(
          {
            costType: asStr(data.costType) ?? "STOK",
            procurementSource: asStr(data.procurementSource) ?? "SUPPLIER",
            projectId: asNum(data.projectId),
            note: asStr(data.note),
            items: Array.isArray(data.items) ? (data.items as never) : [],
          } as never,
          user,
        );
        const id = (res as { id?: number })?.id ?? 0;
        return { id, href: `/purchase-requests/${id}` };
      }
    }
  }

  private toView(row: {
    id: number;
    sessionId: number;
    entityType: string;
    title: string;
    summaryJson: string;
    status: string;
    resultEntityId: string | null;
    resultHref: string | null;
    errorMessage: string | null;
    expiresAt: Date;
    createdAt: Date;
  }): AiPendingActionView {
    let summary: Record<string, string> = {};
    try {
      summary = JSON.parse(row.summaryJson) as Record<string, string>;
    } catch {
      summary = {};
    }
    const entityType = row.entityType as CreatableEntityType;
    return {
      id: row.id,
      sessionId: row.sessionId,
      entityType,
      entityLabel: ENTITY_PERMISSION_MAP[entityType]?.label ?? row.entityType,
      title: row.title,
      summary,
      status: row.status as AiPendingActionView["status"],
      resultEntityId: row.resultEntityId,
      resultHref: row.resultHref,
      errorMessage: row.errorMessage,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
