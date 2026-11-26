import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";

const SETTING_KEY = "ai:llm_config";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_FALLBACKS = ["gemini-3.5-flash", "gemini-3.6-flash"];
const DEFAULT_TIMEOUT_MS = 45000;

interface StoredLlmConfig {
  baseUrl?: string;
  model?: string;
  fallbackModels?: string[];
  timeoutMs?: number;
  encryptedApiKey?: string;
}

export interface EffectiveLlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModels: string[];
  timeoutMs: number;
  source: "DB" | "ENV";
  hasApiKey: boolean;
}

export interface PublicLlmSettings {
  baseUrl: string;
  model: string;
  fallbackModels: string[];
  timeoutMs: number;
  hasApiKey: boolean;
  source: "DB" | "ENV";
  providerLabel: string;
}

export interface UpdateLlmSettingsInput {
  baseUrl?: string;
  model?: string;
  fallbackModels?: string[];
  timeoutMs?: number;
  apiKey?: string;
  clearApiKey?: boolean;
}

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);
  private cache: { value: StoredLlmConfig | null; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private deriveKey(): Buffer {
    const secret =
      this.config.get<string>("APP_ENCRYPTION_KEY") ||
      this.config.get<string>("JWT_SECRET") ||
      "akuntra-local-fallback-key";
    return createHash("sha256").update(secret).digest();
  }

  encryptSecret(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.deriveKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  decryptSecret(token: string): string | null {
    try {
      const parts = token.split(":");
      if (parts.length !== 4 || parts[0] !== "v1") return null;
      const iv = Buffer.from(parts[1]!, "base64");
      const tag = Buffer.from(parts[2]!, "base64");
      const data = Buffer.from(parts[3]!, "base64");
      const decipher = createDecipheriv("aes-256-gcm", this.deriveKey(), iv);
      decipher.setAuthTag(tag);
      const out = Buffer.concat([decipher.update(data), decipher.final()]);
      return out.toString("utf8");
    } catch {
      this.logger.warn("Gagal mendekripsi API key LLM tersimpan.");
      return null;
    }
  }

  private async readStored(): Promise<StoredLlmConfig | null> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.value;
    }
    try {
      const row = await this.prisma.main.systemSetting.findUnique({
        where: { key: SETTING_KEY },
      });
      const parsed = row?.value ? (JSON.parse(row.value) as StoredLlmConfig) : null;
      this.cache = { value: parsed, expiresAt: Date.now() + 15_000 };
      return parsed;
    } catch {
      return null;
    }
  }

  private envConfig() {
    const baseUrl = (this.config.get<string>("LLM_BASE_URL") || DEFAULT_BASE_URL)
      .trim()
      .replace(/\/+$/, "");
    const apiKey = (this.config.get<string>("LLM_API_KEY") || "").trim();
    const model = (this.config.get<string>("LLM_MODEL") || DEFAULT_MODEL).trim();
    const rawFallbacks = (this.config.get<string>("LLM_FALLBACK_MODELS") || "").trim();
    const fallbackModels = rawFallbacks
      ? rawFallbacks
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean)
      : baseUrl.includes("generativelanguage.googleapis.com")
        ? DEFAULT_FALLBACKS
        : [];
    const parsedTimeout = Number(this.config.get<string>("LLM_TIMEOUT_MS") || DEFAULT_TIMEOUT_MS);
    const timeoutMs =
      Number.isFinite(parsedTimeout) && parsedTimeout >= 5000 ? parsedTimeout : DEFAULT_TIMEOUT_MS;
    return { baseUrl, apiKey, model, fallbackModels, timeoutMs };
  }

  async getEffectiveConfig(): Promise<EffectiveLlmConfig> {
    const stored = await this.readStored();
    const env = this.envConfig();

    const baseUrl = (stored?.baseUrl || env.baseUrl).trim().replace(/\/+$/, "");
    const model = (stored?.model || env.model).trim();
    const fallbackModels = Array.isArray(stored?.fallbackModels)
      ? stored.fallbackModels.filter(Boolean)
      : env.fallbackModels;
    const timeoutMs =
      typeof stored?.timeoutMs === "number" && stored.timeoutMs >= 5000
        ? stored.timeoutMs
        : env.timeoutMs;

    const dbKey = stored?.encryptedApiKey ? this.decryptSecret(stored.encryptedApiKey) : null;
    const apiKey = (dbKey || env.apiKey).trim();
    const source: "DB" | "ENV" = stored ? "DB" : "ENV";

    return {
      baseUrl,
      apiKey,
      model,
      fallbackModels,
      timeoutMs,
      source,
      hasApiKey: Boolean(apiKey),
    };
  }

  getProviderLabel(baseUrl: string): string {
    const isLocal =
      baseUrl.includes("localhost") ||
      baseUrl.includes("127.0.0.1") ||
      baseUrl.includes(":11434") ||
      baseUrl.includes(":8000");
    if (baseUrl.includes("generativelanguage.googleapis.com")) return "Google Gemini API";
    if (baseUrl.includes("api.groq.com")) return "Groq Cloud";
    if (baseUrl.includes("api.openai.com")) return "OpenAI";
    if (isLocal) return "Local LLM (On-Premise)";
    return "OpenAI-Compatible LLM";
  }

  async getPublicSettings(): Promise<PublicLlmSettings> {
    const eff = await this.getEffectiveConfig();
    return {
      baseUrl: eff.baseUrl,
      model: eff.model,
      fallbackModels: eff.fallbackModels,
      timeoutMs: eff.timeoutMs,
      hasApiKey: eff.hasApiKey,
      source: eff.source,
      providerLabel: this.getProviderLabel(eff.baseUrl),
    };
  }

  async updateSettings(
    input: UpdateLlmSettingsInput,
    actor: RequestUser,
  ): Promise<PublicLlmSettings> {
    const existing = (await this.readStored()) ?? {};
    const next: StoredLlmConfig = {
      ...existing,
      ...(input.baseUrl !== undefined
        ? { baseUrl: input.baseUrl.trim().replace(/\/+$/, "") || undefined }
        : {}),
      ...(input.model !== undefined ? { model: input.model.trim() || undefined } : {}),
      ...(input.fallbackModels !== undefined
        ? { fallbackModels: input.fallbackModels.map((m) => m.trim()).filter(Boolean) }
        : {}),
      ...(input.timeoutMs !== undefined && Number.isFinite(input.timeoutMs)
        ? { timeoutMs: Math.max(5000, Math.min(120000, Math.round(input.timeoutMs))) }
        : {}),
    };

    if (input.clearApiKey) {
      delete next.encryptedApiKey;
    } else if (input.apiKey && input.apiKey.trim()) {
      next.encryptedApiKey = this.encryptSecret(input.apiKey.trim());
    }

    await this.prisma.main.systemSetting.upsert({
      where: { key: SETTING_KEY },
      create: {
        key: SETTING_KEY,
        value: JSON.stringify(next),
        updatedById: actor.id,
      },
      update: {
        value: JSON.stringify(next),
        updatedById: actor.id,
      },
    });
    this.cache = null;

    // Jangan pernah mencatat API key ke audit log
    void this.audit.log({
      actor,
      action: "UPDATE_AI_SETTINGS",
      entityType: "system_setting",
      entityId: SETTING_KEY,
      detail: `Model: ${next.model || DEFAULT_MODEL}, Key diubah: ${Boolean(input.apiKey?.trim() || input.clearApiKey)}`,
    });

    return this.getPublicSettings();
  }
}
