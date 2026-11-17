import { View, Pressable } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { colors } from "@/tokens";
import { rupiah } from "@/lib/format";
import type { InvoiceFormScope } from "./use-invoice-form";

export function InvoiceSummary({ form }: { form: InvoiceFormScope }) {
  const {
    alreadyBilledDpp,
    calculatedPct,
    currentBase,
    currentDpp,
    currentPph,
    currentPpn,
    currentTotal,
    dealDpp,
    dealGrandTotal,
    dealPph,
    dealPpn,
    effectiveDiscount,
    grossDealDpp,
    isIncludePpn,
    isNoPpn,
    isPurchaseForm,
    mode,
    pphCutAtIssue,
    pphLineLabel,
    pphTiming,
    pphTipeLabel,
    pphWithheldAtIssue,
    selectedParentInvoice,
    setPphTiming,
  } = form;

  return (
    <>
      {/* Grand Total Summary Box */}
      <View className="p-3.5 rounded-xl bg-card border border-border gap-1.5 mb-2">
        {effectiveDiscount > 0 ? (
          <>
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">
                Subtotal Item / Gross:
              </Text>
              <Text className="text-xs font-medium">
                {rupiah(grossDealDpp)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-danger font-medium">
                Diskon Pemotongan:
              </Text>
              <Text className="text-xs font-semibold text-danger">
                - {rupiah(effectiveDiscount)}
              </Text>
            </View>
          </>
        ) : null}
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">
            Total Dasar (DPP):
          </Text>
          <Text className="text-xs font-medium">{rupiah(dealDpp)}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">
            {isNoPpn
              ? "PPN (Tanpa PPN):"
              : isIncludePpn
                ? "PPN (Termasuk):"
                : "PPN (11%):"}
          </Text>
          <Text className="text-xs font-medium">{rupiah(dealPpn)}</Text>
        </View>
        {!isPurchaseForm && (dealPph > 0 || currentPph > 0) ? (
          <View className="gap-1.5 py-1.5">
            <Text className="text-xs font-semibold text-foreground">
              Kapan {pphTipeLabel} dipotong?
            </Text>
            <View className="flex-row gap-2">
              {(
                [
                  {
                    key: "bayar",
                    title: "Saat customer bayar",
                    desc: "Invoice tagih penuh, PPh dicatat dari bukti potong",
                  },
                  {
                    key: "terbit",
                    title: "Saat kirim invoice",
                    desc: "Total invoice langsung dikurangi PPh",
                  },
                ] as const
              ).map((opt) => {
                const active = pphTiming === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setPphTiming(opt.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    className={`flex-1 rounded-lg border px-2.5 py-2 ${active ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                  >
                    <View className="flex-row items-center gap-1.5">
                      {active ? (
                        <Check size={12} color={colors.primary} />
                      ) : null}
                      <Text
                        className={`text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}
                      >
                        {opt.title}
                      </Text>
                    </View>
                    <Text className="text-[10px] text-muted-foreground mt-0.5">
                      {opt.desc}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {mode === "lanjut" && selectedParentInvoice ? (
              <Text className="text-[10px] text-muted-foreground">
                Mengikuti invoice sebelumnya agar satu proyek konsisten.
              </Text>
            ) : null}
          </View>
        ) : null}
        {dealPph > 0 ? (
          <View className="flex-row justify-between">
            <Text className="text-xs text-amber-600 dark:text-amber-400 flex-1 pr-2">
              {pphLineLabel}:
            </Text>
            <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {pphWithheldAtIssue ? "- " : ""}
              {rupiah(dealPph)}
            </Text>
          </View>
        ) : null}
        <View className="flex-row justify-between pb-1.5 border-b border-border">
          <Text className="text-xs font-semibold text-foreground">
            Grand Total Kesepakatan:
          </Text>
          <Text className="text-xs font-bold text-foreground">
            {rupiah(dealGrandTotal)}
          </Text>
        </View>

        {/* Current Invoice Tagihan Breakdown */}
        <View className="flex-row justify-between pt-1">
          <Text className="text-xs font-bold text-primary">
            Tagihan Invoice Ini ({calculatedPct}%):
          </Text>
          <Text className="text-xs font-bold text-primary">
            {rupiah(currentDpp)}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">
            {isNoPpn
              ? "PPN Tagihan (Tanpa PPN):"
              : isIncludePpn
                ? "PPN Tagihan Ini (11% Termasuk):"
                : "PPN Tagihan Ini (11%):"}
          </Text>
          <Text className="text-xs font-medium">{rupiah(currentPpn)}</Text>
        </View>
        {currentPph > 0 ? (
          <View className="flex-row justify-between">
            <Text className="text-xs text-amber-600 dark:text-amber-400 flex-1 pr-2">
              {pphLineLabel}:
            </Text>
            <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {pphCutAtIssue ? "- " : ""}
              {rupiah(currentPph)}
            </Text>
          </View>
        ) : null}
        <View className="flex-row justify-between pt-1 border-t border-border">
          <Text className="text-sm font-bold text-foreground">
            Total Tagihan Faktur Ini:
          </Text>
          <Text className="text-sm font-bold text-primary">
            {rupiah(currentTotal)}
          </Text>
        </View>
        {currentPph > 0 && !isPurchaseForm ? (
          <View className="flex-row justify-between">
            <Text className="text-[11px] text-muted-foreground">
              {pphCutAtIssue
                ? "Customer transfer:"
                : "Estimasi transfer dari customer:"}
            </Text>
            <Text className="text-[11px] font-semibold">
              {rupiah(
                pphCutAtIssue
                  ? currentTotal
                  : Math.max(0, currentTotal - currentPph),
              )}
            </Text>
          </View>
        ) : null}

        {dealDpp - currentBase > 0 ? (
          <View className="flex-row justify-between pt-1 border-t border-dashed border-border">
            <Text className="text-xs text-muted-foreground">
              Sisa yang Belum Ditagih:
            </Text>
            <Text className="text-xs font-semibold text-amber-600">
              {rupiah(Math.max(0, dealDpp - (alreadyBilledDpp + currentBase)))}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
}
