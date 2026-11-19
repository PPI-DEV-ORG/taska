import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  Receipt,
  ChevronDown,
  Check,
  Calendar,
  Tag,
  Layers,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/akuntra/status-badge";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { rupiah } from "@/lib/format";
import type { Row } from "@/constants/modules";
import { formatDate } from "./format-date";

export interface ContinuableInvoiceOptionItem {
  id: string;
  label: string;
  nomor: string;
  customer: string;
  raw: Row;
  chain: any;
}

export interface ContinuableInvoiceSelectProps {
  value?: string;
  invoiceId?: string | number | null;
  options: ContinuableInvoiceOptionItem[];
  onChange: (selectedId: string, invoice: Row) => void;
  placeholder?: string;
  error?: boolean;
}

export function ContinuableInvoiceSelect({
  value,
  invoiceId,
  options,
  onChange,
  placeholder = "Ketik atau pilih faktur DP / termin acuan...",
  error,
}: ContinuableInvoiceSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const selectedOption = React.useMemo(() => {
    if (invoiceId) {
      const match = options.find((o) => String(o.id) === String(invoiceId));
      if (match) return match;
    }
    if (value) {
      return (
        options.find(
          (o) =>
            o.label === value || o.nomor === value || String(o.id) === value,
        ) || null
      );
    }
    return null;
  }, [options, invoiceId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedOption) {
      return selectedOption.label;
    }
    return value || "";
  }, [selectedOption, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return options;
    const term = q.trim().toLowerCase();
    return options.filter((o) => {
      const no = String(o.nomor || "").toLowerCase();
      const cust = String(o.customer || "").toLowerCase();
      const po = String(o.raw.po || o.raw.nomorSo || "").toLowerCase();
      const quo = String(o.raw.quotation || "").toLowerCase();
      const label = String(o.label || "").toLowerCase();
      return (
        no.includes(term) ||
        cust.includes(term) ||
        po.includes(term) ||
        quo.includes(term) ||
        label.includes(term)
      );
    });
  }, [options, q]);

  function handleSelect(opt: ContinuableInvoiceOptionItem) {
    onChange(opt.id, opt.raw);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => {
          setQ("");
          setOpen(true);
        }}
        className={cn(
          "bg-input border-border h-11 flex-row items-center justify-between rounded-lg border px-3 w-full",
          error && "border-danger",
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <Receipt
            size={16}
            color={displayLabel ? colors.primary : colors.muted}
          />
          <Text
            className={cn(
              "text-base md:text-sm flex-1",
              !displayLabel && "text-muted-foreground",
            )}
            numberOfLines={1}
          >
            {displayLabel || placeholder}
          </Text>
        </View>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[90vh] p-4 sm:p-6"
          style={Platform.select({
            web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any,
          })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Layers size={20} color={colors.primary} />
                <DialogTitle>Pilih Faktur DP / Termin Acuan</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor faktur, pelanggan, PO/SO, atau penawaran..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Table */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ minWidth: "100%" }}
            >
              <View className="flex-1 min-w-[760px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px]">
                    Nomor Faktur & Tanggal
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">
                    Pelanggan & Dokumen Asal
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 text-right px-2">
                    Total Nilai Tagihan
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[160px] px-2 text-center">
                    Status & Sisa Kontrak
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">
                    Aksi
                  </Text>
                </View>

                {/* Rows */}
                <ScrollView
                  className="max-h-[50vh]"
                  contentContainerClassName="divide-y divide-border/40"
                >
                  {filteredList.map((opt) => {
                    const isSelected = selectedOption?.id === opt.id;
                    const inv = opt.raw;
                    const tgl = inv.tanggal || inv.createdAt || "";
                    const totalVal = Number(inv.total || inv.nilai || 0);
                    const paid = Number(inv.paidAmount || inv.totalBayar || 0);
                    const outstanding = Math.max(0, totalVal - paid);
                    const remContract = Number(opt.chain?.remainingToBill || 0);

                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => handleSelect(opt)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        {/* Kolom 1: Nomor Invoice & Tanggal */}
                        <View className="w-1/4 min-w-[180px]">
                          <Text
                            className={cn(
                              "text-xs font-bold font-mono text-foreground",
                              isSelected && "text-primary",
                            )}
                          >
                            {opt.nomor}
                          </Text>
                          {tgl ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <Calendar size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground">
                                {formatDate(tgl)}
                              </Text>
                            </View>
                          ) : null}
                          <View className="flex-row items-center gap-1 mt-0.5">
                            <Tag size={10} color={colors.primary} />
                            <Text className="text-[10px] font-semibold text-primary">
                              {inv.jenis ||
                                (String(inv.type || "").toUpperCase() === "DP"
                                  ? "DP"
                                  : "Termin")}
                            </Text>
                          </View>
                        </View>

                        {/* Kolom 2: Customer & Dokumen Asal */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <Text
                            className="text-xs font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {opt.customer || "-"}
                          </Text>
                          {inv.po ? (
                            <Text
                              className="text-[10px] text-muted-foreground mt-0.5 font-mono"
                              numberOfLines={1}
                            >
                              SO: {inv.po}
                            </Text>
                          ) : null}
                          {inv.quotation ? (
                            <Text
                              className="text-[10px] text-muted-foreground font-mono"
                              numberOfLines={1}
                            >
                              Quo: {inv.quotation}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 3: Total Nilai Tagihan */}
                        <View className="w-36 items-end px-2">
                          <Text className="text-xs font-bold text-foreground">
                            {rupiah(totalVal)}
                          </Text>
                          {outstanding > 0 ? (
                            <Text className="text-[10px] text-danger font-medium">
                              Sisa tagihan: {rupiah(outstanding)}
                            </Text>
                          ) : (
                            <Text className="text-[10px] text-success font-medium">
                              Lunas
                            </Text>
                          )}
                        </View>

                        {/* Kolom 4: Status & Sisa Kontrak */}
                        <View className="flex-1 min-w-[160px] px-2 items-center">
                          <StatusBadge status={inv.status || "Aktif"} />
                          {remContract > 0 ? (
                            <View className="mt-1 px-2 py-0.5 rounded bg-warning/15 border border-warning/30">
                              <Text className="text-[10px] font-semibold text-warning">
                                Sisa Kontrak: {rupiah(remContract)}
                              </Text>
                            </View>
                          ) : (
                            <Text className="text-[10px] text-muted-foreground mt-0.5">
                              Kontrak habis
                            </Text>
                          )}
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 items-center">
                          {isSelected ? (
                            <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/15 rounded-md">
                              <Check size={12} color={colors.primary} />
                              <Text className="text-[11px] font-bold text-primary">
                                Dipilih
                              </Text>
                            </View>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2.5"
                            >
                              <Text className="text-[11px] font-semibold text-muted-foreground">
                                Pilih
                              </Text>
                            </Button>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  {filteredList.length === 0 && (
                    <View className="p-8 items-center justify-center gap-2">
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Tidak ada invoice acuan yang cocok dengan &quot;{q}
                        &quot;
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==========================================
// 4b. INVOICE (FAKTUR PENJUALAN) SELECT
// ==========================================
