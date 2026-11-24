import { describe, expect, it } from "vitest";
import {
  formatEventReminderMessage,
  formatEventUpdateMessage,
  formatIndoPeriod,
  formatRecapMessage,
  nextWeekRangeYmd,
  normalizePhoneToWaJid,
  type WaAgendaEntry,
} from "./whatsapp-schedule.service.js";

describe("whatsapp-schedule formatters & helpers", () => {
  it("computes next week Monday-Sunday correctly from Saturday", () => {
    // 2026-11-28 is Saturday -> next week is Mon 2026-11-30 to Sun 2026-12-06
    expect(nextWeekRangeYmd("2026-11-28")).toEqual({
      fromYmd: "2026-11-30",
      toYmd: "2026-12-06",
    });
    // 2026-11-29 is Sunday -> next week is Mon 2026-11-30 to Sun 2026-12-06
    expect(nextWeekRangeYmd("2026-11-29")).toEqual({
      fromYmd: "2026-11-30",
      toYmd: "2026-12-06",
    });
  });

  it("formats cross-month period label cleanly", () => {
    expect(formatIndoPeriod("2026-11-30", "2026-12-06")).toBe("30 November – 6 Desember 2026");
    expect(formatIndoPeriod("2026-11-02", "2026-11-08")).toBe("2 – 8 November 2026");
  });

  it("formats weekly recap matching PRD structure", () => {
    const entries: WaAgendaEntry[] = [
      {
        sourceModule: "calendar",
        sourceId: 1,
        category: "MEETING",
        title: "Meeting Presentasi Produk",
        startDate: new Date("2026-11-30T02:00:00.000Z"), // 09:00 WIB
        endDate: new Date("2026-11-30T04:00:00.000Z"),   // 11:00 WIB
        isAllDay: false,
        pics: ["Andi (Sales)", "Budi (Presales/SE)"],
        companyName: "PT ABC",
        contactPerson: "Bapak X",
        location: "Jakarta Selatan",
        notes: "Bawa demo kit",
      },
    ];
    const msg = formatRecapMessage(
      "AGENDA KEGIATAN MINGGU DEPAN",
      formatIndoPeriod("2026-11-30", "2026-12-06"),
      entries,
    );
    expect(msg).toContain("*AGENDA KEGIATAN MINGGU DEPAN*");
    expect(msg).toContain("Periode: 30 November – 6 Desember 2026");
    expect(msg).toContain("1. *Senin, 30 November*");
    expect(msg).toContain("Waktu: 09:00 – 11:00 WIB");
    expect(msg).toContain("Agenda: Meeting Presentasi Produk");
    expect(msg).toContain("PIC: Andi (Sales), Budi (Presales/SE)");
    expect(msg).toContain("Perusahaan: PT ABC");
    expect(msg).toContain("Contact Person: Bapak X");
    expect(msg).toContain("Lokasi: Jakarta Selatan");
  });

  it("formats schedule update and reminder messages", () => {
    const entry: WaAgendaEntry = {
      sourceModule: "calendar",
      sourceId: 2,
      category: "SURVEY",
      title: "Survey Lokasi CCTV",
      startDate: new Date("2026-12-01T03:00:00.000Z"), // 10:00 WIB
      endDate: null,
      isAllDay: false,
      pics: ["Deni (Teknisi)"],
      companyName: "PT XYZ",
      contactPerson: "Ibu Y",
      location: "Bekasi",
      notes: null,
    };
    const upd = formatEventUpdateMessage("UPDATED", entry, "Admin");
    expect(upd).toContain("*PERUBAHAN JADWAL KEGIATAN*");
    expect(upd).toContain("Diperbarui oleh: Admin");

    const rem = formatEventReminderMessage(entry, 60);
    expect(rem).toContain("*PENGINGAT JADWAL KEGIATAN* (1 jam lagi)");
    expect(rem).toContain("Lokasi: Bekasi");
  });

  it("normalizes personal Indonesian phone numbers to WhatsApp JID", () => {
    expect(normalizePhoneToWaJid("0812-3456-7890")).toBe("6281234567890@s.whatsapp.net");
    expect(normalizePhoneToWaJid("+62 812 3456 7890")).toBe("6281234567890@s.whatsapp.net");
    expect(normalizePhoneToWaJid("81234567890")).toBe("6281234567890@s.whatsapp.net");
    expect(normalizePhoneToWaJid("1203630001@g.us")).toBe("1203630001@g.us");
    expect(normalizePhoneToWaJid("123")).toBeNull();
  });
});
