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

function normalizeFundingSource(
  raw: unknown,
  fallbackText?: string,
): "PERUSAHAAN" | "TALANGAN_PRIBADI" | "PETTY_CASH" {
  const combined = `${typeof raw === "string" ? raw : ""} ${fallbackText ?? ""}`.toLowerCase();
  if (
    combined.includes("talangan") ||
    combined.includes("pribadi") ||
    combined.includes("reimburse") ||
    combined.includes("personal")
  ) {
    return "TALANGAN_PRIBADI";
  }
  if (combined.includes("petty") || combined.includes("kasbon")) {
    return "PETTY_CASH";
  }
  return "PERUSAHAAN";
}

function fundingSourceLabel(code: "PERUSAHAAN" | "TALANGAN_PRIBADI" | "PETTY_CASH"): string {
  if (code === "TALANGAN_PRIBADI") return "Dana Pribadi (Reimburse)";
  if (code === "PETTY_CASH") return "Petty Cash";
  return "Dana Perusahaan";
}

function normalizeTaskPriority(raw: unknown): "RENDAH" | "SEDANG" | "TINGGI" | "URGENT" | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const v = raw.toUpperCase().trim();
  if (v === "LOW" || v === "RENDAH") return "RENDAH";
  if (v === "MEDIUM" || v === "MED" || v === "SEDANG") return "SEDANG";
  if (v === "HIGH" || v === "TINGGI") return "TINGGI";
  if (v === "URGENT" || v === "MENDESAK") return "URGENT";
  return undefined;
}

function normalizeInvoiceType(raw: unknown, fallbackText?: string): "DP" | "TERMIN" | "PELUNASAN" {
  const s = `${typeof raw === "string" ? raw : ""} ${fallbackText ?? ""}`.toLowerCase();
  if (s.includes("pelunasan") || s.includes("lunas")) return "PELUNASAN";
  if (s.includes("dp") || s.includes("down payment") || s.includes("uang muka")) return "DP";
  return "TERMIN";
}

function normalizeClientType(raw: unknown): "PARTNER" | "END_USER" | "SI" | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const v = raw.toUpperCase().trim().replace(/[\s-]+/g, "_");
  if (v === "ENDUSER" || v === "END_USER") return "END_USER";
  if (v === "PARTNER") return "PARTNER";
  if (v === "SI") return "SI";
  return undefined;
}

function normalizePaymentType(raw: unknown, fallbackText?: string): "KAS" | "UTANG" | undefined {
  const s = `${typeof raw === "string" ? raw : ""} ${fallbackText ?? ""}`.toLowerCase();
  if (s.includes("kas") || s.includes("tunai") || s.includes("cash")) return "KAS";
  if (s.includes("utang") || s.includes("tempo") || s.includes("kredit")) return "UTANG";
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
    const rawCat = asStr(data.categoryName) ?? asStr(data.category) ?? "";
    const desc = asStr(data.description) ?? "";
    const searchText = `${rawCat} ${desc}`.toLowerCase().trim();
    if (!searchText) return null;

    const allCats = await this.prisma.main.expenseCategory.findMany({
      select: { id: true, name: true },
    });
    if (allCats.length === 0) return null;

    // 1. Cocok langsung berdasarkan categoryName atau kata di deskripsi
    if (rawCat) {
      const catLower = rawCat.toLowerCase();
      const exact = allCats.find(
        (c) => c.name.toLowerCase().includes(catLower) || catLower.includes(c.name.toLowerCase()),
      );
      if (exact) return exact;
    }
    const byDesc = allCats.find((c) => {
      const tokens = c.name.toLowerCase().split(/[\s/&,-]+/).filter((t) => t.length >= 3);
      return tokens.some((t) => searchText.includes(t));
    });
    if (byDesc) return byDesc;

    // 2. Pencocokan sinonim umum Bahasa Indonesia (makan -> konsumsi, bensin/tol -> transport, dll.)
    const synonymGroups: Array<{ triggers: string[]; catHints: string[] }> = [
      {
        triggers: ["makan", "minum", "konsumsi", "snack", "kopi", "sarapan", "siang", "malam", "jamuan", "catering"],
        catHints: ["konsumsi", "makan", "meal", "food", "entertain"],
      },
      {
        triggers: ["transport", "bensin", "bbm", "parkir", "tol", "grab", "gojek", "ojek", "taksi", "tiket", "kereta", "pesawat", "dinas"],
        catHints: ["transport", "perjalanan", "travel", "bbm", "kendaraan", "dinas"],
      },
      {
        triggers: ["hotel", "penginapan", "akomodasi", "inap"],
        catHints: ["akomodasi", "hotel", "penginapan", "perjalanan"],
      },
      {
        triggers: ["atk", "kertas", "pulpen", "tinta", "printer", "fotokopi", "materai"],
        catHints: ["atk", "kantor", "office", "perlengkapan"],
      },
      {
        triggers: ["listrik", "air", "internet", "wifi", "pulsa", "kuota", "telepon"],
        catHints: ["utilitas", "komunikasi", "listrik", "internet", "telekomunikasi"],
      },
      {
        triggers: ["material", "kabel", "alat", "peralatan", "sparepart", "proyek"],
        catHints: ["material", "proyek", "project", "operasional"],
      },
    ];

    for (const grp of synonymGroups) {
      if (grp.triggers.some((t) => searchText.includes(t))) {
        const hit = allCats.find((c) => {
          const n = c.name.toLowerCase();
          return grp.catHints.some((h) => n.includes(h));
        });
        if (hit) return hit;
      }
    }

    return null;
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
        const clientType = normalizeClientType(data.clientType);
        if (clientType) {
          data.clientType = clientType;
          summary["Tipe Klien"] = clientType;
        }
        if (asStr(data.contactName)) summary["Kontak / PIC"] = asStr(data.contactName)!;
        if (asStr(data.need)) summary["Kebutuhan"] = asStr(data.need)!;
        if (asNum(data.estimatedValue)) summary["Nilai Estimasi"] = fmtRp(asNum(data.estimatedValue)!);
        if (asNum(data.probability) != null) summary["Probabilitas"] = `${asNum(data.probability)}%`;
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
        if (asNum(data.discount)) summary["Diskon"] = fmtRp(asNum(data.discount)!);
        if (asNum(data.ppn) != null) summary["PPN"] = fmtRp(asNum(data.ppn)!);
        if (asNum(data.grandTotal)) summary["Grand Total"] = fmtRp(asNum(data.grandTotal)!);
        if (asStr(data.validUntil)) summary["Berlaku Hingga"] = asStr(data.validUntil)!;
        if (asStr(data.notes) ?? asStr(data.note)) {
          summary["Catatan"] = (asStr(data.notes) ?? asStr(data.note))!;
        }
        break;
      }
      case "invoice": {
        const isProforma =
          data.isProforma === true ||
          String(data.description ?? data.note ?? "").toLowerCase().includes("proforma");
        data.isProforma = isProforma;
        const invType = normalizeInvoiceType(data.type, asStr(data.description) ?? asStr(data.note));
        data.type = invType;
        title = isProforma ? "Buat Proforma Invoice" : `Buat Faktur Keluar (${invType})`;
        summary["Jenis Faktur"] = isProforma ? `Proforma (${invType})` : invType;
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
        if (asNum(data.discount)) summary["Diskon"] = fmtRp(asNum(data.discount)!);
        if (asNum(data.ppn) != null) summary["PPN"] = fmtRp(asNum(data.ppn)!);
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
        const prio = normalizeTaskPriority(data.priority);
        if (prio) {
          data.priority = prio;
          summary["Prioritas"] = prio;
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
        if (asStr(data.company)) summary["Perusahaan"] = asStr(data.company)!;
        if (asStr(data.pic)) summary["PIC"] = asStr(data.pic)!;
        if (asStr(data.phone)) summary["Telepon"] = asStr(data.phone)!;
        if (asStr(data.email)) summary["Email"] = asStr(data.email)!;
        if (asStr(data.city)) summary["Kota"] = asStr(data.city)!;
        if (asStr(data.address)) summary["Alamat"] = asStr(data.address)!;
        if (asStr(data.notes) ?? asStr(data.note)) {
          summary["Catatan"] = (asStr(data.notes) ?? asStr(data.note))!;
        }
        break;
      }
      case "expense": {
        const desc = asStr(data.description) ?? "Pengeluaran Operasional";
        title = `Catat Pengeluaran: ${desc.slice(0, 50)}`;
        summary["Deskripsi"] = desc;
        if (asNum(data.amount)) summary["Nominal"] = fmtRp(asNum(data.amount)!);
        const funding = normalizeFundingSource(data.fundingSource, desc);
        data.fundingSource = funding;
        summary["Sumber Pendanaan"] = fundingSourceLabel(funding);
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
        const rawCost = (asStr(data.costType) ?? "STOK").toUpperCase();
        const costType = rawCost === "PROYEK" ? "PROJECT" : rawCost === "STOCK" ? "STOK" : rawCost;
        data.costType = costType;
        const rawSrc = (asStr(data.procurementSource) ?? "SUPPLIER").toUpperCase();
        data.procurementSource = rawSrc === "RITEL" ? "RETAIL" : rawSrc;
        summary["Tipe Biaya"] = costType;
        summary["Sumber Pengadaan"] = String(data.procurementSource);
        const payType = normalizePaymentType(data.paymentType, asStr(data.note));
        if (payType) {
          data.paymentType = payType;
          summary["Pembayaran"] = payType;
        }
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
            clientType: normalizeClientType(data.clientType),
            need: asStr(data.need),
            estimatedValue: asNum(data.estimatedValue),
            probability: asNum(data.probability),
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
          discount: asNum(data.discount),
          ppn: asNum(data.ppn),
          grandTotal: asNum(data.grandTotal),
          validUntil: asStr(data.validUntil),
          notes: asStr(data.notes) ?? asStr(data.note),
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
            quotationId: asNum(data.quotationId),
            type: normalizeInvoiceType(data.type, asStr(data.description) ?? asStr(data.note)),
            isProforma: data.isProforma === true,
            date: asStr(data.date) ?? new Date().toISOString().slice(0, 10),
            dueDate: asStr(data.dueDate),
            amount: amt,
            discount: asNum(data.discount),
            ppn: asNum(data.ppn),
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
            priority: normalizeTaskPriority(data.priority) ?? "SEDANG",
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
          company: asStr(data.company),
          pic: asStr(data.pic) ?? "-",
          phone: asStr(data.phone),
          email: asStr(data.email),
          city: asStr(data.city),
          address: asStr(data.address),
          notes: asStr(data.notes) ?? asStr(data.note),
        } as never);
        return { id: res.id, href: `/customers/${res.id}` };
      }

      case "expense": {
        const desc = asStr(data.description) ?? "Pengeluaran operasional";
        const funding = normalizeFundingSource(data.fundingSource, desc);
        const res = await this.expenses.create(
          {
            description: desc,
            amount: asNum(data.amount) ?? 0,
            date: asStr(data.date) ?? new Date().toISOString().slice(0, 10),
            fundingSource: funding,
            paymentMethod: asStr(data.paymentMethod),
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
            date: asStr(data.date),
            costType: asStr(data.costType) ?? "STOK",
            procurementSource: asStr(data.procurementSource) ?? "SUPPLIER",
            paymentType: normalizePaymentType(data.paymentType, asStr(data.note)),
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
