import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { UploadService } from "../upload/upload.service.js";
import { DocumentationService } from "../documentation/documentation.service.js";
import { WhatsappReportService } from "./whatsapp-report.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type SessionState =
  | "WAITING_PROJECT" // Menunggu nama customer/project/tempat
  | "WAITING_ACTIVITIES" // Menunggu uraian pekerjaan/list kegiatan
  | "WAITING_RESULT" // Menunggu hasil survey/instalasi
  | "READY_TO_GENERATE";

export type MatchedEntity = {
  type: "survey" | "project" | "delivery-note";
  id: number;
  title: string;
  customerName?: string;
};

export type TechnicianSession = {
  user: RequestUser;
  state: SessionState;
  matchedEntity?: MatchedEntity;
  potentialMatches?: MatchedEntity[];
  photos: Array<{
    fileId: number;
    buffer: Buffer;
    caption?: string;
    originalName: string;
  }>;
  activitiesList: string[];
  findingsOrResult?: string;
  lastActive: number;
};

@Injectable()
export class WhatsappConversationService {
  private readonly logger = new Logger(WhatsappConversationService.name);
  private sessions = new Map<string, TechnicianSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly upload: UploadService,
    private readonly documentation: DocumentationService,
    private readonly reportService: WhatsappReportService,
  ) {}

  async handleIncomingMessage(params: {
    senderJid: string;
    senderName: string;
    text: string;
    mediaBuffer: Buffer | null;
    mimeType: string | null;
    isImage: boolean;
    reply: (msg: string) => Promise<void>;
    sendPdf: (buffer: Buffer, fileName: string, caption?: string) => Promise<void>;
  }) {
    const rawPhone = params.senderJid.split("@")[0] || "";
    const cleanPhone = this.normalizePhone(rawPhone);

    const user = await this.findUserByPhone(cleanPhone);
    if (!user) {
      await params.reply(
        `Halo ${params.senderName}! Nomor WhatsApp Anda (+${rawPhone}) belum terdaftar pada sistem Taska ERP.\n\nSilakan hubungi Super Admin untuk memperbarui nomor HP Anda di profil teknisi.`,
      );
      return;
    }

    let session = this.sessions.get(params.senderJid);
    const now = Date.now();
    // Reset session jika idle lebih dari 4 jam
    if (session && now - session.lastActive > 4 * 60 * 60 * 1000) {
      this.sessions.delete(params.senderJid);
      session = undefined;
    }

    if (!session) {
      session = {
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
        },
        state: "WAITING_PROJECT",
        photos: [],
        activitiesList: [],
        lastActive: now,
      };
      this.sessions.set(params.senderJid, session);
    } else {
      session.lastActive = now;
    }

    // 1. Terima Foto (Media)
    if (params.isImage && params.mediaBuffer) {
      const fileName = `wa-doc-${Date.now()}-${session.photos.length + 1}.jpg`;
      const savedFile = await this.upload.saveNamed(
        params.mediaBuffer,
        "foto",
        fileName,
        session.user,
      );

      session.photos.push({
        fileId: savedFile.id,
        buffer: params.mediaBuffer,
        caption: params.text || undefined,
        originalName: fileName,
      });

      if (params.text) {
        session.activitiesList.push(params.text);
      }

      await params.reply(
        `📸 Foto ke-${session.photos.length} berhasil diterima!${
          params.text ? `\nCatatan: "${params.text}"` : ""
        }\n\nKirim foto lainnya jika masih ada, atau balas dengan nama tempat/customer (contoh: "PT Watson", "Pak Budi", etc) untuk melanjutkan.`,
      );
      return;
    }

    const trimmed = params.text.trim();
    if (!trimmed) return;

    // Perintah batal/reset
    if (["batal", "reset", "cancel"].includes(trimmed.toLowerCase())) {
      this.sessions.delete(params.senderJid);
      await params.reply("🔄 Sesi laporan dibatalkan. Anda dapat memulai kirim foto baru kapan saja.");
      return;
    }

    // Perintah bantuan/status
    if (["bantuan", "help", "status"].includes(trimmed.toLowerCase())) {
      await params.reply(
        `📋 *Status Sesi Laporan Anda:*\n` +
          `• Foto terkumpul: ${session.photos.length} foto\n` +
          `• Target pekerjaan: ${session.matchedEntity ? session.matchedEntity.title : "Belum dipilih"}\n` +
          `• Status: ${session.state}\n\n` +
          `Ketik *BATAL* untuk mengulang sesi dari awal.`,
      );
      return;
    }

    // 2. Pemilihan Angka jika ada pilihan ambigu
    if (session.potentialMatches && session.potentialMatches.length > 0 && /^[1-9]$/.test(trimmed)) {
      const idx = Number(trimmed) - 1;
      if (idx >= 0 && idx < session.potentialMatches.length) {
        session.matchedEntity = session.potentialMatches[idx];
        session.potentialMatches = undefined;
        session.state = session.activitiesList.length > 0 ? "WAITING_RESULT" : "WAITING_ACTIVITIES";

        if (session.state === "WAITING_ACTIVITIES") {
          await params.reply(
            `✅ Terpilih: *${session.matchedEntity.title}*\n\nSilakan tuliskan list pekerjaan yang dilakukan (contoh:\n1. Pemasangan bracket\n2. Penarikan kabel LAN 20m\n3. Setting DVR):`,
          );
        } else {
          await params.reply(
            `✅ Terpilih: *${session.matchedEntity.title}*\n\nBagaimana hasil survey / instalasinya? (contoh: "Instalasi sukses berjalan lancar", atau "Sukses, tapi kabel kurang 5m"):`,
          );
        }
        return;
      }
    }

    // 3. Jika belum punya Target Project/Survey, coba cari kecocokan tempat
    if (!session.matchedEntity) {
      const matches = await this.fuzzyMatchEntities(trimmed, session.user.id);
      if (matches.length === 1) {
        session.matchedEntity = matches[0];
        session.state = session.activitiesList.length > 0 ? "WAITING_RESULT" : "WAITING_ACTIVITIES";

        if (session.state === "WAITING_ACTIVITIES") {
          await params.reply(
            `✅ Ditemukan pekerjaan: *${matches[0].title}*\n\nSilakan tuliskan daftar kegiatan pekerjaan yang dilakukan (contoh:\n1. Pemasangan pipa\n2. Tarik kabel):`,
          );
        } else {
          await params.reply(
            `✅ Ditemukan pekerjaan: *${matches[0].title}*\n\nBagaimana hasil survey / instalasinya? (contoh: "Instalasi selesai dan kamera online semua"):`,
          );
        }
        return;
      } else if (matches.length > 1) {
        session.potentialMatches = matches.slice(0, 5);
        const optionsText = session.potentialMatches
          .map((m, i) => `${i + 1}. [${m.type.toUpperCase()}] ${m.title}`)
          .join("\n");
        await params.reply(
          `🔍 Ditemukan beberapa pekerjaan yang cocok dengan "${trimmed}":\n\n${optionsText}\n\nBalas dengan nomor pilihan (1-${session.potentialMatches.length}):`,
        );
        return;
      } else {
        // Belum cocok spesifik, jika sudah ada foto, tetap simpan sebagai teks kegiatan sementara
        if (session.photos.length > 0 && session.activitiesList.length === 0) {
          session.activitiesList.push(trimmed);
        }
        await params.reply(
          `❓ Belum menemukan project/survey/surat jalan untuk "${trimmed}".\n\nSilakan sebutkan nama perusahaan/customer, nama project, atau lokasi kunjungan:`,
        );
        return;
      }
    }

    // 4. Input Kegiatan/Aktivitas
    if (session.state === "WAITING_ACTIVITIES") {
      const lines = trimmed
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      session.activitiesList.push(...lines);
      session.state = "WAITING_RESULT";
      await params.reply(
        `👍 Rincian pekerjaan tersimpan!\n\nSekarang, bagaimana *hasil akhir survey / instalasi* atau kendala di lapangan?`,
      );
      return;
    }

    // 5. Input Hasil Akhir & Finalisasi Dokumen
    if (session.state === "WAITING_RESULT" || session.state === "READY_TO_GENERATE") {
      session.findingsOrResult = trimmed;
      await params.reply("⏳ Sedang memproses dan menyusun laporan PDF resmi, mohon tunggu...");

      try {
        // Attach foto ke modul dokumentasi ERP
        for (const photo of session.photos) {
          await this.documentation.attach(
            session.matchedEntity.type,
            session.matchedEntity.id,
            photo.fileId,
            photo.caption,
            session.user,
          );
        }

        // Render PDF Laporan Resmi
        const { buffer, fileName } = await this.reportService.generatePdfReport({
          entity: session.matchedEntity,
          user: session.user,
          activities: session.activitiesList,
          resultNotes: session.findingsOrResult,
          photos: session.photos,
        });

        // Simpan file PDF ke sistem ERP
        await this.upload.saveNamed(
          buffer,
          "dokumen",
          fileName,
          session.user,
        );

        // Kirim kembali PDF ke WhatsApp Teknisi
        await params.sendPdf(
          buffer,
          fileName,
          `📄 *Laporan Resmi Selesai!*\n\n` +
            `Pekerjaan: ${session.matchedEntity.title}\n` +
            `Total Foto: ${session.photos.length}\n` +
            `Petugas: ${session.user.name}\n\n` +
            `Laporan ini telah otomatis tersimpan di sistem Taska ERP. Terima kasih!`,
        );

        // Hapus sesi setelah sukses
        this.sessions.delete(params.senderJid);
      } catch (err: any) {
        this.logger.error("Gagal menyusun dan mengirim laporan PDF", err);
        await params.reply(
          `⚠️ Gagal merender file laporan: ${err?.message || "Terjadi kesalahan"}. Foto Anda tetap aman tersimpan di sistem.`,
        );
      }
    }
  }

  private normalizePhone(phone: string): string {
    let p = phone.replace(/\D/g, "");
    if (p.startsWith("0")) {
      p = "62" + p.slice(1);
    } else if (p.startsWith("8")) {
      p = "62" + p;
    }
    return p;
  }

  private async findUserByPhone(cleanPhone: string) {
    if (!cleanPhone) return null;
    const users = await this.prisma.main.user.findMany({
      where: {
        phone: { not: null },
        status: "AKTIF",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    return (
      users.find((u) => {
        if (!u.phone) return false;
        const up = this.normalizePhone(u.phone);
        return up === cleanPhone || up.endsWith(cleanPhone) || cleanPhone.endsWith(up);
      }) || null
    );
  }

  private async fuzzyMatchEntities(keyword: string, _userId: number): Promise<MatchedEntity[]> {
    const q = keyword.trim().toLowerCase();
    const results: MatchedEntity[] = [];

    // 1. Cari Survey
    const surveys = await this.prisma.main.survey.findMany({
      where: {
        OR: [
          { lead: { name: { contains: q } } },
          { lead: { customer: { name: { contains: q } } } },
          { location: { contains: q } },
        ],
      },
      include: {
        lead: {
          select: { name: true, customer: { select: { name: true } } },
        },
      },
      take: 5,
    });
    for (const s of surveys) {
      results.push({
        type: "survey",
        id: s.id,
        title: `Survey #${s.id} - ${s.lead.name} (${s.lead.customer?.name ?? s.location})`,
        customerName: s.lead.customer?.name,
      });
    }

    // 2. Cari Project
    const projects = await this.prisma.main.project.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { customer: { name: { contains: q } } },
          { location: { contains: q } },
        ],
      },
      include: {
        customer: { select: { name: true } },
      },
      take: 5,
    });
    for (const p of projects) {
      results.push({
        type: "project",
        id: p.id,
        title: `Project #${p.id} - ${p.name} (${p.customer?.name ?? "-"})`,
        customerName: p.customer?.name,
      });
    }

    // 3. Cari Surat Jalan
    const deliveryNotes = await this.prisma.main.deliveryNote.findMany({
      where: {
        OR: [
          { number: { contains: q } },
          { locations: { some: { destination: { contains: q } } } },
        ],
      },
      take: 5,
    });
    for (const d of deliveryNotes) {
      results.push({
        type: "delivery-note",
        id: d.id,
        title: `Surat Jalan ${d.number}`,
      });
    }

    return results;
  }
}

