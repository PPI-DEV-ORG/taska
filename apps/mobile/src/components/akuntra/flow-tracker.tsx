import * as React from "react";
import { View } from "react-native";
import { Check, XCircle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { colors } from "@/tokens";
import { OWNER_LABEL, canOwnerAct, type FlowResult } from "@/lib/flow";

/**
 * Pelacak alur dokumen (ala Accurate): tiap langkah menampilkan status (selesai / sedang menunggu / belum)
 * dan siapa penanggung jawabnya, supaya jelas "dokumen ini sekarang ada di siapa".
 */
export function FlowTracker({
  flow,
  role,
  isRequester,
  compact,
}: {
  flow: FlowResult;
  role?: string;
  isRequester?: boolean;
  /** Mode ringkas (tanpa penjelasan) untuk pratinjau di form. */
  compact?: boolean;
}) {
  const { steps, stopped } = flow;
  const firstActionableIdx = steps.findIndex((s) => s.actionable);
  return (
    <View className="gap-0">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const waiting = s.actionable;
        const mine = waiting && role ? canOwnerAct(s.owner, role, isRequester) : false;
        const stoppedHere = !!stopped && i === steps.findIndex((x) => !x.done);
        return (
          <View key={s.key} className="flex-row gap-3">
            <View className="items-center">
              <View
                className={cn(
                  "h-7 w-7 items-center justify-center rounded-full border",
                  stoppedHere
                    ? "border-destructive/40 bg-destructive/15"
                    : s.done
                    ? "border-emerald-600 bg-emerald-600"
                    : waiting
                    ? "border-primary bg-primary"
                    : "border-border bg-muted",
                )}
              >
                {stoppedHere ? (
                  <XCircle size={14} color={colors.danger} />
                ) : s.done ? (
                  <Check size={14} color="#fff" />
                ) : (
                  <Text className={cn("text-[11px] font-bold", waiting ? "text-white" : "text-muted-foreground")}>
                    {i + 1}
                  </Text>
                )}
              </View>
              {!isLast ? <View className={cn("w-[2px] flex-1 min-h-3", s.done ? "bg-emerald-600" : "bg-border")} /> : null}
            </View>
            <View className={cn("flex-1 pb-3", compact && "pb-2")}>
              <View className="flex-row flex-wrap items-center gap-x-2">
                <Text
                  className={cn(
                    "text-sm",
                    s.done ? "font-semibold text-foreground" : waiting ? "font-bold text-primary" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </Text>
                <Text className="text-[11px] text-muted-foreground">· {OWNER_LABEL[s.owner]}</Text>
                {waiting && !stopped ? (
                  <View className={cn("rounded px-1.5 py-0.5", mine ? "bg-primary" : "bg-amber-500/20")}>
                    <Text className={cn("text-[10px] font-bold", mine ? "text-white" : "text-amber-700 dark:text-amber-400")}>
                      {mine ? "GILIRAN ANDA" : `Menunggu ${OWNER_LABEL[s.owner]}`}
                    </Text>
                  </View>
                ) : null}
              </View>
              {!compact && (waiting || i === firstActionableIdx) ? (
                <Text className="mt-0.5 text-xs leading-4 text-muted-foreground">{s.hint}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Kartu "Langkah berikutnya": siapa yang harus bergerak sekarang. Tombol aksi dikirim sebagai children. */
export function NextStepCard({
  flow,
  role,
  isRequester,
  children,
}: {
  flow: FlowResult;
  role?: string;
  isRequester?: boolean;
  children?: React.ReactNode;
}) {
  const { stopped, complete, actionable } = flow;
  if (stopped) {
    return (
      <View className="gap-1 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
        <Text className="text-base font-bold text-destructive">Dokumen {stopped.label}</Text>
        {stopped.reason ? <Text className="text-xs text-destructive/90">Alasan: {stopped.reason}</Text> : null}
        <Text className="text-xs text-muted-foreground">Proses berhenti di sini. Buat pengajuan baru bila masih dibutuhkan.</Text>
      </View>
    );
  }
  if (complete) {
    return (
      <View className="gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
        <Text className="text-base font-bold text-emerald-700 dark:text-emerald-400">Proses selesai</Text>
        <Text className="text-xs text-muted-foreground">Semua langkah sudah dikerjakan.</Text>
      </View>
    );
  }
  const mine = actionable.filter((s) => (role ? canOwnerAct(s.owner, role, isRequester) : false));
  const focus = mine.length ? mine : actionable;
  const isMine = mine.length > 0;
  return (
    <View
      className={cn(
        "gap-2 rounded-xl border p-4",
        isMine ? "border-primary/50 bg-primary/10" : "border-amber-500/40 bg-amber-500/10",
      )}
    >
      <Text className={cn("text-[11px] font-bold uppercase tracking-wider", isMine ? "text-primary" : "text-amber-700 dark:text-amber-400")}>
        {isMine ? "Giliran Anda" : "Langkah berikutnya"}
      </Text>
      {focus.map((s) => (
        <View key={s.key}>
          <Text className="text-base font-bold text-foreground">
            {isMine ? s.label : `Menunggu ${OWNER_LABEL[s.owner]}: ${s.label}`}
          </Text>
          <Text className="text-xs leading-4 text-muted-foreground">{s.hint}</Text>
        </View>
      ))}
      {children ? <View className="mt-1 flex-row flex-wrap gap-2">{children}</View> : null}
    </View>
  );
}
