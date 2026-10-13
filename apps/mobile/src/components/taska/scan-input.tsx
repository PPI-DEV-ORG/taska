import * as React from "react";
import { Platform, TextInput, View } from "react-native";
import { Trash2, ScanLine, WifiOff, CircleCheck, CircleAlert } from "lucide-react-native";
import { Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";

export type Scan = { sn: string; ok: boolean; msg: string };

function beep(ok: boolean) {
  if (Platform.OS !== "web") return;
  try {
    const AC = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.05;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.12);
  } catch {}
}

/** Kolom fokus untuk scanner barcode fisik (bekerja seperti keyboard) atau input manual. */
export function ScanInput({
  onResult, existing = [],
}: { onResult?: (scans: Scan[]) => void; existing?: string[] }) {
  const { offline } = useApp();
  const [value, setValue] = React.useState("");
  const [scans, setScans] = React.useState<Scan[]>([]);
  const ref = React.useRef<TextInput>(null);

  function submit(raw?: string) {
    const sn = (raw ?? value).trim().toUpperCase();
    if (!sn) return;
    let res: Scan;
    if (!/^[A-Z0-9-]{6,}$/.test(sn)) res = { sn, ok: false, msg: "Format SN tidak dikenali" };
    else if (scans.some((s) => s.sn === sn) || existing.includes(sn)) res = { sn, ok: false, msg: "SN sudah tercatat, tidak boleh dua kali" };
    else res = { sn, ok: true, msg: "SN valid" };
    beep(res.ok);
    const next = [res, ...scans];
    setScans(next);
    onResult?.(next);
    setValue("");
    ref.current?.focus();
  }
  function simulate() {
    submit(`SN${2700 + Math.floor(Math.random() * 900)}X${Math.floor(Math.random() * 90 + 10)}`);
  }
  function remove(sn: string) {
    const next = scans.filter((s) => s.sn !== sn);
    setScans(next);
    onResult?.(next);
  }

  if (offline) {
    return (
      <View className="bg-warning/15 flex-row items-center gap-2 rounded-lg p-3">
        <WifiOff size={16} color={colors.warning} />
        <Text className="text-warning flex-1 text-sm">Perlu koneksi. Scan SN divalidasi server.</Text>
      </View>
    );
  }
  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        <View className="bg-input border-primary h-12 flex-1 flex-row items-center gap-2 rounded-lg border px-3">
          <ScanLine size={18} color={colors.primary} />
          <TextInput
            ref={ref}
            autoFocus
            value={value}
            onChangeText={setValue}
            onSubmitEditing={() => submit()}
            placeholder="Scan atau ketik SN, lalu Enter"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            blurOnSubmit={false}
            style={{ flex: 1, color: colors.text, fontSize: 15, outlineStyle: "none" } as any}
          />
        </View>
        <Button variant="outline" className="h-12" onPress={simulate}><Text>Contoh scan</Text></Button>
      </View>
      {scans.length ? (
        <View className="gap-2">
          <Text className="text-muted-foreground text-[13px]">{scans.filter((s) => s.ok).length} unit valid dari {scans.length} scan</Text>
          {scans.map((s) => (
            <View key={s.sn} className="bg-card border-border flex-row items-center gap-3 rounded-lg border px-3 py-2">
              {s.ok ? <CircleCheck size={18} color={colors.success} /> : <CircleAlert size={18} color={colors.danger} />}
              <View className="flex-1">
                <Text className="text-sm font-medium">{s.sn}</Text>
                <Text className="text-[13px]" style={{ color: s.ok ? colors.success : colors.danger }}>{s.msg}</Text>
              </View>
              <Pressable onPress={() => remove(s.sn)} hitSlop={10} className="size-10 items-center justify-center"><Trash2 size={16} color={colors.muted} /></Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
