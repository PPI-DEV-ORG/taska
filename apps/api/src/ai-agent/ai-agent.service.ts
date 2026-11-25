import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import {
  LlmProviderService,
  type LlmChatMessage,
} from "./llm-provider.service.js";
import { AgentToolsService, getWibDateString } from "./agent-tools.service.js";
import type { SendAiChatDto } from "./dto.js";

const MAX_TOOL_ITERATIONS = 5;
const HISTORY_WINDOW = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQ = 15;

export interface AiChatMessageView {
  id: number;
  role: "user" | "assistant";
  content: string;
  toolsUsed: string[];
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
  ) {}

  getCapabilities(user: RequestUser) {
    const status = this.llm.getStatus();
    const allowedTools = this.tools.getAllowedTools(user);
    return {
      configured: status.configured,
      model: status.model,
      providerLabel: status.providerLabel,
      mode: "READ_ONLY" as const,
      allowedToolNames: allowedTools.map((t) => t.function.name),
      suggestedPrompts: this.tools.getSuggestedPrompts(user),
    };
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
    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messages: session.messages.map((m) => this.toMessageView(m)),
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

  async chat(user: RequestUser, dto: SendAiChatDto) {
    this.enforceRateLimit(user.id);

    const promptText = dto.message.trim();
    if (!promptText) {
      throw new BadRequestException("Pertanyaan tidak boleh kosong.");
    }

    let session: { id: number; title: string };
    if (dto.sessionId) {
      const found = await this.prisma.main.aiChatSession.findFirst({
        where: { id: dto.sessionId, userId: user.id },
        select: { id: true, title: true },
      });
      if (!found) {
        throw new NotFoundException("Sesi percakapan tidak ditemukan.");
      }
      session = found;
    } else {
      const autoTitle =
        promptText.length > 70 ? `${promptText.slice(0, 67)}...` : promptText;
      session = await this.prisma.main.aiChatSession.create({
        data: { userId: user.id, title: autoTitle },
        select: { id: true, title: true },
      });
    }

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
      },
    });

    const allowedTools = this.tools.getAllowedTools(user);
    const messages: LlmChatMessage[] = [
      { role: "system", content: this.buildSystemPrompt(user) },
      ...this.sanitizeHistory(recentHistory),
      { role: "user", content: promptText },
    ];

    const usedLabels = new Set<string>();
    let finalReply = "";

    for (let step = 0; step < MAX_TOOL_ITERATIONS; step++) {
      const completion = await this.llm.complete(messages, allowedTools);

      if (completion.toolCalls.length === 0) {
        finalReply = (completion.content || "").trim();
        break;
      }

      messages.push({
        role: "assistant",
        content: completion.content ?? null,
        tool_calls: completion.toolCalls,
      });

      for (const tc of completion.toolCalls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = tc.function.arguments
            ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
            : {};
        } catch {
          parsedArgs = {};
        }

        const result = await this.tools.executeTool(tc.function.name, parsedArgs, user);
        if (result.allowed) {
          usedLabels.add(result.label);
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

    let session: { id: number; title: string };
    if (dto.sessionId) {
      const found = await this.prisma.main.aiChatSession.findFirst({
        where: { id: dto.sessionId, userId: user.id },
        select: { id: true, title: true },
      });
      if (!found) {
        throw new NotFoundException("Sesi percakapan tidak ditemukan.");
      }
      session = found;
    } else {
      const autoTitle =
        promptText.length > 70 ? `${promptText.slice(0, 67)}...` : promptText;
      session = await this.prisma.main.aiChatSession.create({
        data: { userId: user.id, title: autoTitle },
        select: { id: true, title: true },
      });
    }

    const recentHistory = await this.prisma.main.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_WINDOW,
    });
    recentHistory.reverse();

    // Filter pesan user yatim di ujung riwayat (akibat request gagal sebelumnya) agar peran user/assistant tetap rapi
    while (recentHistory.length > 0 && recentHistory[recentHistory.length - 1]?.role === "user") {
      recentHistory.pop();
    }

    const allowedTools = this.tools.getAllowedTools(user);
    const messages: LlmChatMessage[] = [
      { role: "system", content: this.buildSystemPrompt(user) },
      ...this.sanitizeHistory(recentHistory),
      { role: "user", content: promptText },
    ];

    const usedLabels = new Set<string>();
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
        content: completion.content ?? null,
        tool_calls: completion.toolCalls,
      });

      for (const tc of completion.toolCalls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = tc.function.arguments
            ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
            : {};
        } catch {
          parsedArgs = {};
        }

        emit({ type: "status", text: `Membaca data ERP (${tc.function.name})...` });
        const result = await this.tools.executeTool(tc.function.name, parsedArgs, user);
        if (result.allowed) {
          usedLabels.add(result.label);
          emit({ type: "status", text: `Menyusun ringkasan dari ${result.label}...` });
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

    const savedUserMsg = await this.prisma.main.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: promptText,
      },
    });

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
      },
    });
  }

  private buildSystemPrompt(user: RequestUser): string {
    const todayWib = getWibDateString();
    return [
      "Anda adalah Asisten AI Analis Bisnis & Keuangan resmi untuk Akuntra ERP.",
      `Pengguna saat ini: ${user.name} (Role: ${user.role}).`,
      `Tanggal hari ini (WIB / UTC+7): ${todayWib}.`,
      "",
      "ATURAN WAJIB:",
      "1. Mode saat ini adalah READ-ONLY. Tolak dengan sopan jika pengguna meminta membuat, mengubah, menyetujui, atau menghapus data/transaksi ERP.",
      "2. WAJIB panggil tool ERP yang tersedia sebelum menjawab pertanyaan terkait data aktual. Gunakan angka pre-agregasi (`note`, `countByStatus`, `totalRows`, subtotal/total) dari hasil tool; JANGAN mengarang atau menebak angka.",
      "3. Jika pengguna menanyakan perbandingan (mis. bulan ini vs bulan lalu), aktifkan parameter `compareWithPrevious: true` pada `get_financial_report` lalu hitung selisih & persentasenya.",
      "4. Jika tool tidak tersedia atau mengembalikan error akses ditolak, jelaskan dengan sopan bahwa peran pengguna saat ini tidak memiliki hak akses untuk informasi tersebut.",
      "",
      "FORMAT JAWABAN (WAJIB RAPI & MUDAH DIBACA):",
      "- Mulai dengan **1–2 kalimat Ringkasan Eksekutif** (kesimpulan utama + periode tanggal WIB).",
      "- Untuk laporan keuangan (Laba Rugi, Neraca, Arus Kas), daftar stok menipis, atau perbandingan angka, sajikan dalam **tabel Markdown** (`| Komponen | Nominal |`) agar rapi. Jangan cantumkan baris bernilai Rp 0 kecuali pengguna memintanya.",
      "- Format mata uang sebagai Rupiah (`Rp 1.250.000`).",
      "- Tutup dengan bagian singkat **Perlu Perhatian** bila ada temuan penting (proyek terlambat, stok di bawah minimum, kontrak/langganan hampir habis, atau persetujuan menunggu), dan boleh sertakan tautan halaman ERP relevan seperti `[Buka Laporan](/reports)`, `[Lihat Proyek](/projects)`, `[Cek Stok](/stock)`, `[Buka Persetujuan](/approvals)`, `[Lihat Prospek](/leads)`.",
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

  private sanitizeHistory(
    rows: Array<{ role: string; content: string }>,
  ): Array<{ role: "user" | "assistant"; content: string }> {
    const cleaned: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const r of rows) {
      const content = (r.content || "").trim();
      if (!content) continue;
      const role: "user" | "assistant" = r.role === "assistant" ? "assistant" : "user";
      // Riwayat harus mulai dari user dan bergantian user <-> assistant agar diterima semua provider (termasuk Gemini)
      if (cleaned.length === 0 && role !== "user") continue;
      const prev = cleaned[cleaned.length - 1];
      if (prev && prev.role === role) {
        prev.content = `${prev.content}\n\n${content}`;
      } else {
        cleaned.push({ role, content });
      }
    }
    // Pastikan pesan terakhir di riwayat bukan "user" karena pesan baru user akan ditambahkan setelahnya
    if (cleaned.length > 0 && cleaned[cleaned.length - 1]?.role === "user") {
      cleaned.pop();
    }
    return cleaned;
  }

  private toMessageView(m: {
    id: number;
    role: string;
    content: string;
    toolsUsedJson: string | null;
    createdAt: Date;
  }): AiChatMessageView {
    let toolsUsed: string[] = [];
    if (m.toolsUsedJson) {
      try {
        const parsed = JSON.parse(m.toolsUsedJson);
        if (Array.isArray(parsed)) {
          toolsUsed = parsed.filter((x): x is string => typeof x === "string");
        }
      } catch {
        toolsUsed = [];
      }
    }
    return {
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      toolsUsed,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
