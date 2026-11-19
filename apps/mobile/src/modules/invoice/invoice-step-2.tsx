import { View, Pressable } from "react-native";
import { Package, Trash2, Check } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/akuntra/basics";
import { DatePicker } from "@/components/akuntra/dialogs";
import { StatusBadge } from "@/components/akuntra/status-badge";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import {
  PPH_MODE_OPTIONS,
  calcItemPph,
  itemDiscount,
} from "@/modules/quotation/lib";
import type { InvoiceFormScope } from "./use-invoice-form";

export function InvoiceStep2({ form }: { form: InvoiceFormScope }) {
  const {
    activeQuotation,
    continuationType,
    customDiscount,
    customDpp,
    discPctLabel,
    discPercent,
    discountAlreadyInSoPrices,
    editItems,
    effectiveDiscount,
    grossDealDpp,
    items,
    jatuhTempo,
    linkedQuoteForDisc,
    mode,
    relatedExistingInvoices,
    selectedItemIndices,
    selectedParentInvoice,
    setCustomDiscount,
    setCustomDpp,
    setDiscPercent,
    setItems,
    setJatuhTempo,
    setPickerOpen,
    setPphMode,
    setSelectedItemIndices,
    setShowAllItems,
    setShowExtraDiscount,
    setTanggal,
    showAllItems,
    showExtraDiscount,
    tanggal,
    terminNumber,
  } = form;

  return (
    <>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <FormField
            label={mode === "masuk" ? "Tanggal Tagihan" : "Tanggal Terbit"}
            required
          >
            <DatePicker value={tanggal} onChange={setTanggal} />
          </FormField>
        </View>
        <View className="flex-1">
          <FormField label="Jatuh Tempo" required>
            <DatePicker value={jatuhTempo} onChange={setJatuhTempo} />
          </FormField>
        </View>
      </View>

      {(mode === "baru" || mode === "masuk") && items.length === 0 ? (
        <FormField
          label={
            mode === "masuk"
              ? "Nominal Tagihan / Nilai DPP (Rp)"
              : "Nilai Kesepakatan / DPP Total (Rp)"
          }
          required
        >
          <Input
            value={customDpp}
            onChangeText={(v) => setCustomDpp(formatThousands(v))}
            keyboardType="numeric"
            placeholder="Rp 0"
          />
        </FormField>
      ) : null}

      {/* List Barang / Items Section (Only for Invoice Keluar, or if Invoice Masuk has PO items) */}
      {mode === "lanjut" ||
      (mode === "masuk" && relatedExistingInvoices.length > 0) ? (
        <View className="p-4 rounded-xl border border-primary/20 bg-primary/5 gap-2.5">
          <View className="flex-row items-center gap-2">
            <Package size={16} color={colors.primary} />
            <Text className="text-xs font-bold text-primary">
              {mode === "masuk"
                ? "Rincian Tagihan Kelanjutan PO / Pembelian"
                : "Barang & Unit SN Tidak Perlu Dipilih Ulang"}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground leading-relaxed">
            {mode === "masuk"
              ? `Invoice lanjutan (${continuationType === "pelunasan" ? "Pelunasan" : `Termin ${terminNumber}`}) ini melanjutkan sisa tagihan dari invoice masuk sebelumnya tanpa perlu memasukkan ulang daftar barang.`
              : `Seluruh barang dan unit Serial Number (SN) fisik telah tercatat & di-reserve pada invoice pertama (${selectedParentInvoice?.nomor || "DP / Termin 1"}). Invoice lanjutan (${continuationType === "pelunasan" ? "Pelunasan" : `Termin ${terminNumber}`}) ini hanya menagih sisa pembayaran tanpa mengambil unit SN baru dari gudang.`}
          </Text>
          {activeQuotation?.items && activeQuotation.items.length > 0 ? (
            <View className="mt-1 pt-2 border-t border-primary/10 flex-row items-center justify-between">
              <Text className="text-[11px] text-muted-foreground">
                Total barang dalam kontrak awal: {activeQuotation.items.length}{" "}
                item (
                {activeQuotation.items.reduce(
                  (acc: number, it: any) => acc + (Number(it.qty) || 1),
                  0,
                )}{" "}
                unit)
              </Text>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onPress={() => setShowAllItems(!showAllItems)}
              >
                <Text className="text-[11px] text-primary font-medium">
                  {showAllItems
                    ? "Sembunyikan Rincian"
                    : "Lihat Rincian Kontrak"}
                </Text>
              </Button>
            </View>
          ) : null}
          {showAllItems && activeQuotation?.items ? (
            <View className="gap-1 mt-1 bg-background/80 p-2 rounded-lg border border-border/50">
              {activeQuotation.items.map((it: any, i: number) => (
                <View
                  key={i}
                  className="flex-row justify-between py-1 border-b border-border/30"
                >
                  <Text className="text-[11px] text-foreground font-medium flex-1 mr-2">
                    {it.item}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    {it.qty} {it.satuan || it.unit || "unit"} x{" "}
                    {rupiah(it.harga || it.price || 0)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : mode === "masuk" ? (
        items.length > 0 ? (
          <View className="gap-2 p-3 rounded-xl border border-border bg-card">
            <View className="flex-row justify-between items-center">
              <Text className="text-xs font-bold text-foreground">
                Rincian Item dari PO Supplier ({items.length} Item)
              </Text>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onPress={() => editItems([])}
              >
                <Text className="text-xs text-danger">Hapus Rincian Item</Text>
              </Button>
            </View>
            {items.map((it, idx) => {
              const itemPrice = Number(it.harga || it.price || 0);
              const sub = (Number(it.qty) || 1) * itemPrice;
              return (
                <View
                  key={it.id || idx}
                  className="flex-row justify-between py-1.5 border-b border-border/40"
                >
                  <Text className="text-xs font-medium flex-1 mr-2">
                    {it.item} ({it.qty} {it.satuan || it.unit || "unit"} x{" "}
                    {rupiah(itemPrice)})
                  </Text>
                  <Text className="text-xs font-semibold">{rupiah(sub)}</Text>
                </View>
              );
            })}
          </View>
        ) : null
      ) : (
        <View className="gap-2 p-3 rounded-xl border border-border bg-card">
          <View className="flex-row justify-between items-center flex-wrap gap-2">
            <View>
              <Text className="text-xs font-bold text-foreground">
                Daftar Barang & Jasa dari Penawaran / Stok ({items.length} Item)
              </Text>
              <Text className="text-[11px] text-muted-foreground">
                Barang ber-SN pada daftar ini otomatis di-reserve untuk Invoice
                ini.
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 flex-wrap">
              {selectedItemIndices.length > 0 && (
                <Button
                  size="sm"
                  className="h-7 px-2.5 bg-danger flex-row items-center gap-1"
                  onPress={() => {
                    editItems(
                      items.filter((_, i) => !selectedItemIndices.includes(i)),
                    );
                    setSelectedItemIndices([]);
                  }}
                >
                  <Trash2 size={12} color="#fff" />
                  <Text className="text-xs text-white font-semibold">
                    Hapus ({selectedItemIndices.length})
                  </Text>
                </Button>
              )}
              {items.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onPress={() => {
                    if (selectedItemIndices.length === items.length) {
                      setSelectedItemIndices([]);
                    } else {
                      setSelectedItemIndices(items.map((_, i) => i));
                    }
                  }}
                >
                  <Text className="text-xs">
                    {selectedItemIndices.length === items.length
                      ? "Batal Semua"
                      : "Pilih Semua"}
                  </Text>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onPress={() => setPickerOpen(true)}
              >
                <Package size={13} color={colors.primary} />
                <Text className="text-xs text-primary font-semibold">
                  + Pilih Stok & SN / Jasa
                </Text>
              </Button>
            </View>
          </View>
          {items.length > 0 ? (
            <View className="gap-2 mt-1">
              {(showAllItems ? items : items.slice(0, 10)).map((it, idx) => {
                const itPph = calcItemPph(it);
                const itemPrice = Number(it.harga || it.price || 0);
                const lineDisc = itemDiscount(it);
                const sub = (Number(it.qty) || 1) * itemPrice - lineDisc;
                const isSelected = selectedItemIndices.includes(idx);
                return (
                  <View
                    key={it.id || idx}
                    className={`py-2 px-2 rounded-lg border-b border-border/40 gap-1.5 ${isSelected ? "bg-primary/10" : ""}`}
                  >
                    <View className="flex-row justify-between items-center gap-2">
                      <Pressable
                        onPress={() => {
                          setSelectedItemIndices((prev) =>
                            prev.includes(idx)
                              ? prev.filter((i) => i !== idx)
                              : [...prev, idx],
                          );
                        }}
                        hitSlop={6}
                        className="mr-1"
                      >
                        <View
                          className={`w-4 h-4 rounded border items-center justify-center ${
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-border/80 bg-background"
                          }`}
                        >
                          {isSelected && <Check size={11} color="#ffffff" />}
                        </View>
                      </Pressable>
                      <View className="flex-1 mr-1">
                        <Text className="text-xs font-medium">{it.item}</Text>
                        <View className="flex-row flex-wrap items-center gap-1.5 mt-0.5">
                          <Text className="text-[10px] text-muted-foreground">
                            {it.qty} {it.satuan || it.unit || "unit"} x{" "}
                            {rupiah(itemPrice)}
                          </Text>
                          {Array.isArray(it.serialNumbers) &&
                          it.serialNumbers.length > 0 ? (
                            <StatusBadge
                              status={`Reserve SN: ${it.serialNumbers.join(", ")}`}
                            />
                          ) : it.kind === "SERVICE" ? (
                            <StatusBadge status="Jasa / Non-Barang" />
                          ) : null}
                        </View>
                      </View>
                      <View className="items-end gap-0.5">
                        <Text className="text-xs font-semibold">
                          {rupiah(sub)}
                        </Text>
                        {lineDisc > 0 ? (
                          <Text className="text-[10px] text-danger font-medium">
                            Diskon
                            {Number(it.diskonPct) > 0
                              ? ` ${it.diskonPct}%`
                              : ""}
                            : -{rupiah(lineDisc)}
                          </Text>
                        ) : null}
                        {itPph > 0 ? (
                          <Text className="text-[10px] text-muted-foreground">
                            {it.tipePph || "PPh"}: {rupiah(itPph)}
                          </Text>
                        ) : null}
                      </View>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5"
                        onPress={() =>
                          editItems(items.filter((_, i) => i !== idx))
                        }
                      >
                        <Trash2 size={13} color={colors.danger} />
                      </Button>
                    </View>

                    {/* Selector PPh Per-Item */}
                    <View className="flex-row items-center gap-1 flex-wrap">
                      <Text className="text-[10px] text-muted-foreground mr-1">
                        PPh Item:
                      </Text>
                      {PPH_MODE_OPTIONS.map((opt) => {
                        const active = (it.pphMode || "none") === opt.id;
                        return (
                          <Pressable
                            key={opt.id}
                            onPress={() => {
                              setItems((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        pphMode: opt.id,
                                        tipePph: opt.label,
                                      }
                                    : item,
                                ),
                              );
                              if (opt.id !== "none") {
                                setPphMode(opt.id);
                              }
                            }}
                            className={`px-2 py-0.5 rounded border ${
                              active
                                ? "bg-primary/10 border-primary"
                                : "bg-muted/40 border-border/60"
                            }`}
                          >
                            <Text
                              className={`text-[10px] ${active ? "text-primary font-bold" : "text-muted-foreground"}`}
                            >
                              {opt.id === "none" ? "Non-PPh" : opt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
              {items.length > 10 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 border border-border/60 rounded-lg flex-row items-center justify-center gap-1.5 mt-1"
                  onPress={() => setShowAllItems((v) => !v)}
                >
                  <Text className="text-xs font-semibold text-primary">
                    {showAllItems
                      ? "Sembunyikan"
                      : `Lihat Semua (${items.length} item)`}
                  </Text>
                </Button>
              )}
              <View className="flex-row justify-between pt-1">
                <Text className="text-xs font-semibold text-muted-foreground">
                  Subtotal Rincian Barang:
                </Text>
                <Text className="text-xs font-bold text-primary">
                  {rupiah(grossDealDpp)}
                </Text>
              </View>
            </View>
          ) : (
            <Text className="text-xs text-muted-foreground italic">
              Belum ada rincian barang/jasa. Pilih penawaran yang memiliki item
              atau klik &quot;+ Pilih Stok &amp; SN / Jasa&quot;.
            </Text>
          )}
        </View>
      )}

      {/* Diskon Pemotongan (Persen & Nominal) */}
      {mode === "lanjut" ? (
        effectiveDiscount > 0 ? (
          <View className="p-3 rounded-xl bg-card border border-border flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-foreground">
              Diskon Kontrak Awal
            </Text>
            <Text className="text-xs font-semibold text-danger">
              - {rupiah(effectiveDiscount)} {discPctLabel}
            </Text>
          </View>
        ) : null
      ) : discountAlreadyInSoPrices &&
        effectiveDiscount === 0 &&
        !showExtraDiscount ? (
        <View className="p-3 rounded-xl bg-card border border-border gap-1.5">
          <Text className="text-xs font-semibold text-foreground">Diskon</Text>
          <Text className="text-[11px] text-muted-foreground">
            {`Diskon penawaran ${rupiah(Number(linkedQuoteForDisc?.discount ?? linkedQuoteForDisc?.disc ?? 0))} sudah termasuk di harga barang SO, jadi tidak dipotong lagi di invoice.`}
          </Text>
          <Pressable
            onPress={() => setShowExtraDiscount(true)}
            accessibilityRole="button"
            className="self-start"
          >
            <Text className="text-xs font-semibold text-primary">
              + Tambah diskon lain
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="p-3 rounded-xl bg-card border border-border gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-foreground">
              Diskon Pemotongan
            </Text>
            {effectiveDiscount > 0 ? (
              <Text className="text-xs font-semibold text-danger">
                - {rupiah(effectiveDiscount)} {discPctLabel}
              </Text>
            ) : null}
          </View>
          <View className="flex-row items-center gap-2">
            <View className="w-28 sm:w-36">
              <FormField label="Diskon (%)">
                <Input
                  value={discPercent}
                  onChangeText={(p) => {
                    const clean = p.replace(/[^0-9.]/g, "");
                    setDiscPercent(clean);
                    const pct = Number(clean) || 0;
                    if (grossDealDpp > 0) {
                      const calculated = Math.round(grossDealDpp * (pct / 100));
                      setCustomDiscount(
                        calculated > 0 ? formatThousands(calculated) : "",
                      );
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="0%"
                />
              </FormField>
            </View>
            <View className="flex-1">
              <FormField label="Diskon Nominal (Rp)">
                <Input
                  value={customDiscount}
                  onChangeText={(v) => {
                    setCustomDiscount(formatThousands(v));
                    const nom = Number(String(v).replace(/\D/g, "")) || 0;
                    if (grossDealDpp > 0 && nom > 0) {
                      const pct =
                        Math.round((nom / grossDealDpp) * 100 * 10) / 10;
                      setDiscPercent(String(pct));
                    } else {
                      setDiscPercent("");
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="0 (Contoh: 100.000)"
                />
              </FormField>
            </View>
          </View>
        </View>
      )}

      {/* Status Pembayaran */}
    </>
  );
}
