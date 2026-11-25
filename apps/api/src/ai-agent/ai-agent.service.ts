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
      ...recentHistory.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
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
        content: completion.content,
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

  private buildSystemPrompt(user: RequestUser): string {
    const todayWib = getWibDateString();
    return [
      "Anda adalah Asisten AI resmi untuk Akuntra ERP.",
      `Pengguna saat ini: ${user.name} (Role: ${user.role}).`,
      `Tanggal hari ini (WIB / UTC+7): ${todayWib}.`,
      "",
      "ATURAN WAJIB:",
      "1. Mode saat ini adalah READ-ONLY. Tolak dengan sopan jika pengguna meminta membuat, mengubah, menyetujui, atau menghapus data/transaksi ERP.",
      "2. WAJIB panggil tool ERP yang tersedia sebelum menjawab pertanyaan terkait data aktual (leads, keuangan, proyek, stok, persetujuan, surat jalan, kontrak). JANGAN pernah mengarang atau menebak angka.",
      "3. Jika suatu data/tool tidak tersedia atau mengembalikan error akses ditolak, jelaskan dengan sopan bahwa peran pengguna saat ini tidak memiliki hak akses untuk informasi tersebut.",
      "4. Jawab dalam Bahasa Indonesia yang ringkas, jelas, profesional, dan mudah dibaca (gunakan poin/daftar bila perlu). Format mata uang sebagai Rupiah (Rp ...).",
      "5. Jika hasil tool terpotong (truncated: true), sebutkan total data dan jelaskan bahwa ringkasan menampilkan sebagian data teratas.",
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
