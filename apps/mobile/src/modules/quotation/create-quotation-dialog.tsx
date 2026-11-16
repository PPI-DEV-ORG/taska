import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Check, Edit2, Package, Plus, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { CustomerSelect, DatePicker, LeadSelect, QuickAddCustomerDialog } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { ItemEditorDialog } from "@/components/taska/item-editor-dialog";
import { SerialItemPickerModal } from "@/components/taska/serial-item-picker";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { formatThousands, rupiah } from "@/lib/format";
import type { Row } from "@/constants/modules";
import type { QuotationItem } from "./types";
import {
  calcQuotationFinancials,
  itemDiscount,
  itemGross,
  pphModeToTipe,
  sumItemDiscounts,
  sumItemGross,
  type PphMode,
  type PpnMode,
} from "./lib";

const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Buat penawaran dalam SATU form: pilih prospek/pelanggan → tambah barang & jasa (diskon per item) →
 * diskon tambahan & PPN → angka langsung terlihat. Sebelumnya hanya nilai total; item baru bisa diisi di detail.
 */
export function CreateQuotationDialog({
  open,
  onOpenChange,
  defaultLead,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Dibuka dari detail prospek: prospek & pelanggan langsung terisi. */
  defaultLead?: Row | null;
}) {
  const isWeb = Platform.OS === "web";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent
          className="w-[94vw] max-w-3xl max-h-[92vh]"
          style={isWeb ? ({ width: "min(94vw, 820px)", maxWidth: "820px" } as any) : undefined}
        >
          <Inner onClose={() => onOpenChange(false)} defaultLead={defaultLead ?? null} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function Step({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <View className="flex-row items-start gap-2 mb-2">
      <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
        <Text className="text-[11px] font-bold text-primary-foreground">{n}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-foreground">{title}</Text>
        {hint ? <Text className="text-[11px] text-muted-foreground">{hint}</Text> : null}
      </View>
    </View>
  );
}

function Inner({ onClose, defaultLead }: { onClose: () => void; defaultLead: Row | null }) {
  const router = useRouter();
  const { addRow, toast } = useApp();

  const [lead, setLead] = React.useState<Row | null>(defaultLead);
  const [customer, setCustomer] = React.useState<{ id: string; name: string } | null>(() =>
    defaultLead?.customerId
      ? { id: String(defaultLead.customerId), name: String(defaultLead.perusahaan || defaultLead.customer || defaultLead.nama || "-") }
      : null,
  );
  const [quickCustomerOpen, setQuickCustomerOpen] = React.useState(false);

  const [items, setItems] = React.useState<QuotationItem[]>([]);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [lumpSum, setLumpSum] = React.useState(""); // tanpa rincian item

  const [extraType, setExtraType] = React.useState<"nominal" | "percent">("nominal");
  const [extraInput, setExtraInput] = React.useState("");
  const [ppnMode, setPpnMode] = React.useState<PpnMode>("exclude");
  const [validUntil, setValidUntil] = React.useState(plusDays(30));
  const [fileId, setFileId] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  // ── Hitungan (rumus yang sama dengan detail penawaran, SO & invoice) ──
  const gross = items.length > 0 ? sumItemGross(items) : Number(String(lumpSum).replace(/\D/g, "")) || 0;
  const itemDisc = sumItemDiscounts(items);
  const netAfterItemDisc = Math.max(0, gross - itemDisc);
  const extraDisc =
    extraType === "percent"
      ? Math.round((netAfterItemDisc * Math.min(100, parseFloat(extraInput.replace(",", ".")) || 0)) / 100)
      : Math.min(netAfterItemDisc, Number(String(extraInput).replace(/\D/g, "")) || 0);
  const headerDisc = itemDisc + extraDisc;
  const fin = calcQuotationFinancials(gross, headerDisc, ppnMode, "none", items);
  const firstPph = items.find((it) => it.pphMode && it.pphMode !== "none");

  function onPickLead(l: Row | null) {
    setLead(l);
    if (l?.customerId) setCustomer({ id: String(l.customerId), name: String(l.perusahaan || l.customer || l.nama || "-") });
  }

  function saveItem(saved: any, idx?: number | null) {
    const it: QuotationItem = {
      id: String(saved.id || `quo-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      item: String(saved.item || saved.name || "Barang"),
      qty: Number(saved.qty) || 1,
      satuan: String(saved.satuan || saved.unit || "Unit"),
      unit: String(saved.unit || saved.satuan || "Unit"),
      harga: Number(saved.harga ?? saved.price ?? 0),
      price: Number(saved.price ?? saved.harga ?? 0),
      productId: saved.productId ? Number(saved.productId) : undefined,
      sku: typeof saved.sku === "string" ? saved.sku : undefined,
      kind: saved.itemType === "JASA" || saved.kind === "SERVICE" ? "SERVICE" : "GOODS",
      hasSerial: Boolean(saved.hasSerial || (Array.isArray(saved.serialNumbers) && saved.serialNumbers.length > 0)),
      serialNumbers: Array.isArray(saved.serialNumbers) ? saved.serialNumbers : undefined,
      pphMode: (saved.pphMode as PphMode) || "none",
      tipePph: pphModeToTipe((saved.pphMode as PphMode) || "none"),
      diskon: Number(saved.diskon) > 0 ? Number(saved.diskon) : undefined,
      diskonPct: Number(saved.diskonPct) > 0 ? Number(saved.diskonPct) : undefined,
    };
    setItems((prev) => {
      const next = [...prev];
      if (idx != null && idx >= 0 && idx < next.length) next[idx] = it;
      else next.push(it);
      return next;
    });
  }

  const missing: string[] = [];
  if (!customer) missing.push("pelanggan");
  if (gross <= 0) missing.push(items.length ? "harga item" : "item atau nilai penawaran");

  async function submit() {
    if (missing.length) {
      toast(`Lengkapi dulu: ${missing.join(", ")}`, "danger");
      return;
    }
    setSaving(true);
    try {
      const created = await addRow("quotations", {
        leadId: lead?.id ? String(lead.id) : undefined,
        lead: lead?.nama || undefined,
        customerId: customer?.id,
        customer: customer?.name,
        total: gross,
        nilai: gross,
        disc: headerDisc,
        ppnMode,
        tipePpn: ppnMode === "include" ? "Include PPN (Sudah termasuk)" : ppnMode === "none" ? "No PPN (Tanpa PPN)" : "Exclude PPN (11%)",
        ppn: fin.ppn,
        pph: fin.pph,
        pphMode: firstPph?.pphMode || "none",
        tipePph: firstPph ? pphModeToTipe(firstPph.pphMode as PphMode) : "Tanpa PPh",
        items: items.length ? items : undefined,
        berlaku: validUntil,
        fileId: fileId ?? undefined,
      });
      if (created?.id) {
        onClose();
        router.push(`/quotations/${created.id}` as any);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Buat Penawaran</DialogTitle>
      </DialogHeader>
      <ScrollView className="max-h-[72vh] px-1" showsVerticalScrollIndicator={false}>
        <View className="gap-5 pb-2">
          {/* 1. Untuk siapa */}
          <View>
            <Step n={1} title="Untuk siapa?" hint="Pilih prospek bila ada — pelanggannya terisi otomatis." />
            <View className="gap-3">
              <FormField label="Prospek (opsional)">
                <LeadSelect value={lead?.nama} leadId={lead?.id} onChange={onPickLead} allowClear />
              </FormField>
              <FormField label="Pelanggan" required>
                <CustomerSelect
                  value={customer?.name}
                  customerId={customer?.id}
                  onChange={(c) => setCustomer(c ? { id: String(c.id), name: String(c.nama || c.name || "-") } : null)}
                  onAddNew={() => setQuickCustomerOpen(true)}
                  addNewLabel="+ Pelanggan baru"
                />
              </FormField>
            </View>
          </View>

          {/* 2. Barang & jasa */}
          <View>
            <Step n={2} title="Barang & jasa" hint="Ambil dari stok gudang atau tambah manual (jasa, barang non-stok). Diskon bisa per item." />
            <View className="flex-row flex-wrap gap-2 mb-2">
              <Button size="sm" variant="outline" onPress={() => setPickerOpen(true)} className="flex-row items-center gap-1.5">
                <Package size={14} color={colors.primary} />
                <Text className="text-xs font-semibold text-primary">Pilih dari stok</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  setEditingIndex(null);
                  setEditorOpen(true);
                }}
                className="flex-row items-center gap-1.5"
              >
                <Plus size={14} color={colors.text} />
                <Text className="text-xs font-semibold">Tambah item / jasa</Text>
              </Button>
            </View>
            {items.length === 0 ? (
              <View className="rounded-xl border border-dashed border-border p-3 gap-2">
                <Text className="text-xs text-muted-foreground">
                  Belum ada item. Tambahkan item di atas, atau isi nilai total saja bila penawaran tidak dirinci.
                </Text>
                <FormField label="Nilai penawaran tanpa rincian (Rp)">
                  <Input value={lumpSum} onChangeText={(v) => setLumpSum(formatThousands(v))} keyboardType="numeric" placeholder="Contoh: 25.000.000" />
                </FormField>
              </View>
            ) : (
              <View className="border border-border rounded-xl overflow-hidden">
                {items.map((it, idx) => {
                  const lineDisc = itemDiscount(it);
                  return (
                    <View key={it.id} className="px-3 py-2 border-b border-border/50 flex-row items-center gap-2">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-foreground">{it.item}</Text>
                        <Text className="text-[10px] text-muted-foreground">
                          {it.qty} {it.satuan} × {rupiah(it.harga)}
                          {it.kind === "SERVICE" ? " · Jasa" : ""}
                          {it.pphMode && it.pphMode !== "none" ? ` · ${pphModeToTipe(it.pphMode)}` : ""}
                        </Text>
                        {lineDisc > 0 ? (
                          <Text className="text-[10px] text-danger">
                            Diskon{Number(it.diskonPct) > 0 ? ` ${it.diskonPct}%` : ""}: -{rupiah(lineDisc)}
                          </Text>
                        ) : null}
                      </View>
                      <Text className="text-xs font-semibold text-foreground">{rupiah(itemGross(it) - lineDisc)}</Text>
                      <Pressable
                        onPress={() => {
                          setEditingIndex(idx);
                          setEditorOpen(true);
                        }}
                        hitSlop={6}
                        accessibilityLabel={`Ubah ${it.item}`}
                      >
                        <Edit2 size={14} color={colors.text} />
                      </Pressable>
                      <Pressable onPress={() => setItems((prev) => prev.filter((_, i) => i !== idx))} hitSlop={6} accessibilityLabel={`Hapus ${it.item}`}>
                        <Trash2 size={14} color={colors.danger} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* 3. Diskon & pajak */}
          <View>
            <Step n={3} title="Diskon & PPN" />
            <View className="gap-3">
              <FormField label="Diskon tambahan (opsional)" hint={itemDisc > 0 ? `Di luar diskon per item ${rupiah(itemDisc)}` : "Potongan untuk seluruh penawaran"}>
                <View className="flex-row gap-2">
                  <View className="flex-row rounded-lg bg-panel p-0.5 border border-border">
                    {(["nominal", "percent"] as const).map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => {
                          setExtraType(t);
                          setExtraInput("");
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: extraType === t }}
                        className={`px-3 py-1.5 rounded-md ${extraType === t ? "bg-primary" : ""}`}
                      >
                        <Text className={`text-xs ${extraType === t ? "text-primary-foreground font-semibold" : "text-muted-foreground"}`}>
                          {t === "nominal" ? "Rp" : "%"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View className="flex-1">
                    <Input
                      value={extraInput}
                      onChangeText={(v) => setExtraInput(extraType === "percent" ? v.replace(/[^\d.,]/g, "") : formatThousands(v))}
                      keyboardType="numeric"
                      placeholder={extraType === "percent" ? "Contoh: 5" : "Contoh: 500.000"}
                    />
                  </View>
                </View>
              </FormField>
              <FormField label="PPN">
                <View className="flex-row flex-wrap gap-2">
                  {([
                    { key: "exclude", title: "Harga belum termasuk PPN", desc: "PPN 11% ditambahkan" },
                    { key: "include", title: "Harga sudah termasuk PPN", desc: "PPN dihitung dari dalam harga" },
                    { key: "none", title: "Tanpa PPN", desc: "Bukan PKP / non-PPN" },
                  ] as const).map((opt) => {
                    const active = ppnMode === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => setPpnMode(opt.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        className={`flex-1 min-w-[150px] rounded-lg border px-3 py-2 ${active ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                      >
                        <View className="flex-row items-center gap-1.5">
                          {active ? <Check size={12} color={colors.primary} /> : null}
                          <Text className={`text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}>{opt.title}</Text>
                        </View>
                        <Text className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </FormField>
              <View className="flex-row flex-wrap gap-3">
                <View className="flex-1 min-w-[160px]">
                  <FormField label="Berlaku sampai">
                    <DatePicker value={validUntil} onChange={setValidUntil} />
                  </FormField>
                </View>
                <View className="flex-1 min-w-[200px]">
                  <FormField label="File penawaran (opsional)" hint="Bila sudah punya dokumen sendiri">
                    <FileUploader label="Pilih Excel / PDF" kind="dokumen" category="penawaran" autoFlush onUploaded={(id) => setFileId(id)} />
                  </FormField>
                </View>
              </View>
            </View>
          </View>

          {/* Ringkasan */}
          <View className="rounded-xl border border-border bg-card p-3.5 gap-1">
            <SumLine label="Total barang & jasa" value={rupiah(gross)} />
            {itemDisc > 0 ? <SumLine label="Diskon per item" value={`- ${rupiah(itemDisc)}`} danger /> : null}
            {extraDisc > 0 ? <SumLine label="Diskon tambahan" value={`- ${rupiah(extraDisc)}`} danger /> : null}
            <SumLine label={ppnMode === "include" ? "DPP (harga sebelum PPN)" : "DPP"} value={rupiah(fin.dpp)} />
            <SumLine
              label={ppnMode === "none" ? "PPN" : ppnMode === "include" ? "PPN 11% (sudah termasuk)" : "PPN 11%"}
              value={ppnMode === "none" ? "Rp 0" : rupiah(fin.ppn)}
            />
            <View className="flex-row justify-between pt-1.5 mt-1 border-t border-border">
              <Text className="text-sm font-bold text-foreground">Total penawaran</Text>
              <Text className="text-base font-bold text-primary">{rupiah(fin.totalAfterDisc)}</Text>
            </View>
            {fin.pph > 0 ? (
              <Text className="text-[11px] text-muted-foreground">
                PPh {rupiah(fin.pph)} dipotong customer saat bayar · estimasi transfer {rupiah(fin.netReceived)}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <DialogFooter className="flex-row flex-wrap items-center gap-2">
        <View className="flex-1 min-w-[160px]">
          {missing.length ? (
            <Text className="text-[11px] text-warning">Belum lengkap: {missing.join(", ")}</Text>
          ) : (
            <Text className="text-[11px] text-muted-foreground">Total {rupiah(fin.totalAfterDisc)}</Text>
          )}
        </View>
        <Button variant="outline" onPress={onClose} disabled={saving}>
          <Text>Batal</Text>
        </Button>
        <Button onPress={submit} disabled={saving}>
          <Text className="text-white font-semibold">{saving ? "Menyimpan..." : "Simpan Penawaran"}</Text>
        </Button>
      </DialogFooter>

      <ItemEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        item={editingIndex != null ? (items[editingIndex] as any) : null}
        itemIndex={editingIndex}
        existingItems={items as any}
        isBuyPrice={false}
        allowDiscount
        onSave={(saved, idx) => saveItem(saved, idx)}
      />
      <SerialItemPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingItems={items}
        onAddItems={(newItems) => setItems((prev) => [...prev, ...newItems])}
      />
      <QuickAddCustomerDialog
        open={quickCustomerOpen}
        onOpenChange={setQuickCustomerOpen}
        onSuccess={(c: any) => setCustomer({ id: String(c.id), name: String(c.nama || c.name || "-") })}
      />
    </>
  );
}

function SumLine({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className={`text-xs font-medium ${danger ? "text-danger" : "text-foreground"}`}>{value}</Text>
    </View>
  );
}
