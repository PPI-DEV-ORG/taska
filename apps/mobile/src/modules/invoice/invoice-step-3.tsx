import { View, Pressable } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/akuntra/basics";
import { SearchableSelect } from "@/components/akuntra/dialogs";
import { FileUploader } from "@/components/akuntra/file-uploader";
import { rupiah } from "@/lib/format";
import { PPN_MODE_OPTIONS } from "@/modules/quotation/lib";
import { StepTitle } from "./invoice-step-title";
import type { InvoiceFormScope } from "./use-invoice-form";

export function InvoiceStep3({ form }: { form: InvoiceFormScope }) {
  const {
    catatan,
    currentDpp,
    currentPpn,
    isProforma,
    kasBankOptions,
    mode,
    nomor,
    paymentAccountCode,
    paymentStatus,
    ppnMode,
    setCatatan,
    setFileId,
    setNomor,
    setPaymentAccountCode,
    setPaymentFileId,
    setPaymentMethod,
    setPaymentStatus,
    setPpnMode,
    setShowMoreOptions,
    showMoreOptions,
    supplierPoRef,
  } = form;

  return (
    <>
      <StepTitle
        n={3}
        title={mode === "masuk" ? "Pembayaran tagihan" : "Pembayaran"}
        hint={
          isProforma && mode !== "masuk"
            ? undefined
            : 'Biasanya "Belum bayar". Pilih "Langsung lunas" bila uang sudah diterima.'
        }
      />
      {isProforma && mode !== "masuk" ? (
        <View className="p-3 rounded-xl bg-panel border border-border gap-1">
          <Text className="text-xs font-semibold text-foreground">
            Pembayaran
          </Text>
          <Text className="text-[11px] text-muted-foreground">
            Proforma tidak bisa langsung dibayar. Setelah customer setuju /
            membayar, buka proforma lalu tekan &quot;Terbitkan Invoice&quot; —
            pembayaran dicatat di invoice resmi.
          </Text>
        </View>
      ) : null}
      <View
        className={`p-3 rounded-xl bg-panel border border-border gap-2 ${isProforma && mode !== "masuk" ? "hidden" : ""}`}
      >
        <FormField
          label={
            mode === "masuk"
              ? "Status Pembayaran Tagihan Masuk"
              : "Status Pembayaran Saat Terbit"
          }
        >
          <View className="flex-row gap-2">
            <Button
              variant={paymentStatus === "UNPAID" ? "default" : "outline"}
              size="sm"
              onPress={() => setPaymentStatus("UNPAID")}
              className="flex-1 h-8"
            >
              <Text className="text-xs">
                {mode === "masuk"
                  ? "Belum Dibayar (Hutang / Tempo)"
                  : "Belum Bayar (Tagihan / Tempo)"}
              </Text>
            </Button>
            <Button
              variant={paymentStatus === "PAID" ? "default" : "outline"}
              size="sm"
              onPress={() => setPaymentStatus("PAID")}
              className="flex-1 h-8"
            >
              <Text className="text-xs">
                {mode === "masuk"
                  ? "Langsung Dibayar / Lunas (Kas / Bank)"
                  : "Langsung Lunas (Kas / Bank)"}
              </Text>
            </Button>
          </View>
        </FormField>

        {paymentStatus === "PAID" ? (
          <View className="gap-2.5">
            <FormField
              label={
                mode === "masuk"
                  ? "Pilih Akun Kas / Bank Pembayaran (Sumber Dana)"
                  : "Pilih Akun Kas / Bank Penerimaan"
              }
              required
              hint={
                mode === "masuk"
                  ? "Pilih rekening bank atau kas kecil yang digunakan untuk membayar tagihan ini"
                  : "Pilih rekening bank atau kas kecil tempat pembayaran faktur ini masuk"
              }
            >
              <SearchableSelect
                value={
                  kasBankOptions.find((o) => o.code === paymentAccountCode)
                    ?.name ||
                  kasBankOptions[0]?.name ||
                  ""
                }
                options={kasBankOptions.map((o) => o.name)}
                onChange={(val) => {
                  const match = kasBankOptions.find(
                    (o) => o.name === val || val.includes(o.code),
                  );
                  if (match) {
                    setPaymentAccountCode(match.code);
                    const isTunai =
                      match.code === "1000.01" || /kas/i.test(match.rawName);
                    setPaymentMethod(isTunai ? "TUNAI" : "TRANSFER");
                  }
                }}
                placeholder="Pilih rekening kas / bank..."
              />
            </FormField>

            <FormField
              label="Upload Bukti Pembayaran / Transfer (Opsional)"
              hint="Lampirkan foto / PDF bukti transfer bank atau struk pelunasan"
            >
              <FileUploader
                label="Pilih File Foto / PDF Bukti Pembayaran"
                kind="semua"
                category="invoice"
                autoFlush
                onUploaded={(id: number | null) => setPaymentFileId(id)}
              />
            </FormField>
          </View>
        ) : null}
      </View>

      {/* Opsi lainnya: nomor manual, lampiran, catatan (jarang diubah) */}
      <View className="rounded-xl border border-border">
        <Pressable
          onPress={() => setShowMoreOptions((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showMoreOptions }}
          className="flex-row items-center justify-between px-3 py-2.5"
        >
          <Text className="text-xs font-semibold text-foreground">
            Opsi lainnya{" "}
            <Text className="text-[11px] font-normal text-muted-foreground">
              (nomor manual, lampiran, catatan)
            </Text>
          </Text>
          <Text className="text-xs text-primary">
            {showMoreOptions ? "Tutup" : "Buka"}
          </Text>
        </Pressable>
        {showMoreOptions ? (
          <View className="gap-3 px-3 pb-3">
            <FormField
              label={
                mode === "masuk"
                  ? "Nomor Faktur Masuk / No. Tagihan (Kosongkan untuk otomatis)"
                  : "Nomor Faktur (Kosongkan untuk otomatis)"
              }
            >
              {isProforma && mode !== "masuk" ? (
                <Text className="text-xs text-muted-foreground py-2">
                  Nomor proforma (PI/...) dibuat otomatis oleh sistem.
                </Text>
              ) : (
                <Input
                  value={nomor}
                  onChangeText={setNomor}
                  placeholder={
                    mode === "masuk"
                      ? "Contoh: INV-IN/2026/11/001 atau No. Tagihan PLN/IndiHome"
                      : "Otomatis oleh sistem"
                  }
                />
              )}
            </FormField>

            <FormField
              label={
                mode === "masuk"
                  ? "Upload Dokumen Faktur Masuk / Tagihan (Opsional)"
                  : "Upload Dokumen Pendukung Faktur (Opsional)"
              }
              hint={
                mode === "masuk"
                  ? "Lampirkan file PDF / foto tagihan (misal: Tagihan PLN, IndiHome, atau Faktur Pemasok)"
                  : "Lampirkan dokumen pendukung bila ada"
              }
            >
              <FileUploader
                label={
                  mode === "masuk"
                    ? "Pilih File PDF / Foto Tagihan Masuk"
                    : "Pilih File Dokumen Faktur"
                }
                kind="semua"
                category="invoice"
                autoFlush
                onUploaded={(id: number | null) => setFileId(id)}
              />
            </FormField>

            <FormField
              label={
                mode === "masuk"
                  ? "Catatan / Keterangan Tagihan Masuk"
                  : "Catatan / Keterangan Faktur"
              }
            >
              <Textarea
                value={catatan}
                onChangeText={setCatatan}
                placeholder={
                  mode === "masuk"
                    ? "Contoh: Tagihan Internet IndiHome Bulan November 2026 / ID Pelanggan..."
                    : "Catatan tambahan untuk faktur ini..."
                }
              />
            </FormField>
          </View>
        ) : null}
      </View>

      {/* Ketentuan PPN */}
      <View className="w-full sm:w-1/2 px-2 py-2">
        <FormField
          label={
            mode === "masuk"
              ? "Ketentuan PPN Masukan (Pajak Pertambahan Nilai)"
              : "Ketentuan PPN (Pajak Pertambahan Nilai)"
          }
        >
          <View className="gap-2">
            <View className="flex-row flex-wrap gap-1.5">
              {PPN_MODE_OPTIONS.map((opt) => (
                <Button
                  key={opt.id}
                  size="sm"
                  variant={ppnMode === opt.id ? "default" : "outline"}
                  onPress={() => setPpnMode(opt.id)}
                  disabled={!!supplierPoRef && opt.id !== ppnMode}
                  className="h-9 px-3"
                >
                  <Text className="text-xs">{opt.label}</Text>
                </Button>
              ))}
            </View>
            {supplierPoRef ? (
              <Text className="text-[11px] text-muted-foreground">
                Mengikuti ketentuan PPN di PO {supplierPoRef.nomor}.
              </Text>
            ) : null}
            <View className="bg-card border-border/50 gap-1 rounded-lg border p-2.5">
              <Text className="text-[11px] text-muted-foreground">
                {ppnMode === "exclude"
                  ? "PPN 11% ditambahkan di luar nilai dasar (DPP)."
                  : ppnMode === "include"
                    ? "Nilai dasar sudah termasuk PPN 11%."
                    : "Transaksi ini tanpa PPN (0%)."}
              </Text>
              {ppnMode === "include" ? (
                <View className="mt-1 gap-0.5">
                  <Text className="text-xs text-foreground">
                    DPP (Sebelum PPN): {rupiah(currentDpp)}
                  </Text>
                  <Text className="text-xs font-semibold text-primary">
                    PPN 11% Termasuk: {rupiah(currentPpn)}
                  </Text>
                </View>
              ) : currentPpn > 0 ? (
                <Text className="text-xs font-semibold text-primary">
                  PPN 11%: +{rupiah(currentPpn)}
                </Text>
              ) : null}
            </View>
          </View>
        </FormField>
      </View>
    </>
  );
}
