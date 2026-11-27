import * as React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  FileText,
  History,
  MessageSquarePlus,
  Paperclip,
  Send,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  Undo2,
  User as UserIcon,
  X,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/akuntra/basics";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { waktuRelatif } from "@/lib/format";
import { getStorageItem, setStorageItem } from "@/lib/storage";
import { MarkdownText } from "./markdown-text";
import { AiSettingsDialog } from "./ai-settings-dialog";
import {
  cancelAiAction,
  compactAiSession,
  confirmAiAction,
  deleteAiSession,
  fetchAiCapabilities,
  fetchAiSession,
  fetchAiSessions,
  fetchAiUsage,
  sendAiChat,
  streamAiChat,
  undoAiLastTurn,
  uploadFile,
  type AiCapabilities,
  type AiChatAttachment,
  type AiChatMessageItem,
  type AiChatSessionSummary,
  type AiPageContext,
  type AiPendingActionItem,
  type AiSessionStats,
  type AiUsageSummary,
} from "@/services/api";

function formatCompactTokens(n?: number | null): string {
  const val = Number(n ?? 0);
  if (!Number.isFinite(val) || val <= 0) return "0";
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return String(val);
}

function getLastSessionStorageKey(userId?: string | number) {
  return `akuntra_ai_last_session_${userId ?? "anon"}`;
}

export function AiAssistantScreen({
  compact = false,
  pageContext,
  onNavigate,
}: {
  compact?: boolean;
  pageContext?: AiPageContext;
  onNavigate?: () => void;
} = {}) {
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const keyboardHeight = useKeyboardHeight();
  const { toast, user } = useApp();
  const isCompactNative = compact && Platform.OS !== "web";
  const isKeyboardOpen = Platform.OS !== "web" && keyboardHeight > 0;
  const storageKey = getLastSessionStorageKey(user?.id);

  const [capabilities, setCapabilities] = React.useState<AiCapabilities | null>(null);
  const [usage, setUsage] = React.useState<AiUsageSummary | null>(null);
  const [sessionStats, setSessionStats] = React.useState<AiSessionStats | null>(null);
  const [compacting, setCompacting] = React.useState(false);
  const [sessions, setSessions] = React.useState<AiChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = React.useState<number | null>(null);
  const [messages, setMessages] = React.useState<AiChatMessageItem[]>([]);
  const [pendingActions, setPendingActions] = React.useState<AiPendingActionItem[]>([]);
  const [attachments, setAttachments] = React.useState<AiChatAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = React.useState(false);

  const [input, setInput] = React.useState("");
  const [loadingInit, setLoadingInit] = React.useState(true);
  const [loadingSession, setLoadingSession] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [undoingId, setUndoingId] = React.useState<number | null>(null);
  const [actingId, setActingId] = React.useState<number | null>(null);
  const [streamStatus, setStreamStatus] = React.useState<string | null>(null);
  const [streamingReply, setStreamingReply] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [showMobileHistory, setShowMobileHistory] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);

  const refreshUsage = React.useCallback(async () => {
    try {
      const u = await fetchAiUsage();
      setUsage(u);
    } catch {}
  }, []);

  const loadInitial = React.useCallback(async () => {
    setLoadingInit(true);
    setErrorMsg(null);
    try {
      const [cap, list, u] = await Promise.all([
        fetchAiCapabilities(),
        fetchAiSessions(),
        fetchAiUsage().catch(() => null),
      ]);
      setCapabilities(cap);
      setSessions(list);
      if (u) setUsage(u);
    } catch (err) {
      setErrorMsg((err as Error)?.message || "Gagal memuat konfigurasi Asisten AI.");
    } finally {
      setLoadingInit(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    void Promise.all([
      fetchAiCapabilities(),
      fetchAiSessions(),
      fetchAiUsage().catch(() => null),
    ])
      .then(async ([cap, list, u]) => {
        if (!active) return;
        setCapabilities(cap);
        setSessions(list);
        if (u) setUsage(u);

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
          setPendingActions(detail.pendingActions ?? []);
          setSessionStats(detail.sessionStats ?? null);
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
        setPendingActions(detail.pendingActions ?? []);
        setSessionStats(detail.sessionStats ?? null);
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
    setPendingActions([]);
    setSessionStats(null);
    setAttachments([]);
    setErrorMsg(null);
    setShowMobileHistory(false);
    setStorageItem(storageKey, "new");
  }, [storageKey]);

  const handleCompactSession = React.useCallback(async () => {
    if (!activeSessionId || compacting || sending) return;
    setCompacting(true);
    setErrorMsg(null);
    try {
      const res = await compactAiSession(activeSessionId);
      setSessionStats(res.sessionStats);
      toast(
        res.compacted
          ? "Konteks percakapan berhasil diringkas (/compact). Context window kini lebih hemat token."
          : "Belum ada pesan baru yang perlu diringkas.",
      );
      void refreshUsage();
    } catch (err) {
      toast((err as Error)?.message || "Gagal meringkas percakapan", "danger");
    } finally {
      setCompacting(false);
    }
  }, [activeSessionId, compacting, refreshUsage, sending, toast]);

  const handleDeleteSession = React.useCallback(
    async (id: number) => {
      try {
        await deleteAiSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (activeSessionId === id) {
          setActiveSessionId(null);
          setMessages([]);
          setPendingActions([]);
          setStorageItem(storageKey, "new");
        }
        toast("Riwayat percakapan dihapus");
      } catch (err) {
        toast((err as Error)?.message || "Gagal menghapus percakapan");
      }
    },
    [activeSessionId, storageKey, toast],
  );

  const handlePickAttachment = React.useCallback(async () => {
    if (uploadingFile) return;

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const picker = document.createElement("input");
      picker.type = "file";
      picker.accept = ".pdf,.xlsx,.xls,.csv,.doc,.docx,image/*";
      picker.onchange = async () => {
        const file = picker.files?.[0];
        if (!file) return;
        setUploadingFile(true);
        try {
          const fileId = await uploadFile(file, "dokumen", "ai-attachment");
          if (fileId) {
            setAttachments((prev) => [
              ...prev,
              { fileId, name: file.name, mimeType: file.type || undefined },
            ]);
            toast(`File "${file.name}" dilampirkan`);
          }
        } catch (err) {
          toast((err as Error)?.message || "Gagal mengunggah lampiran");
        } finally {
          setUploadingFile(false);
        }
      };
      picker.click();
      return;
    }

    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setUploadingFile(true);
      const name = asset.fileName || `lampiran_${Date.now()}.jpg`;
      const fileId = await uploadFile(
        { uri: asset.uri, name, type: asset.mimeType || "image/jpeg", size: asset.fileSize },
        "dokumen",
        "ai-attachment",
      );
      if (fileId) {
        setAttachments((prev) => [
          ...prev,
          { fileId, name, mimeType: asset.mimeType || "image/jpeg" },
        ]);
        toast(`File "${name}" dilampirkan`);
      }
    } catch (err) {
      toast((err as Error)?.message || "Gagal memilih lampiran");
    } finally {
      setUploadingFile(false);
    }
  }, [toast, uploadingFile]);

  const handleUndoMessage = React.useCallback(
    async (messageId: number) => {
      if (!activeSessionId || undoingId !== null || sending || messageId < 0) return;
      setUndoingId(messageId);
      setErrorMsg(null);
      try {
        const res = await undoAiLastTurn(activeSessionId, messageId);
        setMessages(res.messages);
        setPendingActions(res.pendingActions);
        setInput(res.restoredText);
        toast("Pesan dibatalkan & dikembalikan ke kolom input");
      } catch (err) {
        setErrorMsg((err as Error)?.message || "Gagal melakukan undo pesan.");
      } finally {
        setUndoingId(null);
      }
    },
    [activeSessionId, sending, toast, undoingId],
  );

  const handleConfirmAction = React.useCallback(
    async (actionId: number) => {
      setActingId(actionId);
      setErrorMsg(null);
      try {
        const updated = await confirmAiAction(actionId);
        setPendingActions((prev) => prev.map((a) => (a.id === actionId ? updated : a)));
        toast(`${updated.entityLabel} berhasil dibuat`);
      } catch (err) {
        const msg = (err as Error)?.message || "Gagal menyimpan dokumen.";
        setErrorMsg(msg);
        setPendingActions((prev) =>
          prev.map((a) => (a.id === actionId ? { ...a, status: "FAILED", errorMessage: msg } : a)),
        );
      } finally {
        setActingId(null);
      }
    },
    [toast],
  );

  const handleCancelAction = React.useCallback(
    async (actionId: number) => {
      setActingId(actionId);
      try {
        const updated = await cancelAiAction(actionId);
        setPendingActions((prev) => prev.map((a) => (a.id === actionId ? updated : a)));
        toast("Draft dibatalkan");
      } catch (err) {
        toast((err as Error)?.message || "Gagal membatalkan draft");
      } finally {
        setActingId(null);
      }
    },
    [toast],
  );

  const handleSend = React.useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || sending) return;
      if (text.toLowerCase() === "/compact") {
        if (!overrideText) setInput("");
        await handleCompactSession();
        return;
      }
      if (capabilities && !capabilities.configured) {
        setErrorMsg("Asisten AI belum dikonfigurasi. Mohon isi API Key LLM di Pengaturan.");
        return;
      }

      const currentAttachments = attachments;
      setSending(true);
      setStreamStatus("Menganalisis pertanyaan...");
      setStreamingReply("");
      setErrorMsg(null);
      if (!overrideText) setInput("");
      setAttachments([]);

      const optimisticId = -Date.now();
      const optimisticUser: AiChatMessageItem = {
        id: optimisticId,
        role: "user",
        content: text,
        toolsUsed: [],
        ...(currentAttachments.length > 0 ? { attachments: currentAttachments } : {}),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

      try {
        const extra = {
          ...(pageContext ? { pageContext } : {}),
          ...(currentAttachments.length > 0 ? { attachments: currentAttachments } : {}),
        };
        const reply =
          Platform.OS === "web"
            ? await streamAiChat(
                text,
                activeSessionId ?? undefined,
                {
                  onStatus: (s) => setStreamStatus(s),
                  onDelta: (chunk) => {
                    setStreamStatus(null);
                    setStreamingReply((prev) => prev + chunk);
                    scrollRef.current?.scrollToEnd({ animated: false });
                  },
                },
                extra,
              )
            : await sendAiChat(text, activeSessionId ?? undefined, extra);

        setActiveSessionId(reply.sessionId);
        setStorageItem(storageKey, String(reply.sessionId));
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticId),
          reply.userMessage,
          reply.assistantMessage,
        ]);
        if (reply.pendingActions?.length) {
          setPendingActions((prev) => [...prev, ...reply.pendingActions!]);
        }
        if (reply.sessionStats) {
          setSessionStats(reply.sessionStats);
          if (reply.sessionStats.wasAutoCompacted) {
            toast("Konteks percakapan lama diringkas otomatis (/compact) agar tetap ringan.");
          }
        }
        void refreshUsage();

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
        setAttachments(currentAttachments);
        setErrorMsg((err as Error)?.message || "Gagal mendapatkan jawaban dari Asisten AI.");
      } finally {
        setSending(false);
        setStreamStatus(null);
        setStreamingReply("");
      }
    },
    [activeSessionId, attachments, capabilities, handleCompactSession, input, pageContext, refreshUsage, sending, storageKey, toast],
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

  const contextualPrompts = React.useMemo(() => {
    const base = capabilities?.suggestedPrompts ?? [];
    if (pageContext?.module && pageContext?.entityId) {
      return [
        "Ringkas detail, status, dan hal penting dari dokumen yang sedang saya buka ini.",
        ...base,
      ].slice(0, 5);
    }
    return base;
  }, [capabilities?.suggestedPrompts, pageContext?.entityId, pageContext?.module]);

  const actionsByMessageId = React.useMemo(() => {
    const map = new Map<number, AiPendingActionItem[]>();
    const unmatched: AiPendingActionItem[] = [];
    const assistantMsgs = messages.filter((m) => m.role === "assistant" && m.id > 0);

    for (const act of pendingActions) {
      const actTs = new Date(act.createdAt).getTime();
      // Tempelkan kartu draft ke pesan asisten pertama yang dibuat setelah/bersamaan dengan draft
      let target = assistantMsgs.find((m) => new Date(m.createdAt).getTime() >= actTs - 5000);
      if (!target && assistantMsgs.length > 0) {
        target = assistantMsgs[assistantMsgs.length - 1];
      }
      if (target) {
        const list = map.get(target.id) ?? [];
        list.push(act);
        map.set(target.id, list);
      } else {
        unmatched.push(act);
      }
    }
    return { map, unmatched };
  }, [messages, pendingActions]);

  const renderActionCard = (act: AiPendingActionItem) => (
    <View
      key={`act-${act.id}`}
      className="bg-card border-primary/40 rounded-2xl border p-3.5 gap-2.5 mt-2 w-full overflow-hidden"
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-sm font-bold text-foreground flex-1">{act.title}</Text>
        <View
          className={cn(
            "rounded-full px-2 py-0.5",
            act.status === "CONFIRMED"
              ? "bg-primary/15"
              : act.status === "PENDING"
                ? "bg-warning/15"
                : "bg-panel",
          )}
        >
          <Text
            className={cn(
              "text-[10px] font-bold",
              act.status === "CONFIRMED"
                ? "text-primary"
                : act.status === "PENDING"
                  ? "text-warning"
                  : "text-muted-foreground",
            )}
          >
            {act.status === "PENDING"
              ? "MENUNGGU KONFIRMASI"
              : act.status === "CONFIRMED"
                ? "TERSIMPAN"
                : act.status === "CANCELLED"
                  ? "DIBATALKAN"
                  : "GAGAL"}
          </Text>
        </View>
      </View>

      <View className="gap-1">
        {Object.entries(act.summary).map(([k, v]) => {
          const isFileField = /lampiran|file/i.test(k);
          return (
            <View key={k} className="flex-row items-start justify-between gap-2 min-w-0">
              <Text className="text-muted-foreground text-xs shrink-0">{k}</Text>
              <View className="flex-1 min-w-0 items-end">
                <Text
                  className="text-foreground text-xs font-semibold text-right max-w-full"
                  numberOfLines={isFileField ? 1 : undefined}
                  ellipsizeMode={isFileField ? "tail" : undefined}
                >
                  {v}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {act.errorMessage ? <Text className="text-danger text-xs">{act.errorMessage}</Text> : null}

      {act.status === "PENDING" ? (
        <View className="flex-row gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 h-9"
            disabled={actingId === act.id}
            onPress={() => void handleConfirmAction(act.id)}
          >
            <Check size={14} color="#ffffff" />
            <Text className="text-xs font-semibold text-primary-foreground">
              {actingId === act.id ? "Menyimpan..." : "Konfirmasi & Simpan"}
            </Text>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={actingId === act.id}
            onPress={() => void handleCancelAction(act.id)}
          >
            <X size={14} color={colors.text} />
            <Text className="text-xs">Batal</Text>
          </Button>
        </View>
      ) : act.status === "CONFIRMED" && act.resultHref ? (
        <Button
          variant="outline"
          size="sm"
          onPress={() => {
            onNavigate?.();
            router.push(act.resultHref as never);
          }}
        >
          <Text className="text-primary text-xs font-semibold">Buka Dokumen Baru →</Text>
        </Button>
      ) : null}
    </View>
  );

  const activeSessionTitle = React.useMemo(() => {
    if (!activeSessionId) return "Percakapan Baru";
    return sessions.find((s) => s.id === activeSessionId)?.title || "Percakapan";
  }, [activeSessionId, sessions]);

  const renderSessionList = (maxHeightClass = "max-h-[420px]", showNewButton = true) => (
    <View className="gap-2">
      {showNewButton ? (
        <Button onPress={startNewChat} size="sm" className="w-full">
          <MessageSquarePlus size={15} color="#ffffff" />
          <Text className="text-xs font-semibold text-primary-foreground">Percakapan Baru</Text>
        </Button>
      ) : null}

      {sessions.length === 0 ? (
        <Text className="text-muted-foreground py-4 text-center text-xs">
          Belum ada riwayat percakapan.
        </Text>
      ) : (
        <ScrollView className={maxHeightClass} contentContainerClassName="gap-1.5" nestedScrollEnabled>
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

  const chatBody = (
    <View className={cn("gap-3.5", isCompactNative && "flex-1 min-h-0 gap-2.5")}>
      {pageContext?.module && pageContext?.entityId ? (
        <View className="bg-primary/10 border-primary/30 flex-row items-center gap-2 rounded-xl border px-3 py-2">
          <FileText size={14} color={colors.primary} />
          <Text className="text-primary text-xs font-semibold flex-1" numberOfLines={1}>
            Konteks Aktif: {pageContext.module} #{pageContext.entityId}
          </Text>
        </View>
      ) : null}

      {/* Monitor Token, Kuota, & Context Window (/compact) */}
      {usage || sessionStats ? (
        <View className="bg-panel/60 border-border/80 rounded-xl border px-3 py-2 gap-1.5">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-[11px] font-semibold text-foreground">
                Context: {sessionStats?.activeTurns ?? 0}/{sessionStats?.maxTurns ?? usage?.maxTurnsPerSession ?? 10} chat
              </Text>
              {sessionStats?.compacted ? (
                <View className="bg-primary/15 rounded-full px-2 py-0.5">
                  <Text className="text-[10px] font-semibold text-primary">Dirangkum</Text>
                </View>
              ) : null}
              <Text className="text-[11px] text-muted-foreground">
                Token sesi: {formatCompactTokens(sessionStats?.sessionTokens)} · Bulan ini:{" "}
                {formatCompactTokens(usage?.globalMonth?.totalTokens ?? usage?.month?.totalTokens)}
                {usage?.quotaUsagePct != null ? ` (${usage.quotaUsagePct}% kuota)` : ""}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              {activeSessionId && messages.length >= 2 ? (
                <Pressable
                  disabled={compacting || sending}
                  onPress={() => void handleCompactSession()}
                  className="bg-card border-border/80 rounded-lg border px-2 py-1 active:opacity-80"
                >
                  <Text className="text-[10px] font-semibold text-foreground">
                    {compacting ? "Meringkas..." : "Ringkas (/compact)"}
                  </Text>
                </Pressable>
              ) : null}
              {activeSessionId ? (
                <Pressable
                  disabled={sending}
                  onPress={startNewChat}
                  className="bg-card border-border/80 rounded-lg border px-2 py-1 active:opacity-80"
                >
                  <Text className="text-[10px] font-semibold text-primary">Chat Baru</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          {sessionStats ? (
            <View className="h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
              <View
                className={cn(
                  "h-full rounded-full",
                  sessionStats.activeTurns >= sessionStats.maxTurns
                    ? "bg-danger"
                    : sessionStats.activeTurns >= Math.ceil(sessionStats.maxTurns * 0.8)
                      ? "bg-warning"
                      : "bg-primary",
                )}
                style={{
                  width: `${Math.min(100, Math.round((sessionStats.activeTurns / Math.max(1, sessionStats.maxTurns)) * 100))}%`,
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {loadingInit || loadingSession ? (
        <View
          className={cn(
            "py-10 items-center justify-center gap-2",
            isCompactNative && "flex-1",
          )}
        >
          <ActivityIndicator color={colors.primary} />
          <Text className="text-muted-foreground text-xs">Memuat percakapan...</Text>
        </View>
      ) : messages.length === 0 ? (
        isCompactNative ? (
          <ScrollView
            className="flex-1 min-h-0"
            contentContainerClassName="py-3 gap-3.5"
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <View className="items-center gap-1.5">
              <View className="bg-primary/10 size-11 rounded-2xl items-center justify-center">
                <Sparkles size={20} color={colors.primary} />
              </View>
              <Text className="text-base font-bold text-foreground text-center">
                Tanya atau Buat Draft Data ERP
              </Text>
              <Text className="text-muted-foreground text-xs text-center max-w-md">
                Cari laporan per periode (mis. 3 bulan terakhir / 28 Okt–28 Nov), tanya dokumen yang
                sedang dibuka, atau siapkan draft dengan lampiran file.
              </Text>
            </View>

            {contextualPrompts.length ? (
              <View className="flex-row flex-wrap gap-2 justify-center w-full">
                {contextualPrompts.map((p) => (
                  <Pressable
                    key={p}
                    disabled={sending || !capabilities?.configured}
                    onPress={() => void handleSend(p)}
                    className="bg-panel/80 border-border/80 hover:border-primary/50 active:opacity-80 rounded-xl border px-3 py-2 max-w-full shrink"
                  >
                    <Text className="text-foreground text-xs leading-snug text-center">{p}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <View className="py-4 gap-3.5">
            <View className="items-center gap-1.5">
              <View className="bg-primary/10 size-11 rounded-2xl items-center justify-center">
                <Sparkles size={20} color={colors.primary} />
              </View>
              <Text className="text-base font-bold text-foreground text-center">
                Tanya atau Buat Draft Data ERP
              </Text>
              <Text className="text-muted-foreground text-xs text-center max-w-md">
                Cari laporan per periode (mis. 3 bulan terakhir / 28 Okt–28 Nov), tanya dokumen yang
                sedang dibuka, atau siapkan draft dengan lampiran file.
              </Text>
            </View>

            {contextualPrompts.length ? (
              <View className="flex-row flex-wrap gap-2 justify-center w-full">
                {contextualPrompts.map((p) => (
                  <Pressable
                    key={p}
                    disabled={sending || !capabilities?.configured}
                    onPress={() => void handleSend(p)}
                    className="bg-panel/80 border-border/80 hover:border-primary/50 active:opacity-80 rounded-xl border px-3 py-2 max-w-full shrink"
                  >
                    <Text className="text-foreground text-xs leading-snug text-center">{p}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        )
      ) : (
        <ScrollView
          ref={scrollRef}
          className={
            isCompactNative
              ? "flex-1 min-h-0"
              : compact
                ? "max-h-[340px]"
                : isKeyboardOpen
                  ? "max-h-[260px]"
                  : "max-h-[480px]"
          }
          contentContainerClassName="gap-3 py-1"
          keyboardShouldPersistTaps="handled"
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

                  <View className={cn("max-w-[85%]", isUser && "items-end")}>
                    {isUser && m.attachments && m.attachments.length > 0 ? (
                      <View className="flex-row flex-wrap justify-end gap-1.5 mb-1.5">
                        {m.attachments.map((att) => (
                          <View
                            key={`${m.id}-att-${att.fileId}`}
                            className="bg-card border-border/80 flex-row items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
                          >
                            <Paperclip size={12} color={colors.primary} />
                            <Text
                              className="text-foreground text-xs font-medium max-w-[200px]"
                              numberOfLines={1}
                            >
                              {att.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <View
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5",
                        isUser ? "bg-primary" : "bg-panel/80 border border-border/70",
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

                    {!isUser && (actionsByMessageId.map.get(m.id)?.length ?? 0) > 0 ? (
                      <View className="w-full">
                        {actionsByMessageId.map.get(m.id)!.map((act) => renderActionCard(act))}
                      </View>
                    ) : null}

                    {isUser && activeSessionId && m.id > 0 ? (
                      <Pressable
                        onPress={() => void handleUndoMessage(m.id)}
                        disabled={undoingId !== null || sending}
                        hitSlop={6}
                        className="flex-row items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md hover:bg-panel active:opacity-70"
                      >
                        <Undo2 size={11} color={colors.muted} />
                        <Text className="text-muted-foreground text-[10px] font-medium">
                          {undoingId === m.id ? "Membatalkan..." : "Undo pesan"}
                        </Text>
                      </Pressable>
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

            {actionsByMessageId.unmatched.map((act) => renderActionCard(act))}

            {sending ? (
              <View className="flex-row items-start gap-2.5">
                <View className="bg-primary/15 size-8 shrink-0 rounded-xl items-center justify-center mt-0.5">
                  <Bot size={16} color={colors.primary} />
                </View>
                <View className="bg-panel/80 border-border/70 rounded-2xl border px-3.5 py-2.5 max-w-[85%] gap-1.5">
                  {streamingReply ? <MarkdownText content={streamingReply} /> : null}
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

        {messages.length > 0 && contextualPrompts.length && !(isCompactNative && isKeyboardOpen) ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            style={{ flexGrow: 0, flexShrink: 0 }}
            contentContainerClassName="gap-2 pb-2 pt-0.5 items-center"
            keyboardShouldPersistTaps="handled"
          >
            {contextualPrompts.map((p) => (
              <Pressable
                key={p}
                disabled={sending || !capabilities?.configured}
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

        {attachments.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {attachments.map((att) => (
              <View
                key={att.fileId}
                className="bg-primary/10 border-primary/30 flex-row items-center gap-1.5 rounded-lg border px-2.5 py-1"
              >
                <Paperclip size={12} color={colors.primary} />
                <Text className="text-primary text-xs font-medium max-w-[180px]" numberOfLines={1}>
                  {att.name}
                </Text>
                <Pressable
                  onPress={() =>
                    setAttachments((prev) => prev.filter((a) => a.fileId !== att.fileId))
                  }
                  hitSlop={6}
                >
                  <X size={12} color={colors.primary} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View className="flex-row items-center gap-2 pt-2 border-t border-border/60">
          <Pressable
            onPress={() => void handlePickAttachment()}
            disabled={uploadingFile || sending}
            accessibilityLabel="Lampirkan file PDF atau Excel"
            className="bg-panel border-border/80 hover:border-primary/50 size-11 shrink-0 items-center justify-center rounded-xl border"
          >
            {uploadingFile ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Paperclip size={16} color={colors.textSecondary} />
            )}
          </Pressable>
          <View className="flex-1 min-w-0">
            <Input
              value={input}
              onChangeText={setInput}
              placeholder="Tulis pertanyaan atau minta buat draft..."
              editable={!sending}
              returnKeyType="send"
              onFocus={() => {
                if (Platform.OS !== "web") {
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
                }
              }}
              onSubmitEditing={() => void handleSend()}
            />
          </View>
          <Button
            disabled={sending || !input.trim()}
            onPress={() => void handleSend()}
            className="h-11 px-3.5 shrink-0"
          >
            <Send size={15} color="#ffffff" />
            {!isMobile && !compact ? (
              <Text className="text-xs font-semibold text-primary-foreground">Kirim</Text>
            ) : null}
          </Button>
        </View>
    </View>
  );

  const chatCard = isCompactNative ? (
    <View className="bg-card border-border/80 rounded-2xl border shadow-sm overflow-hidden p-3.5 flex-1 min-h-0">
      {chatBody}
    </View>
  ) : (
    <Panel
      title={compact ? undefined : "Percakapan"}
      subtitle={compact ? undefined : "Jawaban diambil langsung dari data aktual ERP sesuai RBAC Anda"}
      icon={compact ? undefined : Bot}
      right={
        !compact && (activeSessionId || messages.length > 0) ? (
          <Button variant="outline" size="sm" onPress={startNewChat}>
            <MessageSquarePlus size={14} color={colors.text} />
            <Text className="text-xs">Baru</Text>
          </Button>
        ) : null
      }
    >
      {chatBody}
    </Panel>
  );

  if (compact) {
    return (
      <View className={cn("gap-2.5", isCompactNative && "flex-1 min-h-0")}>
        <View className="flex-row items-center justify-between gap-2">
          <Pressable
            onPress={() => setShowMobileHistory((v) => !v)}
            accessibilityLabel="Pilih riwayat percakapan"
            className={cn(
              "flex-1 min-w-0 flex-row items-center gap-2 rounded-xl border px-3 py-2",
              showMobileHistory
                ? "bg-primary/10 border-primary/40"
                : "bg-panel/80 border-border/80 hover:border-primary/40",
            )}
          >
            <History size={14} color={showMobileHistory ? colors.primary : colors.muted} />
            <Text
              className={cn(
                "flex-1 text-xs font-semibold",
                showMobileHistory ? "text-primary" : "text-foreground",
              )}
              numberOfLines={1}
            >
              {activeSessionTitle}
            </Text>
            <Text className="text-muted-foreground text-[10px]">({sessions.length})</Text>
            {showMobileHistory ? (
              <ChevronUp size={14} color={colors.primary} />
            ) : (
              <ChevronDown size={14} color={colors.muted} />
            )}
          </Pressable>

          <Button variant="outline" size="sm" className="h-9 shrink-0" onPress={startNewChat}>
            <MessageSquarePlus size={14} color={colors.text} />
            <Text className="text-xs">Baru</Text>
          </Button>
        </View>

        {showMobileHistory ? (
          <Panel title="Riwayat Percakapan" icon={History}>
            {renderSessionList("max-h-[340px]", false)}
          </Panel>
        ) : (
          chatCard
        )}
      </View>
    );
  }

  return (
    <View className="gap-4">
      <PageHeader
        title="Asisten AI ERP"
        subtitle="Tanyakan laporan lintas modul atau siapkan draft data baru dengan konfirmasi Anda."
        onRefresh={loadInitial}
        action={
          <View className="flex-row flex-wrap items-center gap-2">
            {capabilities?.canManageSettings ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onPress={() => setSettingsOpen(true)}
              >
                <Settings2 size={14} color={colors.text} />
                <Text className="text-xs">Pengaturan LLM</Text>
              </Button>
            ) : null}
            {isMobile ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onPress={() => setShowMobileHistory((v) => !v)}
              >
                <History size={14} color={colors.text} />
                <Text className="text-xs">Riwayat ({sessions.length})</Text>
              </Button>
            ) : null}
          </View>
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
                {capabilities.mode === "READ_AND_DRAFT_CREATE"
                  ? "Baca + Draft Konfirmasi"
                  : "Mode Read-Only"}{" "}
                · {capabilities.allowedToolNames.length} Sumber Aktif
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
              Isi LLM_API_KEY melalui tombol Pengaturan LLM (Super Admin) atau apps/api/.env untuk
              mengaktifkan Asisten AI.
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

        <View className={isMobile ? "w-full" : "flex-1 min-w-0"}>{chatCard}</View>
      </View>

      <AiSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={() => void loadInitial()}
      />
    </View>
  );
}
