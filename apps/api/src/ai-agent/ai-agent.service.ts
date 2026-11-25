import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import {
  LlmProviderService,
  type LlmChatMessage,
} from "./llm-provider.service.js";
import { AgentToolsService, getWibDateString } from "./agent-tools.service.js";
import { AiSettingsService, type UpdateLlmSettingsInput } from "./ai-settings.service.js";
import { AiActionsService, type AiPendingActionView } from "./ai-actions.service.js";
import type { SendAiChatDto } from "./dto.js";

const MAX_TOOL_ITERATIONS = 5;
const HISTORY_WINDOW = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQ = 15;

export interface AiChatAttachmentView {
  fileId: number;
  name: string;
  mimeType?: string;
}

export interface AiChatMessageView {
  id: number;
  role: "user" | "assistant";
  content: string;
  toolsUsed: string[];
  attachments?: AiChatAttachmentView[];
  createdAt: string;
}

export type AiStreamEvent =
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | {
      type: "done";
      payload: {
        sessionId: number;
        sessionTitle: string;
        userMessage: AiChatMessageView;
        assistantMessage: AiChatMessageView;
        toolsUsed: string[];
        pendingActions: AiPendingActionView[];
      };
    }
  | { type: "error"; message: string };

@Injectable()
export class AiAgentService {
  private readonly rateHits = new Map<number, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmProviderService,
    private readonly tools: AgentToolsService,
    private readonly audit: AuditService,
    @Optional() private readonly settings?: AiSettingsService,
    @Optional() private readonly actions?: AiActionsService,
  ) {}

  async getCapabilities(user: RequestUser) {
    const status =
      typeof this.llm.getStatusAsync === "function"
        ? await this.llm.getStatusAsync()
        : this.llm.getStatus();
    const allowedTools = this.tools.getAllowedTools(user);
    const creatableEntities = this.actions?.getAllowedCreatableEntities(user) ?? [];
    return {
      configured: status.configured,
      model: status.model,
      providerLabel: status.providerLabel,
      mode: creatableEntities.length > 0 ? ("READ_AND_DRAFT_CREATE" as const) : ("READ_ONLY" as const),
      canManageSettings: user.role === "SUPER_ADMIN",
      creatableEntities,
      allowedToolNames: allowedTools.map((t) => t.function.name),
      suggestedPrompts: this.tools.getSuggestedPrompts(user),
    };
  }

  private assertSuperAdmin(user: RequestUser) {
    if (user.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("Pengaturan LLM hanya dapat diakses oleh Super Admin.");
    }
  }

  async getSettings(user: RequestUser) {
    this.assertSuperAdmin(user);
    if (!this.settings) throw new BadRequestException("Layanan pengaturan AI belum tersedia.");
    return this.settings.getPublicSettings();
  }

  async updateSettings(user: RequestUser, input: UpdateLlmSettingsInput) {
    this.assertSuperAdmin(user);
    if (!this.settings) throw new BadRequestException("Layanan pengaturan AI belum tersedia.");
    return this.settings.updateSettings(input, user);
  }

  async testSettingsConnection(user: RequestUser) {
    this.assertSuperAdmin(user);
    return this.llm.testConnection();
  }

  async confirmAction(user: RequestUser, actionId: number) {
    if (!this.actions) throw new BadRequestException("Layanan aksi AI belum tersedia.");
    return this.actions.confirmAction(user, actionId);
  }

  async cancelAction(user: RequestUser, actionId: number) {
    if (!this.actions) throw new BadRequestException("Layanan aksi AI belum tersedia.");
    return this.actions.cancelAction(user, actionId);
  }

  async listSessions(user: RequestUser) {
    const sessions = await this.prisma.main.aiChatSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      messageCount: s._count.messages,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async getSession(user: RequestUser, sessionId: number) {
    const session = await this.prisma.main.aiChatSession.findFirst({
      where: { id: sessionId, userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 100,
        },
      },
    });
    if (!session) {
      throw new NotFoundException("Sesi percakapan tidak ditemukan.");
    }
    const pendingActions = this.actions
      ? await this.actions.listSessionActions(user, session.id)
      : [];
    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messages: session.messages.map((m) => this.toMessageView(m)),
      pendingActions,
    };
  }

  async deleteSession(user: RequestUser, sessionId: number) {
    const existing = await this.prisma.main.aiChatSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException("Sesi percakapan tidak ditemukan.");
    }
    await this.prisma.main.aiChatSession.delete({ where: { id: sessionId } });
    return { deleted: true, id: sessionId };
  }

  /**
   * Undo 1 giliran pesan spesifik (pesan user + balasan AI untuk pesan itu, plus batalkan draft PENDING-nya).
   * Menolak undo jika giliran pesan tersebut sudah menghasilkan dokumen ERP terkonfirmasi.
   */
  async undoLastTurn(user: RequestUser, sessionId: number, messageId?: number) {
    const session = await this.prisma.main.aiChatSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: { id: true },
    });
    if (!session) {
      throw new NotFoundException("Sesi percakapan tidak ditemukan.");
    }

    const targetUserMsg = messageId
      ? await this.prisma.main.aiChatMessage.findFirst({
          where: { id: messageId, sessionId, role: "user" },
        })
      : await this.prisma.main.aiChatMessage.findFirst({
          where: { sessionId, role: "user" },
          orderBy: { id: "desc" },
        });
    if (!targetUserMsg) {
      throw new BadRequestException("Pesan yang akan di-undo tidak ditemukan.");
    }

    const nextUserMsg = await this.prisma.main.aiChatMessage.findFirst({
      where: { sessionId, role: "user", id: { gt: targetUserMsg.id } },
      orderBy: { id: "asc" },
      select: { id: true, createdAt: true },
    });

    const actionTimeWindow = {
      gte: targetUserMsg.createdAt,
      ...(nextUserMsg ? { lt: nextUserMsg.createdAt } : {}),
    };

    const confirmedCount = await this.prisma.main.aiPendingAction.count({
      where: {
        sessionId,
        userId: user.id,
        status: "CONFIRMED",
        createdAt: actionTimeWindow,
      },
    });
    if (confirmedCount > 0) {
      throw new BadRequestException(
        "Pesan yang sudah terkonfirmasi membuat dokumen ERP tidak dapat di-undo.",
      );
    }

    await this.prisma.main.aiPendingAction.updateMany({
      where: {
        sessionId,
        userId: user.id,
        status: "PENDING",
        createdAt: actionTimeWindow,
      },
      data: { status: "CANCELLED" },
    });

    const deleted = await this.prisma.main.aiChatMessage.deleteMany({
      where: {
        sessionId,
        id: {
          gte: targetUserMsg.id,
          ...(nextUserMsg ? { lt: nextUserMsg.id } : {}),
        },
      },
    });

    const updated = await this.getSession(user, sessionId);
    return {
      restoredText: targetUserMsg.content,
      deletedCount: deleted.count,
      messages: updated.messages,
      pendingActions: updated.pendingActions,
    };
  }

  private formatPromptForLlm(dto: SendAiChatDto): string {
    const parts: string[] = [dto.message.trim()];
    if (dto.pageContext?.module && dto.pageContext?.entityId) {
      parts.push(
        `\n[Konteks halaman yang sedang dibuka pengguna: modul="${dto.pageContext.module}", id="${dto.pageContext.entityId}"]`,
      );
    }
    if (dto.attachments && dto.attachments.length > 0) {
      const list = dto.attachments
        .map((a) => `fileId=${a.fileId} ("${a.name}")`)
        .join(", ");
      parts.push(
        `\n[Lampiran file dari pengguna (JANGAN baca isi file, cukup tautkan fileId ke draft dokumen jika diminta membuat Penawaran/Faktur/Pengeluaran/Lead): ${list}]`,
      );
    }
    return parts.join("");
  }

  async chat(user: RequestUser, dto: SendAiChatDto) {
    this.enforceRateLimit(user.id);

    const promptText = dto.message.trim();
    if (!promptText) {
      throw new BadRequestException("Pertanyaan tidak boleh kosong.");
    }

    const session = await this.resolveOrCreateSession(user, dto, promptText);
    const recentHistory = await this.prisma.main.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_WINDOW,
    });
    recentHistory.reverse();

    const savedUserMsg = await this.prisma.main.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: promptText,
        toolsUsedJson:
          dto.attachments && dto.attachments.length > 0
            ? JSON.stringify(dto.attachments)
            : null,
      },
    });

    const allowedTools = this.tools.getAllowedTools(user, dto.pageContext);
    const messages: LlmChatMessage[] = [
      { role: "system", content: this.buildSystemPrompt(user, dto.pageContext) },
      ...recentHistory.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: this.formatPromptForLlm(dto) },
    ];

    const usedLabels = new Set<string>();
    const createdActions: AiPendingActionView[] = [];
    let finalReply = "";

    for (let step = 0; step < MAX_TOOL_ITERATIONS; step++) {
      const completion = await this.llm.complete(messages, allowedTools);

      if (completion.toolCalls.length === 0) {
        finalReply = (completion.content || "").trim();
        break;
      }

      messages.push({
        role: "assistant",
        content: completion.content,
        tool_calls: completion.toolCalls,
      });

      for (const tc of completion.toolCalls) {
        const parsedArgs = this.parseToolArgs(tc.function.arguments);
        const result = await this.tools.executeTool(tc.function.name, parsedArgs, user, {
          sessionId: session.id,
          pageContext: dto.pageContext,
          attachments: dto.attachments,
        });
        if (result.allowed) {
          usedLabels.add(result.label);
        }
        if (result.pendingAction) {
          createdActions.push(result.pendingAction);
        }

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result.data),
        });
      }
    }

    if (!finalReply) {
      finalReply =
        "Maaf, saya belum bisa menyusun jawaban lengkap dari data yang tersedia. Coba perjelas pertanyaan Anda.";
    }

    const toolsUsed = Array.from(usedLabels);
    const savedAssistantMsg = await this.prisma.main.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: finalReply,
        toolsUsedJson: toolsUsed.length > 0 ? JSON.stringify(toolsUsed) : null,
      },
    });

    await this.prisma.main.aiChatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    void this.audit.log({
      actor: user,
      action: "AI_CHAT",
      entityType: "ai_chat_session",
      entityId: session.id,
      detail: toolsUsed.length > 0 ? `Sumber: ${toolsUsed.join(", ")}` : "Chat tanpa tool",
    });

    return {
      sessionId: session.id,
      sessionTitle: session.title,
      userMessage: this.toMessageView(savedUserMsg),
      assistantMessage: this.toMessageView(savedAssistantMsg),
      toolsUsed,
      pendingActions: createdActions,
    };
  }

  async chatStream(
    user: RequestUser,
    dto: SendAiChatDto,
    emit: (event: AiStreamEvent) => void,
  ): Promise<void> {
    this.enforceRateLimit(user.id);

    const promptText = dto.message.trim();
    if (!promptText) {
      throw new BadRequestException("Pertanyaan tidak boleh kosong.");
    }

    const session = await this.resolveOrCreateSession(user, dto, promptText);
    const recentHistory = await this.prisma.main.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_WINDOW,
    });
    recentHistory.reverse();

    const savedUserMsg = await this.prisma.main.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: promptText,
        toolsUsedJson:
          dto.attachments && dto.attachments.length > 0
            ? JSON.stringify(dto.attachments)
            : null,
      },
    });

    const allowedTools = this.tools.getAllowedTools(user, dto.pageContext);
    const messages: LlmChatMessage[] = [
      { role: "system", content: this.buildSystemPrompt(user, dto.pageContext) },
      ...recentHistory.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: this.formatPromptForLlm(dto) },
    ];

    const usedLabels = new Set<string>();
    const createdActions: AiPendingActionView[] = [];
    let finalReply = "";

    emit({ type: "status", text: "Menganalisis pertanyaan..." });

    for (let step = 0; step < MAX_TOOL_ITERATIONS; step++) {
      let stepText = "";
      const completion = await this.llm.completeStream(messages, allowedTools, (chunk) => {
        stepText += chunk;
        emit({ type: "delta", text: chunk });
      });

      if (completion.toolCalls.length === 0) {
        finalReply = (completion.content || stepText).trim();
        break;
      }

      messages.push({
        role: "assistant",
        content: completion.content,
        tool_calls: completion.toolCalls,
      });

      for (const tc of completion.toolCalls) {
        const parsedArgs = this.parseToolArgs(tc.function.arguments);
        emit({ type: "status", text: `Memproses ${tc.function.name}...` });
        const result = await this.tools.executeTool(tc.function.name, parsedArgs, user, {
          sessionId: session.id,
          pageContext: dto.pageContext,
          attachments: dto.attachments,
        });
        if (result.allowed) {
          usedLabels.add(result.label);
          emit({ type: "status", text: `Menyusun ringkasan dari ${result.label}...` });
        }
        if (result.pendingAction) {
          createdActions.push(result.pendingAction);
        }

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result.data),
        });
      }
    }

    if (!finalReply) {
      finalReply =
        "Maaf, saya belum bisa menyusun jawaban lengkap dari data yang tersedia. Coba perjelas pertanyaan Anda.";
      emit({ type: "delta", text: finalReply });
    }

    const toolsUsed = Array.from(usedLabels);
    const savedAssistantMsg = await this.prisma.main.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: finalReply,
        toolsUsedJson: toolsUsed.length > 0 ? JSON.stringify(toolsUsed) : null,
      },
    });

    await this.prisma.main.aiChatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    void this.audit.log({
      actor: user,
      action: "AI_CHAT",
      entityType: "ai_chat_session",
      entityId: session.id,
      detail: toolsUsed.length > 0 ? `Sumber: ${toolsUsed.join(", ")}` : "Chat tanpa tool",
    });

    emit({
      type: "done",
      payload: {
        sessionId: session.id,
        sessionTitle: session.title,
        userMessage: this.toMessageView(savedUserMsg),
        assistantMessage: this.toMessageView(savedAssistantMsg),
        toolsUsed,
        pendingActions: createdActions,
      },
    });
  }

  private async resolveOrCreateSession(
    user: RequestUser,
    dto: SendAiChatDto,
    promptText: string,
  ): Promise<{ id: number; title: string }> {
    if (dto.sessionId) {
      const found = await this.prisma.main.aiChatSession.findFirst({
        where: { id: dto.sessionId, userId: user.id },
        select: { id: true, title: true },
      });
      if (!found) {
        throw new NotFoundException("Sesi percakapan tidak ditemukan.");
      }
      return found;
    }
    const autoTitle =
      promptText.length > 70 ? `${promptText.slice(0, 67)}...` : promptText;
    return this.prisma.main.aiChatSession.create({
      data: { userId: user.id, title: autoTitle },
      select: { id: true, title: true },
    });
  }

  private parseToolArgs(raw: string): Record<string, unknown> {
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }


  //setting prompt untuk LLM agar bisa menyesuaikan jawaban dengan konteks ERP Akuntra, role user, dan halaman yang sedang dibuka user
  private buildSystemPrompt(
    user: RequestUser,
    pageContext?: { pathname?: string; module?: string; entityId?: string },
  ): string {
    const todayWib = getWibDateString();
    const ctxHint =
      pageContext?.module && pageContext?.entityId
        ? `Pengguna sedang membuka halaman detail: modul=${pageContext.module}, id=${pageContext.entityId}. Gunakan tool get_current_document_detail bila pengguna bertanya tentang dokumen/data ini.`
        : "";

    return [
      "Anda adalah Asisten AI Analis Bisnis & Operasional resmi untuk Akuntra ERP.",
      `Pengguna saat ini: ${user.name} (Role: ${user.role}).`,
      `Tanggal hari ini (WIB / UTC+7): ${todayWib}.`,
      ...(ctxHint ? [ctxHint] : []),
      "",
      "ATURAN WAJIB:",
      "1. Untuk membaca data aktual ERP, WAJIB panggil tool yang tersedia. Gunakan angka pre-agregasi (`note`, `countByStatus`, `totalRows`, subtotal/total); JANGAN pernah mengarang angka.",
      "2. Untuk pencarian periode fleksibel (mis. '3 bulan terakhir', '28 Oktober sampai 28 November', 'Q3 2026', 'Oktober 2026'), kirimkan parameter `from`/`to` (format YYYY-MM-DD) atau `period` (`last_3_months`, `2026-10`, `2026-Q3`).",
      "3. Untuk perbandingan periode (mis. bulan ini vs bulan lalu), aktifkan `compareWithPrevious: true` pada `get_financial_report`.",
      "4. Untuk membuat data baru (hanya pada modul yang tersedia di `propose_create_record`), WAJIB panggil `propose_create_record` agar muncul kartu konfirmasi pengguna. JANGAN pernah mengklaim data sudah tersimpan sebelum pengguna menekan tombol Konfirmasi & Simpan. Tolak dengan sopan permintaan ubah/hapus data atau pembuatan jurnal/penerimaan/surat jalan.",
      "5. Jika pengguna melampirkan file (`fileId=...`), JANGAN mencoba membaca isi file — cukup tautkan `fileId` (atau `receiptFileId` untuk expense) ke draft `propose_create_record`.",
      "",
      "FORMAT JAWABAN (WAJIB RAPI & MUDAH DIBACA):",
      "- Mulai dengan **1–2 kalimat Ringkasan Eksekutif** (kesimpulan utama + periode tanggal WIB).",
      "- Untuk laporan keuangan, daftar stok menipis, atau perbandingan angka, sajikan dalam **tabel Markdown** (`| Komponen | Nominal |`). Jangan cantumkan baris bernilai Rp 0 kecuali diminta.",
      "- Jika pengguna meminta membuatkan daftar teks siap salin (seperti daftar Serial Number / SN, draft pesan WhatsApp/email, template surat, CSV, JSON, atau kode), WAJIB bungkus teks hasilnya di dalam blok kode fenced Markdown (```text ... ```) agar tampil dalam kotak khusus dengan tombol Salin satu klik.",
      "- Format mata uang sebagai Rupiah (`Rp 1.250.000`).",
      "- Tutup dengan bagian singkat **Perlu Perhatian** bila ada temuan penting, dan boleh sertakan tautan halaman ERP relevan seperti `[Buka Laporan](/reports)`, `[Lihat Proyek](/projects)`, `[Cek Stok](/stock)`, `[Buka Persetujuan](/approvals)`, `[Lihat Prospek](/leads)`.",
    ].join("\n");
  }

  private enforceRateLimit(userId: number) {
    const now = Date.now();
    const hits = (this.rateHits.get(userId) ?? []).filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
    );
    if (hits.length >= RATE_LIMIT_MAX_REQ) {
      throw new BadRequestException(
        "Terlalu banyak pertanyaan dalam 1 menit. Silakan tunggu sebentar sebelum mengirim lagi.",
      );
    }
    hits.push(now);
    this.rateHits.set(userId, hits);
  }

  private toMessageView(m: {
    id: number;
    role: string;
    content: string;
    toolsUsedJson: string | null;
    createdAt: Date;
  }): AiChatMessageView {
    const isAssistant = m.role === "assistant";
    let toolsUsed: string[] = [];
    let attachments: AiChatAttachmentView[] | undefined;

    if (m.toolsUsedJson) {
      try {
        const parsed = JSON.parse(m.toolsUsedJson);
        if (Array.isArray(parsed)) {
          if (isAssistant) {
            toolsUsed = parsed.filter((x): x is string => typeof x === "string");
          } else {
            const valid = parsed.filter(
              (x): x is AiChatAttachmentView =>
                Boolean(x && typeof x === "object" && typeof x.fileId === "number" && typeof x.name === "string"),
            );
            if (valid.length > 0) attachments = valid;
          }
        }
      } catch {
        toolsUsed = [];
      }
    }
    return {
      id: m.id,
      role: isAssistant ? "assistant" : "user",
      content: m.content,
      toolsUsed,
      ...(attachments ? { attachments } : {}),
      createdAt: m.createdAt.toISOString(),
    };
  }
}
