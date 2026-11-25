import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { CheckCircle2, Lock, PlugZap, ShieldCheck } from "lucide-react-native";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/akuntra/basics";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import {
  fetchAiSettings,
  testAiSettingsConnection,
  updateAiSettings,
  type AiLlmSettings,
} from "@/services/api";

export function AiSettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const { toast } = useApp();
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [meta, setMeta] = React.useState<AiLlmSettings | null>(null);

  const [baseUrl, setBaseUrl] = React.useState("");
  const [model, setModel] = React.useState("");
  const [fallbacks, setFallbacks] = React.useState("");
  const [timeoutMs, setTimeoutMs] = React.useState("45000");
  const [apiKey, setApiKey] = React.useState("");
  const [testResult, setTestResult] = React.useState<string | null>(null);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let active = true;

    void (async () => {
      setLoading(true);
      setErrMsg(null);
      setTestResult(null);
      setApiKey("");
      try {
        const s = await fetchAiSettings();
        if (!active) return;
        setMeta(s);
        setBaseUrl(s.baseUrl);
        setModel(s.model);
        setFallbacks(s.fallbackModels.join(", "));
        setTimeoutMs(String(s.timeoutMs));
      } catch (err) {
        if (!active) return;
        setErrMsg((err as Error)?.message || "Gagal memuat pengaturan LLM.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open]);

  const applyPreset = (preset: "gemini" | "ollama") => {
    if (preset === "gemini") {
      setBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai");
      setModel("gemini-3.5-flash-lite");
      setFallbacks("gemini-3.5-flash, gemini-3.6-flash");
      setTimeoutMs("45000");
    } else {
      setBaseUrl("http://127.0.0.1:11434/v1");
      setModel("qwen2.5:7b");
      setFallbacks("");
      setTimeoutMs("60000");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrMsg(null);
    setTestResult(null);
    try {
      const updated = await updateAiSettings({
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        fallbackModels: fallbacks
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        timeoutMs: Number(timeoutMs) || 45000,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setMeta(updated);
      setApiKey("");
      toast("Pengaturan LLM berhasil disimpan");
      onSaved?.();
    } catch (err) {
      setErrMsg((err as Error)?.message || "Gagal menyimpan pengaturan LLM.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setErrMsg(null);
    setTestResult(null);
    try {
      const res = await testAiSettingsConnection();
      setTestResult(
        `Terhubung ke ${res.providerLabel} (${res.model}) dalam ${res.latencyMs} ms — "${res.reply}"`,
      );
    } catch (err) {
      setErrMsg((err as Error)?.message || "Tes koneksi gagal.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pengaturan LLM (Global — Semua Pengguna)</DialogTitle>
        </DialogHeader>

        {loading ? (
          <View className="py-10 items-center gap-2">
            <ActivityIndicator color={colors.primary} />
            <Text className="text-muted-foreground text-xs">Memuat konfigurasi...</Text>
          </View>
        ) : (
          <ScrollView className="max-h-[70vh]" contentContainerClassName="gap-3.5 py-1">
            <View className="bg-primary/10 border-primary/30 flex-row items-start gap-2.5 rounded-xl border p-3">
              <ShieldCheck size={16} color={colors.primary} />
              <Text className="text-muted-foreground text-xs flex-1 leading-relaxed">
                Konfigurasi ini berlaku untuk semua pengguna ERP sesuai RBAC masing-masing. API Key
                disimpan terenkripsi <Text className="font-semibold text-foreground">AES-256-GCM</Text>{" "}
                dan tidak pernah ditampilkan kembali ke browser/app.
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <Pressable
                onPress={() => applyPreset("gemini")}
                className="bg-panel border-border/80 hover:border-primary/50 rounded-lg border px-3 py-1.5"
              >
                <Text className="text-xs font-medium text-foreground">Preset: Google Gemini</Text>
              </Pressable>
              <Pressable
                onPress={() => applyPreset("ollama")}
                className="bg-panel border-border/80 hover:border-primary/50 rounded-lg border px-3 py-1.5"
              >
                <Text className="text-xs font-medium text-foreground">Preset: Local Ollama</Text>
              </Pressable>
            </View>

            <FormField label="Base URL (OpenAI-Compatible)" required>
              <Input
                value={baseUrl}
                onChangeText={setBaseUrl}
                placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
                autoCapitalize="none"
              />
            </FormField>

            <FormField label="Model Utama" required>
              <Input
                value={model}
                onChangeText={setModel}
                placeholder="gemini-3.5-flash-lite atau qwen2.5:7b"
                autoCapitalize="none"
              />
            </FormField>

            <FormField label="Model Cadangan / Fallback (pisahkan koma)">
              <Input
                value={fallbacks}
                onChangeText={setFallbacks}
                placeholder="gemini-3.5-flash, gemini-3.6-flash"
                autoCapitalize="none"
              />
            </FormField>

            <FormField label="Timeout (ms)">
              <Input
                value={timeoutMs}
                onChangeText={setTimeoutMs}
                keyboardType="numeric"
                placeholder="45000"
              />
            </FormField>

            <FormField
              label={
                meta?.hasApiKey
                  ? `API Key (Tersimpan terenkripsi · Sumber: ${meta.source})`
                  : "API Key (Kosongkan untuk Ollama lokal)"
              }
            >
              <Input
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry
                placeholder={
                  meta?.hasApiKey
                    ? "Biarkan kosong jika tidak ingin mengganti API Key"
                    : "Masukkan API Key baru"
                }
                autoCapitalize="none"
              />
            </FormField>

            {testResult ? (
              <View className="bg-primary/10 border-primary/30 flex-row items-start gap-2 rounded-xl border p-3">
                <CheckCircle2 size={15} color={colors.primary} />
                <Text className="text-primary text-xs flex-1">{testResult}</Text>
              </View>
            ) : null}

            {errMsg ? (
              <View className="bg-danger/10 border-danger/30 rounded-xl border p-3">
                <Text className="text-danger text-xs">{errMsg}</Text>
              </View>
            ) : null}

            <View className="flex-row flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
              <Button variant="outline" size="sm" disabled={testing || saving} onPress={handleTest}>
                <PlugZap size={14} color={colors.text} />
                <Text className="text-xs">{testing ? "Menguji..." : "Tes Koneksi"}</Text>
              </Button>
              <View className="flex-row items-center gap-2">
                <Button variant="outline" size="sm" onPress={() => onOpenChange(false)}>
                  <Text className="text-xs">Tutup</Text>
                </Button>
                <Button size="sm" disabled={saving} onPress={handleSave}>
                  <Lock size={13} color="#ffffff" />
                  <Text className="text-xs font-semibold text-primary-foreground">
                    {saving ? "Menyimpan..." : "Simpan"}
                  </Text>
                </Button>
              </View>
            </View>
          </ScrollView>
        )}
      </DialogContent>
    </Dialog>
  );
}
