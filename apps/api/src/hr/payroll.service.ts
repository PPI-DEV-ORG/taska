import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { GeneratePayrollDto, PaySlipDto, UpdateSalaryConfigDto } from "./dto.js";

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalaryConfigs() {
    const users = await (this.prisma.main as any).user.findMany({
      where: { status: "AKTIF" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        position: true,
      },
      orderBy: { name: "asc" },
    });

    const configs = await (this.prisma.main as any).salaryConfig.findMany();
    const configMap = new Map<number, any>(configs.map((c: any) => [c.userId, c]));

    return users.map((u: any) => {
      const cfg: any = configMap.get(u.id);
      return {
        userId: u.id,
        user: u,
        basicSalary: cfg ? Number(cfg.basicSalary) : 0,
        allowance: cfg ? Number(cfg.allowance) : 0,
        ptkp: cfg?.ptkp || "TK/0",
        hasNpwp: cfg?.hasNpwp ?? true,
        pph21Rate: cfg?.pph21Rate ? Number(cfg.pph21Rate) : null,
      };
    });
  }

  async getSalaryConfigByUserId(userId: number) {
    const user = await (this.prisma.main as any).user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        position: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Karyawan tidak ditemukan");
    }

    const cfg = await (this.prisma.main as any).salaryConfig.findUnique({
      where: { userId },
    });

    return {
      userId,
      user,
      basicSalary: cfg ? Number(cfg.basicSalary) : 0,
      allowance: cfg ? Number(cfg.allowance) : 0,
      ptkp: cfg?.ptkp || "TK/0",
      hasNpwp: cfg?.hasNpwp ?? true,
      pph21Rate: cfg?.pph21Rate ? Number(cfg.pph21Rate) : null,
    };
  }

  async deleteSalaryConfig(userId: number) {
    await (this.prisma.main as any).salaryConfig.deleteMany({
      where: { userId },
    });
    return { success: true, message: "Setting gaji karyawan berhasil dihapus" };
  }

  async updateSalaryConfig(userId: number, dto: UpdateSalaryConfigDto) {
    return (this.prisma.main as any).salaryConfig.upsert({
      where: { userId },
      create: {
        userId,
        basicSalary: dto.basicSalary,
        allowance: dto.allowance,
        ptkp: dto.ptkp || "TK/0",
        hasNpwp: dto.hasNpwp ?? true,
        pph21Rate: dto.pph21Rate !== undefined ? dto.pph21Rate : null,
      },
      update: {
        basicSalary: dto.basicSalary,
        allowance: dto.allowance,
        ptkp: dto.ptkp || "TK/0",
        hasNpwp: dto.hasNpwp ?? true,
        pph21Rate: dto.pph21Rate !== undefined ? dto.pph21Rate : null,
      },
    });
  }

  async getSlips(period?: string, userId?: number) {
    const where: any = {};
    if (period) where.period = period;
    if (userId) where.userId = userId;

    const slips = await (this.prisma.main as any).payrollSlip.findMany({
      where,
      orderBy: [{ period: "desc" }, { id: "desc" }],
    });

    const userIds = Array.from(new Set(slips.map((s: any) => s.userId))) as number[];
    const users = await (this.prisma.main as any).user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true, phone: true, position: true },
    });
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    return slips.map((s: any) => ({
      ...s,
      basicSalary: Number(s.basicSalary),
      allowance: Number(s.allowance),
      overtimePay: Number(s.overtimePay),
      absentDeduct: Number(s.absentDeduct),
      grossSalary: Number(s.grossSalary),
      bpjs: Number(s.bpjs),
      pph21: Number(s.pph21),
      netSalary: Number(s.netSalary),
      user: userMap.get(s.userId) || { id: s.userId, name: `User #${s.userId}` },
    }));
  }

  async generateSlips(dto: GeneratePayrollDto) {
    const period = dto.period; // "YYYY-MM"
    const [yearStr, monthStr] = period.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const activeUsers = await (this.prisma.main as any).user.findMany({
      where: { status: "AKTIF" },
    });

    if (!activeUsers || activeUsers.length === 0) {
      throw new BadRequestException("Data karyawan kosong / tidak ada karyawan aktif untuk diproses.");
    }

    const configs = await (this.prisma.main as any).salaryConfig.findMany();
    const configMap = new Map<number, any>(configs.map((c: any) => [c.userId, c]));

    const attendances = await (this.prisma.main as any).attendance.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    // Kelompokkan absensi per user
    const attByUser = new Map<number, any[]>();
    for (const att of attendances) {
      const list = attByUser.get(att.userId) || [];
      list.push(att);
      attByUser.set(att.userId, list);
    }

    const createdSlips = [];

    for (const u of activeUsers) {
      const cfg: any = configMap.get(u.id);
      const basicSalary = cfg ? Number(cfg.basicSalary) : 0;
      const allowance = cfg ? Number(cfg.allowance) : 0;
      const hasNpwp = cfg?.hasNpwp ?? true;
      const customRate = cfg?.pph21Rate ? Number(cfg.pph21Rate) : null;

      const userAtts = attByUser.get(u.id) || [];
      const presentDays = userAtts.filter((a) => (a.status || "").toUpperCase() === "HADIR").length;
      const absentDays = userAtts.filter((a) => (a.status || "").toUpperCase() === "ALPHA").length;
      const lateCount = userAtts.filter((a) => {
        if (!a.checkIn) return false;
        const d = new Date(a.checkIn);
        return d.getHours() > 8 || (d.getHours() === 8 && d.getMinutes() > 30);
      }).length;

      const overtimeHours = userAtts.reduce((sum, a) => sum + Number(a.overtimeHours || 0), 0);

      const standardWorkDays = 22;

      // Hitung upah lembur Depnaker: lembur * (1/173 * basicSalary)
      const hourlyRate = basicSalary > 0 ? basicSalary / 173 : 0;
      const overtimePay = Math.round(overtimeHours * hourlyRate);

      // Potongan absensi per hari absen tanpa keterangan
      const dayRate = basicSalary > 0 ? basicSalary / standardWorkDays : 0;
      const absentDeduct = Math.round(absentDays * dayRate);

      const grossSalary = Math.max(0, basicSalary + allowance + overtimePay - absentDeduct);

      // BPJS Karyawan: 3% dari Gaji Pokok
      const bpjs = Math.round(basicSalary * 0.03);

      // PPh 21: TER Bulanan / Tarif Efektif Rata-rata atau rate spesifik
      let pph21 = 0;
      if (customRate !== null) {
        pph21 = Math.round(grossSalary * (customRate / 100));
      } else {
        // Skema TER Kategori A (TK/0, TK/1, K/0)
        if (grossSalary <= 5400000) {
          pph21 = 0; // PTKP
        } else if (grossSalary <= 5650000) {
          pph21 = Math.round(grossSalary * 0.0025);
        } else if (grossSalary <= 5950000) {
          pph21 = Math.round(grossSalary * 0.005);
        } else if (grossSalary <= 6300000) {
          pph21 = Math.round(grossSalary * 0.0075);
        } else if (grossSalary <= 6750000) {
          pph21 = Math.round(grossSalary * 0.01);
        } else if (grossSalary <= 7500000) {
          pph21 = Math.round(grossSalary * 0.0125);
        } else if (grossSalary <= 8550000) {
          pph21 = Math.round(grossSalary * 0.015);
        } else if (grossSalary <= 9650000) {
          pph21 = Math.round(grossSalary * 0.0175);
        } else if (grossSalary <= 10050000) {
          pph21 = Math.round(grossSalary * 0.02);
        } else {
          pph21 = Math.round(grossSalary * 0.05); // tarif di atas 10jt
        }
      }

      // Jika belum punya NPWP, tarif lebih tinggi 20% sesuai ketentuan
      if (!hasNpwp && pph21 > 0) {
        pph21 = Math.round(pph21 * 1.2);
      }

      const netSalary = Math.max(0, grossSalary - bpjs - pph21);

      const slip = await (this.prisma.main as any).payrollSlip.upsert({
        where: {
          period_userId: {
            period,
            userId: u.id,
          },
        },
        create: {
          period,
          userId: u.id,
          basicSalary,
          allowance,
          overtimePay,
          absentDeduct,
          grossSalary,
          bpjs,
          pph21,
          netSalary,
          workDays: standardWorkDays,
          presentDays,
          absentDays,
          lateCount,
          status: "DRAFT",
        },
        update: {
          basicSalary,
          allowance,
          overtimePay,
          absentDeduct,
          grossSalary,
          bpjs,
          pph21,
          netSalary,
          workDays: standardWorkDays,
          presentDays,
          absentDays,
          lateCount,
        },
      });

      createdSlips.push(slip);
    }

    const slips = await this.getSlips(period);
    return {
      generated: createdSlips.length,
      count: createdSlips.length,
      slips,
    };
  }

  async getSlipById(id: number, userId?: number) {
    const where: any = { id };
    if (userId) where.userId = userId;

    const slip = await (this.prisma.main as any).payrollSlip.findFirst({
      where,
    });

    if (!slip) {
      throw new NotFoundException("Slip gaji tidak ditemukan");
    }

    const user = await (this.prisma.main as any).user.findUnique({
      where: { id: slip.userId },
      select: { id: true, name: true, email: true, role: true, phone: true, position: true },
    });

    return {
      ...slip,
      basicSalary: Number(slip.basicSalary),
      allowance: Number(slip.allowance),
      overtimePay: Number(slip.overtimePay),
      absentDeduct: Number(slip.absentDeduct),
      grossSalary: Number(slip.grossSalary),
      bpjs: Number(slip.bpjs),
      pph21: Number(slip.pph21),
      netSalary: Number(slip.netSalary),
      user: user || { id: slip.userId, name: `User #${slip.userId}` },
    };
  }

  async deleteSlip(id: number) {
    const slip = await (this.prisma.main as any).payrollSlip.findUnique({
      where: { id },
    });

    if (!slip) {
      throw new NotFoundException("Slip gaji tidak ditemukan");
    }

    if (slip.status === "PAID") {
      throw new BadRequestException("Slip gaji yang sudah berstatus PAID tidak dapat dihapus");
    }

    await (this.prisma.main as any).payrollSlip.delete({
      where: { id },
    });

    return { success: true, message: "Slip gaji berhasil dihapus" };
  }

  async markPaid(id: number, dto: PaySlipDto) {
    const slip = await (this.prisma.main as any).payrollSlip.findUnique({
      where: { id },
    });

    if (!slip) {
      throw new NotFoundException("Slip gaji tidak ditemukan");
    }

    const updated = await (this.prisma.main as any).payrollSlip.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    return updated;
  }
}

