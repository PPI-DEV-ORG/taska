import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  Receipt,
  ChevronDown,
  Check,
  Calendar,
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
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { rupiah } from "@/lib/format";
import type { Row } from "@/constants/modules";
import { formatDate } from "./format-date";
import { useBreakpoint } from "@/hooks/use-breakpoint";

export interface InvoiceSelectProps {
  value?: string;
  invoiceId?: string | number | null;
  onChange: (invoice: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
  excludeIds?: Iterable<string | number>;
}

export function InvoiceSelect({
  value,
  invoiceId,
  onChange,
  placeholder = "Cari & pilih invoice penjualan...",
  error,
  allowClear = true,
  excludeIds,
}: InvoiceSelectProps) {
  const { data } = useApp();
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const excludedSet = React.useMemo(() => {
    const set = new Set<string>();
    for (const id of excludeIds ?? []) set.add(String(id));
    return set;
  }, [excludeIds]);

  const invoices: Row[] = React.useMemo(() => {
    return (data.invoices ?? []).filter(
      (inv: Row) =>
        inv.status !== "Batal" &&
        inv.status !== "BATAL" &&
        !excludedSet.has(String(inv.id)),
    );
  }, [data.invoices, excludedSet]);

  const selectedInvoice = React.useMemo(() => {
    if (invoiceId) {
      const match = invoices.find(
        (inv) => String(inv.id) === String(invoiceId),
      );
      if (match) return match;
    }
    if (value && value !== "-") {
      const selNo = value
        .split(" — ")[0]
        ?.split(" - ")[0]
        ?.trim()
        .toLowerCase();
      return (
        invoices.find((inv) => {
          const no = String(inv.nomor || `INV #${inv.id}`).toLowerCase();
          return (
            no === selNo ||
            `${no} - ${inv.customer || "-"}`.toLowerCase() ===
              value.toLowerCase()
          );
        }) || null
      );
    }
    return null;
  }, [invoices, invoiceId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedInvoice) {
      const no = selectedInvoice.nomor || `INV #${selectedInvoice.id}`;
      return `${no} - ${selectedInvoice.customer || "-"}`;
    }
    return value && value !== "-" ? value : "";
  }, [selectedInvoice, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return invoices;
    const term = q.trim().toLowerCase();
    return invoices.filter((inv) => {
      const no = String(inv.nomor || `INV #${inv.id}`).toLowerCase();
      const cust = String(inv.customer || "").toLowerCase();
      const proj = String(inv.project || "").toLowerCase();
      const note = String(inv.catatan || inv.notes || "").toLowerCase();
      const jenis = String(inv.jenis || "").toLowerCase();
      return (
        no.includes(term) ||
        cust.includes(term) ||
        proj.includes(term) ||
        note.includes(term) ||
        jenis.includes(term)
      );
    });
  }, [invoices, q]);

  function handleSelect(inv: Row | null) {
    onChange(inv);
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
          <DialogHeader className="pr-8">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Receipt size={20} color={colors.primary} />
                <DialogTitle>Pilih Invoice Penjualan</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor invoice, customer, proyek, atau catatan..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Cards for Mobile vs Table for Desktop */}
          {isMobile ? (
            <ScrollView
              className="max-h-[60vh] mt-3"
              contentContainerClassName="gap-2.5 pb-2"
              showsVerticalScrollIndicator={false}
            >
              {allowClear && (
                <Pressable
                  onPress={() => handleSelect(null)}
                  className="p-3 rounded-xl border border-dashed border-border bg-card/50 flex-row items-center justify-between"
                >
                  <Text className="text-xs font-medium text-muted-foreground">
                    - Tanpa Invoice Penjualan (Opsional) -
                  </Text>
                  {!invoiceId && !value && (
                    <Check size={16} color={colors.primary} />
                  )}
                </Pressable>
              )}

              {filteredList.map((inv) => {
                const isSelected = selectedInvoice?.id === inv.id;
                const no = inv.nomor || `INV #${inv.id}`;
                const tgl = inv.tanggal || inv.date || inv.createdAt || "";
                const totalVal = Number(inv.total || inv.nilai || 0);
                const terbayar = Number(inv.terbayar || 0);
                const sisa = Math.max(0, totalVal - terbayar);

                return (
                  <Pressable
                    key={inv.id}
                    onPress={() => handleSelect(inv)}
                    className={cn(
                      "p-3.5 rounded-xl border border-border/80 bg-card gap-2 active:scale-[0.99] transition-transform",
                      isSelected && "border-primary/60 bg-primary/[0.04]",
                    )}
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1 min-w-0">
                        <Text
                          className={cn(
                            "text-sm font-bold font-mono text-foreground",
                            isSelected && "text-primary",
                          )}
                          numberOfLines={1}
                        >
                          {no}
                        </Text>
                        {tgl ? (
                          <View className="flex-row items-center gap-1 mt-0.5">
                            <Calendar size={10} color={colors.muted} />
                            <Text className="text-[11px] text-muted-foreground">{formatDate(tgl)}</Text>
                          </View>
                        ) : null}
                      </View>
                      <StatusBadge status={inv.status || "Draf"} />
                    </View>

                    <View className="flex-row items-center justify-between border-t border-border/40 pt-2 mt-0.5">
                      <View className="flex-1 mr-2 min-w-0">
                        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                          {inv.customer || "-"}
                        </Text>
                        <Text className="text-[11px] font-bold text-primary mt-0.5">
                          {rupiah(totalVal)}
                        </Text>
                        {sisa > 0 && terbayar > 0 ? (
                          <Text className="text-[10px] text-warning" numberOfLines={1}>
                            Sisa: {rupiah(sisa)}
                          </Text>
                        ) : null}
                      </View>

                      {isSelected ? (
                        <View className="size-7 rounded-full bg-primary/20 items-center justify-center shrink-0">
                          <Check size={14} color={colors.primary} />
                        </View>
                      ) : (
                        <View className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                          <Text className="text-[11px] font-semibold text-primary">Pilih</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}

              {filteredList.length === 0 && (
                <View className="p-8 items-center justify-center">
                  <Text className="text-xs text-muted-foreground text-center">
                    {q.trim()
                      ? "Tidak ada invoice yang sesuai pencarian."
                      : "Tidak ada invoice yang tersedia atau semua sudah memiliki Surat Jalan."}
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
              <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ minWidth: "100%" }}
            >
              <View className="flex-1 min-w-[880px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[200px]">
                    Nomor Invoice & Jenis
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[180px] px-2">
                    Customer & Proyek
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 shrink-0 text-right pr-3">
                    Total Tagihan
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-48 shrink-0 pl-4 pr-2">
                    Status Pembayaran
                  </Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 shrink-0 text-center">
                    Aksi
                  </Text>
                </View>

                {/* Rows */}
                <ScrollView
                  className="max-h-[50vh]"
                  contentContainerClassName="divide-y divide-border/40"
                >
                  {allowClear && (
                    <Pressable
                      onPress={() => handleSelect(null)}
                      className="p-3.5 hover:bg-muted/30 active:bg-muted/50 flex-row items-center justify-between"
                    >
                      <Text className="text-xs font-medium text-muted-foreground">
                        - Tanpa Invoice Penjualan (Opsional) -
                      </Text>
                      {!invoiceId && !value && (
                        <Check size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  )}

                  {filteredList.map((inv) => {
                    const isSelected = selectedInvoice?.id === inv.id;
                    const no = inv.nomor || `INV #${inv.id}`;
                    const tgl = inv.tanggal || inv.date || inv.createdAt || "";
                    const totalVal = Number(inv.total || inv.nilai || 0);
                    const terbayar = Number(inv.terbayar || 0);
                    const sisa = Math.max(0, totalVal - terbayar);
                    const itemCount = Array.isArray(inv.items)
                      ? inv.items.length
                      : 0;

                    return (
                      <Pressable
                        key={inv.id}
                        onPress={() => handleSelect(inv)}
                        className={cn(
                          "px-4 py-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center",
                          isSelected && "bg-primary/10",
                        )}
                      >
                        {/* Kolom 1 */}
                        <View className="flex-1 min-w-[200px]">
                          <View className="flex-row items-center gap-1.5 flex-wrap">
                            <Text
                              className={cn(
                                "text-xs font-bold font-mono text-foreground",
                                isSelected && "text-primary",
                              )}
                            >
                              {no}
                            </Text>
                            {inv.jenis ? (
                              <View className="bg-primary/10 rounded px-1.5 py-0.5">
                                <Text className="text-[10px] font-semibold text-primary">
                                  {inv.jenis}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {tgl ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <Calendar size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground">
                                {formatDate(tgl)}
                              </Text>
                            </View>
                          ) : null}
                          {itemCount > 0 ? (
                            <Text className="text-[10px] text-muted-foreground mt-0.5">
                              {itemCount} item barang/jasa
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 2 */}
                        <View className="flex-1 min-w-[180px] px-2">
                          <Text
                            className="text-xs font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {inv.customer || "-"}
                          </Text>
                          {inv.project && inv.project !== "-" ? (
                            <Text
                              className="text-[11px] text-muted-foreground mt-0.5"
                              numberOfLines={1}
                            >
                              Proyek: {inv.project}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 3 */}
                        <View className="w-36 shrink-0 items-end pr-3">
                          <Text
                            className="w-full text-right text-xs font-bold text-foreground"
                            numberOfLines={1}
                          >
                            {rupiah(totalVal)}
                          </Text>
                          {sisa > 0 && terbayar > 0 ? (
                            <Text
                              className="w-full text-right text-[10px] text-warning mt-0.5"
                              numberOfLines={1}
                            >
                              Sisa: {rupiah(sisa)}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 4 */}
                        <View className="w-48 shrink-0 pl-4 pr-2 items-start justify-center">
                          <StatusBadge status={inv.status || "Draf"} />
                        </View>

                        {/* Kolom 5 */}
                        <View className="w-20 shrink-0 items-center justify-center">
                          <Button
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            className="h-8 px-3"
                            onPress={() => handleSelect(inv)}
                          >
                            <Text className="text-xs">
                              {isSelected ? "Terpilih" : "Pilih"}
                            </Text>
                          </Button>
                        </View>
                      </Pressable>
                    );
                  })}

                  {filteredList.length === 0 && (
                    <View className="p-8 items-center justify-center">
                      <Text className="text-xs text-muted-foreground">
                        {q.trim()
                          ? "Tidak ada invoice yang sesuai pencarian."
                          : "Tidak ada invoice yang tersedia atau semua sudah memiliki Surat Jalan."}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==========================================
// 5. PROJECT (PROYEK) SELECT
// ==========================================
