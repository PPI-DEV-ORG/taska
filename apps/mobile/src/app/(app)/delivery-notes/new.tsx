import * as React from "react";
import { View, Pressable, Platform, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Check, Info, Trash2, Package, ScanLine, Plus, CheckCircle2, AlertCircle } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { StatusBadge } from "@/components/taska/status-badge";
import { SerialItemPickerModal } from "@/components/taska/serial-item-picker";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { colors } from "@/tokens";
import type { QuotationItem } from "@/modules/quotation/types";
import { Row } from "@/constants/modules";

function playScanBeep(ok: boolean) {
  if (Platform.OS !== "web") return;
  try {
    const AC = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.12);
  } catch {}
}

export default function NewDeliveryNoteScreen() {
  const router = useRouter();
  const { data, user, addRow, toast, refreshModule, pushHistory } = useApp();
  const fileHandle = React.useRef<FileUploaderHandle | null>(null);

  const [tanggalSj, setTanggalSj] = React.useState(new Date().toISOString().slice(0, 10));
  const [tujuan, setTujuan] = React.useState("");
  const [alasan, setAlasan] = React.useState("");
  const [selectedProject, setSelectedProject] = React.useState("-");
  const [selectedSoOption, setSelectedSoOption] = React.useState("-");
  const [hasGoods, setHasGoods] = React.useState(false);
  const [items, setItems] = React.useState<QuotationItem[]>([]);
  const [checklistRequirements, setChecklistRequirements] = React.useState<
    {
      productId?: number;
      name: string;
      sku?: string;
      targetQty: number;
      unit: string;
    }[]
  >([]);
  const [pickerFilterProductId, setPickerFilterProductId] = React.useState<number | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [showAllItems, setShowAllItems] = React.useState(false);

  React.useEffect(() => {
    if (!data.projects || data.projects.length === 0) {
      void refreshModule("projects");
    }
    if (!data["po-client"] || data["po-client"].length === 0) {
      void refreshModule("po-client");
    }
    if (!data.serials || data.serials.length === 0) {
      void refreshModule("serials");
    }
    if (!data.products || data.products.length === 0) {
      void refreshModule("products");
    }
  }, []);

  const poClient = data["po-client"];

  const soList = React.useMemo(() => {
    const list = poClient ?? [];
    return list.filter((so: Row) => {
      if (so.isSupplierPo) return false;
      if (so.docMode === "PO" && (!so.nomorSo || so.nomorSo === "-")) return false;
      return true;
    });
  }, [poClient]);

  const selectedSo = React.useMemo(() => {
    if (!selectedSoOption || selectedSoOption === "-") return null;
    return (
      soList.find((so: Row) => {
        const soNum = (so.nomorSo && so.nomorSo !== "-") ? so.nomorSo : (so.nomor || `SO #${so.id}`);
        return selectedSoOption.startsWith(soNum) || String(so.id) === selectedSoOption;
      }) ?? null
    );
  }, [soList, selectedSoOption]);

  const soOptions = React.useMemo(() => {
    return [
      "-",
      ...soList.map((so: Row) => {
        const soNum = (so.nomorSo && so.nomorSo !== "-") ? so.nomorSo : (so.nomor || `SO #${so.id}`);
        const cust = so.customer && so.customer !== "-" ? ` — ${so.customer}` : "";
        const count = Array.isArray(so.items) && so.items.length > 0 ? ` (${so.items.length} item)` : "";
        return `${soNum}${cust}${count}`;
      }),
    ];
  }, [soList]);

  const projectOptions = React.useMemo(() => {
    const projects = Array.isArray(data.projects) ? data.projects : [];
    return [
      "-",
      ...projects
        .map((p: any) => {
          const name = String(p.nama ?? p.name ?? p.projectName ?? "").trim();
          if (!name) return "";
          const cust = p.customer && p.customer !== "-" && !name.includes(p.customer) ? ` (${p.customer})` : "";
          return `${name}${cust}`;
        })
        .filter((name: string) => name.length > 0),
    ];
  }, [data.projects]);

  // Scanner barcode cepat
  const [scanInput, setScanInput] = React.useState("");
  const [scanFeedback, setScanFeedback] = React.useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const scanInputRef = React.useRef<TextInput>(null);

  const activeProject = React.useMemo(() => {
    if (!selectedProject || selectedProject === "-") return null;
    return (data.projects ?? []).find((p) => {
      const name = String(p.nama ?? p.name ?? "").trim();
      const cust = p.customer && p.customer !== "-" && !name.includes(p.customer) ? ` (${p.customer})` : "";
      const opt = `${name}${cust}`;
      return p.nama === selectedProject || opt === selectedProject || String(p.id) === selectedProject;
    });
  }, [data.projects, selectedProject]);

  const contextInvoiceIds = React.useMemo(() => {
    const set = new Set<string>();
    const projId = activeProject?.id ? String(activeProject.id) : null;
    const projName = activeProject?.nama ? String(activeProject.nama).toLowerCase() : null;
    const quoId = activeProject?.quotationId ? String(activeProject.quotationId) : (selectedSo?.quotationId ? String(selectedSo.quotationId) : null);
    const soId = selectedSo?.id ? String(selectedSo.id) : null;

    for (const inv of (data.invoices ?? [])) {
      const matchProj = (projId && String(inv.projectId) === projId) || (projName && String(inv.project || "").toLowerCase() === projName);
      const matchQuo = quoId && String(inv.quotationId) === quoId;
      const matchSo = soId && (String(inv.clientPoId) === soId || String(inv.soId) === soId);

      if (matchProj || matchQuo || matchSo) {
        set.add(String(inv.id));
        if (inv.nomor) set.add(String(inv.nomor).toLowerCase());
        if (inv.number) set.add(String(inv.number).toLowerCase());
      }
    }
    return Array.from(set);
  }, [activeProject, selectedSo, data.invoices]);

  function handleSelectSo(val: string) {
    setSelectedSoOption(val);
    if (!val || val === "-") return;
    const match = soList.find((so: Row) => {
      const soNum = (so.nomorSo && so.nomorSo !== "-") ? so.nomorSo : (so.nomor || `SO #${so.id}`);
      return val.startsWith(soNum) || String(so.id) === val;
    });
    if (match) {
      if (!tujuan.trim() && match.customer && match.customer !== "-") {
        setTujuan(match.customer);
      }
      const soNum = (match.nomorSo && match.nomorSo !== "-") ? match.nomorSo : match.nomor;
      if (!alasan.trim() || alasan.startsWith("Pengiriman barang untuk Sales Order")) {
        setAlasan(`Pengiriman barang untuk Sales Order ${soNum}`);
      }
      if (match.projectId || match.project) {
        const projMatch = (data.projects ?? []).find(
          (p: Row) => (match.projectId && String(p.id) === String(match.projectId)) || p.nama === match.project
        );
        if (projMatch) {
          const name = String(projMatch.nama ?? projMatch.name ?? "").trim();
          const cust = projMatch.customer && projMatch.customer !== "-" && !name.includes(projMatch.customer) ? ` (${projMatch.customer})` : "";
          setSelectedProject(`${name}${cust}`);
        }
      }
      if (Array.isArray(match.items) && match.items.length > 0) {
        setHasGoods(true);
        const checklist = match.items.map((it: any) => ({
          productId: it.productId ? Number(it.productId) : undefined,
          name: it.item || it.name || "Barang",
          sku: it.sku,
          targetQty: Number(it.qty || 1),
          unit: it.satuan || it.unit || "unit",
        }));
        setChecklistRequirements(checklist);
        toast(`Target kebutuhan (${checklist.length} item) dari Sales Order dimuat`);
        setTimeout(() => scanInputRef.current?.focus(), 150);
      }
    }
  }

  function handleSelectProject(val: string) {
    setSelectedProject(val);
    if (!val || val === "-") return;
    const projMatch = (data.projects ?? []).find((p) => {
      const name = String(p.nama ?? p.name ?? "").trim();
      const cust = p.customer && p.customer !== "-" && !name.includes(p.customer) ? ` (${p.customer})` : "";
      const opt = `${name}${cust}`;
      return p.nama === val || opt === val || String(p.id) === val;
    });
    if (projMatch) {
      if (!tujuan.trim() && projMatch.customer && projMatch.customer !== "-") {
        setTujuan(projMatch.customer);
      }
      if (!alasan.trim() || alasan.startsWith("Pengiriman material untuk project")) {
        setAlasan(`Pengiriman material untuk project ${projMatch.nama || projMatch.name}`);
      }
      api<any>("GET", `/projects/${projMatch.id}/requirements`)
        .then((res) => {
          const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
          if (list.length > 0) {
            setHasGoods(true);
            const checklist = list.map((r: any) => ({
              productId: r.product?.id ? Number(r.product.id) : r.productId ? Number(r.productId) : undefined,
              name: r.product?.name || r.name || "Barang",
              sku: r.product?.sku || r.sku,
              targetQty: Number(r.neededQty ?? r.qty ?? 1),
              unit: r.product?.unit || r.unit || "unit",
            }));
            setChecklistRequirements(checklist);
            toast(`Target kebutuhan (${checklist.length} item) dari Project dimuat`);
            setTimeout(() => scanInputRef.current?.focus(), 150);
          }
        })
        .catch(() => {});
    }
  }

  function handleQuickScan(rawText: string) {
    const tokens = rawText
      .split(/[\r\n,;\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0);

    if (tokens.length === 0) return;

    const existingSnSet = new Set<string>();
    items.forEach((it) => {
      if (Array.isArray(it.serialNumbers)) {
        it.serialNumbers.forEach((s) => existingSnSet.add(String(s).trim().toUpperCase()));
      }
      const match = String(it.item).match(/\(SN:\s*([^\)]+)\)/i);
      if (match?.[1]) existingSnSet.add(match[1].trim().toUpperCase());
    });

    const serialsList: any[] = data.serials ?? [];
    const productsList: any[] = data.products ?? [];

    let addedCount = 0;
    const addedNames: string[] = [];
    const dupSns: string[] = [];
    const notFound: string[] = [];
    const newItems: QuotationItem[] = [];

    for (const token of tokens) {
      // 1. Cek apakah token cocok dengan Serial Number di master serial
      const snMatch = serialsList.find((s) => String(s.sn || "").trim().toUpperCase() === token);
      if (snMatch) {
        const cleanSn = String(snMatch.sn).trim().toUpperCase();
        if (existingSnSet.has(cleanSn)) {
          dupSns.push(cleanSn);
          continue;
        }

        const prod = productsList.find(
          (p) => String(p.id) === String(snMatch.productId) || p.nama === snMatch.produk
        );
        const prodName = prod?.nama || snMatch.produk || "Barang";
        const satuan = prod?.satuan || "unit";

        existingSnSet.add(cleanSn);
        addedCount++;
        addedNames.push(`${prodName} (${cleanSn})`);

        newItems.push({
          id: `gds-${Date.now()}-${snMatch.id}-${Math.random().toString(36).slice(2, 6)}`,
          item: `${prodName} (SN: ${snMatch.sn})`,
          qty: 1,
          satuan,
          harga: Number(prod?.hargaJual || prod?.harga || 0),
          kind: "GOODS",
          productId: prod?.id ? Number(prod.id) : snMatch.productId ? Number(snMatch.productId) : undefined,
          sku: prod?.sku || snMatch.sku || undefined,
          hasSerial: true,
          serialUnitIds: [Number(snMatch.id)],
          serialNumbers: [String(snMatch.sn)],
        });
        continue;
      }

      // 2. Cek apakah token cocok dengan SKU, kode, atau nama produk master
      const prodMatch = productsList.find(
        (p) =>
          String(p.sku || "").trim().toUpperCase() === token ||
          String(p.kode || "").trim().toUpperCase() === token ||
          String(p.nama || "").trim().toUpperCase() === token
      );

      if (prodMatch) {
        if (prodMatch.berSN) {
          // Cari unit SN yang tersedia di gudang yang belum terpilih
          const availSn = serialsList.find(
            (s) =>
              (String(s.productId) === String(prodMatch.id) || s.produk === prodMatch.nama) &&
              !existingSnSet.has(String(s.sn).trim().toUpperCase()) &&
              (s.rawStatus === "DI_GUDANG" || s.rawStatus === "RESERVED" || s.status === "Di gudang" || s.status === "Reserved")
          );

          if (availSn) {
            const cleanSn = String(availSn.sn).trim().toUpperCase();
            existingSnSet.add(cleanSn);
            addedCount++;
            addedNames.push(`${prodMatch.nama} (${cleanSn})`);

            newItems.push({
              id: `gds-${Date.now()}-${availSn.id}-${Math.random().toString(36).slice(2, 6)}`,
              item: `${prodMatch.nama} (SN: ${availSn.sn})`,
              qty: 1,
              satuan: prodMatch.satuan || "unit",
              harga: Number(prodMatch.hargaJual || prodMatch.harga || 0),
              kind: "GOODS",
              productId: Number(prodMatch.id),
              sku: prodMatch.sku || undefined,
              hasSerial: true,
              serialUnitIds: [Number(availSn.id)],
              serialNumbers: [String(availSn.sn)],
            });
            continue;
          } else {
            notFound.push(`${token} (Semua SN Di Gudang sudah terpakai)`);
            continue;
          }
        } else {
          // Non-SN / curah: tambahkan atau increment
          const existingIdx = items.findIndex((it) => Number(it.productId) === Number(prodMatch.id));
          if (existingIdx >= 0) {
            setItems((prev) =>
              prev.map((it, i) => (i === existingIdx ? { ...it, qty: Number(it.qty) + 1 } : it))
            );
            addedCount++;
            addedNames.push(`${prodMatch.nama} (+1)`);
            continue;
          } else {
            addedCount++;
            addedNames.push(`${prodMatch.nama}`);
            newItems.push({
              id: `gds-${Date.now()}-${prodMatch.id}`,
              item: prodMatch.nama,
              qty: 1,
              satuan: prodMatch.satuan || "unit",
              harga: Number(prodMatch.hargaJual || prodMatch.harga || 0),
              kind: "GOODS",
              productId: Number(prodMatch.id),
              sku: prodMatch.sku || undefined,
              hasSerial: false,
            });
            continue;
          }
        }
      }

      notFound.push(token);
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      setHasGoods(true);
    }

    if (addedCount > 0) {
      playScanBeep(true);
      let msg = `✓ ${addedCount} unit berhasil discan & terpilih otomatis: ${addedNames.slice(0, 3).join(", ")}${addedNames.length > 3 ? ` (+${addedNames.length - 3} lainnya)` : ""}`;
      if (dupSns.length > 0) msg += ` · (${dupSns.length} sudah di daftar)`;
      setScanFeedback({ type: "success", message: msg });
    } else if (dupSns.length > 0 && notFound.length === 0) {
      playScanBeep(false);
      setScanFeedback({
        type: "warning",
        message: `SN sudah ada di daftar barang: ${dupSns.join(", ")}`,
      });
    } else {
      playScanBeep(false);
      setScanFeedback({
        type: "error",
        message: `Tidak ditemukan di master: ${notFound.join(", ")}`,
      });
    }

    setScanInput("");
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 50);
  }

  async function submit() {
    if (!tujuan.trim()) {
      toast("Tujuan wajib diisi", "danger");
      return;
    }
    if (!alasan.trim()) {
      toast("Alasan dinas/keluar kantor wajib diisi", "danger");
      return;
    }
    if (hasGoods && items.length === 0) {
      toast("Tambahkan minimal satu barang yang dibawa", "danger");
      return;
    }

    let fileId: number | undefined;
    try {
      fileId = (await fileHandle.current?.flush()) ?? undefined;
    } catch {
      return;
    }

    const itemsSummary = items
      .map((it) => {
        const sns = Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 ? it.serialNumbers : [];
        const snSuffix = sns.length > 0 ? ` (SN: ${sns.join(", ")})` : "";
        return `${it.item} x ${it.qty}${it.satuan ? ` ${it.satuan}` : ""}${snSuffix}`;
      })
      .join(", ");

    const itemsList = items
      .filter((it) => it.productId || it.kind === "GOODS")
      .map((it) => {
        const sns = Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 ? it.serialNumbers : [];
        return {
          productId: it.productId ? Number(it.productId) : undefined,
          qty: Number(it.qty) || 1,
          serials: sns.length > 0 ? sns.join(", ") : undefined,
          note: it.item,
        };
      })
      .filter((i) => i.productId && !Number.isNaN(i.productId));

    const soNum = selectedSo
      ? (selectedSo.nomorSo && selectedSo.nomorSo !== "-")
        ? selectedSo.nomorSo
        : (selectedSo.nomor || `SO #${selectedSo.id}`)
      : undefined;
    const soTag = selectedSo?.id ? ` [so:${selectedSo.id}]` : "";
    const cleanAlasan = alasan.trim();
    const finalAlasan = selectedSo
      ? (cleanAlasan.includes("[so:") ? cleanAlasan : `${cleanAlasan || `Pengiriman Barang SO ${soNum}`}${soTag}`)
      : cleanAlasan;

    const row = {
      nomor: `SJ/${new Date().getFullYear()}/${Math.floor(Math.random() * 800) + 100}`,
      tanggal: tanggalSj,
      tujuan,
      alasan: finalAlasan,
      project: activeProject?.nama || (selectedProject !== "-" ? selectedProject : "-"),
      projectId: activeProject?.id ? Number(activeProject.id) : undefined,
      soId: selectedSo?.id ? Number(selectedSo.id) : undefined,
      soNumber: soNum,
      clientPoId: selectedSo?.id ? Number(selectedSo.id) : undefined,
      pembuat: user?.name || "Karyawan",
      barang: hasGoods && items.length > 0 ? itemsSummary : "-",
      withGoods: hasGoods && items.length > 0,
      reportText: hasGoods && items.length > 0 ? itemsSummary : undefined,
      items: hasGoods && itemsList.length > 0 ? itemsList : undefined,
      status: "Pending",
      persetujuan: "Menunggu persetujuan",
      fileId,
      scanFileId: fileId ? Number(fileId) : undefined,
    };

    await addRow("delivery-notes", row);
    if (selectedSo?.id) {
      pushHistory("po-client", String(selectedSo.id), `Surat jalan ${row.nomor} dibuat untuk pengiriman barang`);
    }
    if (activeProject?.id) {
      pushHistory("projects", String(activeProject.id), `Surat jalan ${row.nomor} dibuat`);
    }
    router.replace("/delivery-notes");
  }

  return (
    <View className="max-w-2xl self-center w-full gap-5">
      <PageHeader
        back
        title="Buat Surat Jalan"
        subtitle="Untuk setiap aktivitas tugas kerja ke luar kantor"
      />

      <View className="bg-panel/40 border-border flex-row items-center gap-2 rounded-xl border p-3">
        <Info size={18} color={colors.info} />
        <Text className="text-text-secondary text-xs flex-1">
          Surat jalan dibuat setiap kali karyawan keluar untuk urusan pekerjaan (survey, meeting, antar barang, instalasi). Keluar hanya untuk beli makan atau jajan tidak perlu surat jalan.
        </Text>
      </View>

      <Panel title="Detail Tujuan & Alasan Tugas">
        <View className="gap-4">
          <FormField label="Tanggal Surat Jalan" required>
            <DatePicker
              value={tanggalSj}
              onChange={setTanggalSj}
              placeholder="Pilih tanggal"
            />
          </FormField>

          <FormField label="Lokasi Tujuan (Bisa lebih dari 1 lokasi)" required>
            <Input
              value={tujuan}
              onChangeText={setTujuan}
              placeholder="Contoh: Gedung Wisma Sudirman Lt. 8 & Ruko Bekasi"
            />
          </FormField>

          <FormField label="Alasan / Keperluan Kerja" required hint="Alasan wajib diisi secara jelas">
            <Textarea
              value={alasan}
              onChangeText={setAlasan}
              placeholder="Contoh: Instalasi reader access control lantai 3 & survey jalur kabel"
            />
          </FormField>

          <FormField label="Terkait Sales Order (SO) (Opsional)" hint="Pilih SO bila surat jalan ini untuk pengiriman pesanan penjualan barang">
            <SearchableSelect
              value={selectedSoOption}
              onChange={handleSelectSo}
              options={soOptions}
              placeholder="Pilih Sales Order (SO) jika ada..."
            />
          </FormField>

          <FormField label="Terkait Project (Opsional)" hint="Pilih project jika penugasan ini untuk pekerjaan proyek tertentu">
            <SearchableSelect
              value={selectedProject}
              onChange={handleSelectProject}
              options={projectOptions}
              placeholder="Pilih project jika ada..."
            />
          </FormField>
        </View>
      </Panel>

      <Panel
        title="Barang yang Dibawa"
        subtitle={hasGoods ? "Surat jalan membawa barang fisik / unit ber-SN dari gudang" : "Surat jalan boleh dengan barang atau tanpa barang"}
        right={
          <View className="flex-row items-center gap-2">
            {hasGoods && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => setPickerOpen(true)}
                className="flex-row items-center gap-1.5 border-primary/40 bg-primary/5"
              >
                <Plus size={14} color={colors.primary} />
                <Text className="text-xs font-semibold text-primary">Pilih dari Stok</Text>
              </Button>
            )}
            <Button
              variant={hasGoods ? "outline" : "default"}
              size="sm"
              onPress={() => {
                const next = !hasGoods;
                setHasGoods(next);
                if (!next) setItems([]);
              }}
            >
              <Text>{hasGoods ? "Tanpa Barang" : "Membawa Barang"}</Text>
            </Button>
          </View>
        }
      >
        {hasGoods ? (
          <View className="gap-3.5">
            {/* Checklist Kebutuhan Dokumen Sumber */}
            {checklistRequirements.length > 0 && (
              <View className="bg-card border border-border rounded-xl p-3.5 gap-2.5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <Package size={15} color={colors.primary} />
                    <Text className="text-xs font-bold text-foreground">
                      Target Kebutuhan Pengiriman ({checklistRequirements.length} item)
                    </Text>
                  </View>
                  <Text className="text-[11px] text-muted-foreground">
                    Scan SN atau pilih unit fisik di bawah hingga terpenuhi
                  </Text>
                </View>

                <View className="divide-y divide-border/60 border border-border/60 rounded-lg overflow-hidden">
                  {checklistRequirements.map((req, idx) => {
                    const picked = items
                      .filter(
                        (it) =>
                          (req.productId && Number(it.productId) === req.productId) ||
                          it.item.toLowerCase().includes(req.name.toLowerCase())
                      )
                      .reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
                    const remaining = Math.max(0, req.targetQty - picked);
                    const isComplete = picked >= req.targetQty;

                    return (
                      <View key={idx} className="p-2.5 flex-row items-center justify-between gap-3 bg-card/40">
                        <View className="flex-1 min-w-0">
                          <View className="flex-row items-center gap-2 flex-wrap">
                            <Text className="text-xs font-semibold text-foreground">{req.name}</Text>
                            {req.sku ? (
                              <View className="bg-panel border border-border/60 rounded px-1.5 py-0.5">
                                <Text className="text-[10px] font-mono text-muted-foreground">{req.sku}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="text-[11px] text-muted-foreground mt-0.5">
                            Target: {req.targetQty} {req.unit} · Terpilih: {picked} {req.unit}{" "}
                            {remaining > 0 ? `· Kurang: ${remaining} ${req.unit}` : ""}
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                          <View
                            className={`px-2 py-0.5 rounded-full border ${
                              isComplete
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : "bg-amber-500/10 border-amber-500/30"
                            }`}
                          >
                            <Text
                              className={`text-[10px] font-semibold ${
                                isComplete
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {isComplete ? "✓ Terpenuhi" : `Kurang ${remaining}`}
                            </Text>
                          </View>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 flex-row items-center gap-1 border-primary/40 bg-primary/5"
                            onPress={() => {
                              setPickerFilterProductId(req.productId);
                              setPickerOpen(true);
                            }}
                          >
                            <Plus size={11} color={colors.primary} />
                            <Text className="text-[11px] font-semibold text-primary">Pilih Unit</Text>
                          </Button>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Box Scanner Langsung */}
            <View className="p-3 rounded-xl border border-primary/40 bg-primary/5 gap-2">
              <View className="flex-row items-center justify-between flex-wrap gap-2">
                <View className="flex-row items-center gap-1.5">
                  <ScanLine size={16} color={colors.primary} />
                  <Text className="text-xs font-bold text-primary">
                    Scan Barcode / SN Langsung (Barang Otomatis Terpilih)
                  </Text>
                </View>
                <Text className="text-[11px] text-muted-foreground">
                  Arahkan scanner ke barcode SN / ketik lalu Enter
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <View className="flex-1 bg-background border border-border focus:border-primary rounded-lg flex-row items-center px-3 h-10">
                  <ScanLine size={16} color={colors.muted} style={{ marginRight: 6 }} />
                  <TextInput
                    ref={scanInputRef}
                    value={scanInput}
                    onChangeText={setScanInput}
                    onSubmitEditing={() => handleQuickScan(scanInput)}
                    placeholder="Scan barcode SN / ketik SN langsung lalu Enter..."
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    style={{ flex: 1, color: colors.text, fontSize: 13, outlineStyle: "none" } as any}
                  />
                  {scanInput.trim().length > 0 && (
                    <Pressable onPress={() => setScanInput("")} hitSlop={8} className="p-1">
                      <Text className="text-xs text-muted-foreground font-bold">✕</Text>
                    </Pressable>
                  )}
                </View>
                <Button
                  size="sm"
                  className="h-10 px-4 bg-primary"
                  disabled={!scanInput.trim()}
                  onPress={() => handleQuickScan(scanInput)}
                >
                  <Text className="text-xs text-white font-semibold">Scan / Tambah</Text>
                </Button>
              </View>

              {scanFeedback && (
                <View
                  className={`flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
                    scanFeedback.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : scanFeedback.type === "warning"
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-danger/10 border-danger/30"
                  }`}
                >
                  {scanFeedback.type === "success" ? (
                    <CheckCircle2 size={13} color={colors.success} />
                  ) : (
                    <AlertCircle size={13} color={scanFeedback.type === "warning" ? colors.warning : colors.danger} />
                  )}
                  <Text
                    className={`text-xs flex-1 ${
                      scanFeedback.type === "success"
                        ? "text-emerald-700 dark:text-emerald-300 font-medium"
                        : scanFeedback.type === "warning"
                        ? "text-amber-700 dark:text-amber-300 font-medium"
                        : "text-danger font-medium"
                    }`}
                  >
                    {scanFeedback.message}
                  </Text>
                </View>
              )}
            </View>

            {items.length === 0 ? (
              <View className="border border-dashed border-border/80 rounded-xl p-5 items-center justify-center gap-2 bg-muted/10">
                <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center">
                  <Package size={18} color={colors.primary} />
                </View>
                <Text className="text-xs font-semibold text-foreground text-center">
                  Belum ada barang yang ditambahkan
                </Text>
                <Text className="text-[11px] text-muted-foreground text-center max-w-sm">
                  Langsung scan barcode SN di atas atau klik tombol di bawah untuk memilih dari master stok.
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => setPickerOpen(true)}
                  className="mt-1 flex-row items-center gap-1.5"
                >
                  <Plus size={13} color={colors.primary} />
                  <Text className="text-xs font-medium text-primary">Pilih Manual dari Stok Gudang</Text>
                </Button>
              </View>
            ) : (
              <View className="gap-2.5">
                <View className="flex-row items-center justify-between pb-1 border-b border-border/40">
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Daftar Barang & Jumlah ({items.length} item)
                  </Text>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 flex-row items-center gap-1"
                    onPress={() => setPickerOpen(true)}
                  >
                    <Plus size={12} color={colors.primary} />
                    <Text className="text-xs font-medium text-primary">Pilih dari Stok</Text>
                  </Button>
                </View>

                {(showAllItems ? items : items.slice(0, 10)).map((it, idx) => {
                  const prod = it.productId ? data.products.find((p) => Number(p.id) === Number(it.productId)) : null;
                  const isSerial = it.hasSerial || (Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0);
                  const snList = Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 ? it.serialNumbers : [];

                  return (
                    <View
                      key={it.id || idx}
                      className="bg-card border-border/70 rounded-xl border p-3 gap-2"
                    >
                      <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2 flex-wrap">
                            <Text className="text-sm font-semibold text-foreground">
                              {it.item}
                            </Text>
                            {prod?.merk ? (
                              <View className="bg-panel border-border/60 rounded px-1.5 py-0.5 border">
                                <Text className="text-[10px] font-medium text-muted-foreground">{prod.merk}</Text>
                              </View>
                            ) : null}
                            {it.sku ? (
                              <View className="bg-panel border-border/60 rounded px-1.5 py-0.5 border">
                                <Text className="text-[10px] font-mono text-muted-foreground">{it.sku}</Text>
                              </View>
                            ) : null}
                          </View>
                          <View className="flex-row items-center gap-2 mt-1 flex-wrap">
                            <Text className="text-xs text-muted-foreground">
                              Satuan: {it.satuan || "unit"} {isSerial ? "· Lacak SN" : "· Curah / Non-SN"}
                            </Text>
                            {snList.length > 0 && (
                              <StatusBadge status={`SN: ${snList.join(", ")}`} />
                            )}
                          </View>
                        </View>

                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs text-muted-foreground">Qty:</Text>
                          {isSerial ? (
                            <View className="w-14 h-8 items-center justify-center rounded-md bg-muted/40 border border-border/60">
                              <Text className="text-xs font-bold text-foreground">{it.qty}</Text>
                            </View>
                          ) : (
                            <Input
                              value={String(it.qty ?? 1)}
                              onChangeText={(v) => {
                                const q = Math.max(1, Number(v.replace(/\D/g, "")) || 1);
                                setItems((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, qty: q } : item))
                                );
                              }}
                              keyboardType="numeric"
                              className="w-16 h-8 text-center text-xs font-semibold"
                            />
                          )}
                          <Pressable
                            onPress={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                            hitSlop={8}
                            className="size-8 items-center justify-center rounded-lg hover:bg-danger/10 active:bg-danger/10"
                          >
                            <Trash2 size={15} color={colors.danger} />
                          </Pressable>
                        </View>
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
                      {showAllItems ? "Sembunyikan" : `Lihat Semua (${items.length} item)`}
                    </Text>
                  </Button>
                )}
              </View>
            )}
          </View>
        ) : (
          <Text className="text-muted-foreground text-sm">
            Surat jalan ini tidak membawa barang (hanya keperluan dinas luar/meeting/survey).
          </Text>
        )}
      </Panel>

      <SerialItemPickerModal
        open={pickerOpen}
        mode="serial"
        onClose={() => {
          setPickerOpen(false);
          setPickerFilterProductId(undefined);
        }}
        currentProjectId={activeProject?.id}
        currentQuotationId={activeProject?.quotationId ?? selectedSo?.quotationId}
        allowedInvoiceIds={contextInvoiceIds}
        initialProductId={pickerFilterProductId}
        existingItems={items}
        onAddItems={(newItems) => {
          setPickerOpen(false);
          setPickerFilterProductId(undefined);
          const existingSnSet = new Set<string>();
          items.forEach((it) => {
            if (Array.isArray(it.serialNumbers)) it.serialNumbers.forEach((s) => existingSnSet.add(String(s).trim().toUpperCase()));
            const snVal = String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1]?.trim();
            if (snVal) existingSnSet.add(snVal.toUpperCase());
          });
          const valid: QuotationItem[] = [];
          const duplicates: string[] = [];
          newItems.forEach((it) => {
            const snList: string[] = [];
            if (Array.isArray(it.serialNumbers)) it.serialNumbers.forEach((s) => snList.push(String(s).trim().toUpperCase()));
            const snVal = String(it.item).match(/\(SN:\s*([^\)]+)\)/i)?.[1]?.trim();
            if (snVal) snList.push(snVal.toUpperCase());
            const hasDup = snList.some((s) => existingSnSet.has(s));
            if (hasDup) {
              duplicates.push(snList.join(", "));
            } else {
              snList.forEach((s) => existingSnSet.add(s));
              valid.push(it);
            }
          });
          if (duplicates.length > 0) {
            toast(`Item dengan SN (${duplicates.join(", ")}) sudah ada di daftar`, "danger");
          }
          if (valid.length > 0) {
            setItems((prev) => [...prev, ...valid]);
            setHasGoods(true);
          }
        }}
      />

      <Panel title="Lampiran / Surat Jalan Bertandatangan">
        <FileUploader
          label="Upload Dokumen Pendukung (Opsional)"
          kind="semua"
          category="surat-jalan"
          handleRef={(h) => { fileHandle.current = h; }}
        />
      </Panel>

      <Button size="lg" onPress={submit}>
        <Check size={18} color={colors.background} />
        <Text>Ajukan Surat Jalan</Text>
      </Button>
    </View>
  );
}
