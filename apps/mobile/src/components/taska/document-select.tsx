import * as React from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import {
  Search,
  FileText,
  FileSpreadsheet,
  Users,
  Receipt,
  ChevronDown,
  Check,
  Calendar,
  Building2,
  Tag,
  Briefcase,
  Layers,
  ClipboardList,
  Presentation,
  Handshake,
  MapPin,
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
import { StatusBadge } from "@/components/taska/status-badge";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { rupiah } from "@/lib/format";
import type { Row } from "@/constants/modules";

function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ==========================================
// 1. PO CLIENT (SALES ORDER) SELECT
// ==========================================

export interface PoClientSelectProps {
  value?: string;
  poId?: string | number | null;
  onChange: (po: Row) => void;
  placeholder?: string;
  error?: boolean;
}

export function PoClientSelect({
  value,
  poId,
  onChange,
  placeholder = "Cari & pilih PO client (Sales Order)...",
  error,
}: PoClientSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const poClientData = data["po-client"];
  const poList: Row[] = React.useMemo(() => poClientData ?? [], [poClientData]);

  const selectedPo = React.useMemo(() => {
    if (poId) {
      const match = poList.find((p) => String(p.id) === String(poId));
      if (match) return match;
    }
    if (value) {
      const selNo = value.split(" - ")[0]?.trim().toLowerCase();
      return (
        poList.find((p) => {
          const no = String(p.nomorSo || p.nomor || p.number || "").toLowerCase();
          return no === selNo || `${no} - ${p.customer || "-"}`.toLowerCase() === value.toLowerCase();
        }) || null
      );
    }
    return null;
  }, [poList, poId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedPo) {
      const no = selectedPo.nomorSo || selectedPo.nomor || selectedPo.number || `PO #${selectedPo.id}`;
      return `${no} - ${selectedPo.customer || "-"}`;
    }
    return value || "";
  }, [selectedPo, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return poList;
    const term = q.trim().toLowerCase();
    return poList.filter((p) => {
      const no = String(p.nomorSo || p.nomor || p.number || "").toLowerCase();
      const cust = String(p.customer || "").toLowerCase();
      const proj = String(p.project || p.proyek || "").toLowerCase();
      const note = String(p.catatan || "").toLowerCase();
      return no.includes(term) || cust.includes(term) || proj.includes(term) || note.includes(term);
    });
  }, [poList, q]);

  function handleSelect(p: Row) {
    onChange(p);
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
          error && "border-danger"
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <FileText size={16} color={displayLabel ? colors.primary : colors.muted} />
          <Text
            className={cn("text-base md:text-sm flex-1", !displayLabel && "text-muted-foreground")}
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
          style={Platform.select({ web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <FileText size={20} color={colors.primary} />
                <DialogTitle>Pilih PO Client (Sales Order)</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor PO/SO, nama customer, proyek, atau catatan..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Table */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="flex-1 min-w-[760px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px]">Nomor SO & Tanggal</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">Customer & Proyek</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 text-right px-2">Total Nilai Pesanan</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[140px] px-2 text-center">Status & Tagihan</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">Aksi</Text>
                </View>

                {/* Rows */}
                <ScrollView className="max-h-[50vh]" contentContainerClassName="divide-y divide-border/40">
                  {filteredList.map((p) => {
                    const isSelected = selectedPo?.id === p.id;
                    const no = p.nomorSo || p.nomor || p.number || `SO #${p.id}`;
                    const tgl = p.tanggal || p.createdAt || "";
                    const totalVal = Number(p.total || p.nilai || 0);
                    const totalInv = Number(p.totalInvoice || 0);
                    const sisa = Math.max(0, totalVal - totalInv);
                    const itemCount = Array.isArray(p.items) ? p.items.length : 0;

                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => handleSelect(p)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10"
                        )}
                      >
                        {/* Kolom 1: Nomor SO & Tanggal */}
                        <View className="w-1/4 min-w-[180px]">
                          <Text className={cn("text-xs font-bold font-mono text-foreground", isSelected && "text-primary")}>
                            {no}
                          </Text>
                          {tgl ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <Calendar size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground">{formatDate(tgl)}</Text>
                            </View>
                          ) : null}
                          {itemCount > 0 ? (
                            <Text className="text-[10px] text-muted-foreground mt-0.5">{itemCount} item barang/jasa</Text>
                          ) : null}
                        </View>

                        {/* Kolom 2: Customer & Proyek */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                            {p.customer || "-"}
                          </Text>
                          {p.project || p.proyek ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <Briefcase size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                                {p.project || p.proyek}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Kolom 3: Total Nilai Pesanan */}
                        <View className="w-36 items-end px-2">
                          <Text className="text-xs font-bold text-foreground">{rupiah(totalVal)}</Text>
                          {p.ppnMode && p.ppnMode !== "none" ? (
                            <Text className="text-[10px] text-primary">{p.ppnMode === "include" ? "Inc. PPN" : "+ PPN 11%"}</Text>
                          ) : null}
                        </View>

                        {/* Kolom 4: Status & Tagihan */}
                        <View className="flex-1 min-w-[140px] px-2 items-center">
                          <StatusBadge status={p.paymentStatus || p.status || "Aktif"} />
                          {totalInv > 0 ? (
                            <Text className="text-[10px] text-muted-foreground mt-0.5">
                              Terbit: {rupiah(totalInv)} (Sisa: {rupiah(sisa)})
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 items-center">
                          {isSelected ? (
                            <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/15 rounded-md">
                              <Check size={12} color={colors.primary} />
                              <Text className="text-[11px] font-bold text-primary">Dipilih</Text>
                            </View>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2.5">
                              <Text className="text-[11px] font-semibold text-muted-foreground">Pilih</Text>
                            </Button>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  {filteredList.length === 0 && (
                    <View className="p-8 items-center justify-center gap-2">
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Tidak ada data PO Client yang cocok dengan &quot;{q}&quot;
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
// 2. QUOTATION (PENAWARAN) SELECT
// ==========================================

export interface QuotationSelectProps {
  value?: string;
  quotationId?: string | number | null;
  onChange: (quotation: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function QuotationSelect({
  value,
  quotationId,
  onChange,
  placeholder = "Cari & pilih dokumen penawaran...",
  error,
  allowClear = false,
}: QuotationSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const quotations: Row[] = React.useMemo(() => data.quotations ?? [], [data.quotations]);

  const selectedQuotation = React.useMemo(() => {
    if (quotationId) {
      const match = quotations.find((it) => String(it.id) === String(quotationId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const selNo = value.split(" - ")[0]?.trim().toLowerCase();
      return (
        quotations.find((it) => {
          const no = String(it.nomor || "").toLowerCase();
          return no === selNo || `${no} - ${it.customer || "-"} - ${it.lead || "-"}`.toLowerCase() === value.toLowerCase();
        }) || null
      );
    }
    return null;
  }, [quotations, quotationId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedQuotation) {
      return `${selectedQuotation.nomor} - ${selectedQuotation.customer || "-"} - ${selectedQuotation.lead || "-"}`;
    }
    return (value && value !== "-") ? value : "";
  }, [selectedQuotation, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return quotations;
    const term = q.trim().toLowerCase();
    return quotations.filter((item) => {
      const no = String(item.nomor || "").toLowerCase();
      const cust = String(item.customer || "").toLowerCase();
      const lead = String(item.lead || "").toLowerCase();
      return no.includes(term) || cust.includes(term) || lead.includes(term);
    });
  }, [quotations, q]);

  function handleSelect(item: Row | null) {
    onChange(item);
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
          error && "border-danger"
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <FileSpreadsheet size={16} color={displayLabel ? colors.primary : colors.muted} />
          <Text
            className={cn("text-base md:text-sm flex-1", !displayLabel && "text-muted-foreground")}
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
          style={Platform.select({ web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <FileSpreadsheet size={20} color={colors.primary} />
                <DialogTitle>Pilih Dokumen Penawaran (Quotation)</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor penawaran, nama customer, atau lead..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Table */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="flex-1 min-w-[760px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px]">Nomor Penawaran & Versi</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[220px] px-2">Customer & Lead</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 text-right px-2">Total Nilai Penawaran</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[120px] px-2 text-center">Status</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">Aksi</Text>
                </View>

                {/* Rows */}
                <ScrollView className="max-h-[50vh]" contentContainerClassName="divide-y divide-border/40">
                  {allowClear && (
                    <Pressable
                      onPress={() => handleSelect(null)}
                      className="p-3.5 hover:bg-muted/30 active:bg-muted/50 flex-row items-center justify-between"
                    >
                      <Text className="text-xs font-medium text-muted-foreground">
                        - Tanpa Penawaran (Buat Manual / Kosongkan) -
                      </Text>
                      {(!quotationId && !value) && <Check size={16} color={colors.primary} />}
                    </Pressable>
                  )}
                  {filteredList.map((item) => {
                    const isSelected = selectedQuotation?.id === item.id;
                    const no = item.nomor || `Quotation #${item.id}`;
                    const versi = item.versi ? `v${item.versi}` : "v1";
                    const tgl = item.tanggal || item.createdAt || "";
                    const totalVal = Number(item.totalAfterDisc || item.total || item.nilai || 0);
                    const itemCount = Array.isArray(item.items) ? item.items.length : 0;

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => handleSelect(item)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10"
                        )}
                      >
                        {/* Kolom 1: Nomor & Versi */}
                        <View className="w-1/4 min-w-[180px]">
                          <View className="flex-row items-center gap-1.5 flex-wrap">
                            <Text className={cn("text-xs font-bold font-mono text-foreground", isSelected && "text-primary")}>
                              {no}
                            </Text>
                            <View className="px-1.5 py-0.2 rounded bg-muted border border-border/80">
                              <Text className="text-[10px] font-semibold text-muted-foreground">{versi}</Text>
                            </View>
                          </View>
                          {tgl ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <Calendar size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground">{formatDate(tgl)}</Text>
                            </View>
                          ) : null}
                          {itemCount > 0 ? (
                            <Text className="text-[10px] text-muted-foreground mt-0.5">{itemCount} item barang/jasa</Text>
                          ) : null}
                        </View>

                        {/* Kolom 2: Customer & Lead */}
                        <View className="w-1/3 min-w-[220px] px-2">
                          <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                            {item.customer || "-"}
                          </Text>
                          {item.lead ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <Tag size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                                Prospek: {item.lead}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Kolom 3: Total Nilai Penawaran */}
                        <View className="w-36 items-end px-2">
                          <Text className="text-xs font-bold text-foreground">{rupiah(totalVal)}</Text>
                          {item.ppnMode && item.ppnMode !== "none" ? (
                            <Text className="text-[10px] text-primary">{item.ppnMode === "include" ? "Inc. PPN" : "+ PPN 11%"}</Text>
                          ) : null}
                        </View>

                        {/* Kolom 4: Status */}
                        <View className="flex-1 min-w-[120px] px-2 items-center">
                          <StatusBadge status={item.status || "Aktif"} />
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 items-center">
                          {isSelected ? (
                            <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/15 rounded-md">
                              <Check size={12} color={colors.primary} />
                              <Text className="text-[11px] font-bold text-primary">Dipilih</Text>
                            </View>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2.5">
                              <Text className="text-[11px] font-semibold text-muted-foreground">Pilih</Text>
                            </Button>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  {filteredList.length === 0 && (
                    <View className="p-8 items-center justify-center gap-2">
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Tidak ada penawaran yang cocok dengan &quot;{q}&quot;
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
// 3. LEAD (PROSPEK) SELECT
// ==========================================

export interface LeadSelectProps {
  value?: string;
  leadId?: string | number | null;
  onChange: (lead: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function LeadSelect({
  value,
  leadId,
  onChange,
  placeholder = "Cari & pilih lead / prospek...",
  error,
  allowClear = false,
}: LeadSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const leads: Row[] = React.useMemo(() => data.leads ?? [], [data.leads]);

  const selectedLead = React.useMemo(() => {
    if (leadId) {
      const match = leads.find((l) => String(l.id) === String(leadId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const selName = (value.split(" · ")[0] ?? value.split(" - ")[0] ?? value).trim().toLowerCase();
      return (
        leads.find((l) => {
          const nama = String(l.nama || "").toLowerCase();
          return nama === selName || `${nama} - ${l.perusahaan || l.customer || "-"}`.toLowerCase() === value.toLowerCase();
        }) || null
      );
    }
    return null;
  }, [leads, leadId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedLead) {
      return `${selectedLead.nama} - ${selectedLead.perusahaan || selectedLead.customer || "-"}`;
    }
    return (value && value !== "-") ? value : "";
  }, [selectedLead, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return leads;
    const term = q.trim().toLowerCase();
    return leads.filter((l) => {
      const nama = String(l.nama || "").toLowerCase();
      const pers = String(l.perusahaan || l.customer || "").toLowerCase();
      const need = String(l.kebutuhan || l.need || "").toLowerCase();
      const telp = String(l.telepon || l.phone || "").toLowerCase();
      return nama.includes(term) || pers.includes(term) || need.includes(term) || telp.includes(term);
    });
  }, [leads, q]);

  function handleSelect(lead: Row | null) {
    onChange(lead);
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
          error && "border-danger"
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <Users size={16} color={displayLabel ? colors.primary : colors.muted} />
          <Text
            className={cn("text-base md:text-sm flex-1", !displayLabel && "text-muted-foreground")}
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
          style={Platform.select({ web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Users size={20} color={colors.primary} />
                <DialogTitle>Pilih Lead / Prospek</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nama lead, perusahaan, telepon, atau kebutuhan..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Table */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="flex-1 min-w-[760px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px]">Nama Lead & Kontak</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">Perusahaan / Customer</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[200px] px-2">Kebutuhan / Prospek</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-28 px-2 text-center">Tahapan / Status</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">Aksi</Text>
                </View>

                {/* Rows */}
                <ScrollView className="max-h-[50vh]" contentContainerClassName="divide-y divide-border/40">
                  {allowClear && (
                    <Pressable
                      onPress={() => handleSelect(null)}
                      className="p-3.5 hover:bg-muted/30 active:bg-muted/50 flex-row items-center justify-between"
                    >
                      <Text className="text-xs font-medium text-muted-foreground">
                        - Tanpa Lead / Kosongkan -
                      </Text>
                      {(!leadId && !value) && <Check size={16} color={colors.primary} />}
                    </Pressable>
                  )}
                  {filteredList.map((lead) => {
                    const isSelected = selectedLead?.id === lead.id;
                    const telp = lead.telepon || lead.phone || "";
                    const email = lead.email || "";
                    const pers = lead.perusahaan || lead.customer || "-";
                    const need = lead.kebutuhan || lead.need || "-";

                    return (
                      <Pressable
                        key={lead.id}
                        onPress={() => handleSelect(lead)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10"
                        )}
                      >
                        {/* Kolom 1: Nama Lead & Kontak */}
                        <View className="w-1/4 min-w-[180px]">
                          <Text className={cn("text-xs font-bold text-foreground", isSelected && "text-primary")}>
                            {lead.nama || `Lead #${lead.id}`}
                          </Text>
                          {telp ? (
                            <Text className="text-[11px] text-muted-foreground mt-0.5">{telp}</Text>
                          ) : null}
                          {email ? (
                            <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>{email}</Text>
                          ) : null}
                        </View>

                        {/* Kolom 2: Perusahaan / Customer */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <View className="flex-row items-center gap-1.5">
                            <Building2 size={12} color={colors.muted} />
                            <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                              {pers}
                            </Text>
                          </View>
                          {lead.kota ? (
                            <Text className="text-[11px] text-muted-foreground mt-0.5">{lead.kota}</Text>
                          ) : null}
                        </View>

                        {/* Kolom 3: Kebutuhan / Prospek */}
                        <View className="flex-1 min-w-[200px] px-2">
                          <Text className="text-xs text-foreground" numberOfLines={2}>
                            {need}
                          </Text>
                        </View>

                        {/* Kolom 4: Tahapan / Status */}
                        <View className="w-28 px-2 items-center">
                          <StatusBadge status={lead.status || lead.stage || "Baru"} />
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 items-center">
                          {isSelected ? (
                            <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/15 rounded-md">
                              <Check size={12} color={colors.primary} />
                              <Text className="text-[11px] font-bold text-primary">Dipilih</Text>
                            </View>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2.5">
                              <Text className="text-[11px] font-semibold text-muted-foreground">Pilih</Text>
                            </Button>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  {filteredList.length === 0 && (
                    <View className="p-8 items-center justify-center gap-2">
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Tidak ada lead / prospek yang cocok dengan &quot;{q}&quot;
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
// 4. CONTINUABLE INVOICE (LANJUTKAN TERMIN / DP) SELECT
// ==========================================

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
  placeholder = "Ketik atau pilih invoice DP / termin acuan...",
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
        options.find((o) => o.label === value || o.nomor === value || String(o.id) === value) || null
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
      return no.includes(term) || cust.includes(term) || po.includes(term) || quo.includes(term) || label.includes(term);
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
          error && "border-danger"
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <Receipt size={16} color={displayLabel ? colors.primary : colors.muted} />
          <Text
            className={cn("text-base md:text-sm flex-1", !displayLabel && "text-muted-foreground")}
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
          style={Platform.select({ web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Layers size={20} color={colors.primary} />
                <DialogTitle>Pilih Invoice DP / Termin Acuan</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor invoice, customer, PO/SO, atau penawaran..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Table */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="flex-1 min-w-[760px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px]">Nomor Invoice & Tanggal</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">Customer & Dokumen Asal</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 text-right px-2">Total Nilai Tagihan</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[160px] px-2 text-center">Status & Sisa Kontrak</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">Aksi</Text>
                </View>

                {/* Rows */}
                <ScrollView className="max-h-[50vh]" contentContainerClassName="divide-y divide-border/40">
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
                          isSelected && "bg-primary/10"
                        )}
                      >
                        {/* Kolom 1: Nomor Invoice & Tanggal */}
                        <View className="w-1/4 min-w-[180px]">
                          <Text className={cn("text-xs font-bold font-mono text-foreground", isSelected && "text-primary")}>
                            {opt.nomor}
                          </Text>
                          {tgl ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <Calendar size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground">{formatDate(tgl)}</Text>
                            </View>
                          ) : null}
                          <View className="flex-row items-center gap-1 mt-0.5">
                            <Tag size={10} color={colors.primary} />
                            <Text className="text-[10px] font-semibold text-primary">
                              {inv.jenis || (String(inv.type || "").toUpperCase() === "DP" ? "DP" : "Termin")}
                            </Text>
                          </View>
                        </View>

                        {/* Kolom 2: Customer & Dokumen Asal */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                            {opt.customer || "-"}
                          </Text>
                          {inv.po ? (
                            <Text className="text-[10px] text-muted-foreground mt-0.5 font-mono" numberOfLines={1}>
                              SO: {inv.po}
                            </Text>
                          ) : null}
                          {inv.quotation ? (
                            <Text className="text-[10px] text-muted-foreground font-mono" numberOfLines={1}>
                              Quo: {inv.quotation}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 3: Total Nilai Tagihan */}
                        <View className="w-36 items-end px-2">
                          <Text className="text-xs font-bold text-foreground">{rupiah(totalVal)}</Text>
                          {outstanding > 0 ? (
                            <Text className="text-[10px] text-danger font-medium">Sisa tagihan: {rupiah(outstanding)}</Text>
                          ) : (
                            <Text className="text-[10px] text-success font-medium">Lunas</Text>
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
                            <Text className="text-[10px] text-muted-foreground mt-0.5">Kontrak habis</Text>
                          )}
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 items-center">
                          {isSelected ? (
                            <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/15 rounded-md">
                              <Check size={12} color={colors.primary} />
                              <Text className="text-[11px] font-bold text-primary">Dipilih</Text>
                            </View>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2.5">
                              <Text className="text-[11px] font-semibold text-muted-foreground">Pilih</Text>
                            </Button>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  {filteredList.length === 0 && (
                    <View className="p-8 items-center justify-center gap-2">
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Tidak ada invoice acuan yang cocok dengan &quot;{q}&quot;
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
// 5. PROJECT (PROYEK) SELECT
// ==========================================

export interface ProjectSelectProps {
  value?: string;
  projectId?: string | number | null;
  onChange: (project: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function ProjectSelect({
  value,
  projectId,
  onChange,
  placeholder = "Pilih alokasi proyek jika ada...",
  error,
  allowClear = true,
}: ProjectSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const projects: Row[] = React.useMemo(() => data.projects ?? [], [data.projects]);

  const selectedProject = React.useMemo(() => {
    if (projectId) {
      const match = projects.find((p) => String(p.id) === String(projectId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        projects.find((p) => {
          const name = String(p.nama || p.name || "").toLowerCase();
          const cust = String(p.customer || "").toLowerCase();
          return name === qVal || `${name} (${cust})`.toLowerCase() === qVal || String(p.id) === qVal;
        }) || null
      );
    }
    return null;
  }, [projects, projectId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedProject) {
      const cust = selectedProject.customer ? ` (${selectedProject.customer})` : "";
      return `${selectedProject.nama || selectedProject.name || `Proyek #${selectedProject.id}`}${cust}`;
    }
    return (value && value !== "-") ? value : "";
  }, [selectedProject, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return projects;
    const term = q.trim().toLowerCase();
    return projects.filter((p) => {
      const name = String(p.nama || p.name || "").toLowerCase();
      const cust = String(p.customer || "").toLowerCase();
      const jenis = String(p.jenis || "").toLowerCase();
      const status = String(p.status || "").toLowerCase();
      return name.includes(term) || cust.includes(term) || jenis.includes(term) || status.includes(term);
    });
  }, [projects, q]);

  function handleSelect(item: Row | null) {
    onChange(item);
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
          error && "border-danger"
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <Briefcase size={16} color={displayLabel ? colors.primary : colors.muted} />
          <Text
            className={cn("text-base md:text-sm flex-1", !displayLabel && "text-muted-foreground")}
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
          style={Platform.select({ web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Briefcase size={20} color={colors.primary} />
                <DialogTitle>Pilih Alokasi Proyek</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nama proyek, customer, atau jenis proyek..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Table */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="flex-1 min-w-[760px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[220px]">Nama Proyek & Jenis</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">Customer / Klien</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 text-right px-2">Nilai Kontrak</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[140px] px-2 text-center">Progres & Status</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">Aksi</Text>
                </View>

                {/* Rows */}
                <ScrollView className="max-h-[50vh]" contentContainerClassName="divide-y divide-border/40">
                  {allowClear && (
                    <Pressable
                      onPress={() => handleSelect(null)}
                      className="p-3.5 hover:bg-muted/30 active:bg-muted/50 flex-row items-center justify-between"
                    >
                      <Text className="text-xs font-medium text-muted-foreground">
                        - Tanpa Alokasi Proyek (Non-Proyek / Umum) -
                      </Text>
                      {(!projectId && !value) && <Check size={16} color={colors.primary} />}
                    </Pressable>
                  )}

                  {filteredList.map((p) => {
                    const isSelected = selectedProject?.id === p.id;
                    const name = p.nama || p.name || `Proyek #${p.id}`;
                    const jenis = p.jenis || "Proyek";
                    const cust = p.customer || p.klien || "-";
                    const totalVal = Number(p.nilai || p.total || p.budget || 0);
                    const progres = p.progres != null ? `${p.progres}%` : "-";

                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => handleSelect(p)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10"
                        )}
                      >
                        {/* Kolom 1: Nama Proyek & Jenis */}
                        <View className="w-1/3 min-w-[220px]">
                          <Text className={cn("text-xs font-bold text-foreground", isSelected && "text-primary")}>
                            {name}
                          </Text>
                          <View className="flex-row items-center gap-1 mt-0.5">
                            <Tag size={10} color={colors.muted} />
                            <Text className="text-[11px] text-muted-foreground">{jenis}</Text>
                          </View>
                        </View>

                        {/* Kolom 2: Customer / Klien */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <View className="flex-row items-center gap-1.5">
                            <Building2 size={12} color={colors.muted} />
                            <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                              {cust}
                            </Text>
                          </View>
                        </View>

                        {/* Kolom 3: Nilai Kontrak */}
                        <View className="w-36 items-end px-2">
                          <Text className="text-xs font-bold text-foreground">
                            {totalVal > 0 ? rupiah(totalVal) : "-"}
                          </Text>
                        </View>

                        {/* Kolom 4: Progres & Status */}
                        <View className="flex-1 min-w-[140px] px-2 items-center">
                          <StatusBadge status={p.status || "Berjalan"} />
                          <Text className="text-[10px] text-muted-foreground mt-0.5">Progres: {progres}</Text>
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 items-center">
                          {isSelected ? (
                            <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/15 rounded-md">
                              <Check size={12} color={colors.primary} />
                              <Text className="text-[11px] font-bold text-primary">Dipilih</Text>
                            </View>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2.5">
                              <Text className="text-[11px] font-semibold text-muted-foreground">Pilih</Text>
                            </Button>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  {filteredList.length === 0 && (
                    <View className="p-8 items-center justify-center gap-2">
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Tidak ada proyek yang cocok dengan &quot;{q}&quot;
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
// 6. SURVEY SELECT
// ==========================================

export interface SurveySelectProps {
  value?: string;
  surveyId?: string | number | null;
  onChange: (survey: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function SurveySelect({
  value,
  surveyId,
  onChange,
  placeholder = "Pilih survey jika ada...",
  error,
  allowClear = true,
}: SurveySelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const surveys: Row[] = React.useMemo(() => data.surveys ?? [], [data.surveys]);

  const selectedSurvey = React.useMemo(() => {
    if (surveyId) {
      const match = surveys.find((s) => String(s.id) === String(surveyId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        surveys.find((s) => {
          const opt = `Survey #${s.id} - ${s.lead || s.customer || s.lokasi || "Survey"}`.toLowerCase();
          const idStr = String(s.id);
          return opt === qVal || idStr === qVal || opt.includes(qVal);
        }) || null
      );
    }
    return null;
  }, [surveys, surveyId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedSurvey) {
      return `Survey #${selectedSurvey.id} - ${selectedSurvey.lead || selectedSurvey.customer || selectedSurvey.lokasi || "Survey"}`;
    }
    return (value && value !== "-") ? value : "";
  }, [selectedSurvey, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return surveys;
    const term = q.trim().toLowerCase();
    return surveys.filter((s) => {
      const idStr = String(s.id).toLowerCase();
      const lead = String(s.lead || "").toLowerCase();
      const cust = String(s.customer || "").toLowerCase();
      const lok = String(s.lokasi || "").toLowerCase();
      const tim = String(s.tim || "").toLowerCase();
      return idStr.includes(term) || lead.includes(term) || cust.includes(term) || lok.includes(term) || tim.includes(term);
    });
  }, [surveys, q]);

  function handleSelect(item: Row | null) {
    onChange(item);
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
          error && "border-danger"
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <ClipboardList size={16} color={displayLabel ? colors.primary : colors.muted} />
          <Text
            className={cn("text-base md:text-sm flex-1", !displayLabel && "text-muted-foreground")}
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
          style={Platform.select({ web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <ClipboardList size={20} color={colors.primary} />
                <DialogTitle>Pilih Survey Terkait</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor survey, kebutuhan, customer, atau lokasi..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Table */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="flex-1 min-w-[760px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[220px]">ID & Kebutuhan Survey</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">Customer & Lokasi</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 px-2">Jadwal & Tim</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[120px] px-2 text-center">Status</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">Aksi</Text>
                </View>

                {/* Rows */}
                <ScrollView className="max-h-[50vh]" contentContainerClassName="divide-y divide-border/40">
                  {allowClear && (
                    <Pressable
                      onPress={() => handleSelect(null)}
                      className="p-3.5 hover:bg-muted/30 active:bg-muted/50 flex-row items-center justify-between"
                    >
                      <Text className="text-xs font-medium text-muted-foreground">
                        - Tanpa Survey (Kosongkan) -
                      </Text>
                      {(!surveyId && !value) && <Check size={16} color={colors.primary} />}
                    </Pressable>
                  )}

                  {filteredList.map((s) => {
                    const isSelected = selectedSurvey?.id === s.id;
                    const title = s.lead || s.kebutuhan || "Survey Lokasi";
                    const cust = s.customer || "-";
                    const lok = s.lokasi || "-";
                    const tgl = s.jadwal || s.createdAt || "";

                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => handleSelect(s)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10"
                        )}
                      >
                        {/* Kolom 1: ID & Kebutuhan */}
                        <View className="w-1/3 min-w-[220px]">
                          <View className="flex-row items-center gap-1.5 flex-wrap">
                            <Text className={cn("text-xs font-bold font-mono text-foreground", isSelected && "text-primary")}>
                              Survey #{s.id}
                            </Text>
                          </View>
                          <Text className="text-[11px] text-muted-foreground mt-0.5" numberOfLines={2}>
                            {title}
                          </Text>
                        </View>

                        {/* Kolom 2: Customer & Lokasi */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                            {cust}
                          </Text>
                          {lok !== "-" ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <MapPin size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>{lok}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Kolom 3: Jadwal & Tim */}
                        <View className="w-36 px-2">
                          {tgl ? (
                            <View className="flex-row items-center gap-1">
                              <Calendar size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground">{formatDate(tgl)}</Text>
                            </View>
                          ) : null}
                          {s.tim ? (
                            <Text className="text-[10px] text-muted-foreground mt-0.5" numberOfLines={1}>
                              Tim: {s.tim}
                            </Text>
                          ) : null}
                        </View>

                        {/* Kolom 4: Status */}
                        <View className="flex-1 min-w-[120px] px-2 items-center">
                          <StatusBadge status={s.status || "Diminta"} />
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 items-center">
                          {isSelected ? (
                            <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/15 rounded-md">
                              <Check size={12} color={colors.primary} />
                              <Text className="text-[11px] font-bold text-primary">Dipilih</Text>
                            </View>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2.5">
                              <Text className="text-[11px] font-semibold text-muted-foreground">Pilih</Text>
                            </Button>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  {filteredList.length === 0 && (
                    <View className="p-8 items-center justify-center gap-2">
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Tidak ada data survey yang cocok dengan &quot;{q}&quot;
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
// 7. POC SELECT
// ==========================================

export interface PocSelectProps {
  value?: string;
  pocId?: string | number | null;
  onChange: (poc: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function PocSelect({
  value,
  pocId,
  onChange,
  placeholder = "Pilih kegiatan POC / Demo...",
  error,
  allowClear = true,
}: PocSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const pocList: Row[] = React.useMemo(() => (data as any)["poc-reports"] ?? [], [data]);

  const selectedPoc = React.useMemo(() => {
    if (pocId) {
      const match = pocList.find((p) => String(p.id) === String(pocId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        pocList.find((p) => {
          const opt = `POC ${p.nomor || p.number || p.id} - ${p.judul || p.title || "POC"}`.toLowerCase();
          const no = String(p.nomor || p.number || "").toLowerCase();
          return opt === qVal || no === qVal || String(p.id) === qVal || opt.includes(qVal);
        }) || null
      );
    }
    return null;
  }, [pocList, pocId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedPoc) {
      return `POC ${selectedPoc.nomor || selectedPoc.number || selectedPoc.id} - ${selectedPoc.judul || selectedPoc.title || "POC"}`;
    }
    return (value && value !== "-") ? value : "";
  }, [selectedPoc, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return pocList;
    const term = q.trim().toLowerCase();
    return pocList.filter((p) => {
      const no = String(p.nomor || p.number || "").toLowerCase();
      const judul = String(p.judul || p.title || "").toLowerCase();
      const klien = String(p.klien || p.customer || "").toLowerCase();
      const tipe = String(p.tipe || "").toLowerCase();
      return no.includes(term) || judul.includes(term) || klien.includes(term) || tipe.includes(term);
    });
  }, [pocList, q]);

  function handleSelect(item: Row | null) {
    onChange(item);
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
          error && "border-danger"
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <Presentation size={16} color={displayLabel ? colors.primary : colors.muted} />
          <Text
            className={cn("text-base md:text-sm flex-1", !displayLabel && "text-muted-foreground")}
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
          style={Platform.select({ web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Presentation size={20} color={colors.primary} />
                <DialogTitle>Pilih Kegiatan POC / Demo</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor POC, judul, klien, atau tipe..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Table */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="flex-1 min-w-[760px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[220px]">Nomor & Judul POC</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">Klien / Acara</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 px-2">Tipe & Tanggal</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[120px] px-2 text-center">Status</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">Aksi</Text>
                </View>

                {/* Rows */}
                <ScrollView className="max-h-[50vh]" contentContainerClassName="divide-y divide-border/40">
                  {allowClear && (
                    <Pressable
                      onPress={() => handleSelect(null)}
                      className="p-3.5 hover:bg-muted/30 active:bg-muted/50 flex-row items-center justify-between"
                    >
                      <Text className="text-xs font-medium text-muted-foreground">
                        - Tanpa POC (Kosongkan) -
                      </Text>
                      {(!pocId && !value) && <Check size={16} color={colors.primary} />}
                    </Pressable>
                  )}

                  {filteredList.map((p) => {
                    const isSelected = selectedPoc?.id === p.id;
                    const no = p.nomor || p.number || `POC #${p.id}`;
                    const judul = p.judul || p.title || "Kegiatan POC";
                    const klien = p.klien || p.customer || "-";
                    const tgl = p.tanggal || p.createdAt || "";

                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => handleSelect(p)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10"
                        )}
                      >
                        {/* Kolom 1: Nomor & Judul */}
                        <View className="w-1/3 min-w-[220px]">
                          <Text className={cn("text-xs font-bold font-mono text-foreground", isSelected && "text-primary")}>
                            {no}
                          </Text>
                          <Text className="text-[11px] text-muted-foreground mt-0.5" numberOfLines={2}>
                            {judul}
                          </Text>
                        </View>

                        {/* Kolom 2: Klien / Acara */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                            {klien}
                          </Text>
                          {p.lokasi ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <MapPin size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>{p.lokasi}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Kolom 3: Tipe & Tanggal */}
                        <View className="w-36 px-2">
                          <Text className="text-xs text-foreground font-medium">{p.tipe || "Demo"}</Text>
                          {tgl ? (
                            <Text className="text-[11px] text-muted-foreground mt-0.5">{formatDate(tgl)}</Text>
                          ) : null}
                        </View>

                        {/* Kolom 4: Status */}
                        <View className="flex-1 min-w-[120px] px-2 items-center">
                          <StatusBadge status={p.status || "Planned"} />
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 items-center">
                          {isSelected ? (
                            <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/15 rounded-md">
                              <Check size={12} color={colors.primary} />
                              <Text className="text-[11px] font-bold text-primary">Dipilih</Text>
                            </View>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2.5">
                              <Text className="text-[11px] font-semibold text-muted-foreground">Pilih</Text>
                            </Button>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  {filteredList.length === 0 && (
                    <View className="p-8 items-center justify-center gap-2">
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Tidak ada data POC yang cocok dengan &quot;{q}&quot;
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
// 8. VISIT SELECT
// ==========================================

export interface VisitSelectProps {
  value?: string;
  visitId?: string | number | null;
  onChange: (visit: Row | null) => void;
  placeholder?: string;
  error?: boolean;
  allowClear?: boolean;
}

export function VisitSelect({
  value,
  visitId,
  onChange,
  placeholder = "Pilih kunjungan / meeting...",
  error,
  allowClear = true,
}: VisitSelectProps) {
  const { data } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const visitList: Row[] = React.useMemo(() => (data as any)["visit-reports"] ?? [], [data]);

  const selectedVisit = React.useMemo(() => {
    if (visitId) {
      const match = visitList.find((v) => String(v.id) === String(visitId));
      if (match) return match;
    }
    if (value && value !== "-") {
      const qVal = value.trim().toLowerCase();
      return (
        visitList.find((v) => {
          const opt = `VISIT ${v.nomor || v.number || v.id} - ${v.judul || v.title || "Meeting"}`.toLowerCase();
          const no = String(v.nomor || v.number || "").toLowerCase();
          return opt === qVal || no === qVal || String(v.id) === qVal || opt.includes(qVal);
        }) || null
      );
    }
    return null;
  }, [visitList, visitId, value]);

  const displayLabel = React.useMemo(() => {
    if (selectedVisit) {
      return `VISIT ${selectedVisit.nomor || selectedVisit.number || selectedVisit.id} - ${selectedVisit.judul || selectedVisit.title || "Meeting"}`;
    }
    return (value && value !== "-") ? value : "";
  }, [selectedVisit, value]);

  const filteredList = React.useMemo(() => {
    if (!q.trim()) return visitList;
    const term = q.trim().toLowerCase();
    return visitList.filter((v) => {
      const no = String(v.nomor || v.number || "").toLowerCase();
      const judul = String(v.judul || v.title || "").toLowerCase();
      const klien = String(v.klien || v.customer || "").toLowerCase();
      const tipe = String(v.tipe || "").toLowerCase();
      return no.includes(term) || judul.includes(term) || klien.includes(term) || tipe.includes(term);
    });
  }, [visitList, q]);

  function handleSelect(item: Row | null) {
    onChange(item);
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
          error && "border-danger"
        )}
      >
        <View className="flex-1 mr-2 flex-row items-center gap-2">
          <Handshake size={16} color={displayLabel ? colors.primary : colors.muted} />
          <Text
            className={cn("text-base md:text-sm flex-1", !displayLabel && "text-muted-foreground")}
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
          style={Platform.select({ web: { width: "min(96vw, 1150px)", maxWidth: "1150px" } as any })}
        >
          <DialogHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Handshake size={20} color={colors.primary} />
                <DialogTitle>Pilih Kunjungan / Meeting</DialogTitle>
              </View>
            </View>
          </DialogHeader>

          {/* Search bar */}
          <View className="bg-input border-border h-10 flex-row items-center gap-2 rounded-lg border px-3 mt-2">
            <Search size={16} color={colors.muted} />
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Cari berdasarkan nomor visit, judul, klien, atau tipe..."
              autoFocus
              className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
            />
          </View>

          {/* Table */}
          <View className="border border-border/80 rounded-xl overflow-hidden mt-3 bg-card flex-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
              <View className="flex-1 min-w-[760px]">
                {/* Header */}
                <View className="flex-row items-center bg-muted/60 px-4 py-2.5 border-b border-border/70 text-xs font-bold text-muted-foreground">
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/3 min-w-[220px]">Nomor & Aktivitas Visit</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-1/4 min-w-[180px] px-2">Klien / Instansi</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-36 px-2">Jenis & Tanggal</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground flex-1 min-w-[120px] px-2 text-center">Status</Text>
                  <Text className="text-[11px] font-bold text-muted-foreground w-20 text-center">Aksi</Text>
                </View>

                {/* Rows */}
                <ScrollView className="max-h-[50vh]" contentContainerClassName="divide-y divide-border/40">
                  {allowClear && (
                    <Pressable
                      onPress={() => handleSelect(null)}
                      className="p-3.5 hover:bg-muted/30 active:bg-muted/50 flex-row items-center justify-between"
                    >
                      <Text className="text-xs font-medium text-muted-foreground">
                        - Tanpa Kunjungan (Kosongkan) -
                      </Text>
                      {(!visitId && !value) && <Check size={16} color={colors.primary} />}
                    </Pressable>
                  )}

                  {filteredList.map((v) => {
                    const isSelected = selectedVisit?.id === v.id;
                    const no = v.nomor || v.number || `VISIT #${v.id}`;
                    const judul = v.judul || v.title || "Aktivitas Kunjungan";
                    const klien = v.klien || v.customer || "-";
                    const tgl = v.tanggal || v.createdAt || "";

                    return (
                      <Pressable
                        key={v.id}
                        onPress={() => handleSelect(v)}
                        className={cn(
                          "p-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex-row items-center justify-between gap-2",
                          isSelected && "bg-primary/10"
                        )}
                      >
                        {/* Kolom 1: Nomor & Aktivitas */}
                        <View className="w-1/3 min-w-[220px]">
                          <Text className={cn("text-xs font-bold font-mono text-foreground", isSelected && "text-primary")}>
                            {no}
                          </Text>
                          <Text className="text-[11px] text-muted-foreground mt-0.5" numberOfLines={2}>
                            {judul}
                          </Text>
                        </View>

                        {/* Kolom 2: Klien / Instansi */}
                        <View className="w-1/4 min-w-[180px] px-2">
                          <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                            {klien}
                          </Text>
                          {v.lokasi ? (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <MapPin size={10} color={colors.muted} />
                              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>{v.lokasi}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Kolom 3: Jenis & Tanggal */}
                        <View className="w-36 px-2">
                          <Text className="text-xs text-foreground font-medium">{v.tipe || "Meeting"}</Text>
                          {tgl ? (
                            <Text className="text-[11px] text-muted-foreground mt-0.5">{formatDate(tgl)}</Text>
                          ) : null}
                        </View>

                        {/* Kolom 4: Status */}
                        <View className="flex-1 min-w-[120px] px-2 items-center">
                          <StatusBadge status={v.status || "Planned"} />
                        </View>

                        {/* Kolom 5: Aksi */}
                        <View className="w-20 items-center">
                          {isSelected ? (
                            <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/15 rounded-md">
                              <Check size={12} color={colors.primary} />
                              <Text className="text-[11px] font-bold text-primary">Dipilih</Text>
                            </View>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2.5">
                              <Text className="text-[11px] font-semibold text-muted-foreground">Pilih</Text>
                            </Button>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  {filteredList.length === 0 && (
                    <View className="p-8 items-center justify-center gap-2">
                      <Text className="text-sm font-semibold text-muted-foreground">
                        Tidak ada data kunjungan yang cocok dengan &quot;{q}&quot;
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
