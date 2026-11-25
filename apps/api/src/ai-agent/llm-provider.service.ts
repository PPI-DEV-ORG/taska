import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type LlmRole = "system" | "user" | "assistant" | "tool";

export interface LlmToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
  /** Menyimpan field tambahan provider (mis. extra_content.google.thought_signature pada Gemini). */
  [key: string]: unknown;
}

export interface LlmChatMessage {
  role: LlmRole;
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: LlmToolCall[];
}

export interface LlmToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmCompletionResult {
  content: string | null;
  toolCalls: LlmToolCall[];
  finishReason: string | null;
}

export interface LlmProviderStatus {
  configured: boolean;
  model: string;
  providerLabel: string;
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_TIMEOUT_MS = 45000;
const RETRY_DELAY_MS = 1200;

@Injectable()
export class LlmProviderService {
  private readonly logger = new Logger(LlmProviderService.name);

  constructor(private readonly config: ConfigService) {}

  private getBaseUrl(): string {
    const raw = (this.config.get<string>("LLM_BASE_URL") || DEFAULT_BASE_URL).trim();
    return raw.replace(/\/+$/, "");
  }

  private getApiKey(): string {
    return (this.config.get<string>("LLM_API_KEY") || "").trim();
  }

  private getModel(): string {
    return (this.config.get<string>("LLM_MODEL") || DEFAULT_MODEL).trim();
  }

  private getFallbackModel(): string | null {
    const raw = (this.config.get<string>("LLM_FALLBACK_MODEL") || "").trim();
    return raw || null;
  }

  private getTimeoutMs(): number {
    const parsed = Number(this.config.get<string>("LLM_TIMEOUT_MS") || DEFAULT_TIMEOUT_MS);
    return Number.isFinite(parsed) && parsed >= 5000 ? parsed : DEFAULT_TIMEOUT_MS;
  }

  getStatus(): LlmProviderStatus {
    const baseUrl = this.getBaseUrl();
    const apiKey = this.getApiKey();
    const model = this.getModel();
    const isLocal =
      baseUrl.includes("localhost") ||
      baseUrl.includes("127.0.0.1") ||
      baseUrl.includes(":11434") ||
      baseUrl.includes(":8000");

    let providerLabel = "OpenAI-Compatible LLM";
    if (baseUrl.includes("generativelanguage.googleapis.com")) {
      providerLabel = "Google Gemini API";
    } else if (baseUrl.includes("api.groq.com")) {
      providerLabel = "Groq Cloud";
    } else if (baseUrl.includes("api.openai.com")) {
      providerLabel = "OpenAI";
    } else if (isLocal) {
      providerLabel = "Local LLM (On-Premise)";
    }

    return {
      configured: Boolean(apiKey) || isLocal,
      model,
      providerLabel,
    };
  }

  async complete(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
  ): Promise<LlmCompletionResult> {
    const status = this.getStatus();
    if (!status.configured) {
      throw new ServiceUnavailableException(
        "Asisten AI belum dikonfigurasi. Mohon isi LLM_API_KEY di konfigurasi server API.",
      );
    }

    const primaryModel = this.getModel();
    const fallbackModel = this.getFallbackModel();
    const attempts = [primaryModel, fallbackModel ?? primaryModel];

    let lastError: ServiceUnavailableException | null = null;

    for (let i = 0; i < attempts.length; i++) {
      const modelToUse = attempts[i] ?? primaryModel;
      const result = await this.callOnce(modelToUse, messages, tools);
      if (result.ok) {
        return result.data;
      }
      lastError = result.error;
      if (!result.retryable || i === attempts.length - 1) {
        throw lastError;
      }
      this.logger.warn(
        `Percobaan ${i + 1} gagal (${result.statusCode ?? "timeout"}), mencoba ulang dengan model ${attempts[i + 1]}...`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    throw (
      lastError ??
      new ServiceUnavailableException("Layanan AI sedang tidak tersedia. Silakan coba lagi.")
    );
  }

  private async callOnce(
    model: string,
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
  ): Promise<
    | { ok: true; data: LlmCompletionResult }
    | { ok: false; retryable: boolean; statusCode?: number; error: ServiceUnavailableException }
  > {
    const baseUrl = this.getBaseUrl();
    const apiKey = this.getApiKey();
    const timeoutMs = this.getTimeoutMs();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model,
        messages,
        temperature: 0.2,
      };
      if (tools.length > 0) {
        body.tools = tools;
        body.tool_choice = "auto";
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        this.logger.warn(`LLM HTTP ${res.status} (${model}): ${errText.slice(0, 300)}`);

        if (res.status === 429) {
          return {
            ok: false,
            retryable: true,
            statusCode: 429,
            error: new ServiceUnavailableException(
              "Batas kuota permintaan AI sementara tercapai. Silakan tunggu beberapa saat lalu coba lagi.",
            ),
          };
        }
        if (res.status === 503 || res.status === 502 || res.status === 500) {
          return {
            ok: false,
            retryable: true,
            statusCode: res.status,
            error: new ServiceUnavailableException(
              "Server model AI sedang padat sementara. Silakan kirim ulang beberapa detik lagi.",
            ),
          };
        }
        if (res.status === 401 || res.status === 403) {
          return {
            ok: false,
            retryable: false,
            statusCode: res.status,
            error: new ServiceUnavailableException(
              "Kunci API LLM tidak valid atau ditolak oleh penyedia layanan AI.",
            ),
          };
        }
        return {
          ok: false,
          retryable: false,
          statusCode: res.status,
          error: new ServiceUnavailableException(
            `Layanan AI sedang bermasalah (HTTP ${res.status}). Silakan coba beberapa saat lagi.`,
          ),
        };
      }

      const json = (await res.json()) as {
        choices?: Array<{
          finish_reason?: string | null;
          message?: {
            content?: string | null;
            tool_calls?: LlmToolCall[];
          };
        }>;
      };

      const choice = json.choices?.[0];
      if (!choice?.message) {
        return {
          ok: false,
          retryable: true,
          error: new ServiceUnavailableException(
            "Layanan AI mengembalikan respons kosong. Silakan coba lagi.",
          ),
        };
      }

      return {
        ok: true,
        data: {
          content: choice.message.content ?? null,
          toolCalls: Array.isArray(choice.message.tool_calls) ? choice.message.tool_calls : [],
          finishReason: choice.finish_reason ?? null,
        },
      };
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        return {
          ok: false,
          retryable: false,
          error: new ServiceUnavailableException(
            "Permintaan ke layanan AI melebihi batas waktu. Silakan coba pertanyaan yang lebih spesifik.",
          ),
        };
      }
      this.logger.error(`Gagal menghubungi layanan AI: ${(err as Error)?.message}`);
      return {
        ok: false,
        retryable: false,
        error: new ServiceUnavailableException(
          "Tidak dapat terhubung ke layanan AI. Periksa koneksi jaringan server atau konfigurasi LLM_BASE_URL.",
        ),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async completeStream(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[],
    onDelta: (chunk: string) => void,
  ): Promise<LlmCompletionResult> {
    const status = this.getStatus();
    if (!status.configured) {
      throw new ServiceUnavailableException(
        "Asisten AI belum dikonfigurasi. Mohon isi LLM_API_KEY di konfigurasi server API.",
      );
    }

    const baseUrl = this.getBaseUrl();
    const apiKey = this.getApiKey();
    const model = this.getModel();
    const timeoutMs = this.getTimeoutMs();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model,
        messages,
        temperature: 0.2,
        stream: true,
      };
      if (tools.length > 0) {
        body.tools = tools;
        body.tool_choice = "auto";
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        this.logger.warn(`LLM Stream HTTP ${res.status} (${model}): ${errText.slice(0, 300)}`);
        // Beberapa model (mis. Gemini OpenAI-compat dengan tools) menolak stream=true (400) atau padat (429/5xx):
        // otomatis fallback ke non-streaming complete() yang juga memiliki mekanisme retry/fallback model.
        if (
          res.status === 400 ||
          res.status === 429 ||
          res.status === 503 ||
          res.status === 502 ||
          res.status === 500
        ) {
          const fallback = await this.complete(messages, tools);
          if (fallback.content) onDelta(fallback.content);
          return fallback;
        }
        if (res.status === 401 || res.status === 403) {
          throw new ServiceUnavailableException(
            "Kunci API LLM tidak valid atau ditolak oleh penyedia layanan AI.",
          );
        }
        throw new ServiceUnavailableException(
          `Layanan AI sedang bermasalah (HTTP ${res.status}). Silakan coba beberapa saat lagi.`,
        );
      }

      const contentType = res.headers.get("content-type") || "";
      if (!res.body || !contentType.includes("text/event-stream")) {
        const json = (await res.json()) as {
          choices?: Array<{
            finish_reason?: string | null;
            message?: { content?: string | null; tool_calls?: LlmToolCall[] };
          }>;
        };
        const choice = json.choices?.[0];
        const text = choice?.message?.content ?? null;
        if (text) onDelta(text);
        return {
          content: text,
          toolCalls: Array.isArray(choice?.message?.tool_calls) ? choice.message.tool_calls : [],
          finishReason: choice?.finish_reason ?? null,
        };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let finishReason: string | null = null;
      const toolList: LlmToolCall[] = [];
      const toolByIndex = new Map<number, LlmToolCall>();
      const toolById = new Map<string, LlmToolCall>();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nlIdx = buffer.indexOf("\n");
        while (nlIdx >= 0) {
          const rawLine = buffer.slice(0, nlIdx).trim();
          buffer = buffer.slice(nlIdx + 1);
          nlIdx = buffer.indexOf("\n");

          if (!rawLine.startsWith("data:")) continue;
          const dataStr = rawLine.slice(5).trim();
          if (!dataStr || dataStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(dataStr) as {
              choices?: Array<{
                finish_reason?: string | null;
                delta?: {
                  content?: string | null;
                  tool_calls?: Array<
                    {
                      index?: number;
                      id?: string;
                      type?: "function";
                      function?: { name?: string; arguments?: string };
                    } & Record<string, unknown>
                  >;
                };
              }>;
            };
            const choice = parsed.choices?.[0];
            if (!choice) continue;
            if (choice.finish_reason) finishReason = choice.finish_reason;

            const deltaContent = choice.delta?.content;
            if (typeof deltaContent === "string" && deltaContent.length > 0) {
              content += deltaContent;
              onDelta(deltaContent);
            }

            if (Array.isArray(choice.delta?.tool_calls)) {
              for (const tc of choice.delta.tool_calls) {
                const hasIdx = typeof tc.index === "number";
                let existing: LlmToolCall | undefined;
                if (tc.id && toolById.has(tc.id)) {
                  existing = toolById.get(tc.id);
                } else if (hasIdx && toolByIndex.has(tc.index!)) {
                  const candidate = toolByIndex.get(tc.index!)!;
                  // Jika Gemini mengirim beberapa tool call paralel dengan index sama tapi id berbeda, buat entry baru
                  if (!tc.id || candidate.id === tc.id) {
                    existing = candidate;
                  }
                }

                if (!existing) {
                  existing = {
                    id: tc.id || `call_${toolList.length}_${Date.now()}`,
                    type: "function",
                    function: { name: "", arguments: "" },
                  };
                  toolList.push(existing);
                  if (tc.id) toolById.set(tc.id, existing);
                  if (hasIdx) toolByIndex.set(tc.index!, existing);
                }

                if (tc.id) {
                  existing.id = tc.id;
                  toolById.set(tc.id, existing);
                }
                if (tc.function?.name) existing.function.name += tc.function.name;
                if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;

                // Pertahankan field tambahan provider (mis. extra_content / thought_signature Gemini)
                for (const [k, v] of Object.entries(tc)) {
                  if (
                    k !== "index" &&
                    k !== "id" &&
                    k !== "type" &&
                    k !== "function" &&
                    v !== undefined
                  ) {
                    existing[k] = v;
                  }
                }
              }
            }
          } catch {
            // Abaikan potongan chunk parsial
          }
        }
      }

      return {
        content: content || null,
        toolCalls: toolList,
        finishReason,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      if ((err as Error)?.name === "AbortError") {
        throw new ServiceUnavailableException(
          "Permintaan ke layanan AI melebihi batas waktu. Silakan coba pertanyaan yang lebih spesifik.",
        );
      }
      this.logger.error(`Gagal streaming layanan AI: ${(err as Error)?.message}`);
      throw new ServiceUnavailableException(
        "Tidak dapat terhubung ke layanan AI. Periksa koneksi jaringan server atau konfigurasi LLM_BASE_URL.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
