import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { WhatsappService } from "./whatsapp.service.js";
import { WhatsappScheduleService, type WaScheduleNotificationSettings } from "./whatsapp-schedule.service.js";
import { WhatsappAttendanceService, type WaAttendanceNotificationSettings } from "./whatsapp-attendance.service.js";
import { Require } from "../common/decorators/require-permission.decorator.js";

@Controller("whatsapp")
export class WhatsappController {
  constructor(
    private readonly service: WhatsappService,
    private readonly scheduleService: WhatsappScheduleService,
    private readonly attendanceService: WhatsappAttendanceService,
  ) {}

  @Get("status")
  @Require("settings", "L")
  getStatus() {
    return this.service.getStatus();
  }

  @Get("qr")
  @Require("settings", "L")
  async getQr() {
    const qr = await this.service.getQrDataUrl();
    return { qr };
  }

  @Post("restart")
  @Require("settings", "U")
  restart() {
    return this.service.restart();
  }

  @Post("logout")
  @Require("settings", "U")
  logout() {
    return this.service.logout();
  }

  /**
   * Daftar grup WhatsApp yang diikuti bot.
   * Terbuka untuk semua user login agar form Kalender juga bisa memilih grup WA pengingat.
   */
  @Get("groups")
  async listGroups() {
    const connected = this.service.isConnected();
    const groups = connected ? await this.service.listGroups() : [];
    return { connected, groups };
  }

  /**
   * Pengaturan notifikasi grup jadwal (bisa dibaca user login untuk info grup default di Kalender).
   */
  @Get("schedule-notification/settings")
  getScheduleSettings() {
    return this.scheduleService.getSettings();
  }

  @Patch("schedule-notification/settings")
  @Require("settings", "U")
  saveScheduleSettings(@Body() body: Partial<WaScheduleNotificationSettings>) {
    return this.scheduleService.saveSettings(body);
  }

  @Post("schedule-notification/send-now")
  @Require("settings", "U")
  sendScheduleNow(@Body() body: { type?: "TEST" | "DAILY" | "WEEKLY"; groupJid?: string }) {
    const type = body?.type === "DAILY" || body?.type === "WEEKLY" ? body.type : "TEST";
    return this.scheduleService.sendManual(type, body?.groupJid);
  }

  /** Kirim 1 agenda kalender ke grup WA secara manual dari Detail Agenda. */
  @Post("schedule-notification/event/:id")
  sendEventNow(
    @Param("id", ParseIntPipe) id: number,
    @Body() body?: { groupJid?: string },
  ) {
    return this.scheduleService.sendSingleEventNow(id, body?.groupJid);
  }

  /** Pengaturan notifikasi rekap & reminder absensi ke grup WA. */
  @Get("attendance-notification/settings")
  @Require("settings", "L")
  getAttendanceSettings() {
    return this.attendanceService.getSettings();
  }

  @Patch("attendance-notification/settings")
  @Require("settings", "U")
  saveAttendanceSettings(@Body() body: Partial<WaAttendanceNotificationSettings>) {
    return this.attendanceService.saveSettings(body);
  }

  @Post("attendance-notification/send-now")
  @Require("settings", "U")
  sendAttendanceNow(
    @Body() body: { type?: "RECAP" | "CHECKOUT_REMINDER" | "TEST"; groupJid?: string },
  ) {
    const type =
      body?.type === "RECAP" || body?.type === "CHECKOUT_REMINDER" ? body.type : "TEST";
    return this.attendanceService.sendManual(type, body?.groupJid);
  }
}
