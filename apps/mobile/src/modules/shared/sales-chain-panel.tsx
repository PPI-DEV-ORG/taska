import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Check, CheckCircle2, Clock, FileText, Package, Truck, Receipt } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import type { Row } from "@/constants/modules";
import { evaluateSales, SALES_STEPS } from "@/lib/sales-flow";

/** Rantai penjualan: Penawaran → Sales Order → Surat Jalan + Faktur → Pembayaran. */
export function SalesChainPanel({ moduleKey, row }: { moduleKey: string; row: Row }) {
  const router = useRouter();
  const { data } = useApp();
  const flow = React.useMemo(
    () => evaluateSales(moduleKey, row, data as Record<string, Row[]>),
    [moduleKey, row, data],
  );

  const steps = React.useMemo(() => {
    return (flow.steps ?? SALES_STEPS).map((step) => {
      const stepInFlow = flow.steps?.find((s) => s.key === step.key);
      const isDone = Boolean(stepInFlow?.done ?? (Array.isArray((flow as any).doneKeys) && (flow as any).doneKeys.includes(step.key)));
      const isCurrent = flow.currentKey === step.key;
      return {
        key: step.key,
        label: step.label,
        owner: step.owner,
        done: isDone,
        current: isCurrent,
      };
    });
  }, [flow]);

  const allCompleted = steps.every((s) => s.done);

  return (
    <View className="gap-3">
      <Panel
        title="Alur Penjualan"
        subtitle="Rantai dokumen dari Penawaran Harga, Sales Order, Surat Jalan hingga Pelunasan Faktur"
      >
        {/* Stepper Row */}
        <View className="flex-row items-center justify-between gap-1 py-1">
          {steps.map((st, idx) => {
            const isLast = idx === steps.length - 1;
            return (
              <React.Fragment key={st.key}>
                <View className="items-center flex-1">
                  <View
                    className={`h-7 w-7 rounded-full items-center justify-center ${
                      st.done
                        ? "bg-emerald-600 border border-emerald-600"
                        : st.current
                        ? "bg-primary border border-primary"
                        : "bg-muted border border-border"
                    }`}
                  >
                    {st.done ? (
                      <Check size={14} color="#fff" />
                    ) : (
                      <Text
                        className={`text-[10px] font-bold ${
                          st.current ? "text-white" : "text-muted-foreground"
                        }`}
                      >
                        {idx + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    className={`text-[11px] mt-1 text-center font-medium ${
                      st.current
                        ? "text-primary font-bold"
                        : st.done
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground"
                    }`}
                    numberOfLines={1}
                  >
                    {st.label}
                  </Text>
                </View>
                {!isLast ? (
                  <View
                    className={`h-[2px] flex-1 -mt-3.5 ${
                      st.done && steps[idx + 1]?.done ? "bg-emerald-600" : "bg-border"
                    }`}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>

        {/* Status Banner */}
        {allCompleted ? (
          <View className="mt-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-3 flex-row items-center gap-2.5">
            <CheckCircle2 size={18} color="#10b981" />
            <View className="flex-1">
              <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                Rangkaian Penjualan Selesai & Lunas
              </Text>
              <Text className="text-muted-foreground text-[11px] mt-0.5">
                Barang telah terkirim via Surat Jalan dan seluruh pembayaran faktur telah dilunasi oleh pelanggan.
              </Text>
            </View>
          </View>
        ) : (
          <View className="mt-3 pt-2.5 border-t border-border/60 flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-row items-center gap-1.5">
              <Clock size={13} color={colors.primary} />
              <Text className="text-xs text-muted-foreground">Tahap saat ini:</Text>
              <Text className="text-xs font-bold text-primary">
                {steps.find((s) => s.current)?.label || "Diproses"}
              </Text>
            </View>
            <Text className="text-[11px] text-muted-foreground">
              Dokumen terkait dicari otomatis dari penawaran, Sales Order, dan proyek yang sama.
            </Text>
          </View>
        )}
      </Panel>
    </View>
  );
}
