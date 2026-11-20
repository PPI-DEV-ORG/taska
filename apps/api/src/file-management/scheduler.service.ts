import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { FileMigrationService } from "./migration.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type CreateScheduleDto = {
  name?: string;
  sourceProviderId: number;
  targetProviderId: number;
  everyDays: number; // e.g. 3, 5, 7, etc.
  runAtTime?: string; // e.g. "02:00"
  olderThanDays?: number;
  enabled?: boolean;
};

@Injectable()
export class FileSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isTicking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly migrationService: FileMigrationService,
  ) {}

  onModuleInit() {
    // Check setiap 60 detik
    this.timer = setInterval(() => {
      this.tick().catch((e) => {
        this.logger.error(`Error pada tick scheduler migrasi: ${(e as Error).message}`);
      });
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Hitung tanggal nextRunAt berikutnya berdasarkan interval hari dan jam WIB (Asia/Jakarta)
   */
  calculateNextRun(everyDays: number, runAtTime: string = "02:00", fromDate: Date = new Date()): Date {
    const [hoursStr, minsStr] = runAtTime.split(":");
    const targetHour = Number(hoursStr || 2);
    const targetMin = Number(minsStr || 0);

    // Ambil tanggal hari ini dalam WIB (UTC+7)
    const nowUtc = fromDate.getTime();
    const wibOffset = 7 * 60 * 60 * 1000;
    const nowWib = new Date(nowUtc + wibOffset);

    // Tentukan waktu target hari ini di WIB
    const targetWib = new Date(nowWib);
    targetWib.setUTCHours(targetHour, targetMin, 0, 0);

    let nextWib: Date;
    if (targetWib.getTime() > nowWib.getTime()) {
      // Masih di masa depan hari ini
      nextWib = targetWib;
    } else {
      // Tambahkan interval hari
      nextWib = new Date(targetWib.getTime() + everyDays * 24 * 60 * 60 * 1000);
    }

    // Kembalikan ke UTC Date
    return new Date(nextWib.getTime() - wibOffset);
  }

  async listSchedules() {
    return this.prisma.main.fileMigrationSchedule.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async createSchedule(dto: CreateScheduleDto, user: RequestUser) {
    if (dto.sourceProviderId === dto.targetProviderId) {
      throw new BadRequestException("Provider sumber dan tujuan tidak boleh sama");
    }
    if (!dto.everyDays || dto.everyDays < 1) {
      throw new BadRequestException("Interval hari harus minimal 1 hari");
    }

    const nextRun = this.calculateNextRun(dto.everyDays, dto.runAtTime || "02:00");

    return this.prisma.main.fileMigrationSchedule.create({
      data: {
        name: dto.name || `Migrasi rutin ${dto.everyDays} hari sekali`,
        sourceProviderId: dto.sourceProviderId,
        targetProviderId: dto.targetProviderId,
        everyDays: dto.everyDays,
        runAtTime: dto.runAtTime || "02:00",
        olderThanDays: dto.olderThanDays,
        enabled: dto.enabled ?? true,
        nextRunAt: nextRun,
        createdById: user.id,
      },
    });
  }

  async updateSchedule(
    id: number,
    dto: Partial<CreateScheduleDto>,
    user: RequestUser,
  ) {
    const existing = await this.prisma.main.fileMigrationSchedule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Jadwal tidak ditemukan");

    const everyDays = dto.everyDays ?? existing.everyDays;
    const runAtTime = dto.runAtTime ?? existing.runAtTime;
    let nextRun = existing.nextRunAt;

    if (dto.everyDays || dto.runAtTime || (dto.enabled && !existing.enabled)) {
      nextRun = this.calculateNextRun(everyDays, runAtTime);
    }

    return this.prisma.main.fileMigrationSchedule.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.sourceProviderId ? { sourceProviderId: dto.sourceProviderId } : {}),
        ...(dto.targetProviderId ? { targetProviderId: dto.targetProviderId } : {}),
        ...(dto.everyDays ? { everyDays: dto.everyDays } : {}),
        ...(dto.runAtTime ? { runAtTime: dto.runAtTime } : {}),
        ...(dto.olderThanDays !== undefined ? { olderThanDays: dto.olderThanDays } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        nextRunAt: nextRun,
      },
    });
  }

  async deleteSchedule(id: number) {
    await this.prisma.main.fileMigrationSchedule.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Pemeriksaan berkala untuk jadwal yang jatuh tempo
   */
  private async tick() {
    if (this.isTicking) return;
    this.isTicking = true;

    try {
      const now = new Date();
      const dueSchedules = await this.prisma.main.fileMigrationSchedule.findMany({
        where: {
          enabled: true,
          nextRunAt: { lte: now },
        },
      });

      for (const schedule of dueSchedules) {
        try {
          this.logger.log(`Menjalankan jadwal migrasi otomatis #${schedule.id} (${schedule.name})...`);

          // Update nextRunAt terlebih dahulu agar tidak dieksekusi ganda
          const nextRun = this.calculateNextRun(schedule.everyDays, schedule.runAtTime, new Date());
          await this.prisma.main.fileMigrationSchedule.update({
            where: { id: schedule.id },
            data: {
              lastRunAt: now,
              nextRunAt: nextRun,
            },
          });

          // Jalankan job migrasi
          await this.migrationService.startMigration(
            {
              sourceProviderId: schedule.sourceProviderId,
              targetProviderId: schedule.targetProviderId,
              olderThanDays: schedule.olderThanDays ?? undefined,
              includeOrphans: false, // File lepas tidak dimigrasikan
            },
            undefined,
            "SCHEDULED",
            schedule.id,
          );
        } catch (err) {
          this.logger.error(`Gagal mengeksekusi jadwal migrasi #${schedule.id}: ${(err as Error).message}`);
        }
      }
    } finally {
      this.isTicking = false;
    }
  }
}
