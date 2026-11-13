import * as React from "react";
import { View, Pressable } from "react-native";
import { HandCoins } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Panel } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { api } from "@/services/api";
import { rupiah } from "@/lib/format";
import {
  CashAdvanceDetailDialog,
  CreateCashAdvanceDialog,
  STATUS_LABEL,
  type CashAdvance,
  type CashAdvancePurpose,
} from "./cash-advance-dialogs";

/**
 * Uang jalan untuk satu survey / surat jalan: ajukan sebelum berangkat, pantau pencairan & laporan biayanya.
 */
export function CashAdvancePanel({
  surveyId,
  deliveryNoteId,
  projectId,
  purpose,
  defaultDescription,
  title,
  subtitle,
}: {
  surveyId?: number;
  deliveryNoteId?: number;
  projectId?: number;
  purpose: CashAdvancePurpose;
  defaultDescription?: string;
  title: string;
  subtitle: string;
}) {
  const [rows, setRows] = React.useState<CashAdvance[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<number | null>(null);

  const [version, setVersion] = React.useState(0);
  const load = React.useCallback(() => setVersion((v) => v + 1), []);

  React.useEffect(() => {
    const qs = surveyId
      ? `surveyId=${surveyId}`
      : deliveryNoteId
      ? `deliveryNoteId=${deliveryNoteId}`
      : projectId
      ? `projectId=${projectId}`
      : "";
    if (!qs) return;
    let alive = true;
    api<{ items: CashAdvance[] }>("GET", `/cash-advances?${qs}`)
      .then((res) => {
        if (alive) setRows(res.items ?? []);
      })
      .catch(() => {
        /* diabaikan: panel opsional */
      });
    return () => {
      alive = false;
    };
  }, [surveyId, deliveryNoteId, projectId, version]);

  const active = rows.filter((r) => !["DITOLAK", "DIBATALKAN"].includes(r.status));
  // Ringkasan kas yang masih dipegang tim untuk dokumen / project ini
  const open = rows.filter((r) => ["DICAIRKAN", "DILAPORKAN"].includes(r.status));
  const held = open.reduce((s, r) => s + (r.disbursedAmount ?? 0), 0);
  const usedPending = open.reduce((s, r) => s + r.reportedTotal, 0);

  return (
    <Panel
      title={title}
      subtitle={subtitle}
      right={
        <Button size="sm" variant={active.length ? "outline" : "default"} onPress={() => setCreateOpen(true)} className="flex-row items-center gap-1.5">
          <HandCoins size={14} color={active.length ? undefined : "#fff"} />
          <Text className={`text-xs font-semibold ${active.length ? "" : "text-white"}`}>Ajukan Uang Jalan</Text>
        </Button>
      }
    >
      {open.length > 0 ? (
        <View className="flex-row flex-wrap gap-3 mb-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
          <Text className="text-[11px] text-muted-foreground">
            Dipegang tim: <Text className="text-[11px] font-bold text-foreground">{rupiah(held)}</Text>
          </Text>
          <Text className="text-[11px] text-muted-foreground">
            Sudah dipakai (menunggu verifikasi): <Text className="text-[11px] font-bold text-foreground">{rupiah(usedPending)}</Text>
          </Text>
          <Text className="text-[11px] text-muted-foreground">
            Sisa: <Text className="text-[11px] font-bold text-primary">{rupiah(Math.max(0, held - usedPending))}</Text>
          </Text>
        </View>
      ) : null}
      {rows.length === 0 ? (
        <Text className="text-xs text-muted-foreground">Belum ada uang jalan. Ajukan ke Finance sebelum berangkat.</Text>
      ) : (
        <View className="gap-1.5">
          {rows.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setDetailId(r.id)}
              accessibilityRole="button"
              className="flex-row items-center justify-between gap-2 py-1.5 border-b border-border/40 active:opacity-70"
            >
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground">
                  {r.number} · {r.employee.name}
                </Text>
                <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
                  {r.description}
                  {r.reportedTotal > 0 ? ` · dipakai ${rupiah(r.reportedTotal)}` : ""}
                </Text>
              </View>
              <Text className="text-xs font-semibold text-foreground">{rupiah(r.disbursedAmount ?? r.approvedAmount ?? r.amount)}</Text>
              <StatusBadge status={STATUS_LABEL[r.status]} />
            </Pressable>
          ))}
        </View>
      )}
      <CreateCashAdvanceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaults={{ purpose, surveyId, deliveryNoteId, projectId, description: defaultDescription, title: purpose === "SURVEY" ? "Minta Uang Jalan Survey" : purpose === "PROJECT" ? "Ajukan Kas Proyek" : "Alokasikan Uang Jalan Pengiriman" }}
        onCreated={() => load()}
      />
      <CashAdvanceDetailDialog id={detailId} onOpenChange={(v) => !v && setDetailId(null)} onChanged={() => load()} />
    </Panel>
  );
}
