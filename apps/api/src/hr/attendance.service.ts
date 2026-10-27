import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { CheckInDto, CheckOutDto, RecordAttendanceDto } from "./dto.js";

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayDate(): Date {
    const now = new Date();
    // Gunakan tanggal lokal YYYY-MM-DD
    const dateStr = now.toISOString().slice(0, 10);
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  async getToday(userId: number) {
    const today = this.getTodayDate();
    const att = await (this.prisma.main as any).attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });
    return att || null;
  }

  async checkIn(userId: number, dto: CheckInDto) {
    const today = this.getTodayDate();
    const existing = await (this.prisma.main as any).attendance.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    if (existing && existing.checkIn) {
      throw new BadRequestException("Anda sudah melakukan check-in hari ini");
    }

    const now = new Date();
    return (this.prisma.main as any).attendance.upsert({
      where: { userId_date: { userId, date: today } },
      create: {
        userId,
        date: today,
        checkIn: now,
        status: "HADIR",
        notes: dto.notes || null,
      },
      update: {
        checkIn: now,
        status: "HADIR",
        notes: dto.notes || existing?.notes || null,
      },
    });
  }

  async checkOut(userId: number, dto: CheckOutDto) {
    const today = this.getTodayDate();
    const existing = await (this.prisma.main as any).attendance.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    if (!existing || !existing.checkIn) {
      throw new BadRequestException("Anda belum melakukan check-in hari ini");
    }

    const now = new Date();
    let overtime = dto.overtimeHours !== undefined ? Number(dto.overtimeHours) : 0;
    if (overtime === 0) {
      const settings = await this.getSettings();
      if (settings.overtimeCalculationMode === "AFTER_WORK_END") {
        const [endH, endM] = (settings.workEndTime || "17:00").split(":").map(Number);
        const workEndMinute = endH * 60 + (endM || 0);
        const nowMinute = now.getHours() * 60 + now.getMinutes();
        const diffMinutes = nowMinute - workEndMinute;
        if (diffMinutes >= (settings.overtimeMinMinutes || 30)) {
          overtime = Math.round((diffMinutes / 60) * 10) / 10;
        }
      } else {
        // AFTER_HOURS: misal setelah 8 jam kerja
        const checkInTime = new Date(existing.checkIn).getTime();
        const diffHours = (now.getTime() - checkInTime) / 3600000;
        const threshold = Number(settings.overtimeThresholdHours) || 8;
        if (diffHours > threshold) {
          const ot = diffHours - threshold;
          if (ot * 60 >= (settings.overtimeMinMinutes || 30)) {
            overtime = Math.round(ot * 10) / 10;
          }
        }
      }
    }

    return (this.prisma.main as any).attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        overtimeHours: overtime,
        notes: dto.notes ? (existing.notes ? `${existing.notes} | Pulang: ${dto.notes}` : dto.notes) : existing.notes,
      },
    });
  }

  async getSettings() {
    const row = await (this.prisma.main as any).systemSetting.findUnique({
      where: { key: "attendance_work_schedule" },
    });
    const defaults = {
      workStartTime: "08:00",
      workEndTime: "17:00",
      lateToleranceMinutes: 15,
      breakStartTime: "12:00",
      breakEndTime: "13:00",
      overtimeCalculationMode: "AFTER_HOURS",
      overtimeThresholdHours: 8,
      overtimeMinMinutes: 30,
      overtimeRatePerHour: 25000,
    };
    if (!row || !row.value) return defaults;
    try {
      return { ...defaults, ...JSON.parse(row.value) };
    } catch {
      return defaults;
    }
  }

  async saveSettings(userId: number, dto: any) {
    const current = await this.getSettings();
    const updated = { ...current, ...dto };
    await (this.prisma.main as any).systemSetting.upsert({
      where: { key: "attendance_work_schedule" },
      create: {
        key: "attendance_work_schedule",
        value: JSON.stringify(updated),
        description: "Pengaturan Jam Kerja & Aturan Lembur Karyawan",
        updatedById: userId,
      },
      update: {
        value: JSON.stringify(updated),
        updatedById: userId,
      },
    });
    return updated;
  }

  async updateAttendance(id: number, dto: any) {
    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.overtimeHours !== undefined) data.overtimeHours = Number(dto.overtimeHours) || 0;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return (this.prisma.main as any).attendance.update({
      where: { id },
      data,
    });
  }

  async recordStatus(dto: RecordAttendanceDto) {
    const targetDate = new Date(`${dto.date.slice(0, 10)}T00:00:00.000Z`);
    return (this.prisma.main as any).attendance.upsert({
      where: {
        userId_date: {
          userId: dto.userId,
          date: targetDate,
        },
      },
      create: {
        userId: dto.userId,
        date: targetDate,
        status: dto.status,
        overtimeHours: dto.overtimeHours || 0,
        notes: dto.notes || null,
      },
      update: {
        status: dto.status,
        overtimeHours: dto.overtimeHours !== undefined ? dto.overtimeHours : undefined,
        notes: dto.notes !== undefined ? dto.notes : undefined,
      },
    });
  }

  async list(filters: { month?: string; date?: string; userId?: number; page?: number; limit?: number }) {
    const where: any = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.date) {
      const d = new Date(`${filters.date.slice(0, 10)}T00:00:00.000Z`);
      where.date = d;
    } else if (filters.month) {
      // filters.month: "YYYY-MM"
      const [yearStr, monthStr] = filters.month.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      where.date = {
        gte: start,
        lt: end,
      };
    }

    const rows = await (this.prisma.main as any).attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: filters.limit || 100,
      skip: filters.page && filters.limit ? (filters.page - 1) * filters.limit : 0,
    });

    // Populate user names
    const userIds = Array.from(new Set(rows.map((r: any) => r.userId))) as number[];
    const users = await (this.prisma.main as any).user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true },
    });
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    return rows.map((r: any) => ({
      ...r,
      user: userMap.get(r.userId) || { id: r.userId, name: `User #${r.userId}` },
    }));
  }

  async summary(month?: string, userId?: number) {
    const where: any = {};
    if (userId) where.userId = userId;

    if (month) {
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      where.date = {
        gte: new Date(Date.UTC(year, monthNum - 1, 1)),
        lt: new Date(Date.UTC(year, monthNum, 1)),
      };
    }

    const rows = await (this.prisma.main as any).attendance.findMany({ where });

    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let cuti = 0;
    let alpha = 0;
    let totalOvertime = 0;

    for (const r of rows) {
      const s = (r.status || "").toUpperCase();
      if (s === "HADIR") hadir++;
      else if (s === "IZIN") izin++;
      else if (s === "SAKIT") sakit++;
      else if (s === "CUTI") cuti++;
      else if (s === "ALPHA") alpha++;

      totalOvertime += Number(r.overtimeHours || 0);
    }

    return {
      totalRecords: rows.length,
      hadir,
      izin,
      sakit,
      cuti,
      alpha,
      totalOvertime,
    };
  }
}

