import { Injectable } from "@nestjs/common";
import { ReportsService, type ReportQuery } from "../reports/reports.service.js";
import { DashboardService } from "../dashboard/dashboard.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { can, hasMenu } from "../rbac/permissions.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { LlmToolDefinition } from "./llm-provider.service.js";

const MAX_TOOL_ROWS = 50;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface ToolExecutionResult {
  label: string;
  allowed: boolean;
  data: unknown;
}

function getWibNow(): Date {
  return new Date(Date.now() + WIB_OFFSET_MS);
}

export function getWibDateString(date = new Date()): string {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wib.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolvePeriodDates(period?: string): { from?: string; to?: string } {
  if (!period) return {};
  const wib = getWibNow();
  const y = wib.getUTCFullYear();
  const m = wib.getUTCMonth();
  const d = wib.getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (year: number, monthIdx: number, day: number) =>
    `${year}-${pad(monthIdx + 1)}-${pad(day)}`;

  switch (period) {
    case "today": {
      const s = fmt(y, m, d);
      return { from: s, to: s };
    }
    case "this_week": {
      const dow = wib.getUTCDay(); // 0 = Minggu
      const diffToMonday = dow === 0 ? 6 : dow - 1;
      const start = new Date(Date.UTC(y, m, d - diffToMonday));
      return {
        from: fmt(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
        to: fmt(y, m, d),
      };
    }
    case "this_month": {
      return { from: fmt(y, m, 1), to: fmt(y, m, d) };
    }
    case "last_month": {
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 0));
      return {
        from: fmt(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
        to: fmt(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
      };
    }
    case "this_year": {
      return { from: fmt(y, 0, 1), to: fmt(y, m, d) };
    }
    default:
      return {};
  }
}

const LEAD_STAGE_MAP: Record<string, string> = {
  PROSPECTING: "PROSPECTING",
  QUALIFICATION: "QUALIFICATION",
  QUALIFIED: "QUALIFICATION",
  PROPOSAL: "PROPOSAL",
  NEGOTIATION: "NEGOTIATION",
  NEGOSIASI: "NEGOTIATION",
  WON: "WON",
  MENANG: "WON",
  LOST: "LOST",
  KALAH: "LOST",
};

const PROJECT_STATUS_MAP: Record<string, string> = {
  DIRENCANAKAN: "DIRENCANAKAN",
  PLANNED: "DIRENCANAKAN",
  BERJALAN: "BERJALAN",
  RUNNING: "BERJALAN",
  ACTIVE: "BERJALAN",
  ONGOING: "BERJALAN",
  DITUNDA: "DITUNDA",
  PAUSED: "DITUNDA",
  ON_HOLD: "DITUNDA",
  TERLAMBAT: "TERLAMBAT",
  DELAYED: "TERLAMBAT",
  LATE: "TERLAMBAT",
  OVERDUE: "TERLAMBAT",
  SELESAI: "SELESAI",
  COMPLETED: "SELESAI",
  DONE: "SELESAI",
};

const APPROVAL_STATUS_MAP: Record<string, string> = {
  MENUNGGU: "MENUNGGU",
  PENDING: "MENUNGGU",
  WAITING: "MENUNGGU",
  DISETUJUI: "DISETUJUI",
  APPROVED: "DISETUJUI",
  DITOLAK: "DITOLAK",
  REJECTED: "DITOLAK",
};

const DELIVERY_STATUS_MAP: Record<string, string> = {
  PENDING: "PENDING",
  MENUNGGU: "PENDING",
  DIKIRIM: "DIKIRIM",
  SHIPPED: "DIKIRIM",
  SENT: "DIKIRIM",
  DITERIMA: "DITERIMA",
  DELIVERED: "DITERIMA",
  RECEIVED: "DITERIMA",
  DIBATALKAN: "DIBATALKAN",
  CANCELLED: "DIBATALKAN",
};

const EXPENSE_STATUS_MAP: Record<string, string> = {
  DILAPORKAN: "DILAPORKAN",
  PENDING: "DILAPORKAN",
  MENUNGGU: "DILAPORKAN",
  DISETUJUI: "DISETUJUI",
  APPROVED: "DISETUJUI",
  DITOLAK: "DITOLAK",
  REJECTED: "DITOLAK",
  DIBAYAR: "DIBAYAR",
  PAID: "DIBAYAR",
};

function normalizeEnum(raw: string | undefined, map: Record<string, string>): string | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return map[key];
}

function formatTableForLlm(
  report: { title: string; columns: string[]; note?: string; rows: unknown[][] },
  limit = MAX_TOOL_ROWS,
  preserveLastRow = false,
) {
  const totalRows = report.rows.length;
  let pickedRows = report.rows;
  if (totalRows > limit) {
    if (preserveLastRow && limit > 1) {
      pickedRows = [...report.rows.slice(0, limit - 1), report.rows[totalRows - 1]!];
    } else {
      pickedRows = report.rows.slice(0, limit);
    }
  }
  const sliced = pickedRows.map((row) => {
    const obj: Record<string, unknown> = {};
    report.columns.forEach((col, i) => {
      obj[col] = row[i] ?? null;
    });
    return obj;
  });
  return {
    title: report.title,
    note: report.note ?? null,
    totalRows,
    shownRows: sliced.length,
    truncated: totalRows > limit,
    items: sliced,
  };
}

@Injectable()
export class AgentToolsService {
  constructor(
    private readonly reports: ReportsService,
    private readonly dashboard: DashboardService,
    private readonly prisma: PrismaService,
  ) {}

  getAllowedTools(user: RequestUser): LlmToolDefinition[] {
    const tools: LlmToolDefinition[] = [];
    const role = user.role;

    tools.push({
      type: "function",
      function: {
        name: "get_dashboard_summary",
        description:
          "Mengambil ringkasan KPI dashboard sesuai peran pengguna saat ini (prospek, proyek, persetujuan, stok, atau tugas aktif).",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    });

    if (hasMenu(role, "leads")) {
      tools.push(
        {
          type: "function",
          function: {
            name: "get_leads_overview",
            description:
              "Membaca daftar dan ringkasan Leads / Prospek CRM berdasarkan stage, kata kunci, atau periode tanggal.",
            parameters: {
              type: "object",
              properties: {
                stage: {
                  type: "string",
                  enum: ["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST"],
                  description:
                    "Filter stage opsional: PROSPECTING, QUALIFICATION, PROPOSAL, NEGOTIATION, WON, LOST",
                },
                q: { type: "string", description: "Kata kunci nama lead/prospek (opsional)" },
                period: {
                  type: "string",
                  enum: ["today", "this_week", "this_month", "last_month", "this_year"],
                  description: "Shortcut periode WIB (opsional)",
                },
                from: { type: "string", description: "Tanggal awal YYYY-MM-DD (opsional)" },
                to: { type: "string", description: "Tanggal akhir YYYY-MM-DD (opsional)" },
              },
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_followups_overview",
            description:
              "Membaca daftar aktivitas follow-up leads, termasuk yang jatuh tempo hari ini atau terlambat (overdue).",
            parameters: {
              type: "object",
              properties: {
                due: {
                  type: "string",
                  enum: ["overdue", "today", "all"],
                  description: "Filter jatuh tempo follow-up",
                },
                q: { type: "string", description: "Kata kunci pencarian (opsional)" },
              },
              additionalProperties: false,
            },
          },
        },
      );
    }

    if (can(role, "accounting", "L") || can(role, "expenses", "V")) {
      const allowedTypes: string[] = [];
      if (can(role, "accounting", "L")) {
        allowedTypes.push(
          "income-statement",
          "balance-sheet",
          "cash-flow",
          "project-profit-loss",
          "invoices",
          "general-journal",
        );
      }
      if (can(role, "expenses", "V")) {
        allowedTypes.push("expenses");
      }
      tools.push({
        type: "function",
        function: {
          name: "get_financial_report",
          description:
            "Membaca laporan keuangan akurat dari Buku Besar & Akuntansi: income-statement (Laba Rugi / P&L perusahaan lengkap: Pendapatan DPP, HPP, Laba Kotor, OPEX, Laba Bersih), balance-sheet (Neraca lengkap: Aktiva, Kewajiban, Ekuitas, PPN), cash-flow (Arus Kas masuk/keluar/bersih), project-profit-loss (P&L khusus per proyek), invoices (Faktur & Piutang), general-journal (Jurnal Umum), atau expenses (Pengeluaran).",
          parameters: {
            type: "object",
            properties: {
              reportType: {
                type: "string",
                enum: allowedTypes,
                description:
                  "Gunakan income-statement untuk Laba Rugi/P&L perusahaan, balance-sheet untuk Neraca, cash-flow untuk Arus Kas, project-profit-loss untuk P&L per proyek.",
              },
              period: {
                type: "string",
                enum: ["today", "this_week", "this_month", "last_month", "this_year"],
                description: "Shortcut periode WIB (opsional)",
              },
              from: { type: "string", description: "Tanggal awal YYYY-MM-DD (opsional)" },
              to: { type: "string", description: "Tanggal akhir YYYY-MM-DD (opsional)" },
              status: { type: "string", description: "Filter status opsional" },
            },
            required: ["reportType"],
            additionalProperties: false,
          },
        },
      });
    }

    if (hasMenu(role, "projects")) {
      tools.push({
        type: "function",
        function: {
          name: "get_projects_overview",
          description:
            "Membaca daftar proyek beserta progres, status (BERJALAN, SELESAI, TERLAMBAT, DITUNDA), PIC, dan status pembayaran.",
          parameters: {
            type: "object",
            properties: {
              status: {
                type: "string",
                description: "Filter status proyek opsional: BERJALAN, SELESAI, TERLAMBAT, DITUNDA",
              },
              q: { type: "string", description: "Kata kunci nama proyek (opsional)" },
              period: {
                type: "string",
                enum: ["today", "this_week", "this_month", "last_month", "this_year"],
              },
            },
            additionalProperties: false,
          },
        },
      });
    }

    if (hasMenu(role, "stock")) {
      tools.push({
        type: "function",
        function: {
          name: "get_stock_overview",
          description:
            "Membaca ketersediaan stok barang per SKU & gudang, termasuk filter khusus barang yang stoknya di bawah minimum (lowStockOnly=true).",
          parameters: {
            type: "object",
            properties: {
              q: { type: "string", description: "Kata kunci nama barang atau SKU (opsional)" },
              lowStockOnly: {
                type: "boolean",
                description: "Jika true, hanya tampilkan barang yang stoknya <= stok minimum",
              },
            },
            additionalProperties: false,
          },
        },
      });
    }

    if (can(role, "approvals", "V")) {
      tools.push({
        type: "function",
        function: {
          name: "get_pending_approvals",
          description: "Membaca daftar dokumen yang menunggu persetujuan (approval).",
          parameters: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["MENUNGGU", "DISETUJUI", "DITOLAK"],
                description: "Filter status persetujuan (default: MENUNGGU)",
              },
            },
            additionalProperties: false,
          },
        },
      });
    }

    if (can(role, "delivery-notes", "C")) {
      tools.push({
        type: "function",
        function: {
          name: "get_delivery_notes_overview",
          description: "Membaca daftar surat jalan / pengiriman barang.",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", description: "Filter status surat jalan (opsional)" },
              period: {
                type: "string",
                enum: ["today", "this_week", "this_month", "last_month", "this_year"],
              },
            },
            additionalProperties: false,
          },
        },
      });
    }

    if (hasMenu(role, "contracts")) {
      tools.push({
        type: "function",
        function: {
          name: "get_contracts_overview",
          description:
            "Membaca daftar kontrak aktif, mendekati masa berakhir (expiringSoon=true), atau berdasarkan status.",
          parameters: {
            type: "object",
            properties: {
              expiringSoon: {
                type: "boolean",
                description: "Jika true, tampilkan kontrak yang berakhir dalam 60 hari ke depan",
              },
              q: { type: "string", description: "Kata kunci judul/nomor kontrak (opsional)" },
            },
            additionalProperties: false,
          },
        },
      });
    }

    return tools;
  }

  getSuggestedPrompts(user: RequestUser): string[] {
    const prompts: string[] = [];
    const role = user.role;

    if (hasMenu(role, "leads")) {
      prompts.push("Berapa jumlah leads yang masih dalam status Qualified?");
    }
    if (can(role, "accounting", "L")) {
      prompts.push("Bagaimana kondisi keuangan (Laba Rugi, Neraca & Arus Kas) bulan ini?");
    }
    if (hasMenu(role, "projects")) {
      prompts.push("Tampilkan proyek yang sedang berjalan beserta progresnya.");
    }
    if (hasMenu(role, "stock")) {
      prompts.push("Barang apa saja yang stoknya sudah di bawah minimum?");
    }
    if (can(role, "approvals", "V")) {
      prompts.push("Ada berapa dokumen yang sedang menunggu persetujuan?");
    }
    if (prompts.length < 4) {
      prompts.push("Bagaimana ringkasan aktivitas dan status kerja saya hari ini?");
    }
    return prompts.slice(0, 5);
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    user: RequestUser,
  ): Promise<ToolExecutionResult> {
    const role = user.role;
    const str = (key: string): string | undefined => {
      const v = args[key];
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    };
    const bool = (key: string): boolean => args[key] === true || args[key] === "true";

    const periodDates = resolvePeriodDates(str("period"));
    const baseQuery: ReportQuery = {
      q: str("q"),
      status: str("status"),
      stage: str("stage"),
      from: str("from") ?? periodDates.from,
      to: str("to") ?? periodDates.to,
    };

    switch (name) {
      case "get_dashboard_summary": {
        const data = await this.dashboard.summary(user);
        return { label: "Ringkasan Dashboard", allowed: true, data };
      }

      case "get_leads_overview": {
        if (!hasMenu(role, "leads")) {
          return {
            label: "Laporan Prospek",
            allowed: false,
            data: { error: "Akses ditolak: peran Anda tidak memiliki akses ke modul Prospek/Leads." },
          };
        }
        const report = await this.reports.build("leads", {
          ...baseQuery,
          stage: normalizeEnum(baseQuery.stage, LEAD_STAGE_MAP),
        });
        return { label: "Laporan Prospek (Leads)", allowed: true, data: formatTableForLlm(report) };
      }

      case "get_followups_overview": {
        if (!hasMenu(role, "leads")) {
          return {
            label: "Aktivitas Follow-Up",
            allowed: false,
            data: { error: "Akses ditolak: peran Anda tidak memiliki akses ke modul Follow-Up." },
          };
        }
        const report = await this.reports.build("followups", {
          ...baseQuery,
          due: str("due") ?? "all",
        });
        return { label: "Aktivitas Follow-Up", allowed: true, data: formatTableForLlm(report) };
      }

      case "get_financial_report": {
        const rawType = str("reportType") ?? "income-statement";
        const isExpense = rawType === "expenses";
        const allowed = isExpense ? can(role, "expenses", "V") : can(role, "accounting", "L");
        if (!allowed) {
          return {
            label: "Laporan Keuangan",
            allowed: false,
            data: {
              error: "Akses ditolak: laporan keuangan hanya dapat diakses oleh Finance & pimpinan.",
            },
          };
        }

        // Petakan profit-loss / income-statement ke Laporan Laba Rugi Standar Akuntansi (Buku Besar)
        // agar angka P&L perusahaan selalu akurat, sementara project-profit-loss khusus P&L per proyek.
        const reportTypeMap: Record<string, string> = {
          "income-statement": "income-statement",
          "profit-loss": "income-statement",
          "project-profit-loss": "profit-loss",
          "balance-sheet": "balance-sheet",
          "cash-flow": "cash-flow",
          invoices: "invoices",
          "general-journal": "general-journal",
          expenses: "expenses",
        };
        const targetType = reportTypeMap[rawType];
        if (!targetType) {
          return {
            label: "Laporan Keuangan",
            allowed: false,
            data: { error: `Jenis laporan "${rawType}" tidak didukung.` },
          };
        }
        const report = await this.reports.build(targetType, {
          ...baseQuery,
          status:
            targetType === "expenses"
              ? normalizeEnum(baseQuery.status, EXPENSE_STATUS_MAP)
              : undefined,
        });
        const labelMap: Record<string, string> = {
          "income-statement": "Laporan Laba Rugi (Akuntansi)",
          "profit-loss": "Laporan Laba Rugi per Proyek",
          "balance-sheet": "Laporan Neraca (Balance Sheet)",
          "cash-flow": "Laporan Arus Kas (Cash Flow)",
          invoices: "Laporan Faktur & Piutang",
          "general-journal": "Jurnal Umum",
          expenses: "Laporan Pengeluaran",
        };
        const isFullStatement = targetType === "income-statement" || targetType === "balance-sheet";
        const isCashFlow = targetType === "cash-flow";
        return {
          label: labelMap[targetType] ?? "Laporan Keuangan",
          allowed: true,
          data: formatTableForLlm(report, isFullStatement ? 250 : MAX_TOOL_ROWS, isCashFlow),
        };
      }

      case "get_projects_overview": {
        if (!hasMenu(role, "projects")) {
          return {
            label: "Laporan Proyek",
            allowed: false,
            data: { error: "Akses ditolak: peran Anda tidak memiliki akses ke modul Proyek." },
          };
        }
        let report = await this.reports.build("projects", {
          ...baseQuery,
          status: normalizeEnum(baseQuery.status, PROJECT_STATUS_MAP),
        });
        // Redaksi kolom Nilai untuk peran tanpa hak lihat harga proyek (sama dengan ReportsController)
        if (!can(role, "projects", "P")) {
          const idx = report.columns.indexOf("Nilai");
          if (idx >= 0) {
            report = {
              ...report,
              columns: report.columns.filter((_, i) => i !== idx),
              rows: report.rows.map((r) => r.filter((_, i) => i !== idx)),
            };
          }
        }
        return { label: "Laporan Proyek", allowed: true, data: formatTableForLlm(report) };
      }

      case "get_stock_overview": {
        if (!hasMenu(role, "stock")) {
          return {
            label: "Laporan Stok",
            allowed: false,
            data: { error: "Akses ditolak: peran Anda tidak memiliki akses ke modul Stok." },
          };
        }
        const report = await this.reports.build("stock", baseQuery);
        const lowOnly = bool("lowStockOnly");
        let filteredReport = report;
        if (lowOnly) {
          const lowIdx = report.columns.indexOf("Stok Menipis");
          if (lowIdx >= 0) {
            filteredReport = {
              ...report,
              title: "Barang dengan Stok di Bawah Minimum",
              rows: report.rows.filter((r) => {
                const val = String(r[lowIdx] ?? "").toLowerCase();
                return val === "ya" || val === "true" || val === "menipis";
              }),
            };
          }
        }
        return {
          label: lowOnly ? "Stok Di Bawah Minimum" : "Laporan Stok",
          allowed: true,
          data: formatTableForLlm(filteredReport),
        };
      }

      case "get_pending_approvals": {
        if (!can(role, "approvals", "V")) {
          return {
            label: "Antrean Persetujuan",
            allowed: false,
            data: { error: "Akses ditolak: peran Anda tidak memiliki akses persetujuan." },
          };
        }
        const report = await this.reports.build("approvals", {
          ...baseQuery,
          status: normalizeEnum(baseQuery.status, APPROVAL_STATUS_MAP),
        });
        return { label: "Antrean Persetujuan", allowed: true, data: formatTableForLlm(report) };
      }

      case "get_delivery_notes_overview": {
        if (!can(role, "delivery-notes", "C")) {
          return {
            label: "Laporan Surat Jalan",
            allowed: false,
            data: { error: "Akses ditolak: peran Anda tidak memiliki akses ke Surat Jalan." },
          };
        }
        const report = await this.reports.build("delivery-notes", {
          ...baseQuery,
          status: normalizeEnum(baseQuery.status, DELIVERY_STATUS_MAP),
        });
        return { label: "Laporan Surat Jalan", allowed: true, data: formatTableForLlm(report) };
      }

      case "get_contracts_overview": {
        if (!hasMenu(role, "contracts")) {
          return {
            label: "Manajemen Kontrak",
            allowed: false,
            data: { error: "Akses ditolak: peran Anda tidak memiliki akses ke modul Kontrak." },
          };
        }
        const now = new Date();
        const in60Days = new Date(now.getTime() + 60 * 86400000);
        const expiringSoon = bool("expiringSoon");
        const qText = str("q");
        const rows = await this.prisma.main.ctrContract.findMany({
          where: {
            ...(expiringSoon ? { expirationDate: { gte: now, lte: in60Days } } : {}),
            ...(qText
              ? {
                  OR: [
                    { title: { contains: qText } },
                    { contractNumber: { contains: qText } },
                    { counterpartyName: { contains: qText } },
                  ],
                }
              : {}),
          },
          select: {
            contractNumber: true,
            title: true,
            counterpartyName: true,
            status: true,
            effectiveDate: true,
            expirationDate: true,
            ...(can(role, "contracts", "P") ? { contractValue: true } : {}),
          },
          orderBy: { expirationDate: "asc" },
          take: MAX_TOOL_ROWS,
        });
        return {
          label: "Manajemen Kontrak",
          allowed: true,
          data: {
            totalRows: rows.length,
            items: rows.map((r) => ({
              nomor: r.contractNumber,
              judul: r.title,
              pihak: r.counterpartyName,
              status: r.status,
              mulai: r.effectiveDate ? getWibDateString(new Date(r.effectiveDate)) : null,
              berakhir: r.expirationDate ? getWibDateString(new Date(r.expirationDate)) : null,
              ...("contractValue" in r && r.contractValue != null
                ? { nilai: Number(r.contractValue) }
                : {}),
            })),
          },
        };
      }

      default:
        return {
          label: name,
          allowed: false,
          data: { error: `Tool "${name}" tidak dikenal.` },
        };
    }
  }
}
