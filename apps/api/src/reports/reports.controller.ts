import { Controller, ForbiddenException, Get, Param, Query, StreamableFile } from "@nestjs/common";
import { ReportsService, REPORT_TYPES } from "./reports.service.js";
import { exportMeta, toDocx, toPdf, toXlsx, type ReportCompany } from "./exporters.js";
import { SettingsService } from "../settings/settings.service.js";
import { Require } from "../common/decorators/require-permission.decorator.js";
import { CurrentUser, type RequestUser } from "../common/decorators/current-user.decorator.js";
import { can, hasMenu, type Action } from "../rbac/permissions.js";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

class ReportQueryDto {
  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  stage?: string;

  @IsOptional() @IsString()
  warehouseId?: string;

  @IsOptional() @IsIn(["overdue", "today", "all"])
  due?: "overdue" | "today" | "all";
}

class ExportQueryDto extends ReportQueryDto {
  @IsOptional() @IsIn(["xlsx", "pdf", "docx"])
  format?: "xlsx" | "pdf" | "docx";
}

/**
 * Hak yang dibutuhkan tiap laporan (mengikuti Pengaturan Peran, bukan nama peran) — hanya untuk peran yang
 * memegang bidangnya. "M" = punya menu modul itu (bukan sekadar data untuk pilihan form).
 * Laporan keuangan = modul Buku Besar; pengeluaran seluruh karyawan = hak Setujui pengeluaran (Finance / pimpinan).
 */
const REPORT_PERMISSION: Record<string, [string, Action]> = {
  leads: ["leads", "M"],
  followups: ["leads", "M"],
  projects: ["projects", "M"], // progres + status pembayaran project (kolom Nilai hanya bila punya hak P)
  "delivery-notes": ["delivery-notes", "C"], // yang membuat & mengelola surat jalan
  stock: ["stock", "M"],
  approvals: ["approvals", "V"],
  expenses: ["expenses", "V"],
  invoices: ["accounting", "L"],
  "profit-loss": ["accounting", "L"],
  "income-statement": ["accounting", "L"],
  "balance-sheet": ["accounting", "L"],
  "cash-flow": ["accounting", "L"],
  "general-journal": ["accounting", "L"],
  "ppn-masukan": ["accounting", "L"], // rekap faktur pajak masukan untuk dicocokkan dengan Coretax
};

function canAccessReport(type: string, user?: RequestUser): boolean {
  const [mod, act] = REPORT_PERMISSION[type] ?? ["accounting", "L"];
  if (!user) return false;
  return act === "M" ? hasMenu(user.role, mod) : can(user.role, mod, act);
}

/** Sembunyikan angka uang di laporan Proyek bagi peran tanpa hak lihat harga project (mis. PM). */
function redactReport<T extends { columns: string[]; rows: unknown[][] }>(type: string, data: T, user?: RequestUser): T {
  if (type !== "projects" || (user && can(user.role, "projects", "P"))) return data;
  const idx = data.columns.indexOf("Nilai");
  if (idx < 0) return data;
  return { ...data, columns: data.columns.filter((_, i) => i !== idx), rows: data.rows.map((r) => r.filter((_, i) => i !== idx)) };
}

function assertReport(type: string, user?: RequestUser) {
  if (!canAccessReport(type, user)) {
    throw new ForbiddenException(
      REPORT_PERMISSION[type]?.[0] === "accounting"
        ? "Laporan keuangan hanya untuk Finance & pimpinan"
        : "Laporan ini bukan bagian dari tugas peran Anda",
    );
  }
}

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  @Require("reports", "L")
  types(@CurrentUser() user?: RequestUser) {
    return { reports: REPORT_TYPES.filter((t) => canAccessReport(t, user)) };
  }

  @Get("archive")
  @Require("reports", "L")
  archive(@Query("q") q?: string, @Query("year") year?: string, @Query("category") category?: string) {
    return this.service.archiveList({ q, year, category });
  }

  @Get(":type/export")
  @Require("reports", "L")
  async export(
    @Param("type") type: string,
    @Query() q: ExportQueryDto,
    @CurrentUser() user?: RequestUser,
  ): Promise<StreamableFile> {
    assertReport(type, user);
    const data = redactReport(type, await this.service.build(type, q), user);
    const format = q.format ?? "xlsx";
    const meta = exportMeta(format, data.title);
    // Kop laporan dari profil perusahaan (Pengaturan); laporan tetap bisa diunduh walau profil gagal dimuat
    const profile = await this.settings.getCompanyProfile().catch(() => null);
    const company: ReportCompany | undefined = profile ? { name: profile.name, address: profile.address, npwp: profile.npwp } : undefined;
    const buffer =
      format === "xlsx" ? await toXlsx(data, company) : format === "pdf" ? await toPdf(data, company) : await toDocx(data, company);
    return new StreamableFile(buffer, {
      type: meta.mime,
      disposition: `attachment; filename="${meta.filename}"`,
    });
  }

  @Get(":type")
  @Require("reports", "L")
  async data(
    @Param("type") type: string,
    @Query() q: ReportQueryDto,
    @CurrentUser() user?: RequestUser,
  ) {
    assertReport(type, user);
    return redactReport(type, await this.service.build(type, q), user);
  }
}
