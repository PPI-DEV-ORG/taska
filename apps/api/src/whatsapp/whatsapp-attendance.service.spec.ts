import { describe, expect, it } from "vitest";
import {
  formatAttendanceRecapMessage,
  formatCheckoutReminderMessage,
} from "./whatsapp-attendance.service.js";

describe("whatsapp-attendance formatters", () => {
  it("formats daily attendance recap with present times and absent list", () => {
    const msg = formatAttendanceRecapMessage(
      "2026-11-24",
      [
        {
          name: "Andi",
          role: "SALES",
          checkInTime: "08:45",
          locationStatus: "LUAR_KANTOR_DINAS",
          notes: "Meeting PT ABC (Bapak X)",
          lateMinutes: 0,
        },
        {
          name: "Siti",
          role: "ADMIN",
          checkInTime: "09:10",
          locationStatus: "DI_KANTOR",
          lateMinutes: 10,
        },
      ],
      [
        { name: "Rina", role: "FINANCE", status: "BELUM_ABSEN" },
        { name: "Budi", role: "SE", status: "IZIN" },
      ],
    );

    expect(msg).toContain("*REKAP ABSENSI HARIAN*");
    expect(msg).toContain("*Sudah Hadir (2):*");
    expect(msg).toContain("1. Andi (Sales) — 08:45 WIB · Lapangan | Meeting PT ABC (Bapak X)");
    expect(msg).toContain("2. Siti (Admin) — 09:10 WIB · Kantor | Telat 10m");
    expect(msg).toContain("*Belum Absen (2):*");
    expect(msg).toContain("1. Rina (Finance)");
    expect(msg).toContain("2. Budi (Presales/SE) (IZIN)");
  });

  it("formats checkout reminder message for pending staff", () => {
    const msg = formatCheckoutReminderMessage("2026-11-24", [
      { name: "Deni", role: "TEKNISI", checkInTime: "08:30" },
    ]);
    expect(msg).toContain("*REMINDER TUTUP ABSEN (CHECK-OUT)*");
    expect(msg).toContain("1. Deni (Teknisi) — Masuk 08:30 WIB");

    const allDone = formatCheckoutReminderMessage("2026-11-24", []);
    expect(allDone).toContain("sudah melakukan Check-Out");
  });
});
