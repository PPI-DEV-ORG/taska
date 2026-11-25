import * as React from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, View } from "react-native";
import {
  AlertTriangle,
  Bot,
  Copy,
  Database,
  History,
  MessageSquarePlus,
  Send,
  Share2,
  Sparkles,
  Trash2,
  User as UserIcon,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/akuntra/basics";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { waktuRelatif } from "@/lib/format";
import { getStorageItem, setStorageItem } from "@/lib/storage";
import { MarkdownText } from "./markdown-text";
import {
  deleteAiSession,
  fetchAiCapabilities,
  fetchAiSession,
  fetchAiSessions,
  sendAiChat,
  streamAiChat,
  type AiCapabilities,
  type AiChatMessageItem,
  type AiChatSessionSummary,
} from "@/services/api";

function getLastSessionStorageKey(userId?: string | number) {
  return `akuntra_ai_last_session_${userId ?? "anon"}`;
}

export function AiAssistantScreen() {
  const { isMobile } = useBreakpoint();
  const { toast, user } = useApp();
  const storageKey = getLastSessionStorageKey(user?.id);

  const [capabilities, setCapabilities] = React.useState<AiCapabilities | null>(null);
  const [sessions, setSessions] = React.useState<AiChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = React.useState<number | null>(null);
  const [messages, setMessages] = React.useState<AiChatMessageItem[]>([]);
  const [input, setInput] = React.useState("");
  const [loadingInit, setLoadingInit] = React.useState(true);
  const [loadingSession, setLoadingSession] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [streamStatus, setStreamStatus] = React.useState<string | null>(null);
  const [streamingReply, setStreamingReply] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [showMobileHistory, setShowMobileHistory] = React.useState(false);

  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);

  const loadInitial = React.useCallback(async () => {
    setLoadingInit(true);
    setErrorMsg(null);
    try {
      const [cap, list] = await Promise.all([fetchAiCapabilities(), fetchAiSessions()]);
      setCapabilities(cap);
      setSessions(list);
    } catch (err) {
      setErrorMsg((err as Error)?.message || "Gagal memuat konfigurasi Asisten AI.");
    } finally {
      setLoadingInit(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    void Promise.all([fetchAiCapabilities(), fetchAiSessions()])
      .then(async ([cap, list]) => {
        if (!active) return;
        setCapabilities(cap);
        setSessions(list);

        // Buka otomatis sesi terakhir yang aktif agar tidak tertutup saat pindah halaman
        const saved = getStorageItem(storageKey);
        if (saved === "new" || list.length === 0) return;

        const savedId = saved ? Number(saved) : NaN;
        const target =
          (Number.isFinite(savedId) ? list.find((s) => s.id === savedId) : undefined) ?? list[0];
        if (!target) return;

        try {
          const detail = await fetchAiSession(target.id);
          if (!active) return;
          setActiveSessionId(detail.id);
          setMessages(detail.messages);
          setStorageItem(storageKey, String(detail.id));
        } catch {
          // Abaikan jika sesi sudah terhapus
        }
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg((err as Error)?.message || "Gagal memuat konfigurasi Asisten AI.");
      })
      .finally(() => {
        if (active) setLoadingInit(false);
      });
    return () => {
      active = false;
    };
  }, [storageKey]);

  const openSession = React.useCallback(
    async (id: number) => {
      setLoadingSession(true);
      setErrorMsg(null);
      setShowMobileHistory(false);
      try {
        const detail = await fetchAiSession(id);
        setActiveSessionId(detail.id);
        setMessages(detail.messages);
        setStorageItem(storageKey, String(detail.id));
      } catch (err) {
        setErrorMsg((err as Error)?.message || "Gagal membuka riwayat percakapan.");
      } finally {
        setLoadingSession(false);
      }
    },
    [storageKey],
  );

  const startNewChat = React.useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setErrorMsg(null);
    setShowMobileHistory(false);
    setStorageItem(storageKey, "new");
  }, [storageKey]);

  const handleDeleteSession = React.useCallback(
    async (id: number) => {
      try {
        await deleteAiSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (activeSessionId === id) {
          setActiveSessionId(null);
          setMessages([]);
          setStorageItem(storageKey, "new");
        }
        toast("Riwayat percakapan dihapus");
      } catch (err) {
        toast((err as Error)?.message || "Gagal menghapus percakapan");
      }
    },
    [activeSessionId, storageKey, toast],
  );

  const handleSend = React.useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || sending) return;
      if (capabilities && !capabilities.configured) {
        setErrorMsg("Asisten AI belum dikonfigurasi. Mohon isi LLM_API_KEY di server API.");
        return;
      }

      setSending(true);
      setStreamStatus("Menganalisis pertanyaan...");
      setStreamingReply("");
      setErrorMsg(null);
      if (!overrideText) setInput("");

      const optimisticId = -Date.now();
      const optimisticUser: AiChatMessageItem = {
        id: optimisticId,
        role: "user",
        content: text,
        toolsUsed: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

      try {
        const reply =
          Platform.OS === "web"
            ? await streamAiChat(text, activeSessionId ?? undefined, {
                onStatus: (s) => setStreamStatus(s),
                onDelta: (chunk) => {
                  setStreamStatus(null);
                  setStreamingReply((prev) => prev + chunk);
                  scrollRef.current?.scrollToEnd({ animated: false });
                },
              })
            : await sendAiChat(text, activeSessionId ?? undefined);
        setActiveSessionId(reply.sessionId);
        setStorageItem(storageKey, String(reply.sessionId));
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticId),
          reply.userMessage,
          reply.assistantMessage,
        ]);

        setSessions((prev) => {
          const exists = prev.find((s) => s.id === reply.sessionId);
          const updatedItem: AiChatSessionSummary = {
            id: reply.sessionId,
            title: reply.sessionTitle,
            messageCount: (exists?.messageCount ?? 0) + 2,
            createdAt: exists?.createdAt ?? reply.userMessage.createdAt,
            updatedAt: reply.assistantMessage.createdAt,
          };
          return [updatedItem, ...prev.filter((s) => s.id !== reply.sessionId)];
        });
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        if (!overrideText) setInput(text);
        setErrorMsg((err as Error)?.message || "Gagal mendapatkan jawaban dari Asisten AI.");
      } finally {
        setSending(false);
        setStreamStatus(null);
        setStreamingReply("");
      }
    },
    [activeSessionId, capabilities, input, sending, storageKey],
  );

  const handleCopyOrShare = React.useCallback(
    async (text: string) => {
      try {
        if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          toast("Jawaban disalin ke clipboard");
          return;
        }
        await Share.share({ message: text });
      } catch {
        toast("Gagal menyalin jawaban");
      }
    },
    [toast],
  );

  const renderSessionList = () => (
    <View className="gap-2">
      <Button onPress={startNewChat} size="sm" className="w-full">
        <MessageSquarePlus size={15} color="#ffffff" />
        <Text className="text-xs font-semibold text-primary-foreground">Percakapan Baru</Text>
      </Button>

      {sessions.length === 0 ? (
        <Text className="text-muted-foreground py-4 text-center text-xs">
          Belum ada riwayat percakapan.
        </Text>
      ) : (
        <ScrollView className="max-h-[420px]" contentContainerClassName="gap-1.5" nestedScrollEnabled>
          {sessions.map((s) => {
            const active = s.id === activeSessionId;
            return (
              <Pressable
                key={s.id}
                onPress={() => void openSession(s.id)}
                className={cn(
                  "flex-row items-center justify-between gap-2 rounded-xl border px-3 py-2.5",
                  active
                    ? "bg-primary/10 border-primary/40"
                    : "bg-card border-border/70 hover:bg-panel/60",
                )}
              >
                <View className="flex-1 min-w-0">
                  <Text
                    className={cn(
                      "text-xs font-semibold",
                      active ? "text-primary" : "text-foreground",
                    )}
                    numberOfLines={1}
                  >
                    {s.title}
                  </Text>
                  <Text className="text-muted-foreground text-[10px] mt-0.5">
                    {s.messageCount} pesan · {waktuRelatif(s.updatedAt)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void handleDeleteSession(s.id)}
                  hitSlop={8}
                  className="p-1.5 rounded-lg hover:bg-danger/15"
                >
                  <Trash2 size={14} color={colors.muted} />
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  return (
    <View className="gap-4">
      <PageHeader
        title="Asisten AI ERP"
        subtitle="Tanyakan status leads, keuangan, proyek, dan stok sesuai hak akses peran Anda (Mode Read-Only)."
        onRefresh={loadInitial}
        action={
          isMobile ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onPress={() => setShowMobileHistory((v) => !v)}
            >
              <History size={14} color={colors.text} />
              <Text className="text-xs">Riwayat ({sessions.length})</Text>
            </Button>
          ) : null
        }
      >
        {capabilities ? (
          <View className="flex-row flex-wrap items-center gap-2 mt-1">
            <View
              className={cn(
                "flex-row items-center gap-1.5 rounded-full border px-2.5 py-1",
                capabilities.configured
                  ? "bg-primary/10 border-primary/30"
                  : "bg-warning/10 border-warning/30",
              )}
            >
              <Sparkles
                size={12}
                color={capabilities.configured ? colors.primary : colors.warning}
              />
              <Text
                className={cn(
                  "text-[11px] font-semibold",
                  capabilities.configured ? "text-primary" : "text-warning",
                )}
              >
                {capabilities.configured
                  ? `${capabilities.providerLabel} · ${capabilities.model}`
                  : "Belum Dikonfigurasi"}
              </Text>
            </View>
            <View className="bg-panel border-border/70 rounded-full border px-2.5 py-1">
              <Text className="text-muted-foreground text-[11px] font-medium">
                Mode Read-Only · {capabilities.allowedToolNames.length} Sumber Data Aktif
              </Text>
            </View>
          </View>
        ) : null}
      </PageHeader>

      {capabilities && !capabilities.configured ? (
        <View className="bg-warning/10 border-warning/40 flex-row items-start gap-3 rounded-2xl border p-4">
          <AlertTriangle size={18} color={colors.warning} />
          <View className="flex-1 min-w-0 gap-1">
            <Text className="text-warning text-sm font-semibold">
              API Key LLM Belum Diatur di Server
            </Text>
            <Text className="text-muted-foreground text-xs leading-relaxed">
              Isi LLM_API_KEY di apps/api/.env (contoh: Google AI Studio Gemini 2.5 Flash) lalu
              restart API untuk mengaktifkan Asisten AI.
            </Text>
          </View>
        </View>
      ) : null}

      {isMobile && showMobileHistory ? (
        <Panel title="Riwayat Percakapan" icon={History}>
          {renderSessionList()}
        </Panel>
      ) : null}

      <View className={isMobile ? "gap-4" : "flex-row gap-5 items-start"}>
        {!isMobile ? (
          <View className="w-[270px] shrink-0">
            <Panel title="Riwayat Chat" icon={History}>
              {renderSessionList()}
            </Panel>
          </View>
        ) : null}

        <View className={isMobile ? "w-full" : "flex-1 min-w-0"}>
          <Panel
            title="Percakapan"
            subtitle="Jawaban diambil langsung dari data aktual ERP sesuai RBAC Anda"
            icon={Bot}
            right={
              activeSessionId ? (
                <Button variant="outline" size="sm" onPress={startNewChat}>
                  <MessageSquarePlus size={14} color={colors.text} />
                  <Text className="text-xs">Baru</Text>
                </Button>
              ) : null
            }
          >
            <View className="gap-4">
              {loadingInit || loadingSession ? (
                <View className="py-12 items-center justify-center gap-2">
                  <ActivityIndicator color={colors.primary} />
                  <Text className="text-muted-foreground text-xs">Memuat percakapan...</Text>
                </View>
              ) : messages.length === 0 ? (
                <View className="py-6 gap-4">
                  <View className="items-center gap-2">
                    <View className="bg-primary/10 size-12 rounded-2xl items-center justify-center">
                      <Sparkles size={22} color={colors.primary} />
                    </View>
                    <Text className="text-base font-bold text-foreground text-center">
                      Tanya Apa Saja tentang Data ERP
                    </Text>
                    <Text className="text-muted-foreground text-xs text-center max-w-md">
                      Pilih salah satu pertanyaan cepat di bawah atau ketik pertanyaan Anda sendiri
                      dalam Bahasa Indonesia.
                    </Text>
                  </View>

                  {capabilities?.suggestedPrompts?.length ? (
                    <View className="flex-row flex-wrap gap-2 justify-center">
                      {capabilities.suggestedPrompts.map((p) => (
                        <Pressable
                          key={p}
                          disabled={sending || !capabilities.configured}
                          onPress={() => void handleSend(p)}
                          className="bg-panel/80 border-border/80 hover:border-primary/50 active:opacity-80 rounded-xl border px-3 py-2"
                        >
                          <Text className="text-foreground text-xs">{p}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : (
                <ScrollView
                  ref={scrollRef}
                  className="max-h-[480px]"
                  contentContainerClassName="gap-3 py-1"
                  nestedScrollEnabled
                >
                  {messages.map((m) => {
                    const isUser = m.role === "user";
                    return (
                      <View
                        key={m.id}
                        className={cn("flex-row gap-2.5", isUser ? "justify-end" : "justify-start")}
                      >
                        {!isUser ? (
                          <View className="bg-primary/15 size-8 shrink-0 rounded-xl items-center justify-center mt-0.5">
                            <Bot size={16} color={colors.primary} />
                          </View>
                        ) : null}

                        <View
                          className={cn(
                            "rounded-2xl px-3.5 py-2.5 max-w-[85%]",
                            isUser
                              ? "bg-primary"
                              : "bg-panel/80 border border-border/70",
                          )}
                        >
                          {isUser ? (
                            <Text className="text-sm leading-relaxed text-primary-foreground">
                              {m.content}
                            </Text>
                          ) : (
                            <MarkdownText content={m.content} />
                          )}

                          {!isUser ? (
                            <View className="flex-row flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-border/50">
                              <View className="flex-row flex-wrap items-center gap-1.5 flex-1 min-w-0">
                                {m.toolsUsed.length > 0 ? (
                                  <>
                                    <Database size={11} color={colors.muted} />
                                    {m.toolsUsed.map((label) => (
                                      <View
                                        key={label}
                                        className="bg-card border-border/70 rounded-md border px-1.5 py-0.5"
                                      >
                                        <Text className="text-muted-foreground text-[10px] font-medium">
                                          {label}
                                        </Text>
                                      </View>
                                    ))}
                                  </>
                                ) : null}
                              </View>
                              <Pressable
                                onPress={() => void handleCopyOrShare(m.content)}
                                hitSlop={8}
                                className="flex-row items-center gap-1 rounded-md px-2 py-1 hover:bg-card active:opacity-70"
                              >
                                {Platform.OS === "web" ? (
                                  <Copy size={12} color={colors.muted} />
                                ) : (
                                  <Share2 size={12} color={colors.muted} />
                                )}
                                <Text className="text-muted-foreground text-[10px] font-medium">
                                  {Platform.OS === "web" ? "Salin" : "Bagikan"}
                                </Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>

                        {isUser ? (
                          <View className="bg-panel border-border/80 size-8 shrink-0 rounded-xl border items-center justify-center mt-0.5">
                            <UserIcon size={15} color={colors.textSecondary} />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}

                  {sending ? (
                    <View className="flex-row items-start gap-2.5">
                      <View className="bg-primary/15 size-8 shrink-0 rounded-xl items-center justify-center mt-0.5">
                        <Bot size={16} color={colors.primary} />
                      </View>
                      <View className="bg-panel/80 border-border/70 rounded-2xl border px-3.5 py-2.5 max-w-[85%] gap-1.5">
                        {streamingReply ? (
                          <MarkdownText content={streamingReply} />
                        ) : null}
                        <View className="flex-row items-center gap-2">
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text className="text-muted-foreground text-xs">
                            {streamStatus || "Membaca data ERP & menyusun jawaban..."}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : null}
                </ScrollView>
              )}

              {errorMsg ? (
                <View className="bg-danger/10 border-danger/30 rounded-xl border px-3 py-2">
                  <Text className="text-danger text-xs">{errorMsg}</Text>
                </View>
              ) : null}

              {messages.length > 0 && capabilities?.suggestedPrompts?.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2 py-0.5"
                >
                  {capabilities.suggestedPrompts.map((p) => (
                    <Pressable
                      key={p}
                      disabled={sending || !capabilities.configured}
                      onPress={() => void handleSend(p)}
                      className="bg-panel/70 border-border/70 hover:border-primary/50 active:opacity-80 rounded-full border px-3 py-1.5"
                    >
                      <Text className="text-muted-foreground text-[11px] font-medium" numberOfLines={1}>
                        {p}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <View className="flex-row items-center gap-2 pt-2 border-t border-border/60">
                <View className="flex-1 min-w-0">
                  <Input
                    value={input}
                    onChangeText={setInput}
                    placeholder="Tulis pertanyaan Anda tentang data ERP..."
                    editable={!sending}
                    returnKeyType="send"
                    onSubmitEditing={() => void handleSend()}
                  />
                </View>
                <Button
                  disabled={sending || !input.trim()}
                  onPress={() => void handleSend()}
                  className="h-11 px-4 shrink-0"
                >
                  <Send size={15} color="#ffffff" />
                  {!isMobile ? (
                    <Text className="text-xs font-semibold text-primary-foreground">Kirim</Text>
                  ) : null}
                </Button>
              </View>
            </View>
          </Panel>
        </View>
      </View>
    </View>
  );
}
