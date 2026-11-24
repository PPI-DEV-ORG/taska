import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { CheckInDto, CheckOutDto, RecordAttendanceDto, UpdateAttendanceDto } from "./dto.js";

export type AttendanceLocationStatus =
  | "DI_KANTOR"
  | "LUAR_KANTOR_DINAS"
  | "DI_LUAR_RADIUS"
  | "TERCATAT"
  | "TANPA_GPS";

export type AttendanceVerificationStatus =
  | "TERVERIFIKASI"
  | "PERLU_VERIFIKASI"
  | "DITOLAK";

export interface AttendanceScheduleSettings {
  workStartTime: string;
  workEndTime: string;
  lateToleranceMinutes: number;
  breakStartTime: string;
  breakEndTime: string;
  overtimeCalculationMode: "AFTER_HOURS" | "AFTER_WORK_END";
  overtimeThresholdHours: number;
  overtimeMinMinutes: number;
  overtimeRatePerHour: number;
  officeName: string;
  officeLatitude: number | null;
  officeLongitude: number | null;
  officeRadiusMeters: number;
  requirePhotoOnAttendance: boolean;
  requireGpsOnAttendance: boolean;
  fieldRoles: string[];
}

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceScheduleSettings = {
  workStartTime: "08:00",
  workEndTime: "17:00",
  lateToleranceMinutes: 15,
  breakStartTime: "12:00",
  breakEndTime: "13:00",
  overtimeCalculationMode: "AFTER_HOURS",
  overtimeThresholdHours: 8,
  overtimeMinMinutes: 30,
  overtimeRatePerHour: 25000,
  officeName: "Kantor Pusat",
  officeLatitude: null,
  officeLongitude: null,
  officeRadiusMeters: 150,
  requirePhotoOnAttendance: true,
  requireGpsOnAttendance: true,
  fieldRoles: ["teknisi", "sales", "driver", "lapangan", "super_admin", "bos"],
};

/** Hitung jarak Haversine dalam meter antara dua titik koordinat GPS. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // meter
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/** Evaluasi status lokasi absensi berdasarkan GPS, geofence kantor, dan role user. */
export function evaluateAttendanceLocation(params: {
  latitude?: number | null;
  longitude?: number | null;
  userRole?: string | null;
  settings: AttendanceScheduleSettings;
}): {
  distanceMeters: number | null;
  locationStatus: AttendanceLocationStatus;
  needsVerification: boolean;
} {
  const { latitude, longitude, userRole, settings } = params;
  const hasCoords =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude);

  if (!hasCoords) {
    return {
      distanceMeters: null,
      locationStatus: "TANPA_GPS",
      needsVerification: true,
    };
  }

  const hasOffice =
    typeof settings.officeLatitude === "number" &&
    Number.isFinite(settings.officeLatitude) &&
    typeof settings.officeLongitude === "number" &&
    Number.isFinite(settings.officeLongitude);

  if (!hasOffice) {
    return {
      distanceMeters: null,
      locationStatus: "TERCATAT",
      needsVerification: false,
    };
  }

  const dist = haversineMeters(
    latitude,
    longitude,
    settings.officeLatitude!,
    settings.officeLongitude!,
  );
  const radius = Number(settings.officeRadiusMeters) || 150;

  if (dist <= radius) {
    return {
      distanceMeters: dist,
      locationStatus: "DI_KANTOR",
      needsVerification: false,
    };
  }

  const normalizedRole = (userRole || "").trim().toLowerCase();
  const allowedFieldRoles = (settings.fieldRoles || []).map((r) =>
    r.trim().toLowerCase(),
  );
  if (normalizedRole && allowedFieldRoles.includes(normalizedRole)) {
    return {
      distanceMeters: dist,
      locationStatus: "LUAR_KANTOR_DINAS",
      needsVerification: false,
    };
  }

  return {
    distanceMeters: dist,
    locationStatus: "DI_LUAR_RADIUS",
    needsVerification: true,
  };
}

/** Hitung menit keterlambatan berdasarkan jam masuk kerja + toleransi. */
export function computeLateMinutes(
  checkInDate: Date,
  workStartTime: string,
  lateToleranceMinutes: number,
): number {
  const [startH, startM] = (workStartTime || "08:00").split(":").map(Number);
  if (!Number.isFinite(startH) || !Number.isFinite(startM)) return 0;
  const startTotal = startH * 60 + startM + (Number(lateToleranceMinutes) || 0);
  const actualTotal = checkInDate.getHours() * 60 + checkInDate.getMinutes();
  const diff = actualTotal - startTotal;
  return diff > 0 ? diff : 0;
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayDate(): Date {
    const nowWib = new Date(Date.now() + 7 * 3600_000);
    // Gunakan tanggal lokal WIB (YYYY-MM-DD)
    const dateStr = nowWib.toISOString().slice(0, 10);
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

  async checkIn(userId: number, dto: CheckInDto, userRole?: string) {
    const today = this.getTodayDate();
    const existing = await (this.prisma.main as any).attendance.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    if (existing && existing.checkIn) {
      throw new BadRequestException("Anda sudah melakukan check-in hari ini");
    }

    const settings = await this.getSettings();

    if (settings.requirePhotoOnAttendance && !dto.photoFileId) {
      throw new BadRequestException(
        "Foto langsung dari kamera wajib dilampirkan saat Check-In",
      );
    }

    const hasCoords =
      typeof dto.latitude === "number" &&
      Number.isFinite(dto.latitude) &&
      typeof dto.longitude === "number" &&
      Number.isFinite(dto.longitude);

    if (settings.requireGpsOnAttendance && !hasCoords) {
      throw new BadRequestException(
        "Lokasi GPS wajib diaktifkan untuk melakukan Check-In",
      );
    }

    const locEval = evaluateAttendanceLocation({
      latitude: dto.latitude,
      longitude: dto.longitude,
      userRole,
      settings,
    });

    const normalizedRole = (userRole || "").toUpperCase();
    const fieldRoles = (settings.fieldRoles ?? ["SALES", "SE", "TEKNISI"]).map((r) =>
      r.toUpperCase(),
    );
    const isFieldRole = fieldRoles.includes(normalizedRole);
    const trimmedNotes = (dto.notes || "").trim();

    if (isFieldRole && trimmedNotes.length < 5) {
      throw new BadRequestException(
        "Role lapangan (Sales, Presales, Teknisi) wajib mengisi keterangan aktivitas / pihak klien yang ditemui sebagai bagian dari catatan KPI.",
      );
    }

    if (!isFieldRole && locEval.locationStatus === "DI_LUAR_RADIUS" && trimmedNotes.length < 5) {
      throw new BadRequestException(
        "Anda berada di luar radius kantor. Wajib mengisi alasan & keterangan yang jelas (misal: Remote Working, WFH, atau penugasan luar kantor).",
      );
    }

    const now = new Date();
    const lateMinutes = computeLateMinutes(
      now,
      settings.workStartTime,
      settings.lateToleranceMinutes,
    );
    const verificationStatus: AttendanceVerificationStatus =
      locEval.needsVerification || !dto.photoFileId
        ? "PERLU_VERIFIKASI"
        : "TERVERIFIKASI";

    const payload = {
      checkIn: now,
      status: "HADIR",
      notes: dto.notes || existing?.notes || null,
      checkInPhotoFileId: dto.photoFileId ?? null,
      checkInLatitude: hasCoords ? dto.latitude! : null,
      checkInLongitude: hasCoords ? dto.longitude! : null,
      checkInAccuracy:
        typeof dto.accuracy === "number" && Number.isFinite(dto.accuracy)
          ? dto.accuracy
          : null,
      checkInDistanceMeters: locEval.distanceMeters,
      checkInLocationStatus: locEval.locationStatus,
      checkInAddress: dto.address || null,
      lateMinutes,
      verificationStatus,
    };

    return (this.prisma.main as any).attendance.upsert({
      where: { userId_date: { userId, date: today } },
      create: {
        userId,
        date: today,
        ...payload,
      },
      update: payload,
    });
  }

  async checkOut(userId: number, dto: CheckOutDto, userRole?: string) {
    const today = this.getTodayDate();
    const existing = await (this.prisma.main as any).attendance.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    if (!existing || !existing.checkIn) {
      throw new BadRequestException("Anda belum melakukan check-in hari ini");
    }

    const settings = await this.getSettings();

    if (settings.requirePhotoOnAttendance && !dto.photoFileId) {
      throw new BadRequestException(
        "Foto langsung dari kamera wajib dilampirkan saat Check-Out",
      );
    }

    const hasCoords =
      typeof dto.latitude === "number" &&
      Number.isFinite(dto.latitude) &&
      typeof dto.longitude === "number" &&
      Number.isFinite(dto.longitude);

    if (settings.requireGpsOnAttendance && !hasCoords) {
      throw new BadRequestException(
        "Lokasi GPS wajib diaktifkan untuk melakukan Check-Out",
      );
    }

    const locEval = evaluateAttendanceLocation({
      latitude: dto.latitude,
      longitude: dto.longitude,
      userRole,
      settings,
    });

    const now = new Date();
    let overtime = dto.overtimeHours !== undefined ? Number(dto.overtimeHours) : 0;
    if (overtime === 0) {
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

    // Jika sebelumnya sudah PERLU_VERIFIKASI atau check-out butuh verifikasi, pertahankan PERLU_VERIFIKASI
    let nextVerification: AttendanceVerificationStatus =
      existing.verificationStatus || "TERVERIFIKASI";
    if (
      nextVerification !== "DITOLAK" &&
      (locEval.needsVerification || !dto.photoFileId)
    ) {
      nextVerification = "PERLU_VERIFIKASI";
    }

    return (this.prisma.main as any).attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        overtimeHours: overtime,
        notes: dto.notes
          ? existing.notes
            ? `${existing.notes} | Pulang: ${dto.notes}`
            : dto.notes
          : existing.notes,
        checkOutPhotoFileId: dto.photoFileId ?? null,
        checkOutLatitude: hasCoords ? dto.latitude! : null,
        checkOutLongitude: hasCoords ? dto.longitude! : null,
        checkOutAccuracy:
          typeof dto.accuracy === "number" && Number.isFinite(dto.accuracy)
            ? dto.accuracy
            : null,
        checkOutDistanceMeters: locEval.distanceMeters,
        checkOutLocationStatus: locEval.locationStatus,
        checkOutAddress: dto.address || null,
        verificationStatus: nextVerification,
      },
    });
  }

  async getSettings(): Promise<AttendanceScheduleSettings> {
    const row = await (this.prisma.main as any).systemSetting.findUnique({
      where: { key: "attendance_work_schedule" },
    });
    if (!row || !row.value) return { ...DEFAULT_ATTENDANCE_SETTINGS };
    try {
      return { ...DEFAULT_ATTENDANCE_SETTINGS, ...JSON.parse(row.value) };
    } catch {
      return { ...DEFAULT_ATTENDANCE_SETTINGS };
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
        description: "Pengaturan Jam Kerja, Geofence Kantor & Aturan Lembur Karyawan",
        updatedById: userId,
      },
      update: {
        value: JSON.stringify(updated),
        updatedById: userId,
      },
    });
    return updated;
  }

  async updateAttendance(id: number, dto: UpdateAttendanceDto, actorUserId?: number) {
    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.overtimeHours !== undefined) data.overtimeHours = Number(dto.overtimeHours) || 0;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.verificationStatus !== undefined) {
      data.verificationStatus = dto.verificationStatus;
      data.verifiedById = actorUserId ?? null;
      data.verifiedAt = new Date();
    }

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
        verificationStatus: "TERVERIFIKASI",
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
    let needsVerification = 0;
    let incompleteCheckout = 0;

    for (const r of rows) {
      const s = (r.status || "").toUpperCase();
      if (s === "HADIR") hadir++;
      else if (s === "IZIN") izin++;
      else if (s === "SAKIT") sakit++;
      else if (s === "CUTI") cuti++;
      else if (s === "ALPHA") alpha++;

      if (r.verificationStatus === "PERLU_VERIFIKASI") needsVerification++;
      if (s === "HADIR" && r.checkIn && !r.checkOut) incompleteCheckout++;

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
      needsVerification,
      incompleteCheckout,
    };
  }
}
