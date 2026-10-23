import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { UploadService } from "../upload/upload.service.js";
import { DocumentationService } from "../documentation/documentation.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentNumberService } from "../document-number/document-number.service.js";
import { WhatsappReportService } from "./whatsapp-report.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

export type ReportKind = "survey" | "project" | "delivery-note";

export type SessionState =
  | "IDLE"
  | "WAITING_TARGET" // Menunggu pilihan nomor atau nama Lead/Project/Surat Jalan
  | "WAITING_LOCATION" // Menunggu lokasi jika buat data Survey / Surat Jalan baru
  | "WAITING_DESCRIPTION" // Menunggu deskripsi/hasil laporan jika belum dikirim
  | "WAITING_PHOTOS"; // Menunggu foto jika user kirim teks duluan

export type MatchedEntity = {
  type: ReportKind;
  id: number; // ID survey, project, atau deliveryNote (0 jika belum ada survey tapi sudah ada leadId)
  leadId?: number;
  projectId?: number;
  title: string;
  customerName?: string;
  location?: string;
  need?: string;
  isNewSurveyForLead?: boolean;
  isBrandNewLeadAndSurvey?: boolean;
  newTargetName?: string;
};

export type SessionPhoto = {
  fileId: number;
  buffer: Buffer;
  mimeType: string;
  caption?: string;
  originalName: string;
  receivedAt: number;
};

export type TechnicianSession = {
  user: RequestUser;
  state: SessionState;
  reportKind?: ReportKind;
  matchedEntity?: MatchedEntity;
  potentialMatches?: MatchedEntity[];
  photos: SessionPhoto[];
  pendingCaptions: string[];
  activitiesList: string[];
  description?: string;
  location?: string;
  pendingTargetName?: string;
  lastActive: number;
  lastPhotoAt: number;
  replyFn?: (msg: string) => Promise<void>;
  sendPdfFn?: (buffer: Buffer, fileName: string, caption?: string) => Promise<void>;
};

const STOPWORDS = new Set([
  "laporan",
  "hasil",
  "survey",
  "survei",
  "instalasi",
  "pemasangan",
  "pasang",
  "proyek",
  "project",
  "surat",
  "jalan",
  "sj",
  "pengiriman",
  "kirim",
  "antar",
  "barang",
  "untuk",
  "pada",
  "ke",
  "di",
  "dari",
  "dan",
  "yang",
  "dengan",
  "foto",
  "pt",
  "cv",
  "tbk",
  "ud",
  "pak",
  "bu",
  "bapak",
  "ibu",
]);

@Injectable()
export class WhatsappConversationService {
  private readonly logger = new Logger(WhatsappConversationService.name);
  private sessions = new Map<string, TechnicianSession>();
  private photoTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly upload: UploadService,
    private readonly documentation: DocumentationService,
    private readonly reportService: WhatsappReportService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly docnum: DocumentNumberService,
  ) {}

  async handleIncomingMessage(params: {
    senderJid: string;
    senderPhoneJid?: string;
    senderName: string;
    text: string;
    mediaBuffer: Buffer | null;
    mimeType: string | null;
    isImage: boolean;
    reply: (msg: string) => Promise<void>;
    sendPdf: (buffer: Buffer, fileName: string, caption?: string) => Promise<void>;
  }) {
    const rawPhone = (params.senderPhoneJid || params.senderJid).split("@")[0]?.split(":")[0] || "";
    const cleanPhone = this.normalizePhone(rawPhone);

    const user = await this.findOrResolveUser(cleanPhone, params.senderName);
    if (!user) {
      await params.reply(
        `Halo ${params.senderName}! Belum ada akun aktif pada sistem Taska ERP. Silakan hubungi Admin.`,
      );
      return;
    }

    let session = this.sessions.get(params.senderJid);
    const now = Date.now();

    // Reset session jika tidak aktif lebih dari 2 jam
    if (session && now - session.lastActive > 2 * 60 * 60 * 1000) {
      this.clearPhotoTimer(params.senderJid);
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
        state: "IDLE",
        photos: [],
        pendingCaptions: [],
        activitiesList: [],
        lastActive: now,
        lastPhotoAt: 0,
        replyFn: params.reply,
        sendPdfFn: params.sendPdf,
      };
      this.sessions.set(params.senderJid, session);
    } else {
      session.lastActive = now;
      session.replyFn = params.reply;
      session.sendPdfFn = params.sendPdf;
    }

    // ─── 1. Jika Pesan Berisi Gambar / Foto Baru ───
    if (params.isImage && params.mediaBuffer) {
      // Pastikan HANYA mengambil foto dari pengiriman yang baru saja dikirim:
      // Jika sebelumnya state masih IDLE dan foto terakhir sudah lewat > 10 menit, bersihkan foto lama
      if (
        session.state === "IDLE" &&
        session.photos.length > 0 &&
        now - session.lastPhotoAt > 10 * 60 * 1000
      ) {
        session.photos = [];
        session.pendingCaptions = [];
        session.activitiesList = [];
      }

      const ext = params.mimeType === "image/png" ? "png" : "jpg";
      const fileName = `wa-doc-${now}-${session.photos.length + 1}.${ext}`;
      const savedFile = await this.upload.saveNamed(
        params.mediaBuffer,
        "foto",
        fileName,
        session.user,
      );

      const rawCaption = params.text.trim();
      // Jika caption panjang (berisi kalimat laporan lengkap), jangan duplikasi seluruh kalimat panjang di bawah tiap foto jika merupakan deskripsi utama
      const shortCaption =
        rawCaption && rawCaption.length <= 75 && !this.looksLikeFullReportCommand(rawCaption)
          ? rawCaption
          : undefined;

      session.photos.push({
        fileId: savedFile.id,
        buffer: params.mediaBuffer,
        mimeType: params.mimeType || "image/jpeg",
        caption: shortCaption,
        originalName: fileName,
        receivedAt: now,
      });
      session.lastPhotoAt = now;

      if (rawCaption) {
        session.pendingCaptions.push(rawCaption);
      }

      // Gunakan debounce 1.8 detik agar pengiriman album (misal 4 foto sekaligus) terkumpul semua dulu
      this.schedulePhotoBatchProcessing(params.senderJid);
      return;
    }

    // ─── 2. Jika Pesan Teks Biasa ───
    // Jika user langsung mengirim teks tepat setelah mengirim album foto, batalkan timer tunggu album & proses sekaligus
    if (this.photoTimers.has(params.senderJid)) {
      this.clearPhotoTimer(params.senderJid);
    }

    const trimmed = params.text.trim();
    if (!trimmed) return;

    await this.processTextInput(params.senderJid, session, trimmed);
  }

  private clearPhotoTimer(senderJid: string) {
    const t = this.photoTimers.get(senderJid);
    if (t) {
      clearTimeout(t);
      this.photoTimers.delete(senderJid);
    }
  }

  private schedulePhotoBatchProcessing(senderJid: string) {
    this.clearPhotoTimer(senderJid);
    const timer = setTimeout(() => {
      this.photoTimers.delete(senderJid);
      const session = this.sessions.get(senderJid);
      if (!session) return;
      void this.onPhotoBatchReady(senderJid, session);
    }, 1800);
    this.photoTimers.set(senderJid, timer);
  }

  private async onPhotoBatchReady(senderJid: string, session: TechnicianSession) {
    try {
      const combinedCaptions = session.pendingCaptions.join("\n").trim();
      session.pendingCaptions = [];

      // Jika di dalam foto/album sudah disertakan caption laporan (misal: "Laporan Survey CCTV PT Telkom, Tempat pemasangan bagus...")
      if (combinedCaptions) {
        await this.processTextInput(senderJid, session, combinedCaptions);
        return;
      }

      // Jika sebelumnya user sudah mengisi data laporan & tinggal menunggu foto dikirim
      if (session.state === "WAITING_PHOTOS" && session.matchedEntity && session.description) {
        await this.checkCompletenessAndFinalize(senderJid, session);
        return;
      }

      // Jika user baru mengirim foto tanpa caption
      const count = session.photos.length;
      const suggestions = await this.getQuickSuggestions(session.user.id, session.reportKind);
      if (suggestions.length > 0 && session.state === "IDLE") {
        session.potentialMatches = suggestions;
        session.state = "WAITING_TARGET";
        const listStr = suggestions
          .map((m, i) => `${i + 1}. [${this.kindLabel(m.type)}] ${m.title}`)
          .join("\n");
        await session.replyFn?.(
          `📸 *${count} foto berhasil diterima!*\n\n` +
            `Silakan kirim deskripsi laporan Anda, contoh:\n` +
            `*"Laporan Survey CCTV PT Telkom, tempat pemasangan bagus, perlu kabel lebih panjang"*\n\n` +
            `Atau pilih nomor pekerjaan aktif di bawah ini:\n${listStr}\n` +
            `0. Buat Laporan Survey / Pekerjaan Baru`,
        );
      } else {
        await session.replyFn?.(
          `📸 *${count} foto berhasil diterima!*\n\n` +
            `Silakan kirim keterangan laporan Anda (Contoh: *"Laporan Survey CCTV PT Telkom, tempat pemasangan bagus, perlu kabel lebih panjang"*).`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Error onPhotoBatchReady: ${err?.message}`, err?.stack);
    }
  }

  private async processTextInput(senderJid: string, session: TechnicianSession, rawText: string) {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    // ─── Perintah Batal / Reset ───
    if (["batal", "reset", "cancel", "/reset", "/batal"].includes(trimmed.toLowerCase())) {
      this.clearPhotoTimer(senderJid);
      this.sessions.delete(senderJid);
      await session.replyFn?.(
        "🔄 Sesi laporan telah di-reset. Silakan kirim foto baru beserta keterangan laporan Anda.",
      );
      return;
    }

    // ─── Perintah Bantuan / Status ───
    if (["bantuan", "help", "status", "menu", "/help", "halo", "hi", "ping"].includes(trimmed.toLowerCase()) && session.photos.length === 0) {
      await session.replyFn?.(
        `🤖 *Bot WhatsApp Taska ERP*\n\n` +
          `Anda dapat mengirim laporan *Survey*, *Instalasi Project*, atau *Surat Jalan* langsung lewat chat ini:\n\n` +
          `1️⃣ Kirim 1 atau beberapa foto dokumentasi lapangan\n` +
          `2️⃣ Sertakan caption atau balas dengan pesan seperti:\n` +
          `   • *"Laporan Survey CCTV PT Telkom, tempat pemasangan bagus, perlu kabel lebih panjang"*\n` +
          `   • *"Laporan Instalasi PT Telkom, pemasangan 8 kamera selesai dan normal"*\n` +
          `   • *"Laporan Surat Jalan PT Telkom, barang sudah diterima Pak Budi lengkap"*\n\n` +
          `Bot akan otomatis mencocokkan data, mengupdate/membuat data di ERP, menyusun PDF laporan resmi, dan mengirimkan file PDF-nya kepada Anda.\n\n` +
          `Ketik *BATAL* kapan saja untuk mengulang dari awal.`,
      );
      return;
    }

    // Jika sedang menunggu foto dan user mengetik "lanjut" / "tanpa foto"
    if (
      session.state === "WAITING_PHOTOS" &&
      ["lanjut", "skip", "tanpa foto", "buat pdf", "cetak"].includes(trimmed.toLowerCase())
    ) {
      await this.checkCompletenessAndFinalize(senderJid, session);
      return;
    }

    // ─── State: WAITING_LOCATION (Saat membuat Survey / Surat Jalan baru yang belum punya lokasi) ───
    if (session.state === "WAITING_LOCATION" && session.matchedEntity) {
      session.location = trimmed;
      session.matchedEntity.location = trimmed;
      await this.checkCompletenessAndFinalize(senderJid, session);
      return;
    }

    // ─── State: WAITING_DESCRIPTION (Saat Target sudah terpilih tapi hasil/deskripsi laporan belum ada) ───
    if (session.state === "WAITING_DESCRIPTION" && session.matchedEntity) {
      session.description = trimmed;
      session.activitiesList.push(
        ...trimmed
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      );
      await this.checkCompletenessAndFinalize(senderJid, session);
      return;
    }

    // ─── Pemilihan Nomor dari Daftar Pilihan (0, 1, 2, ...) ───
    if (
      session.potentialMatches &&
      session.potentialMatches.length > 0 &&
      /^\d{1,2}$/.test(trimmed)
    ) {
      const num = Number(trimmed);
      if (num === 0) {
        // User memilih 0 -> Buat Data Baru
        session.potentialMatches = undefined;
        const targetName = session.pendingTargetName || "";
        if (targetName) {
          session.matchedEntity = {
            type: session.reportKind || "survey",
            id: 0,
            title: `${this.kindLabel(session.reportKind || "survey")} — ${targetName}`,
            customerName: targetName,
            newTargetName: targetName,
            isBrandNewLeadAndSurvey: (session.reportKind || "survey") === "survey",
          };
          await this.checkCompletenessAndFinalize(senderJid, session);
        } else {
          session.state = "WAITING_TARGET";
          await session.replyFn?.(
            `📝 Silakan ketik *nama Lead / Customer / Project* beserta lokasinya (Contoh: *"Survey CCTV PT Telkom, lokasi Jl. Sudirman No. 10"*):`,
          );
        }
        return;
      }

      const idx = num - 1;
      if (idx >= 0 && idx < session.potentialMatches.length) {
        const chosen = session.potentialMatches[idx]!;
        session.matchedEntity = chosen;
        session.reportKind = chosen.type;
        session.potentialMatches = undefined;
        await this.checkCompletenessAndFinalize(senderJid, session);
        return;
      }
    }

    // ─── Jika User sudah memilih Target namun mengirim kalimat tambahan ───
    if (session.matchedEntity && !session.description) {
      session.description = trimmed;
      session.activitiesList.push(
        ...trimmed
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      );
      await this.checkCompletenessAndFinalize(senderJid, session);
      return;
    }

    // ─── Parsing Pesan Natural (Contoh: "[4 foto] Laporan Survey CCTV PT Telkom , Tempat Pemasang Bagaus, kemungkina perlu kabel yang lebih panjang") ───
    const parsed = this.parseNaturalReportMessage(trimmed);
    if (parsed.kind) {
      session.reportKind = parsed.kind;
    }
    if (parsed.location && !session.location) {
      session.location = parsed.location;
    }
    if (parsed.description) {
      session.description = session.description
        ? `${session.description}\n${parsed.description}`
        : parsed.description;
      const lines = parsed.description
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      for (const l of lines) {
        if (!session.activitiesList.includes(l)) session.activitiesList.push(l);
      }
    }

    const searchQuery = parsed.targetQuery || trimmed;
    const matchRes = await this.smartFindEntities(searchQuery, trimmed, session.reportKind);

    // Jika waktu pencocokan natural (tanpa koma) ditemukan sisa teks setelah nama entitas sebagai deskripsi
    if (!session.description && matchRes.extractedDescription) {
      session.description = matchRes.extractedDescription;
      session.activitiesList.push(matchRes.extractedDescription);
    }

    if (matchRes.matches.length === 1) {
      session.matchedEntity = matchRes.matches[0]!;
      session.reportKind = session.matchedEntity.type;
      session.potentialMatches = undefined;
      await this.checkCompletenessAndFinalize(senderJid, session);
      return;
    }

    if (matchRes.matches.length > 1) {
      // Cek apakah match pertama memiliki skor jauh lebih spesifik atau apakah ada beberapa kandidat
      session.potentialMatches = matchRes.matches.slice(0, 6);
      session.pendingTargetName = parsed.targetQuery || undefined;
      session.state = "WAITING_TARGET";
      const optionsText = session.potentialMatches
        .map((m, i) => `${i + 1}. [${this.kindLabel(m.type)}] ${m.title}`)
        .join("\n");
      await session.replyFn?.(
        `🔍 Ditemukan beberapa data yang cocok dengan *"${parsed.targetQuery || trimmed}"*:\n\n` +
          `${optionsText}\n` +
          `0. Buat Data ${this.kindLabel(session.reportKind || "survey")} Baru untuk "${parsed.targetQuery || trimmed}"\n\n` +
          `Balas dengan *nomor pilihan (0-${session.potentialMatches.length})*:`,
      );
      return;
    }

    // ─── Jika Tidak Ditemukan di Database ───
    // Jika jenis laporan adalah Survey (atau default) dan user sudah menyebutkan nama target (mis. "CCTV PT Telkom"):
    if ((session.reportKind === "survey" || !session.reportKind) && parsed.targetQuery && parsed.targetQuery.length >= 3) {
      session.pendingTargetName = parsed.targetQuery;
      const activeSuggestions = await this.getQuickSuggestions(session.user.id, "survey");
      if (activeSuggestions.length > 0 && session.state === "IDLE") {
        session.potentialMatches = activeSuggestions;
        session.state = "WAITING_TARGET";
        const optionsText = activeSuggestions
          .map((m, i) => `${i + 1}. [${this.kindLabel(m.type)}] ${m.title}`)
          .join("\n");
        await session.replyFn?.(
          `ℹ️ Belum ditemukan Lead/Survey dengan nama *"${parsed.targetQuery}"*.\n\n` +
            `• Balas *0* untuk membuat *Data Survey & Lead Baru* atas nama *"${parsed.targetQuery}"*\n` +
            `• Atau pilih nomor jika maksud Anda salah satu pekerjaan aktif berikut:\n${optionsText}`,
        );
        return;
      }

      // Jika tidak ada suggestion lain atau user memang sedang menginput nama target baru -> langsung siapkan pembuatan Survey baru
      session.matchedEntity = {
        type: "survey",
        id: 0,
        title: `Survey — ${parsed.targetQuery}`,
        customerName: parsed.targetQuery,
        newTargetName: parsed.targetQuery,
        location: session.location,
        isBrandNewLeadAndSurvey: true,
      };
      await this.checkCompletenessAndFinalize(senderJid, session);
      return;
    }

    // Jika Surat Jalan baru dan belum ada di DB
    if (session.reportKind === "delivery-note" && parsed.targetQuery) {
      session.matchedEntity = {
        type: "delivery-note",
        id: 0,
        title: `Surat Jalan — ${parsed.targetQuery}`,
        customerName: parsed.targetQuery,
        newTargetName: parsed.targetQuery,
        location: session.location || parsed.targetQuery,
      };
      await this.checkCompletenessAndFinalize(senderJid, session);
      return;
    }

    // Jika belum jelas targetnya, tampilkan daftar aktif agar user tinggal balas nomor atau namanya
    const suggestions = await this.getQuickSuggestions(session.user.id, session.reportKind);
    session.potentialMatches = suggestions;
    session.state = "WAITING_TARGET";
    const listText =
      suggestions.length > 0
        ? `\n\nDaftar pekerjaan aktif:\n` +
          suggestions.map((m, i) => `${i + 1}. [${this.kindLabel(m.type)}] ${m.title}`).join("\n") +
          `\n\nBalas dengan *nomor pilihan (1-${suggestions.length})* atau ketik langsung nama Lead/Customer/Project:`
        : `\n\nSilakan balas dengan *nama Lead / Customer / Project* serta lokasi (contoh: *"Survey CCTV PT Telkom, Tempat pemasangan bagus"*):`;

    await session.replyFn?.(
      `❓ Mohon sebutkan laporan ini terkait dengan *Lead / Project / Surat Jalan* mana.${listText}`,
    );
  }

  /**
   * Cek apakah seluruh data yang dibutuhkan sudah lengkap:
   * - Jika Survey SUDAH ADA di database (`entity.id > 0`), TIDAK PERLU tanya lokasi/kebutuhan lagi karena data sudah lengkap di DB!
   *   Hanya pastikan ada deskripsi/hasil laporan, lalu langsung buat PDF + update Survey + kirim PDF ke user.
   * - Jika harus BUAT SURVEY BARU (`entity.id === 0`), cek apakah `location` dan `description` sudah ada.
   *   Kalau belum ada, tanyakan ke user terlebih dahulu.
   */
  private async checkCompletenessAndFinalize(senderJid: string, session: TechnicianSession) {
    const entity = session.matchedEntity;
    if (!entity) return;

    // 1. Jika harus buat Survey baru (belum ada Survey di Lead tersebut, atau Lead baru), pastikan lokasi sudah diketahui
    if (entity.type === "survey" && entity.id === 0) {
      const effectiveLocation = session.location || entity.location;
      if (!effectiveLocation || effectiveLocation === "-") {
        session.state = "WAITING_LOCATION";
        await session.replyFn?.(
          `📍 Lead/Pekerjaan *${entity.title}* belum memiliki data lokasi survey.\n\n` +
            `Di mana *lokasi / alamat survey* dilaksanakan? (Contoh: *"Gedung Telkom Lt. 3, Jl. Gatot Subroto Jakarta"*):`,
        );
        return;
      }
      entity.location = effectiveLocation;
    }

    // 2. Pastikan deskripsi / hasil laporan sudah ada
    if (!session.description || !session.description.trim()) {
      session.state = "WAITING_DESCRIPTION";
      const kindWord =
        entity.type === "survey"
          ? "hasil survey"
          : entity.type === "project"
            ? "hasil instalasi / pekerjaan"
            : "keterangan pengiriman / penerima surat jalan";
      await session.replyFn?.(
        `✅ Target: *${entity.title}*\n\n` +
          `Bagaimana *${kindWord}* di lapangan? (Contoh: *"Tempat pemasangan bagus, kemungkinan perlu kabel yang lebih panjang"*):`,
      );
      return;
    }

    // 3. Jika user mengirim teks laporan terlebih dahulu tapi belum mengirim foto sama sekali
    if (session.photos.length === 0 && session.state !== "WAITING_PHOTOS") {
      session.state = "WAITING_PHOTOS";
      await session.replyFn?.(
        `✅ Data laporan untuk *${entity.title}* sudah dicatat.\n\n` +
          `📸 Silakan kirim *foto dokumentasi* lapangan sekarang (bisa kirim 1 atau banyak foto sekaligus), atau ketik *LANJUT* jika ingin membuat PDF tanpa foto.`,
      );
      return;
    }

    // 4. Semua sudah lengkap! Langsung buat/update data di ERP, generate PDF, attach ke data, & kirim PDF ke WhatsApp user
    await this.finalizeAndSendReport(senderJid, session);
  }

  private async finalizeAndSendReport(senderJid: string, session: TechnicianSession) {
    const entity = session.matchedEntity;
    if (!entity) return;

    const currentPhotos = [...session.photos];
    const resultNotes = session.description?.trim() || "Pekerjaan telah dilaksanakan dengan baik.";
    const activities =
      session.activitiesList.length > 0 ? [...session.activitiesList] : [resultNotes];

    await session.replyFn?.(
      `⏳ Memproses laporan *${entity.title}* (${currentPhotos.length} foto) dan menyusun PDF resmi...`,
    );

    try {
      let finalEntityId = entity.id;
      let finalTitle = entity.title;
      let finalLocation = session.location || entity.location || "-";
      let finalCustomerName = entity.customerName;
      let finalNeed = entity.need;

      // ─── A. PROSES DATA SURVEY (UPDATE SURVEY TERBARU ATAU BUAT BARU) ───
      if (entity.type === "survey") {
        if (entity.id > 0) {
          // Survey sudah ada di database -> langsung update data survey dengan hasil laporan teknisi
          const existingSurvey = await this.prisma.main.survey.findUnique({
            where: { id: entity.id },
            include: {
              lead: { include: { customer: true } },
              members: true,
            },
          });

          if (existingSurvey) {
            const combinedNotes = existingSurvey.notes
              ? `${existingSurvey.notes}\n\n[Laporan WA ${new Date().toLocaleDateString("id-ID")} - ${session.user.name}]:\n${resultNotes}`
              : `[Laporan WA ${new Date().toLocaleDateString("id-ID")} - ${session.user.name}]:\n${resultNotes}`;

            const updatedSurvey = await this.prisma.main.survey.update({
              where: { id: existingSurvey.id },
              data: {
                status: "SELESAI",
                notes: combinedNotes,
                ...(session.location && (!existingSurvey.location || existingSurvey.location === "-")
                  ? { location: session.location }
                  : {}),
              },
              include: {
                lead: { include: { customer: true } },
              },
            });

            // Pastikan teknisi tercatat di SurveyMember
            await this.prisma.main.surveyMember
              .upsert({
                where: {
                  surveyId_userId: { surveyId: existingSurvey.id, userId: session.user.id },
                },
                create: { surveyId: existingSurvey.id, userId: session.user.id },
                update: {},
              })
              .catch(() => {});

            finalEntityId = updatedSurvey.id;
            finalTitle = `Survey #${updatedSurvey.id} — ${updatedSurvey.lead.name}`;
            finalLocation = updatedSurvey.location;
            finalCustomerName = updatedSurvey.lead.customer?.name || updatedSurvey.lead.name;
            finalNeed = updatedSurvey.need || updatedSurvey.lead.need || undefined;
          }
        } else {
          // Belum ada Survey -> cek apakah Lead sudah ada atau buat Lead baru dulu
          let leadId = entity.leadId;
          let leadName = entity.newTargetName || entity.customerName || "Lead Survey Lapangan";

          if (!leadId) {
            // Cari sekali lagi apakah ada customer dengan nama tersebut
            const existingCustomer = await this.prisma.main.customer.findFirst({
              where: {
                OR: [
                  { name: { contains: leadName } },
                  { company: { contains: leadName } },
                ],
              },
            });

            const newLead = await this.prisma.main.lead.create({
              data: {
                name: leadName,
                customerId: existingCustomer?.id ?? null,
                need: resultNotes,
                owner_id: session.user.id,
                stage: "QUALIFICATION",
                needsSurvey: true,
              },
            });
            leadId = newLead.id;
            this.notifications.dataChange("leads", "create", newLead.id);
          } else {
            const leadRow = await this.prisma.main.lead.findUnique({
              where: { id: leadId },
              include: { customer: true },
            });
            if (leadRow) {
              leadName = leadRow.name;
              finalCustomerName = leadRow.customer?.name || leadRow.name;
              finalNeed = leadRow.need || undefined;
              if (!finalLocation || finalLocation === "-") {
                finalLocation = leadRow.customer?.address || leadRow.customer?.city || "-";
              }
            }
          }

          const createdSurvey = await this.prisma.main.survey.create({
            data: {
              leadId,
              location: finalLocation || "-",
              need: finalNeed || resultNotes,
              notes: `[Laporan WA ${new Date().toLocaleDateString("id-ID")} - ${session.user.name}]:\n${resultNotes}`,
              scheduleAt: new Date(),
              status: "SELESAI",
              cost: 0,
              requestedById: session.user.id,
              members: {
                create: [{ userId: session.user.id }],
              },
            },
            include: {
              lead: { include: { customer: true } },
            },
          });

          finalEntityId = createdSurvey.id;
          finalTitle = `Survey #${createdSurvey.id} — ${createdSurvey.lead.name}`;
          finalLocation = createdSurvey.location;
          finalCustomerName = createdSurvey.lead.customer?.name || createdSurvey.lead.name;
          finalNeed = createdSurvey.need || undefined;
        }
      }

      // ─── B. PROSES DATA INSTALASI / PROJECT ───
      else if (entity.type === "project") {
        const proj = await this.prisma.main.project.findUnique({
          where: { id: entity.id },
          include: { customer: true },
        });
        if (proj) {
          const isBastOrDone = /\b(selesai\s*100|bast|serah\s*terima|tuntas)\b/i.test(resultNotes);
          const nextNotes = proj.notes
            ? `${proj.notes}\n\n[Laporan Instalasi WA ${new Date().toLocaleDateString("id-ID")} - ${session.user.name}]:\n${resultNotes}`
            : `[Laporan Instalasi WA ${new Date().toLocaleDateString("id-ID")} - ${session.user.name}]:\n${resultNotes}`;

          await this.prisma.main.project.update({
            where: { id: proj.id },
            data: {
              notes: nextNotes,
              ...(isBastOrDone ? { status: "SELESAI", progress: 100, completedAt: new Date() } : {}),
            },
          });
          await this.prisma.main.projectMember
            .upsert({
              where: { projectId_userId: { projectId: proj.id, userId: session.user.id } },
              create: { projectId: proj.id, userId: session.user.id },
              update: {},
            })
            .catch(() => {});

          finalEntityId = proj.id;
          finalTitle = `Project #${proj.id} — ${proj.name}`;
          finalCustomerName = proj.customer?.name || undefined;
          finalLocation = proj.customer?.address || proj.customer?.city || session.location || "-";
        }
      }

      // ─── C. PROSES DATA SURAT JALAN (DELIVERY NOTE) ───
      else if (entity.type === "delivery-note") {
        if (entity.id > 0) {
          const dn = await this.prisma.main.deliveryNote.findUnique({
            where: { id: entity.id },
            include: { locations: { include: { project: true } } },
          });
          if (dn) {
            finalEntityId = dn.id;
            finalTitle = `Surat Jalan ${dn.number}`;
            finalLocation = dn.locations.map((l) => l.destination).join(", ") || session.location || "-";
          }
        } else {
          // Buat Surat Jalan baru jika belum ada
          const number = await this.docnum.next("suratJalan");
          const createdDn = await this.prisma.main.deliveryNote.create({
            data: {
              number,
              creatorId: session.user.id,
              withGoods: true,
              date: new Date(),
              status: "DITERIMA",
              receiveById: session.user.id,
              receivedAt: new Date(),
              reportText: resultNotes,
              reportAt: new Date(),
              scanFileId: currentPhotos[0]?.fileId ?? null,
              locations: {
                create: [
                  {
                    destination: finalLocation !== "-" ? finalLocation : (entity.newTargetName || "Lokasi Customer"),
                    reason: resultNotes,
                    projectId: entity.projectId ?? null,
                  },
                ],
              },
            },
          });
          finalEntityId = createdDn.id;
          finalTitle = `Surat Jalan ${createdDn.number}`;
        }
      }

      const enrichedEntity: MatchedEntity = {
        ...entity,
        id: finalEntityId,
        title: finalTitle,
        customerName: finalCustomerName,
        location: finalLocation !== "-" ? finalLocation : undefined,
        need: finalNeed,
      };

      // ─── D. RENDER FILE PDF LAPORAN RESMI (HANYA FOTO DARI BATCH INI) ───
      const { buffer, fileName } = await this.reportService.generatePdfReport({
        entity: enrichedEntity,
        user: session.user,
        activities,
        resultNotes,
        photos: currentPhotos.map((p) => ({
          buffer: p.buffer,
          caption: p.caption,
          mimeType: p.mimeType,
        })),
      });

      const savedPdf = await this.upload.saveNamed(
        buffer,
        "dokumen",
        fileName,
        session.user,
      );

      // ─── E. ATTACH FOTO & FILE PDF KE DATA SURVEY / PROJECT / SURAT JALAN DI ERP ───
      if (finalEntityId > 0) {
        // 1. Lampirkan foto ke DocumentationService & tautkan refType/refId
        for (const photo of currentPhotos) {
          await this.documentation
            .attach(
              enrichedEntity.type,
              finalEntityId,
              photo.fileId,
              photo.caption,
              { ...session.user, role: "SUPER_ADMIN" }, // Pastikan teknisi/user dapat melampirkan foto ke modul terkait
            )
            .catch(() => {});

          const photoRefType =
            enrichedEntity.type === "survey"
              ? "survey"
              : enrichedEntity.type === "project"
                ? "project"
                : "delivery-note";
          await this.prisma.main.file
            .update({
              where: { id: photo.fileId },
              data: { refType: photoRefType, refId: String(finalEntityId), kind: "FOTO" },
            })
            .catch(() => {});
        }

        // 2. Tautkan File PDF Laporan ke entitas terkait agar muncul di halaman Detail aplikasi Taska
        if (enrichedEntity.type === "survey") {
          await this.prisma.main.file
            .update({
              where: { id: savedPdf.id },
              data: { refType: "survey", refId: String(finalEntityId), kind: "DOKUMEN" },
            })
            .catch(() => {});

          await this.notifications
            .notify({
              roles: ["SALES", "PM", "BOS"],
              kind: "LEAD",
              title: "Laporan Survey Selesai (via WA)",
              text: `${session.user.name} mengirim laporan survey ${finalTitle}`,
              href: `/surveys/${finalEntityId}`,
            })
            .catch(() => {});
          this.notifications.dataChange("surveys", "update", finalEntityId);
        } else if (enrichedEntity.type === "project") {
          await this.prisma.main.file
            .update({
              where: { id: savedPdf.id },
              data: { refType: "project", refId: String(finalEntityId), kind: "DOKUMEN" },
            })
            .catch(() => {});

          const projRow = await this.prisma.main.project.findUnique({ where: { id: finalEntityId } });
          if (projRow) {
            await this.prisma.main.project
              .update({
                where: { id: finalEntityId },
                data: {
                  doFileId: savedPdf.id,
                  ...(!projRow.bahpFileId ? { bahpFileId: savedPdf.id } : {}),
                },
              })
              .catch(() => {});
          }

          await this.notifications
            .notify({
              roles: ["PM", "BOS", "SALES"],
              kind: "TUGAS",
              title: "Laporan Instalasi Project (via WA)",
              text: `${session.user.name} mengirim laporan instalasi ${finalTitle}`,
              href: `/projects/${finalEntityId}`,
            })
            .catch(() => {});
          this.notifications.dataChange("projects", "update", finalEntityId);
        } else if (enrichedEntity.type === "delivery-note") {
          await this.prisma.main.file
            .update({
              where: { id: savedPdf.id },
              data: { refType: "delivery-note-report", refId: String(finalEntityId), kind: "DOKUMEN" },
            })
            .catch(() => {});

          await this.prisma.main.deliveryNote
            .update({
              where: { id: finalEntityId },
              data: {
                reportText: resultNotes,
                reportFileId: savedPdf.id,
                reportAt: new Date(),
                status: "DITERIMA",
                receiveById: session.user.id,
                receivedAt: new Date(),
                ...(currentPhotos[0]?.fileId ? { scanFileId: currentPhotos[0].fileId } : {}),
              },
            })
            .catch(() => {});

          await this.notifications
            .notify({
              roles: ["GUDANG", "PM", "FINANCE", "BOS"],
              kind: "SURAT",
              title: "Laporan Surat Jalan Selesai (via WA)",
              text: `${session.user.name} mengirim laporan ${finalTitle}`,
              href: `/delivery-notes/${finalEntityId}`,
            })
            .catch(() => {});
          this.notifications.dataChange("delivery-notes", "update", finalEntityId);
        }

        await this.audit
          .log({
            actor: session.user,
            action: `LAPORAN_WA_${enrichedEntity.type.toUpperCase()}`,
            entityType: enrichedEntity.type,
            entityId: finalEntityId,
            detail: `${finalTitle} — ${currentPhotos.length} foto, PDF: ${fileName}`,
          })
          .catch(() => {});
      }

      // ─── F. KIRIM FILE PDF LAPORAN KE WHATSAPP USER ───
      await session.sendPdfFn?.(
        buffer,
        fileName,
        `✅ *Laporan Resmi Berhasil Dibuat!*\n\n` +
          `• *Dokumen:* ${finalTitle}\n` +
          (finalLocation && finalLocation !== "-" ? `• *Lokasi:* ${finalLocation}\n` : "") +
          `• *Foto Terlampir:* ${currentPhotos.length} foto\n` +
          `• *Petugas:* ${session.user.name}\n` +
          `• *Hasil:* ${resultNotes}\n\n` +
          `File PDF & foto dokumentasi telah otomatis tersimpan dan terlampir pada data *${this.kindLabel(enrichedEntity.type)}* di aplikasi Taska ERP.`,
      );

      // Bersihkan sesi agar pengiriman berikutnya tidak mencampur foto lama
      this.clearPhotoTimer(senderJid);
      this.sessions.delete(senderJid);
    } catch (err: any) {
      this.logger.error(`Gagal memfinalisasi laporan WA: ${err?.message}`, err?.stack);
      await session.replyFn?.(
        `⚠️ Terjadi kendala saat membuat laporan PDF: ${err?.message || "Kesalahan sistem"}. Silakan coba balas ulang atau ketik *BATAL* untuk mengulang.`,
      );
    }
  }

  private kindLabel(kind: ReportKind): string {
    if (kind === "survey") return "Survey";
    if (kind === "project") return "Instalasi Project";
    return "Surat Jalan";
  }

  private looksLikeFullReportCommand(text: string): boolean {
    return /\b(laporan|survey|survei|instalasi|pemasangan|surat\s*jalan|sj)\b/i.test(text) || text.includes(",");
  }

  /**
   * Memecah kalimat teknisi seperti:
   * "[4 foto] Laporan Survey CCTV PT Telkom , Tempat Pemasang Bagaus, kemungkina perlu kabel yang lebih panjang"
   * menjadi:
   * - kind: "survey"
   * - targetQuery: "CCTV PT Telkom"
   * - description: "Tempat Pemasang Bagaus, kemungkina perlu kabel yang lebih panjang"
   */
  private parseNaturalReportMessage(raw: string): {
    kind?: ReportKind;
    targetQuery: string;
    description?: string;
    location?: string;
  } {
    let text = raw.replace(/^\[\d+\s*foto\]\s*/i, "").trim();

    let kind: ReportKind | undefined;
    if (/\b(surat\s*jalan|sj|pengiriman|antar\s*barang|kirim\s*barang|serah\s*terima\s*barang)\b/i.test(text)) {
      kind = "delivery-note";
    } else if (/\b(survey|survei|cek\s*lokasi)\b/i.test(text)) {
      kind = "survey";
    } else if (/\b(instalasi|pemasangan|pasang|project|proyek|progress|bast)\b/i.test(text)) {
      kind = "project";
    }

    // Ekstrak lokasi eksplisit bila ditulis "lokasi: ..."
    let location: string | undefined;
    const locMatch = text.match(/\b(?:lokasi|alamat|tempat)\s*[:=]\s*([^,\n;]+)/i);
    if (locMatch?.[1]) {
      location = locMatch[1].trim();
    }

    // Hapus awalan "Laporan Hasil Survey untuk ..." agar menyisakan "[Target] , [Deskripsi]"
    const stripped = text
      .replace(
        /^(?:laporan\s+)?(?:hasil\s+)?(?:dokumentasi\s+)?(?:survey|survei|cek\s+lokasi|instalasi|pemasangan|project|proyek|surat\s+jalan|sj|pengiriman)\s*(?:untuk|ke|pada|di|lead|leads|project|proyek)?\s*[:\-]?\s*/i,
        "",
      )
      .trim();

    // Cek pemisah antara Nama Target (Lead/Project) dan Hasil/Deskripsi (koma, titik dua, baris baru, atau strip)
    const sepMatch = stripped.match(/^([^,\n;:]+?)(?:\s*[,;:\n]\s*|\s+-\s+)([\s\S]+)$/);
    if (sepMatch) {
      const targetCandidate = sepMatch[1]!.trim();
      const descCandidate = sepMatch[2]!.trim();
      return {
        kind,
        targetQuery: targetCandidate,
        description: descCandidate || undefined,
        location,
      };
    }

    return {
      kind,
      targetQuery: stripped || text,
      description: undefined,
      location,
    };
  }

  /**
   * Mencari kecocokan di database untuk Survey/Lead, Project, dan Surat Jalan.
   * Mendukung pencarian kata kunci / token (misal "CCTV PT Telkom" cocok dengan Lead "CCTV Telkomsel" atau "PT Telkom").
   * Untuk Survey: mengecek apakah Lead sudah punya Survey terbaru (jika sudah ada -> pakai Survey itu; jika belum -> tandai untuk buat Survey baru dari Lead tersebut).
   */
  private async smartFindEntities(
    targetQuery: string,
    fullMessage: string,
    preferredKind?: ReportKind,
  ): Promise<{ matches: MatchedEntity[]; extractedDescription?: string }> {
    const cleanQuery = targetQuery.trim();
    const tokens = cleanQuery
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOPWORDS.has(w));

    const scoreText = (haystack: string): number => {
      if (!haystack) return 0;
      const h = haystack.toLowerCase();
      const qLower = cleanQuery.toLowerCase();
      let score = 0;
      if (qLower.length >= 3 && h.includes(qLower)) score += 100;
      if (qLower.length >= 3 && qLower.includes(h) && h.length >= 4) score += 80;
      for (const tok of tokens) {
        if (h.includes(tok)) {
          score += tok.length >= 4 ? 30 : 15;
        } else if (tok.length >= 5) {
          // Prefix match (contoh: "telkom" <-> "telkomsel")
          const prefix = tok.slice(0, 5);
          if (h.includes(prefix)) score += 20;
        }
      }
      return score;
    };

    const scored: Array<{ entity: MatchedEntity; score: number; matchedName: string }> = [];

    // ─── 1. Cari di Leads & Surveys (Jika preferredKind === "survey" atau belum ditentukan) ───
    if (!preferredKind || preferredKind === "survey") {
      const leads = await this.prisma.main.lead.findMany({
        include: {
          customer: true,
          surveys: {
            orderBy: { id: "desc" },
            take: 1,
          },
        },
        orderBy: { id: "desc" },
        take: 100,
      });

      const seenSurveyIds = new Set<number>();

      for (const lead of leads) {
        const latestSurvey = lead.surveys[0];
        if (latestSurvey) seenSurveyIds.add(latestSurvey.id);

        const combinedLabel = `${lead.name} ${lead.customer?.name || ""} ${lead.customer?.company || ""} ${latestSurvey?.location || ""}`;
        const sc = Math.max(
          scoreText(lead.name),
          scoreText(lead.customer?.name || ""),
          scoreText( combinedLabel),
        );

        if (sc >= 20) {
          if (latestSurvey) {
            scored.push({
              score: sc + 10, // Prioritaskan Lead yang sudah punya jadwal/data Survey
              matchedName: lead.name,
              entity: {
                type: "survey",
                id: latestSurvey.id,
                leadId: lead.id,
                title: `Survey #${latestSurvey.id} — ${lead.name} (${lead.customer?.name || latestSurvey.location})`,
                customerName: lead.customer?.name || lead.name,
                location: latestSurvey.location,
                need: latestSurvey.need || lead.need || undefined,
              },
            });
          } else {
            // Lead ada, tetapi BELUM ada data Survey -> buat Survey baru untuk Lead ini (prioritaskan Lead pada tahap PROSPECTING / QUALIFICATION atau needsSurvey)
            const isSurveyStage =
              lead.stage === "PROSPECTING" || lead.stage === "QUALIFICATION" || lead.needsSurvey;
            const customerLoc = lead.customer?.address || lead.customer?.city || undefined;
            scored.push({
              score: isSurveyStage ? sc + 5 : sc - 5,
              matchedName: lead.name,
              entity: {
                type: "survey",
                id: 0,
                leadId: lead.id,
                title: `Survey Baru — Lead: ${lead.name}${lead.customer?.name ? ` (${lead.customer.name})` : ""}`,
                customerName: lead.customer?.name || lead.name,
                location: customerLoc,
                need: lead.need || undefined,
                isNewSurveyForLead: true,
              },
            });
          }
        }
      }

      // Cek juga Survey yang mungkin cocok dari kolom location/need secara langsung
      const standaloneSurveys = await this.prisma.main.survey.findMany({
        include: {
          lead: { include: { customer: true } },
        },
        orderBy: { id: "desc" },
        take: 50,
      });
      for (const s of standaloneSurveys) {
        if (seenSurveyIds.has(s.id)) continue;
        const sc = scoreText(`${s.lead.name} ${s.lead.customer?.name || ""} ${s.location} ${s.need || ""}`);
        if (sc >= 20) {
          scored.push({
            score: sc + 10,
            matchedName: s.lead.name,
            entity: {
              type: "survey",
              id: s.id,
              leadId: s.leadId,
              title: `Survey #${s.id} — ${s.lead.name} (${s.lead.customer?.name || s.location})`,
              customerName: s.lead.customer?.name || s.lead.name,
              location: s.location,
              need: s.need || undefined,
            },
          });
        }
      }
    }

    // ─── 2. Cari di Projects (Jika preferredKind === "project" atau belum ditentukan) ───
    if (!preferredKind || preferredKind === "project") {
      const projects = await this.prisma.main.project.findMany({
        include: {
          customer: true,
          quotation: { include: { lead: true } },
        },
        orderBy: { id: "desc" },
        take: 80,
      });
      for (const p of projects) {
        const sc = Math.max(
          scoreText(p.name),
          scoreText(p.customer?.name || ""),
          scoreText(p.quotation?.lead?.name || ""),
        );
        if (sc >= 20) {
          scored.push({
            score: preferredKind === "project" ? sc + 15 : sc,
            matchedName: p.name,
            entity: {
              type: "project",
              id: p.id,
              projectId: p.id,
              title: `Project #${p.id} — ${p.name} (${p.customer?.name ?? "-"})`,
              customerName: p.customer?.name || undefined,
              location: p.customer?.address || p.customer?.city || undefined,
            },
          });
        }
      }
    }

    // ─── 3. Cari di Surat Jalan / DeliveryNote (Jika preferredKind === "delivery-note" atau belum ditentukan) ───
    if (!preferredKind || preferredKind === "delivery-note") {
      const dns = await this.prisma.main.deliveryNote.findMany({
        include: {
          locations: { include: { project: { include: { customer: true } } } },
        },
        orderBy: { id: "desc" },
        take: 60,
      });
      for (const d of dns) {
        const destStr = d.locations
          .map((l) => `${l.destination} ${l.project?.name || ""} ${l.project?.customer?.name || ""}`)
          .join(" ");
        const sc = Math.max(scoreText(d.number), scoreText(destStr));
        if (sc >= 20) {
          const firstLoc = d.locations[0];
          scored.push({
            score: preferredKind === "delivery-note" ? sc + 15 : sc,
            matchedName: firstLoc?.destination || d.number,
            entity: {
              type: "delivery-note",
              id: d.id,
              projectId: firstLoc?.projectId ?? undefined,
              title: `Surat Jalan ${d.number} — ${firstLoc?.destination || "-"}`,
              customerName: firstLoc?.project?.customer?.name || firstLoc?.destination,
              location: firstLoc?.destination,
            },
          });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);

    // Jika skor tertinggi jauh mengungguli kandidat lain (misal exact match), ambil kandidat terbaik tersebut
    if (scored.length > 1 && scored[0]!.score >= 90 && scored[0]!.score - scored[1]!.score >= 35) {
      const best = scored[0]!;
      return {
        matches: [best.entity],
        extractedDescription: this.extractTrailingDescription(fullMessage, best.matchedName),
      };
    }

    const topScore = scored[0]?.score ?? 0;
    const filtered = scored
      .filter((x) => x.score >= Math.max(20, topScore - 25))
      .map((x) => x.entity);

    return {
      matches: filtered,
      extractedDescription:
        scored[0] ? this.extractTrailingDescription(fullMessage, scored[0].matchedName) : undefined,
    };
  }

  /** Jika user menulis kalimat tanpa koma ("Laporan Survey CCTV Telkomsel tempat pemasangan bagus"), ambil teks setelah nama entitas. */
  private extractTrailingDescription(fullMessage: string, entityName: string): string | undefined {
    if (!entityName) return undefined;
    const idx = fullMessage.toLowerCase().indexOf(entityName.toLowerCase());
    if (idx < 0) return undefined;
    const after = fullMessage
      .slice(idx + entityName.length)
      .replace(/^[\s,;:\-]+/, "")
      .trim();
    return after.length >= 4 ? after : undefined;
  }

  /** Ambil daftar pekerjaan aktif terbaru (Survey/Lead/Project/Surat Jalan) untuk memudahkan user memilih lewat nomor. */
  private async getQuickSuggestions(userId: number, kind?: ReportKind): Promise<MatchedEntity[]> {
    const out: MatchedEntity[] = [];

    if (!kind || kind === "survey") {
      const surveys = await this.prisma.main.survey.findMany({
        where: { status: { in: ["DIMINTA", "DIJADWALKAN", "BERJALAN", "SELESAI"] } },
        include: { lead: { include: { customer: true } }, members: true },
        orderBy: { id: "desc" },
        take: 4,
      });
      for (const s of surveys) {
        out.push({
          type: "survey",
          id: s.id,
          leadId: s.leadId,
          title: `Survey #${s.id} — ${s.lead.name} (${s.lead.customer?.name || s.location})`,
          customerName: s.lead.customer?.name || s.lead.name,
          location: s.location,
          need: s.need || undefined,
        });
      }

      if (out.length < 4) {
        const leadsWithoutSurvey = await this.prisma.main.lead.findMany({
          where: {
            surveys: { none: {} },
            stage: { in: ["PROSPECTING", "QUALIFICATION"] },
          },
          include: { customer: true },
          orderBy: { id: "desc" },
          take: 4 - out.length,
        });
        for (const l of leadsWithoutSurvey) {
          out.push({
            type: "survey",
            id: 0,
            leadId: l.id,
            title: `Survey Baru — Lead: ${l.name}`,
            customerName: l.customer?.name || l.name,
            location: l.customer?.address || l.customer?.city || undefined,
            need: l.need || undefined,
            isNewSurveyForLead: true,
          });
        }
      }
    }

    if (!kind || kind === "project") {
      const projects = await this.prisma.main.project.findMany({
        where: { status: { in: ["BERJALAN", "DITUNDA"] } },
        include: { customer: true },
        orderBy: { id: "desc" },
        take: 3,
      });
      for (const p of projects) {
        out.push({
          type: "project",
          id: p.id,
          projectId: p.id,
          title: `Project #${p.id} — ${p.name} (${p.customer?.name ?? "-"})`,
          customerName: p.customer?.name || undefined,
          location: p.customer?.address || p.customer?.city || undefined,
        });
      }
    }

    if (!kind || kind === "delivery-note") {
      const dns = await this.prisma.main.deliveryNote.findMany({
        where: { status: { in: ["PENDING", "DIKIRIM"] } },
        include: { locations: true },
        orderBy: { id: "desc" },
        take: 2,
      });
      for (const d of dns) {
        out.push({
          type: "delivery-note",
          id: d.id,
          title: `Surat Jalan ${d.number} — ${d.locations[0]?.destination ?? "-"}`,
          location: d.locations[0]?.destination,
        });
      }
    }

    return out.slice(0, 6);
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

  private async findOrResolveUser(cleanPhone: string, senderName: string) {
    const users = await this.prisma.main.user.findMany({
      where: { status: "AKTIF" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
      orderBy: { id: "asc" },
    });

    if (cleanPhone) {
      const byPhone = users.find((u) => {
        if (!u.phone) return false;
        const up = this.normalizePhone(u.phone);
        return up.length >= 8 && (up === cleanPhone || up.endsWith(cleanPhone) || cleanPhone.endsWith(up));
      });
      if (byPhone) return byPhone;
    }

    if (senderName) {
      const lowerName = senderName.trim().toLowerCase();
      const byName = users.find(
        (u) =>
          u.name.toLowerCase() === lowerName ||
          u.name.toLowerCase().includes(lowerName) ||
          lowerName.includes(u.name.toLowerCase()),
      );
      if (byName) return byName;
    }

    // Fallback ke user TEKNISI / SE / PM / SUPER_ADMIN aktif agar bot selalu bisa dipakai teknisi di lapangan
    return (
      users.find((u) => u.role === "TEKNISI") ||
      users.find((u) => u.role === "SE") ||
      users.find((u) => u.role === "PM") ||
      users[0] ||
      null
    );
  }
}
