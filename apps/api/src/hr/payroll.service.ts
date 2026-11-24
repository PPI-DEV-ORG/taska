import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { PostingService } from "../accounting/posting.service.js";
import { MappingService } from "../accounting/mapping.service.js";
import { PostingRules } from "../accounting/posting.rules.js";
import { AdjustSlipDto, GeneratePayrollDto, PayPeriodDto, PayrollSettingsDto, PaySlipDto, UpdateEmployeeDto, UpdateSalaryConfigDto } from "./dto.js";
import { calculateSlip, DEFAULT_PAYROLL_SETTINGS, type PayrollSettings, type SalaryInput } from "./payroll.calc.js";

const SETTINGS_KEY = "payroll.settings";
const n = (v: unknown) => Number(v || 0);
const dateOrNull = (s?: string | null) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00.000Z`) : null);
const blankToNull = (s?: string | null) => (s === undefined ? undefined : s && String(s).trim() ? String(s).trim() : null);

const USER_SELECT = { id: true, name: true, email: true, role: true, phone: true, position: true, department: true } as const;

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingService: PostingService,
    private readonly mappingService: MappingService,
  ) {}

  private get db(): any {
    return this.prisma.main as any;
  }

  // ─────────────── Pengaturan BPJS & pajak ───────────────

  async getSettings(): Promise<PayrollSettings> {
    const row = await this.db.systemSetting.findUnique({ where: { key: SETTINGS_KEY } });
    let saved: Partial<PayrollSettings> = {};
    try {
      saved = row?.value ? JSON.parse(row.value) : {};
    } catch {
      saved = {};
    }
    return { ...DEFAULT_PAYROLL_SETTINGS, ...saved };
  }

  async updateSettings(dto: PayrollSettingsDto, userId?: number) {
    const next = { ...(await this.getSettings()), ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) };
    await this.db.systemSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: JSON.stringify(next), updatedById: userId ?? null },
      create: { key: SETTINGS_KEY, value: JSON.stringify(next), description: "Aturan payroll: hari kerja, BPJS, PPh 21", updatedById: userId ?? null },
    });
    return next;
  }

  // ─────────────── Master data karyawan ───────────────

  private shapeConfig(cfg: any) {
    return {
      basicSalary: cfg ? n(cfg.basicSalary) : 0,
      allowance: cfg ? n(cfg.allowance) : 0,
      mealAllowance: cfg ? n(cfg.mealAllowance) : 0,
      ptkp: cfg?.ptkp || "TK/0",
      hasNpwp: cfg?.hasNpwp ?? true,
      pph21Rate: cfg?.pph21Rate ? n(cfg.pph21Rate) : null,
      bpjsKes: cfg?.bpjsKes ?? true,
      bpjsTk: cfg?.bpjsTk ?? true,
      bpjsJp: cfg?.bpjsJp ?? true,
      configured: !!cfg,
    };
  }

  async listEmployees(includeInactive = false) {
    const users = await this.db.user.findMany({
      where: includeInactive ? {} : { status: "AKTIF" },
      select: { ...USER_SELECT, status: true, employeeProfile: true, salaryConfig: true },
      orderBy: { name: "asc" },
    });
    return users.map((u: any) => {
      const p = u.employeeProfile;
      const missing = [
        !p?.nik && "NIK",
        !p?.npwp && (u.salaryConfig?.hasNpwp ?? true) && "NPWP",
        !p?.bankAccountNo && "Rekening",
        !u.salaryConfig && "Gaji",
      ].filter(Boolean) as string[];
      return {
        userId: u.id,
        user: { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, position: u.position, department: u.department, status: u.status },
        profile: p ?? null,
        salary: this.shapeConfig(u.salaryConfig),
        missing,
      };
    });
  }

  async updateEmployee(userId: number, dto: UpdateEmployeeDto) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("Karyawan tidak ditemukan");
    const employeeNo = blankToNull(dto.employeeNo);
    if (employeeNo) {
      const dup = await this.db.employeeProfile.findFirst({ where: { employeeNo, NOT: { userId } }, select: { userId: true } });
      if (dup) throw new BadRequestException(`No. karyawan ${employeeNo} sudah dipakai karyawan lain`);
    }
    const userData: Record<string, unknown> = {};
    for (const k of ["position", "department", "phone"] as const) if (dto[k] !== undefined) userData[k] = blankToNull(dto[k]);
    if (Object.keys(userData).length) await this.db.user.update({ where: { id: userId }, data: userData });

    const profile: Record<string, unknown> = {};
    for (const k of [
      "nik", "npwp", "birthPlace", "gender", "address", "bankName", "bankAccountNo", "bankAccountName",
      "bpjsKesNo", "bpjsTkNo", "emergencyName", "emergencyPhone",
    ] as const) {
      if (dto[k] !== undefined) profile[k] = blankToNull(dto[k]);
    }
    if (dto.employeeNo !== undefined) profile.employeeNo = employeeNo;
    if (dto.employmentType !== undefined) profile.employmentType = dto.employmentType || "TETAP";
    for (const k of ["birthDate", "joinDate", "contractEndDate"] as const) if (dto[k] !== undefined) profile[k] = dateOrNull(dto[k]);
    await this.db.employeeProfile.upsert({ where: { userId }, update: profile, create: { userId, ...profile } });

    if (dto.salary) await this.updateSalaryConfig(userId, dto.salary);
    return (await this.listEmployees(true)).find((e: any) => e.userId === userId);
  }

  // ─────────────── Pengaturan gaji (kompatibel dengan layar lama) ───────────────

  async getSalaryConfigs() {
    const users = await this.db.user.findMany({ where: { status: "AKTIF" }, select: { ...USER_SELECT, salaryConfig: true }, orderBy: { name: "asc" } });
    return users.map((u: any) => ({ userId: u.id, user: { ...u, salaryConfig: undefined }, ...this.shapeConfig(u.salaryConfig) }));
  }

  async getSalaryConfigByUserId(userId: number) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { ...USER_SELECT, salaryConfig: true } });
    if (!user) throw new NotFoundException("Karyawan tidak ditemukan");
    return { userId, user: { ...user, salaryConfig: undefined }, ...this.shapeConfig(user.salaryConfig) };
  }

  async deleteSalaryConfig(userId: number) {
    await this.db.salaryConfig.deleteMany({ where: { userId } });
    return { success: true, message: "Setting gaji karyawan berhasil dihapus" };
  }

  async updateSalaryConfig(userId: number, dto: UpdateSalaryConfigDto) {
    const data = {
      basicSalary: dto.basicSalary,
      allowance: dto.allowance,
      ptkp: dto.ptkp || "TK/0",
      hasNpwp: dto.hasNpwp ?? true,
      pph21Rate: dto.pph21Rate !== undefined ? dto.pph21Rate : null,
      ...(dto.mealAllowance !== undefined ? { mealAllowance: dto.mealAllowance } : {}),
      ...(dto.bpjsKes !== undefined ? { bpjsKes: dto.bpjsKes } : {}),
      ...(dto.bpjsTk !== undefined ? { bpjsTk: dto.bpjsTk } : {}),
      ...(dto.bpjsJp !== undefined ? { bpjsJp: dto.bpjsJp } : {}),
    };
    return this.db.salaryConfig.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  }

  // ─────────────── Slip gaji ───────────────

  private shapeSlip(s: any, user?: any) {
    const money = [
      "basicSalary", "allowance", "mealAllowance", "overtimePay", "absentDeduct", "otherIncome", "grossSalary",
      "bpjs", "bpjsCompany", "taxBase", "terRate", "pph21", "otherDeduction", "netSalary",
    ];
    const out: any = { ...s };
    for (const k of money) out[k] = n(s[k]);
    out.user = user || { id: s.userId, name: `User #${s.userId}` };
    return out;
  }

  async getSlips(period?: string, userId?: number) {
    const where: any = {};
    if (period) where.period = period;
    if (userId) where.userId = userId;
    const slips = await this.db.payrollSlip.findMany({ where, orderBy: [{ period: "desc" }, { id: "desc" }] });
    const userIds = Array.from(new Set(slips.map((s: any) => s.userId))) as number[];
    const users = await this.db.user.findMany({
      where: { id: { in: userIds } },
      select: { ...USER_SELECT, employeeProfile: { select: { employeeNo: true, bankName: true, bankAccountNo: true, bankAccountName: true, npwp: true } } },
    });
    const userMap = new Map(users.map((u: any) => [u.id, u]));
    return slips.map((s: any) => this.shapeSlip(s, userMap.get(s.userId)));
  }

  private periodRange(period: string) {
    const m = /^(\d{4})-(\d{2})$/.exec(period || "");
    if (!m) throw new BadRequestException("Periode harus berformat YYYY-MM");
    const year = Number(m[1]);
    const month = Number(m[2]);
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
  }

  /** Rekap absensi satu karyawan dalam periode (mengabaikan absensi berstatus DITOLAK). */
  private summarizeAttendance(rows: any[]) {
    const validRows = rows.filter((a) => String(a.verificationStatus || "").toUpperCase() !== "DITOLAK");
    const up = (a: any) => String(a.status || "").toUpperCase();
    return {
      presentDays: validRows.filter((a) => up(a) === "HADIR").length,
      absentDays: validRows.filter((a) => up(a) === "ALPHA").length,
      overtimeHours: validRows.reduce((s, a) => s + n(a.overtimeHours), 0),
      lateCount: validRows.filter((a) => {
        if (typeof a.lateMinutes === "number" && a.lateMinutes > 0) return true;
        if (!a.checkIn) return false;
        const d = new Date(a.checkIn);
        return d.getHours() > 8 || (d.getHours() === 8 && d.getMinutes() > 30);
      }).length,
    };
  }

  private slipData(calc: ReturnType<typeof calculateSlip>, att: ReturnType<PayrollService["summarizeAttendance"]>, workDays: number) {
    return {
      basicSalary: calc.basicSalary,
      allowance: calc.allowance,
      mealAllowance: calc.mealAllowance,
      overtimePay: calc.overtimePay,
      absentDeduct: calc.absentDeduct,
      otherIncome: calc.otherIncome,
      grossSalary: calc.grossSalary,
      bpjs: calc.bpjs,
      bpjsCompany: calc.bpjsCompany,
      taxBase: calc.taxBase,
      terCategory: calc.terCategory,
      terRate: calc.terRate,
      pph21: calc.pph21,
      otherDeduction: calc.otherDeduction,
      netSalary: calc.netSalary,
      detail: { ...calc.detail, overtimeHours: att.overtimeHours },
      workDays,
      presentDays: att.presentDays,
      absentDays: att.absentDays,
      lateCount: att.lateCount,
    };
  }

  /**
   * Buat / hitung ulang slip DRAFT untuk semua karyawan aktif.
   * Slip yang sudah dibayar tidak disentuh; bonus, potongan & catatan pada slip DRAFT dipertahankan.
   */
  async generateSlips(dto: GeneratePayrollDto) {
    const period = dto.period;
    const { start, end } = this.periodRange(period);
    const settings = await this.getSettings();
    const users = await this.db.user.findMany({ where: { status: "AKTIF" }, select: { id: true, salaryConfig: true } });
    if (!users.length) throw new BadRequestException("Tidak ada karyawan aktif untuk diproses.");

    const [attendances, existing] = await Promise.all([
      this.db.attendance.findMany({ where: { date: { gte: start, lt: end } } }),
      this.db.payrollSlip.findMany({ where: { period } }),
    ]);
    const attByUser = new Map<number, any[]>();
    for (const a of attendances) attByUser.set(a.userId, [...(attByUser.get(a.userId) ?? []), a]);
    const existingByUser = new Map<number, any>(existing.map((s: any) => [s.userId, s]));

    let generated = 0;
    let skippedPaid = 0;
    let skippedNoSalary = 0;
    for (const u of users) {
      const prev = existingByUser.get(u.id);
      if (prev?.status === "PAID") {
        skippedPaid += 1;
        continue;
      }
      if (!u.salaryConfig || n(u.salaryConfig.basicSalary) <= 0) {
        skippedNoSalary += 1;
        continue;
      }
      const cfg = this.shapeConfig(u.salaryConfig) as SalaryInput;
      const att = this.summarizeAttendance(attByUser.get(u.id) ?? []);
      const calc = calculateSlip(cfg, att, { otherIncome: n(prev?.otherIncome), otherDeduction: n(prev?.otherDeduction) }, settings);
      const data = this.slipData(calc, att, settings.workDays);
      await this.db.payrollSlip.upsert({
        where: { period_userId: { period, userId: u.id } },
        create: { period, userId: u.id, status: "DRAFT", ...data },
        update: data,
      });
      generated += 1;
    }
    const slips = await this.getSlips(period);
    return { generated, count: generated, skippedPaid, skippedNoSalary, slips };
  }

  /** Bonus / potongan / catatan pada slip DRAFT, lalu hitung ulang (termasuk PPh 21). */
  async adjustSlip(id: number, dto: AdjustSlipDto) {
    const slip = await this.db.payrollSlip.findUnique({ where: { id } });
    if (!slip) throw new NotFoundException("Slip gaji tidak ditemukan");
    if (slip.status === "PAID") throw new BadRequestException("Slip yang sudah dibayar tidak bisa diubah");
    const cfgRow = await this.db.salaryConfig.findUnique({ where: { userId: slip.userId } });
    const { start, end } = this.periodRange(slip.period);
    const atts = await this.db.attendance.findMany({ where: { userId: slip.userId, date: { gte: start, lt: end } } });
    const settings = await this.getSettings();
    const att = this.summarizeAttendance(atts);
    const calc = calculateSlip(
      this.shapeConfig(cfgRow) as SalaryInput,
      att,
      { otherIncome: dto.otherIncome ?? n(slip.otherIncome), otherDeduction: dto.otherDeduction ?? n(slip.otherDeduction) },
      settings,
    );
    if (calc.netSalary < 0) throw new BadRequestException("Potongan melebihi gaji — gaji bersih tidak boleh minus");
    await this.db.payrollSlip.update({
      where: { id },
      data: { ...this.slipData(calc, att, settings.workDays), ...(dto.note !== undefined ? { note: dto.note || null } : {}) },
    });
    return this.getSlipById(id);
  }

  async getSlipById(id: number, userId?: number) {
    const where: any = { id };
    if (userId) where.userId = userId;
    const slip = await this.db.payrollSlip.findFirst({ where });
    if (!slip) throw new NotFoundException("Slip gaji tidak ditemukan");
    const user = await this.db.user.findUnique({
      where: { id: slip.userId },
      select: { ...USER_SELECT, employeeProfile: { select: { employeeNo: true, bankName: true, bankAccountNo: true, bankAccountName: true, npwp: true } } },
    });
    return this.shapeSlip(slip, user);
  }

  async deleteSlip(id: number) {
    const slip = await this.db.payrollSlip.findUnique({ where: { id } });
    if (!slip) throw new NotFoundException("Slip gaji tidak ditemukan");
    if (slip.status === "PAID") throw new BadRequestException("Slip gaji yang sudah berstatus PAID tidak dapat dihapus");
    await this.db.payrollSlip.delete({ where: { id } });
    return { success: true, message: "Slip gaji berhasil dihapus" };
  }

  private async assertCashAccount(code: string) {
    const acc = await this.db.coaAccount.findUnique({ where: { code } });
    if (!acc || !acc.isPostable || acc.status !== "AKTIF") throw new BadRequestException("Akun kas/bank pembayaran gaji tidak valid");
    if (!acc.isCash) throw new BadRequestException("Gaji harus dibayar dari akun Kas / Bank");
  }

  /**
   * Bayar gaji:  Dr Beban Gaji (bruto)  Dr Beban BPJS Perusahaan
   *              Cr Hutang PPh 21  Cr Hutang BPJS (karyawan + perusahaan)  Cr Piutang Karyawan (potongan pinjaman)
   *              Cr Kas / Bank (gaji bersih)
   */
  async markPaid(id: number, dto: PaySlipDto, userId?: number) {
    const slip = await this.db.payrollSlip.findUnique({ where: { id } });
    if (!slip) throw new NotFoundException("Slip gaji tidak ditemukan");
    if (n(slip.netSalary) < 0) throw new BadRequestException("Gaji bersih minus — periksa potongan slip ini");
    const mappings = await this.mappingService.getAll();
    const paidAccount = dto.paidAccountCode || mappings.CASH_DEFAULT || "1000.02";
    await this.assertCashAccount(paidAccount);
    const user = await this.db.user.findUnique({ where: { id: slip.userId }, select: { name: true } });
    const ref = `PAY-${slip.period}-${slip.userId}`;

    await this.prisma.main.$transaction(async (tx: any) => {
      // Atomik: hanya slip yang BELUM dibayar (cegah gaji terbayar dua kali)
      const guard = await tx.payrollSlip.updateMany({
        where: { id, NOT: { status: "PAID" } },
        data: { status: "PAID", paidAt: new Date(), paidAccountCode: paidAccount },
      });
      if (guard.count === 0) throw new BadRequestException("Slip gaji ini sudah dibayar. Pembayaran tidak dicatat dua kali.");
      await this.postingService.post(
        {
          sourceType: "PayrollSlip",
          sourceId: slip.id,
          event: "paid",
          source: "PAYROLL",
          date: new Date(),
          memo: `Gaji ${user?.name || `karyawan #${slip.userId}`} periode ${slip.period}`,
          refNo: ref,
          createdById: userId,
          lines: PostingRules.buildPayrollLines(
            {
              id: slip.id,
              slipNumber: ref,
              grossSalary: n(slip.grossSalary),
              bpjsCompany: n(slip.bpjsCompany),
              pph21: n(slip.pph21),
              bpjsEmployee: n(slip.bpjs),
              netSalary: n(slip.netSalary),
              otherDeduction: n(slip.otherDeduction),
              paidAccountCode: paidAccount,
              employeeId: slip.userId,
              employeeName: user?.name,
            },
            mappings,
          ),
        },
        tx,
      );
    });
    return this.getSlipById(id);
  }

  /** Bayar semua slip DRAFT dalam satu periode. */
  async payPeriod(dto: PayPeriodDto, userId?: number) {
    const drafts = await this.db.payrollSlip.findMany({ where: { period: dto.period, NOT: { status: "PAID" } }, select: { id: true } });
    if (!drafts.length) throw new BadRequestException("Tidak ada slip yang belum dibayar pada periode ini");
    const results: { id: number; ok: boolean; error?: string }[] = [];
    for (const d of drafts) {
      try {
        await this.markPaid(d.id, { paidAccountCode: dto.paidAccountCode }, userId);
        results.push({ id: d.id, ok: true });
      } catch (e: any) {
        results.push({ id: d.id, ok: false, error: e?.message });
      }
    }
    return { paid: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), slips: await this.getSlips(dto.period) };
  }
}
