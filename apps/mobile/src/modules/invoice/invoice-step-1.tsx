import { View, Pressable } from "react-native";
import { FileDown, Check } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/taska/basics";
import {
  CustomerSelect,
  SearchableSelect,
  SupplierSelect,
  PoClientSelect,
  QuotationSelect,
  LeadSelect,
  ContinuableInvoiceSelect,
} from "@/components/taska/dialogs";
import { StatusBadge } from "@/components/taska/status-badge";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import { type Row } from "@/constants/modules";
import {
  downloadQuotationTemplate,
  downloadQuotationPdf,
} from "@/modules/quotation/quotation-files";
import { type PpnMode } from "@/modules/quotation/lib";
import { generateInvoiceInNumber } from "./invoice-form-utils";
import { StepTitle } from "./invoice-step-title";
import type { InvoiceFormScope } from "./use-invoice-form";

export function InvoiceStep1({ form }: { form: InvoiceFormScope }) {
  const {
    activePo,
    activeQuotation,
    alreadyBilledDpp,
    catatan,
    continuableInvoiceInOptions,
    continuableInvoiceOptions,
    continuationType,
    customCustomerName,
    customSupplierName,
    data,
    dealDpp,
    dpPercent,
    handleSelectLead,
    handleSelectParentInvoice,
    handleSelectPo,
    handleSelectQuotation,
    handleSwitchMode,
    handleSwitchScheme,
    invoiceInCategoryOptions,
    isIncludePpn,
    isProforma,
    mode,
    purchaseCategoryCode,
    relatedExistingInvoices,
    remainingDpp,
    scheme,
    selectedCustomerId,
    selectedLeadId,
    selectedParentChain,
    selectedParentInvoice,
    selectedParentInvoiceId,
    selectedParentInvoiceInId,
    selectedPoId,
    selectedQuotationId,
    selectedSupplierId,
    selectedSupplierPoId,
    setCatatan,
    setContinuationType,
    setCustomCustomerName,
    setCustomDpp,
    setCustomSupplierName,
    setDpPercent,
    setIsProforma,
    setItems,
    setNomor,
    setPaymentStatus,
    setPpnMode,
    setPurchaseCategoryCode,
    setQuickCustomerOpen,
    setQuickSupplierOpen,
    setScheme,
    setSelectedCustomerId,
    setSelectedParentInvoiceInId,
    setSelectedSupplierId,
    setSelectedSupplierPoId,
    setSourceType,
    setTerminPercent,
    sourceType,
    sourceTypeOptions,
    supplierPoRef,
    terminNumber,
    terminPercent,
    toast,
  } = form;

  return (
    <>
      <StepTitle
        n={1}
        title={mode === "masuk" ? "Jenis & sumber tagihan" : "Mau menagih apa?"}
        hint={
          mode === "lanjut"
            ? "Pilih invoice DP / termin sebelumnya — nilai kontrak, PPN, dan diskon mengikuti invoice itu."
            : mode === "masuk"
              ? "Tagihan dari supplier / operasional."
              : "Pilih SO atau penawaran — item, harga, diskon & PPN terisi otomatis."
        }
      />
      {/* Mode Switcher (3 Tab: Invoice Keluar Baru | Lanjutkan Termin / DP | Invoice Masuk) */}
      <View className="flex-row flex-wrap rounded-lg bg-panel p-1 border border-border mb-4 gap-1">
        <Button
          variant={mode === "baru" ? "default" : "ghost"}
          size="sm"
          onPress={() => handleSwitchMode("baru")}
          className="flex-1 min-w-[160px] h-8"
        >
          <Text
            className={`text-xs font-semibold ${mode === "baru" ? "text-primary-foreground" : "text-muted-foreground"}`}
          >
            Invoice Keluar Baru
          </Text>
        </Button>
        <Button
          variant={mode === "lanjut" ? "default" : "ghost"}
          size="sm"
          onPress={() => handleSwitchMode("lanjut")}
          className="flex-1 min-w-[160px] h-8"
        >
          <Text
            className={`text-xs font-semibold ${mode === "lanjut" ? "text-primary-foreground" : "text-muted-foreground"}`}
          >
            Lanjutkan Termin / DP
          </Text>
        </Button>
        <Button
          variant={mode === "masuk" ? "default" : "ghost"}
          size="sm"
          onPress={() => handleSwitchMode("masuk")}
          className="flex-1 min-w-[170px] h-8"
        >
          <Text
            className={`text-xs font-semibold ${mode === "masuk" ? "text-primary-foreground" : "text-muted-foreground"}`}
          >
            Invoice Masuk (Tagihan / Beli)
          </Text>
        </Button>
      </View>

      {mode === "baru" && sourceType !== "direct_purchase" ? (
        <View className="mb-4 gap-1.5">
          <Text className="text-xs font-semibold text-foreground">
            Jenis dokumen
          </Text>
          <View className="flex-row gap-2">
            {(
              [
                {
                  key: false,
                  title: "Invoice resmi",
                  desc: "Masuk piutang & jurnal, bisa dicatat pembayarannya",
                },
                {
                  key: true,
                  title: "Proforma Invoice",
                  desc: "Penagihan awal. Belum dijurnal; terbitkan invoice resmi setelah disetujui / dibayar",
                },
              ] as const
            ).map((opt) => {
              const active = isProforma === opt.key;
              return (
                <Pressable
                  key={String(opt.key)}
                  onPress={() => setIsProforma(opt.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  className={`flex-1 rounded-lg border px-3 py-2 ${active ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                >
                  <View className="flex-row items-center gap-1.5">
                    {active ? <Check size={12} color={colors.primary} /> : null}
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
        </View>
      ) : null}

      {/* Source Link Section or Continuation Invoice Selector or Invoice Masuk Section */}
      {mode === "masuk" ? (
        <View className="mb-4 gap-2.5 p-3.5 rounded-xl border border-warning/40 bg-warning/5">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-foreground">
              Detail Tagihan / Invoice Masuk (Listrik, Internet, Operasional,
              atau Supplier)
            </Text>
            <StatusBadge status="Faktur Masuk" />
          </View>

          <FormField
            label="Kategori Tagihan / Akun Beban (COA)"
            required
            hint="Otomatis dijurnal ke akun beban/persediaan terkait di Laporan & COA"
          >
            <SearchableSelect
              value={
                invoiceInCategoryOptions.find(
                  (o) => o.code === purchaseCategoryCode,
                )?.label ||
                invoiceInCategoryOptions[0]?.label ||
                ""
              }
              onChange={(val) => {
                const found = invoiceInCategoryOptions.find(
                  (o) => o.label === val,
                );
                if (found) {
                  setPurchaseCategoryCode(found.code);
                  if (found.code === "6202.01") {
                    if (
                      !customSupplierName ||
                      customSupplierName.includes("IndiHome") ||
                      customSupplierName.includes("PDAM")
                    ) {
                      setCustomSupplierName("PLN (Tagihan Listrik)");
                    }
                    setCatatan("Tagihan Listrik PLN");
                  } else if (found.code === "6202.03") {
                    if (
                      !customSupplierName ||
                      customSupplierName.includes("PLN") ||
                      customSupplierName.includes("PDAM")
                    ) {
                      setCustomSupplierName("Telkom IndiHome (Internet)");
                    }
                    setCatatan("Tagihan Internet & Telekomunikasi");
                  } else if (found.code === "6202.02") {
                    if (
                      !customSupplierName ||
                      customSupplierName.includes("PLN") ||
                      customSupplierName.includes("IndiHome")
                    ) {
                      setCustomSupplierName("PDAM (Tagihan Air)");
                    }
                    setCatatan("Tagihan Air PDAM");
                  }
                }
              }}
              options={invoiceInCategoryOptions.map((o) => o.label)}
              placeholder="Pilih kategori tagihan / akun COA..."
            />
          </FormField>

          <FormField
            label="Pihak Penagih / Penyedia Layanan / Pemasok"
            required
            hint="Pilih dari daftar pemasok rekanan atau ketik manual nama penagih (misal: PLN, Telkom IndiHome, Biznet)"
          >
            <View className="gap-1.5">
              <SupplierSelect
                supplierId={selectedSupplierId}
                value={
                  customSupplierName ||
                  (data.suppliers ?? []).find(
                    (s: Row) => String(s.id) === String(selectedSupplierId),
                  )?.nama ||
                  (data.suppliers ?? []).find(
                    (s: Row) => String(s.id) === String(selectedSupplierId),
                  )?.name ||
                  ""
                }
                onChange={(val, match) => {
                  if (match) {
                    setCustomSupplierName(match.nama || match.name);
                    setSelectedSupplierId(String(match.id));
                  } else {
                    setCustomSupplierName(val === "-" ? "" : val);
                    setSelectedSupplierId("");
                  }
                }}
                onAddNew={() => setQuickSupplierOpen(true)}
                addNewLabel="+ Tambah Pemasok Baru"
                placeholder="Pilih pemasok rekanan..."
              />
              <Input
                value={customSupplierName}
                onChangeText={(val) => {
                  setCustomSupplierName(val);
                  const match = (data.suppliers ?? []).find(
                    (s: Row) => (s.nama || s.name) === val,
                  );
                  if (match) setSelectedSupplierId(String(match.id));
                  else setSelectedSupplierId("");
                }}
                placeholder="Atau ketik manual nama penagih (contoh: PLN, IndiHome, Toko ABC)..."
              />
            </View>
          </FormField>

          <FormField label="PO Pemasok Terkait (Opsional — Kosongkan untuk Tagihan Listrik / Internet / Non-PO)">
            <SearchableSelect
              value={
                (data["supplier-pos"] ?? []).find(
                  (p: Row) => String(p.id) === String(selectedSupplierPoId),
                )?.nomor ||
                (data["supplier-pos"] ?? []).find(
                  (p: Row) => String(p.id) === String(selectedSupplierPoId),
                )?.number ||
                ""
              }
              onChange={(val) => {
                const selNo = val.split(" - ")[0]?.trim() || val;
                const match = (data["supplier-pos"] ?? []).find(
                  (p: Row) => (p.nomor || p.number) === selNo,
                );
                if (match) {
                  setSelectedSupplierPoId(String(match.id));
                  setPurchaseCategoryCode(
                    match.projectId || (match.project && match.project !== "-")
                      ? "5101"
                      : "1200",
                  );
                  if (match.supplierId)
                    setSelectedSupplierId(String(match.supplierId));
                  if (match.supplier) setCustomSupplierName(match.supplier);
                  if (
                    match.ppnMode === "exclude" ||
                    match.ppnMode === "include" ||
                    match.ppnMode === "none"
                  ) {
                    setPpnMode(match.ppnMode as PpnMode);
                  }
                  if (Array.isArray(match.items) && match.items.length > 0) {
                    setItems(match.items);
                  } else if (match.dpp || match.total || match.nilai) {
                    setCustomDpp(
                      formatThousands(match.dpp || match.total || match.nilai),
                    );
                  }
                  const poInvs = (data.invoiceIn ?? []).filter((inv: Row) => {
                    const st = String(inv.status || "").toUpperCase();
                    if (st === "BATAL" || st === "DIBATALKAN") return false;
                    return String(inv.supplierPoId) === String(match.id);
                  });
                  if (poInvs.length > 0) {
                    setScheme("termin");
                    setContinuationType("pelunasan");
                  } else {
                    const poTerms = String(
                      match.paymentTerms || match.payment || "",
                    );
                    const dpMatch = poTerms.match(/DP\s*(\d+)%/i);
                    if (dpMatch) {
                      setScheme("dp");
                      setDpPercent(dpMatch[1] || "50");
                    }
                  }
                }
              }}
              options={(data["supplier-pos"] ?? []).map(
                (p: Row) => `${p.nomor || p.number} - ${p.supplier || "-"}`,
              )}
              placeholder="Kosongkan jika bukan dari PO Pemasok..."
            />
            {supplierPoRef ? (
              <Text className="text-[11px] text-muted-foreground mt-1">
                Mengacu PO {supplierPoRef.nomor} (
                {supplierPoRef.mode === "include"
                  ? "Include PPN"
                  : supplierPoRef.mode === "exclude"
                    ? "Exclude PPN"
                    : "Tanpa PPN"}
                ): DPP {rupiah(supplierPoRef.dpp)} · PPN{" "}
                {rupiah(supplierPoRef.ppn)} · Total{" "}
                {rupiah(supplierPoRef.dpp + supplierPoRef.ppn)}
              </Text>
            ) : null}
          </FormField>

          {continuableInvoiceInOptions.length > 0 ? (
            <FormField label="Atau Lanjutkan dari Faktur Masuk DP / Termin Sebelumnya (Opsional)">
              <SearchableSelect
                value={
                  continuableInvoiceInOptions.find(
                    (o: { id: string; label: string; raw: Row }) =>
                      o.id === selectedParentInvoiceInId,
                  )?.label || ""
                }
                onChange={(val) => {
                  const match = continuableInvoiceInOptions.find(
                    (o: { id: string; label: string; raw: Row }) =>
                      o.label === val,
                  );
                  if (match) {
                    setSelectedParentInvoiceInId(match.id);
                    const inv = match.raw;
                    if (inv.supplierId)
                      setSelectedSupplierId(String(inv.supplierId));
                    if (inv.supplier) setCustomSupplierName(inv.supplier);
                    if (inv.supplierPoId)
                      setSelectedSupplierPoId(String(inv.supplierPoId));
                    // Lanjutan tagihan tanpa PO: ikuti tagihan sebelumnya (dengan PO: otomatis mengikuti PO)
                    setPpnMode(
                      inv.ppnMode === "include" || inv.ppnMode === "exclude"
                        ? inv.ppnMode
                        : Number(inv.ppn || 0) > 0
                          ? "exclude"
                          : "none",
                    );
                    if (inv.debitAccount)
                      setPurchaseCategoryCode(inv.debitAccount);
                    if (inv.category) {
                      const matchCat = invoiceInCategoryOptions.find(
                        (c) => c.category === inv.category,
                      );
                      if (matchCat) setPurchaseCategoryCode(matchCat.code);
                    }
                    setScheme("termin");
                    setContinuationType("pelunasan");
                  } else {
                    setSelectedParentInvoiceInId("");
                  }
                }}
                options={[
                  "-- Tidak ada (Faktur Baru) --",
                  ...continuableInvoiceInOptions.map(
                    (o: { id: string; label: string; raw: Row }) => o.label,
                  ),
                ]}
                placeholder="Pilih faktur DP / Termin sebelumnya..."
              />
            </FormField>
          ) : null}
        </View>
      ) : mode === "lanjut" ? (
        <View className="mb-4 p-3 rounded-xl bg-card border border-primary/30 gap-2.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-foreground">
              Lanjutkan Tagihan dari Invoice Sebelumnya
            </Text>
            <StatusBadge status="Lanjutan" />
          </View>
          <FormField
            label="Pilih Faktur DP / Termin Acuan"
            required
            hint="Cari & pilih faktur DP/Termin yang masih memiliki sisa tagihan atau sisa kontrak"
          >
            {continuableInvoiceOptions.length === 0 ? (
              <View className="p-3 rounded-lg bg-panel border border-dashed border-border/80">
                <Text className="text-xs text-muted-foreground text-center">
                  Tidak ada invoice DP / Termin aktif yang masih memiliki sisa
                  tagihan atau sisa kontrak. Semua invoice sudah lunas atau
                  dibatalkan.
                </Text>
              </View>
            ) : (
              <ContinuableInvoiceSelect
                invoiceId={selectedParentInvoiceId}
                options={continuableInvoiceOptions}
                onChange={(selectedId) => handleSelectParentInvoice(selectedId)}
              />
            )}
          </FormField>
          {selectedParentInvoice ? (
            <View className="gap-1 mt-1 p-2.5 rounded-lg bg-panel/70 border border-border/50 text-xs">
              <View className="flex-row justify-between">
                <Text className="text-[11px] text-muted-foreground">
                  Pelanggan:
                </Text>
                <Text className="text-[11px] font-semibold text-foreground">
                  {selectedParentInvoice.customer || customCustomerName || "-"}
                </Text>
              </View>
              {activeQuotation?.nomor || selectedParentInvoice.quotation ? (
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-muted-foreground">
                    Penawaran:
                  </Text>
                  <Text className="text-[11px] font-mono font-medium text-primary">
                    {activeQuotation?.nomor || selectedParentInvoice.quotation}
                  </Text>
                </View>
              ) : null}
              {activePo?.nomor ||
              activePo?.nomorSo ||
              selectedParentInvoice.po ? (
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-muted-foreground">
                    PO / SO Client:
                  </Text>
                  <Text className="text-[11px] font-mono font-medium text-primary">
                    {activePo?.nomor ||
                      activePo?.nomorSo ||
                      selectedParentInvoice.po}
                  </Text>
                </View>
              ) : null}
              {selectedParentChain &&
              selectedParentChain.remainingToBill > 0 ? (
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-muted-foreground">
                    Sisa kontrak:
                  </Text>
                  <Text className="text-[11px] font-semibold text-warning">
                    {rupiah(selectedParentChain.remainingToBill)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <View className="mb-4 gap-2">
          <FormField label="Tautkan Faktur Ke / Jenis Transaksi" required>
            <SearchableSelect
              value={
                sourceTypeOptions.find((o) => o.value === sourceType)?.label ||
                sourceTypeOptions[0]?.label ||
                ""
              }
              onChange={(val) => {
                const found = sourceTypeOptions.find((o) => o.label === val);
                if (!found) return;
                const nextType = found.value;
                setSourceType(nextType);
                if (nextType === "direct_sale") {
                  setScheme("sekaligus");
                  setPaymentStatus("PAID");
                  if (
                    !catatan ||
                    catatan.startsWith("Faktur ") ||
                    catatan.startsWith("Tagihan ")
                  ) {
                    setCatatan("Nota Penjualan Langsung (Walk-in)");
                  }
                } else if (nextType === "po") {
                  setScheme("sekaligus");
                }
              }}
              options={sourceTypeOptions.map((o) => o.label)}
              placeholder="Pilih jenis transaksi faktur..."
            />
          </FormField>

          {sourceType === "direct_sale" ? (
            <View className="gap-2 p-2.5 rounded-lg border border-border bg-card/60">
              <FormField label="Pelanggan (Opsional: Kosongkan untuk Pelanggan Langsung / Walk-in)">
                <CustomerSelect
                  value={
                    customCustomerName ||
                    (data.customers ?? []).find(
                      (c: Row) => String(c.id) === String(selectedCustomerId),
                    )?.nama ||
                    ""
                  }
                  customerId={selectedCustomerId}
                  onAddNew={() => setQuickCustomerOpen(true)}
                  addNewLabel="+ Tambah Pelanggan Baru"
                  onChange={(cust) => {
                    if (!cust) {
                      setCustomCustomerName("");
                      setSelectedCustomerId("");
                      return;
                    }
                    const name = cust.company || cust.nama || cust.name || "";
                    setCustomCustomerName(name);
                    setSelectedCustomerId(String(cust.id));
                  }}
                  placeholder="Pelanggan Langsung (Walk-in) / Cari pelanggan..."
                  allowClear
                />
              </FormField>
            </View>
          ) : sourceType === "quotation" ? (
            <FormField label="Pilih Penawaran Terkait" required>
              <QuotationSelect
                quotationId={selectedQuotationId}
                onChange={handleSelectQuotation}
              />
              {activeQuotation ? (
                <View className="flex-row flex-wrap items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      downloadQuotationPdf({
                        quotationId: activeQuotation.id,
                        customer: activeQuotation.customer,
                        lead: activeQuotation.lead,
                        nomor: activeQuotation.nomor,
                        signer: activeQuotation.pemilik,
                      });
                      toast("File PDF penawaran sedang diunduh");
                    }}
                    className="h-8 px-2.5 flex-row items-center gap-1.5"
                  >
                    <FileDown size={13} color={colors.text} />
                    <Text className="text-xs">Download PDF Penawaran</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      downloadQuotationTemplate({
                        quotationId: activeQuotation.id,
                        customer: activeQuotation.customer,
                        lead: activeQuotation.lead,
                        nomor: activeQuotation.nomor,
                        signer: activeQuotation.pemilik,
                      });
                      toast("File Excel penawaran (.xlsx) sedang diunduh");
                    }}
                    className="h-8 px-2.5 flex-row items-center gap-1.5"
                  >
                    <FileDown size={13} color={colors.text} />
                    <Text className="text-xs">
                      Download Excel Penawaran (.xlsx)
                    </Text>
                  </Button>
                </View>
              ) : null}
            </FormField>
          ) : sourceType === "po" ? (
            <FormField
              label="Pilih PO Pelanggan (Pesanan Penjualan) Terkait"
              required
            >
              <PoClientSelect poId={selectedPoId} onChange={handleSelectPo} />
            </FormField>
          ) : sourceType === "lead" ? (
            <FormField label="Pilih Prospek Terkait" required>
              <LeadSelect leadId={selectedLeadId} onChange={handleSelectLead} />
            </FormField>
          ) : null}

          {sourceType !== "direct_purchase" && sourceType !== "direct_sale" ? (
            <FormField label="Pelanggan" required>
              <CustomerSelect
                value={
                  customCustomerName ||
                  (data.customers ?? []).find(
                    (c: Row) => String(c.id) === String(selectedCustomerId),
                  )?.nama ||
                  ""
                }
                customerId={selectedCustomerId}
                onAddNew={() => setQuickCustomerOpen(true)}
                addNewLabel="+ Tambah Pelanggan Baru"
                onChange={(cust) => {
                  if (!cust) {
                    setCustomCustomerName("");
                    setSelectedCustomerId("");
                    return;
                  }
                  const name = cust.company || cust.nama || cust.name || "";
                  setCustomCustomerName(name);
                  setSelectedCustomerId(String(cust.id));
                }}
                placeholder="Cari & pilih pelanggan..."
              />
            </FormField>
          ) : null}
        </View>
      )}

      {/* Mode: Lanjutkan Termin / DP Sebelumnya info banner */}
      {mode === "lanjut" ||
      (mode === "masuk" && relatedExistingInvoices.length > 0) ? (
        <View className="mb-4 p-3 rounded-xl bg-panel border border-border gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-foreground">
              Riwayat Tagihan Sebelumnya
            </Text>
            <Text className="text-xs font-semibold text-primary">
              {relatedExistingInvoices.length} Invoice Tercatat
            </Text>
          </View>

          <View className="gap-1 my-1">
            {relatedExistingInvoices.map((inv: Row) => (
              <View
                key={inv.id}
                className="flex-row justify-between items-center text-xs py-1 border-b border-border/40"
              >
                <Text className="text-xs font-mono font-medium">
                  {inv.nomor} ({inv.jenis})
                </Text>
                <Text className="text-xs font-semibold">
                  {rupiah(inv.nilai)}
                </Text>
              </View>
            ))}
          </View>

          <View className="bg-card p-2 rounded-lg gap-1 border border-border">
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">
                {isIncludePpn
                  ? "Nilai Kontrak (Termasuk PPN):"
                  : "Total Nilai Dasar (DPP):"}
              </Text>
              <Text className="text-xs font-bold">{rupiah(dealDpp)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">
                Sudah Ditagihkan:
              </Text>
              <Text className="text-xs font-semibold text-success">
                {rupiah(alreadyBilledDpp)}
              </Text>
            </View>
            <View className="flex-row justify-between pt-1 border-t border-border">
              <Text className="text-xs font-bold text-foreground">
                {isIncludePpn
                  ? "Sisa Belum Ditagih (Termasuk PPN):"
                  : "Sisa Belum Ditagih (DPP):"}
              </Text>
              <Text className="text-xs font-bold text-primary">
                {rupiah(remainingDpp)}
              </Text>
            </View>
          </View>

          <View className="mt-2">
            <FormField label="Pilih Jenis Lanjutan" required>
              <View className="flex-row gap-2">
                <Button
                  variant={
                    continuationType === "termin" ? "default" : "outline"
                  }
                  size="sm"
                  onPress={() => {
                    setContinuationType("termin");
                    if (mode === "masuk") {
                      setNomor(
                        generateInvoiceInNumber(
                          "termin",
                          relatedExistingInvoices,
                          data.invoiceIn?.length || 0,
                          data.invoiceIn,
                          "termin",
                        ),
                      );
                    }
                  }}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">Termin {terminNumber}</Text>
                </Button>
                <Button
                  variant={
                    continuationType === "pelunasan" ? "default" : "outline"
                  }
                  size="sm"
                  onPress={() => {
                    setContinuationType("pelunasan");
                    if (mode === "masuk") {
                      setNomor(
                        generateInvoiceInNumber(
                          "termin",
                          relatedExistingInvoices,
                          data.invoiceIn?.length || 0,
                          data.invoiceIn,
                          "pelunasan",
                        ),
                      );
                    }
                  }}
                  className="flex-1 h-8"
                >
                  <Text className="text-xs">
                    Pelunasan (Sisa {rupiah(remainingDpp)})
                  </Text>
                </Button>
              </View>
            </FormField>
            {continuationType === "termin" ? (
              <View className="mt-2">
                <FormField
                  label={`Persentase Termin ${terminNumber} (%)`}
                  required
                >
                  <Input
                    value={terminPercent}
                    onChangeText={setTerminPercent}
                    keyboardType="numeric"
                    placeholder="Contoh: 30"
                  />
                </FormField>
              </View>
            ) : null}
          </View>
        </View>
      ) : mode === "baru" ||
        (mode === "masuk" && relatedExistingInvoices.length === 0) ? (
        /* Mode Baru & Masuk Scheme */
        <View className="mb-4 p-3 rounded-xl bg-panel border border-border gap-2">
          <FormField label="Skema Pembayaran" required>
            <View className="flex-row gap-2">
              <Button
                variant={scheme === "termin" ? "default" : "outline"}
                size="sm"
                onPress={() => handleSwitchScheme("termin")}
                className="flex-1 h-8"
              >
                <Text className="text-xs">Termin (Bertahap)</Text>
              </Button>
              <Button
                variant={scheme === "dp" ? "default" : "outline"}
                size="sm"
                onPress={() => handleSwitchScheme("dp")}
                className="flex-1 h-8"
              >
                <Text className="text-xs">DP (Uang Muka)</Text>
              </Button>
              <Button
                variant={scheme === "sekaligus" ? "default" : "outline"}
                size="sm"
                onPress={() => handleSwitchScheme("sekaligus")}
                className="flex-1 h-8"
              >
                <Text className="text-xs">Sekaligus (100%)</Text>
              </Button>
            </View>
          </FormField>

          {scheme === "dp" ? (
            <FormField label="Persentase DP (%)" required>
              <Input
                value={dpPercent}
                onChangeText={setDpPercent}
                keyboardType="numeric"
                placeholder="50"
              />
            </FormField>
          ) : scheme === "termin" ? (
            <FormField label="Persentase Termin 1 (%)" required>
              <Input
                value={terminPercent}
                onChangeText={setTerminPercent}
                keyboardType="numeric"
                placeholder="30"
              />
            </FormField>
          ) : null}
        </View>
      ) : null}

      {/* Form Fields */}
    </>
  );
}
