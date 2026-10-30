import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Check, PackageCheck, Plus, Trash2, Box, Barcode, Store, FileText, Clock } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import type { Row } from "@/constants/modules";

interface ReceivingLineItem {
  id: string;
  productId: number;
  qty: number;
  serials: string[];
  snInput: string;
  notes: string;
  hasSerial?: boolean;
}

type SourceType = "DRAFT" | "REQUEST" | "PO" | "DIRECT";

export default function NewReceivingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ receivingId?: string; requestId?: string; poId?: string }>();
  const { data, user, addRow, patchRow, toast } = useApp();

  const pos = data["supplier-pos"] || [];
  const warehouses = data.warehouses || [];
  const products: Row[] = data.products || [];
  const categories = data.productCategories || [];
  const receivings = data.receiving || [];
  const purchaseRequests = data["purchase-requests"] || [];

  // Filter draft receivings yang menunggu diproses gudang
  const pendingReceivings = receivings.filter(
    (r) =>
      r.status === "Menunggu penerimaan" ||
      r.status === "Menunggu" ||
      r.rawStatus === "MENUNGGU" ||
      String(r.status || "").toLowerCase().includes("menunggu")
  );

  // Filter purchase requests yang relevan
  const eligibleRequests = purchaseRequests.filter((r) =>
    ["Dikirim", "Disetujui", "Dibayar", "DIKIRIM", "DISETUJUI", "DIBAYAR"].includes(String(r.status || r.rawStatus))
  );

  // Penentuan tipe sumber awal berdasarkan parameter URL atau keberadaan draft
  const initialSourceType: SourceType = React.useMemo(() => {
    if (params.receivingId) return "DRAFT";
    if (params.requestId) return "REQUEST";
    if (params.poId) return "PO";
    if (pendingReceivings.length > 0) return "DRAFT";
    return "PO";
  }, [params.receivingId, params.requestId, params.poId, pendingReceivings.length]);

  const [sourceType, setSourceType] = React.useState<SourceType>(initialSourceType);

  // Draft Receiving selection
  const [selectedDraftId, setSelectedDraftId] = React.useState<string>(() => {
    if (params.receivingId) return String(params.receivingId);
    return pendingReceivings[0]?.id ? String(pendingReceivings[0].id) : "";
  });

  // Request selection
  const [selectedReqId, setSelectedReqId] = React.useState<string>(() => {
    if (params.requestId) return String(params.requestId);
    return eligibleRequests[0]?.id ? String(eligibleRequests[0].id) : "";
  });

  // PO selection
  const [selectedPo, setSelectedPo] = React.useState<string>(() => {
    if (params.poId) {
      const match = pos.find((p) => String(p.id) === String(params.poId) || p.nomor === params.poId);
      if (match) return match.nomor;
    }
    return pos[0]?.nomor || "";
  });

  function getPoLineItems(poNumber: string): ReceivingLineItem[] | null {
    const selected = pos.find((p) => p.nomor === poNumber);
    const poItems = (selected as any)?._items || (selected as any)?.items || [];
    if (!Array.isArray(poItems) || poItems.length === 0) return null;
    return poItems.map((pi: any, idx: number) => {
      const matchedProd = products.find((p) => Number(p.id) === Number(pi.productId));
      return {
        id: `po-item-${idx}`,
        productId: Number(pi.productId) || Number(matchedProd?.id) || 1,
        qty: Number(pi.qty) || 1,
        serials: [],
        snInput: "",
        notes: "",
      };
    });
  }

  function getDraftLineItems(receivingRow: Row): ReceivingLineItem[] {
    const rawItems = (receivingRow as any)?._items || (receivingRow as any)?.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return [
        {
          id: `draft-item-0`,
          productId: Number(products[0]?.id) || 1,
          qty: 1,
          serials: [],
          snInput: "",
          notes: "",
        },
      ];
    }
    return rawItems.map((it: any, idx: number) => {
      const matchedProd = products.find(
        (p) =>
          Number(p.id) === Number(it.productId) ||
          String(p.nama).toLowerCase() === String(it.productName || it.name || "").toLowerCase()
      );
      const isSn = it.hasSerial !== undefined
        ? !!it.hasSerial
        : (matchedProd?.berSN !== undefined || matchedProd?.hasSerial !== undefined
          ? !!(matchedProd.berSN || matchedProd.hasSerial)
          : true);
      const rawSerials = it.serials ? String(it.serials).split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      return {
        id: `draft-item-${idx}`,
        productId: Number(it.productId) || Number(matchedProd?.id) || Number(products[0]?.id) || 1,
        qty: Number(it.qtyReceived ?? it.qtyGood ?? it.qtyOrdered ?? 1),
        serials: rawSerials,
        snInput: rawSerials.join("\n"),
        notes: it.note || "",
        hasSerial: isSn,
      };
    });
  }

  function getRequestLineItems(reqRow: Row): ReceivingLineItem[] {
    const rawItems = (reqRow as any)?._items || (reqRow as any)?.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return [
        {
          id: `req-item-0`,
          productId: Number(products[0]?.id) || 1,
          qty: 1,
          serials: [],
          snInput: "",
          notes: "",
        },
      ];
    }
    return rawItems.map((it: any, idx: number) => {
      const matchedProd = products.find(
        (p) =>
          Number(p.id) === Number(it.productId) ||
          String(p.nama).toLowerCase() === String(it.name || it.item || "").toLowerCase()
      );
      const isSn = it.hasSerial !== undefined
        ? !!it.hasSerial
        : (matchedProd?.berSN !== undefined || matchedProd?.hasSerial !== undefined
          ? !!(matchedProd.berSN || matchedProd.hasSerial)
          : true);
      return {
        id: `req-item-${idx}`,
        productId: Number(it.productId) || Number(matchedProd?.id) || Number(products[0]?.id) || 1,
        qty: Number(it.qty || 1),
        serials: [],
        snInput: "",
        notes: it.notes || it.keterangan || "",
        hasSerial: isSn,
      };
    });
  }

  const initialDraft = receivings.find((r) => String(r.id) === String(params.receivingId || selectedDraftId)) || pendingReceivings[0];
  const initialReq = purchaseRequests.find((r) => String(r.id) === String(params.requestId || selectedReqId)) || eligibleRequests[0];

  const [directSupplier, setDirectSupplier] = React.useState<string>(() => {
    if (initialSourceType === "DRAFT" && initialDraft) {
      return String(initialDraft.supplier || initialDraft.supplierName || "-");
    }
    if (initialSourceType === "REQUEST" && initialReq) {
      return String(initialReq.supplier || "Supplier Ritel");
    }
    return "";
  });

  const [selectedGudang, setSelectedGudang] = React.useState<string>(() => {
    if (initialSourceType === "DRAFT" && initialDraft && (initialDraft.warehouse || initialDraft.gudang)) {
      return String(initialDraft.warehouse || initialDraft.gudang);
    }
    return warehouses[0]?.nama || "Gudang Utama Jakarta";
  });

  const [tanggalTerima, setTanggalTerima] = React.useState(new Date().toISOString().slice(0, 10));

  const [notes, setNotes] = React.useState<string>(() => {
    if (initialSourceType === "DRAFT" && initialDraft?.conditionNote) {
      return String(initialDraft.conditionNote);
    }
    if (initialSourceType === "REQUEST" && initialReq) {
      return `Ref Request: ${initialReq.nomor} — ${initialReq.purpose || initialReq.tujuan || ""}`;
    }
    return "";
  });

  const fileHandle = React.useRef<FileUploaderHandle | null>(null);

  // Line items initial state
  const [items, setItems] = React.useState<ReceivingLineItem[]>(() => {
    if (initialSourceType === "DRAFT" && initialDraft) {
      return getDraftLineItems(initialDraft);
    }
    if (initialSourceType === "REQUEST" && initialReq) {
      return getRequestLineItems(initialReq);
    }
    if (initialSourceType === "PO") {
      const poLines = getPoLineItems(selectedPo);
      if (poLines) return poLines;
    }
    return [
      {
        id: "item-1",
        productId: Number(products[0]?.id) || 1,
        qty: 1,
        serials: [],
        snInput: "",
        notes: "",
      },
    ];
  });

  function handleSelectSourceType(type: SourceType) {
    setSourceType(type);
    if (type === "DRAFT") {
      const targetDraft = receivings.find((r) => String(r.id) === String(selectedDraftId)) || pendingReceivings[0];
      if (targetDraft) {
        if (targetDraft.warehouse || targetDraft.gudang) {
          setSelectedGudang(String(targetDraft.warehouse || targetDraft.gudang));
        }
        setDirectSupplier(String(targetDraft.supplier || targetDraft.supplierName || "-"));
        if (targetDraft.conditionNote) setNotes(String(targetDraft.conditionNote));
        setItems(getDraftLineItems(targetDraft));
      }
    } else if (type === "REQUEST") {
      const targetReq = purchaseRequests.find((r) => String(r.id) === String(selectedReqId)) || eligibleRequests[0];
      if (targetReq) {
        setDirectSupplier(String(targetReq.supplier || "Supplier Ritel"));
        setNotes(`Ref Request: ${targetReq.nomor} — ${targetReq.purpose || targetReq.tujuan || ""}`);
        setItems(getRequestLineItems(targetReq));
      }
    } else if (type === "PO") {
      const poItems = getPoLineItems(selectedPo);
      if (poItems) setItems(poItems);
    }
  }

  function handleSelectDraft(draftId: string) {
    setSelectedDraftId(draftId);
    const targetDraft = receivings.find((r) => String(r.id) === String(draftId));
    if (targetDraft) {
      if (targetDraft.warehouse || targetDraft.gudang) {
        setSelectedGudang(String(targetDraft.warehouse || targetDraft.gudang));
      }
      setDirectSupplier(String(targetDraft.supplier || targetDraft.supplierName || "-"));
      if (targetDraft.conditionNote) setNotes(String(targetDraft.conditionNote));
      setItems(getDraftLineItems(targetDraft));
    }
  }

  function handleSelectRequest(reqId: string) {
    setSelectedReqId(reqId);
    const targetReq = purchaseRequests.find((r) => String(r.id) === String(reqId));
    if (targetReq) {
      setDirectSupplier(String(targetReq.supplier || "Supplier Ritel"));
      setNotes(`Ref Request: ${targetReq.nomor} — ${targetReq.purpose || targetReq.tujuan || ""}`);
      setItems(getRequestLineItems(targetReq));
    }
  }

  function handleSelectPo(poNum: string) {
    setSelectedPo(poNum);
    const poItems = getPoLineItems(poNum);
    if (poItems) setItems(poItems);
  }

  // Modal Tambah Produk Baru ke Master
  const [newProductOpen, setNewProductOpen] = React.useState(false);
  const [newNama, setNewNama] = React.useState("");
  const [newMerk, setNewMerk] = React.useState("");
  const [newSku, setNewSku] = React.useState("");
  const [newKategori, setNewKategori] = React.useState(categories[0]?.nama ? String(categories[0].nama) : "Kamera CCTV");
  const [newSatuan, setNewSatuan] = React.useState("unit");
  const [newHasSerial, setNewHasSerial] = React.useState(true);
  const [newHargaBeli, setNewHargaBeli] = React.useState("");

  // Modal Tambah Kategori Baru Cepat
  const [newCatOpen, setNewCatOpen] = React.useState(false);
  const [quickCatNama, setQuickCatNama] = React.useState("");

  function handleSaveQuickCategory() {
    if (!quickCatNama.trim()) {
      toast("Nama kategori wajib diisi", "danger");
      return;
    }
    const catName = quickCatNama.trim();
    addRow("productCategories", {
      nama: catName,
      status: "Aktif",
    });
    setNewKategori(catName);
    setNewCatOpen(false);
    setQuickCatNama("");
    toast(`Kategori ${catName} berhasil ditambahkan`);
  }

  const po = pos.find((p) => p.nomor === selectedPo);
  const selectedDraft = receivings.find((r) => String(r.id) === String(selectedDraftId));
  const selectedReq = purchaseRequests.find((r) => String(r.id) === String(selectedReqId));

  function handleAddItem() {
    const nextProd = products[0];
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        productId: Number(nextProd?.id) || 1,
        qty: 1,
        serials: [],
        snInput: "",
        notes: "",
      },
    ]);
  }

  function handleRemoveItem(id: string) {
    if (items.length <= 1) {
      toast("Minimal 1 item penerimaan barang", "danger");
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function handleUpdateItem(id: string, patch: Partial<ReceivingLineItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function handleSaveNewProduct() {
    if (!newNama.trim() || !newSku.trim()) {
      toast("Nama produk dan SKU wajib diisi", "danger");
      return;
    }
    const cat = categories.find((c) => String(c.nama) === newKategori);
    const createdSku = newSku.trim().toUpperCase();
    const createdProd = {
      nama: newNama.trim(),
      sku: createdSku,
      merk: newMerk.trim() || undefined,
      brand: newMerk.trim() || undefined,
      kategori: newKategori,
      categoryId: cat?.id ? Number(cat.id) : undefined,
      satuan: newSatuan,
      unit: newSatuan,
      berSN: newHasSerial,
      hasSerial: newHasSerial,
      hargaBeli: Number(newHargaBeli.replace(/\D/g, "")) || 0,
      min: 5,
    };

    addRow("products", createdProd);
    setNewProductOpen(false);
    toast(`Produk ${newNama} berhasil ditambahkan ke master`);

    setNewNama("");
    setNewMerk("");
    setNewSku("");
    setNewHargaBeli("");
  }

  async function submit() {
    if (sourceType === "DRAFT" && !selectedDraftId) {
      toast("Pilih data draft penerimaan yang ingin dilanjutkan", "danger");
      return;
    }
    if (sourceType === "REQUEST" && !selectedReqId) {
      toast("Pilih request barang terlebih dahulu", "danger");
      return;
    }
    if (sourceType === "PO" && !selectedPo) {
      toast("Pilih PO Supplier terlebih dahulu", "danger");
      return;
    }
    if (sourceType === "DIRECT" && !directSupplier.trim()) {
      toast("Isi nama supplier / toko penerimaan langsung", "danger");
      return;
    }
    if (items.length === 0) {
      toast("Pilih minimal 1 barang untuk diterima", "danger");
      return;
    }

    // Validate SN for serialized items: pastikan jumlah SN persis sama dengan Qty
    for (const line of items) {
      const prod = products.find((p) => Number(p.id) === line.productId);
      const isSn = line.hasSerial !== undefined
        ? !!line.hasSerial
        : (prod?.berSN !== undefined || prod?.hasSerial !== undefined
          ? !!(prod.berSN || prod.hasSerial)
          : false);

      if (isSn) {
        const rawSns = line.serials.length > 0
          ? line.serials
          : line.snInput
              .split(/[\n,;]+/)
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean);
        if (rawSns.length === 0) {
          toast(`Serial Number untuk produk ${prod?.nama || "Barang"} wajib diisi (${line.qty} unit)`, "danger");
          return;
        }
        if (rawSns.length !== line.qty) {
          toast(
            `Jumlah Serial Number (${rawSns.length} SN) tidak sesuai dengan Qty penerimaan (${line.qty} unit) untuk produk ${prod?.nama || "Barang"}`,
            "danger"
          );
          return;
        }
      }
    }

    const fileId = (await fileHandle.current?.flush()) ?? undefined;
    const wh = warehouses.find((w) => w.nama === selectedGudang);

    const payloadItems = items.map((line) => {
      const prod = products.find((p) => Number(p.id) === line.productId);
      const isSn = !!(prod?.berSN || prod?.hasSerial);
      const sns = line.serials.length > 0
        ? line.serials
        : line.snInput
            .split(/[\n,;]+/)
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);

      return {
        productId: line.productId,
        qtyReceived: line.qty,
        qtyOrdered: line.qty,
        serials: isSn && sns.length > 0 ? sns.join(",") : undefined,
        note: line.notes || undefined,
      };
    });

    const itemsSummary = items
      .map((line) => {
        const prod = products.find((p) => Number(p.id) === line.productId);
        const satuan = prod?.satuan || "unit";
        return `${prod?.nama || "Produk"} x ${line.qty} ${satuan}`;
      })
      .join(", ");

    // Alur 1: Melanjutkan Draft Penerimaan yang sudah ada
    if (sourceType === "DRAFT" && selectedDraft) {
      const effectiveFileId = fileId ?? selectedDraft.fileId;
      await patchRow("receiving", String(selectedDraft.id), {
        status: "DITERIMA",
        conditionNote: notes || selectedDraft.conditionNote,
        catatan: notes || selectedDraft.conditionNote,
        warehouseId: wh?.id ? Number(wh.id) : undefined,
        items: payloadItems,
        ...(effectiveFileId ? { fileId: effectiveFileId, receiptFileId: effectiveFileId, photoFileId: effectiveFileId } : {}),
      });

      // Update Purchase Request jika ada relasi
      const rawReqId = selectedDraft.requestId || selectedDraft.requestNumber;
      const targetReq = (data["purchase-requests"] ?? []).find(
        (r) => String(r.id) === String(rawReqId) || r.nomor === rawReqId
      );
      const effReqId = targetReq?.id ?? (rawReqId && !isNaN(Number(rawReqId)) ? rawReqId : null);
      if (effReqId) {
        await patchRow("purchase-requests", String(effReqId), {
          status: "DITERIMA",
          ...(effectiveFileId ? { doFileId: effectiveFileId } : {}),
        }).catch(() => {});
      }

      // Update PO Supplier jika ada relasi
      if (selectedDraft.supplierPoId && String(selectedDraft.supplierPoId) !== "-") {
        await patchRow("supplier-pos", String(selectedDraft.supplierPoId), {
          status: "Sampai",
          pengiriman: "Sampai",
          ...(effectiveFileId ? { doFileId: effectiveFileId } : {}),
        }).catch(() => {});
      }

      toast("Penerimaan barang berhasil diproses! Stok bertambah dan dokumen diperbarui.");
      router.replace("/stock");
      return;
    }

    // Alur 2: Dari Purchase Request Langsung
    if (sourceType === "REQUEST" && selectedReq) {
      const row = {
        nomor: `TB/${new Date().getFullYear()}/${Math.floor(Math.random() * 800) + 100}`,
        requestId: Number(selectedReq.id),
        supplier: selectedReq.supplier || "Supplier Ritel",
        supplierName: selectedReq.supplier || "Supplier Ritel",
        gudang: selectedGudang,
        warehouseId: wh?.id ? Number(wh.id) : undefined,
        item: itemsSummary,
        items: payloadItems,
        tanggal: tanggalTerima,
        penerima: user?.name || "Petugas Gudang",
        status: "Diterima",
        catatan: notes,
        fileId,
        receiptFileId: fileId,
        photoFileId: fileId,
      };

      await addRow("receiving", row);
      await patchRow("purchase-requests", String(selectedReq.id), {
        status: "DITERIMA",
        ...(fileId ? { doFileId: fileId } : {}),
      }).catch(() => {});

      toast("Penerimaan dari Request Barang berhasil disimpan & stok bertambah!");
      router.replace("/stock");
      return;
    }

    // Alur 3 & 4: PO Supplier atau Direct
    const row = {
      nomor: `TB/${new Date().getFullYear()}/${Math.floor(Math.random() * 800) + 100}`,
      po: sourceType === "PO" ? selectedPo : "-",
      supplierPoId: sourceType === "PO" && po?.id ? Number(po.id) : undefined,
      supplierName: sourceType === "DIRECT" ? directSupplier.trim() : (po?.supplier || "-"),
      supplier: sourceType === "DIRECT" ? directSupplier.trim() : (po?.supplier || "-"),
      gudang: selectedGudang,
      warehouseId: wh?.id ? Number(wh.id) : undefined,
      item: itemsSummary,
      items: payloadItems,
      tanggal: tanggalTerima,
      penerima: user?.name || "Petugas Gudang",
      status: "Diterima",
      catatan: notes,
      fileId,
      receiptFileId: fileId,
      photoFileId: fileId,
    };

    await addRow("receiving", row);
    if (sourceType === "PO" && po?.id) {
      await patchRow("supplier-pos", String(po.id), {
        ...(fileId ? { doFileId: fileId } : {}),
        pengiriman: "Sampai",
        status: "Sampai",
      }).catch(() => {});
    }

    toast("Penerimaan barang berhasil disimpan, stok bertambah & DO terhubung ke PO");
    router.replace("/stock");
  }

  return (
    <View className="max-w-3xl self-center w-full gap-5 pb-12">
      <PageHeader
        back
        title="Penerimaan Barang (Gudang)"
        subtitle="Verifikasi fisik barang tiba, update stok otomatis, dan catat Serial Number"
      />

      {/* Panel 1: Sumber & Pengirim Barang */}
      <Panel title="Sumber Kedatangan Barang">
        <View className="gap-4">
          <View className="flex-row flex-wrap gap-2">
            <Button
              size="sm"
              variant={sourceType === "DRAFT" ? "default" : "outline"}
              onPress={() => handleSelectSourceType("DRAFT")}
              className="flex-1 min-w-[140px]"
            >
              <Clock size={16} color={sourceType === "DRAFT" ? colors.background : colors.text} />
              <Text>Lanjutkan Draft ({pendingReceivings.length})</Text>
            </Button>
            <Button
              size="sm"
              variant={sourceType === "REQUEST" ? "default" : "outline"}
              onPress={() => handleSelectSourceType("REQUEST")}
              className="flex-1 min-w-[140px]"
            >
              <FileText size={16} color={sourceType === "REQUEST" ? colors.background : colors.text} />
              <Text>Dari Request ({eligibleRequests.length})</Text>
            </Button>
            <Button
              size="sm"
              variant={sourceType === "PO" ? "default" : "outline"}
              onPress={() => handleSelectSourceType("PO")}
              className="flex-1 min-w-[140px]"
            >
              <PackageCheck size={16} color={sourceType === "PO" ? colors.background : colors.text} />
              <Text>Dari PO Supplier</Text>
            </Button>
            <Button
              size="sm"
              variant={sourceType === "DIRECT" ? "default" : "outline"}
              onPress={() => handleSelectSourceType("DIRECT")}
              className="flex-1 min-w-[140px]"
            >
              <Store size={16} color={sourceType === "DIRECT" ? colors.background : colors.text} />
              <Text>Penerimaan Langsung</Text>
            </Button>
          </View>

          {sourceType === "DRAFT" ? (
            <FormField label="Pilih Data Penerimaan yang Sedang Menunggu" required>
              {pendingReceivings.length === 0 ? (
                <View className="bg-panel/40 border border-border/80 rounded-xl p-3">
                  <Text className="text-xs text-muted-foreground">
                    Tidak ada draft penerimaan berstatus Menunggu saat ini. Anda dapat memilih sumber &quot;Dari Request&quot; atau &quot;Dari PO Supplier&quot;.
                  </Text>
                </View>
              ) : (
                <SearchableSelect
                  value={
                    selectedDraft
                      ? `${selectedDraft.nomor} — ${selectedDraft.supplier || selectedDraft.supplierName || "Supplier"}`
                      : ""
                  }
                  onChange={(label) => {
                    const match = pendingReceivings.find(
                      (d) => `${d.nomor} — ${d.supplier || d.supplierName || "Supplier"}` === label
                    );
                    if (match) handleSelectDraft(String(match.id));
                  }}
                  options={pendingReceivings.map((d) => `${d.nomor} — ${d.supplier || d.supplierName || "Supplier"}`)}
                  placeholder="Pilih nomor draft penerimaan"
                />
              )}
            </FormField>
          ) : sourceType === "REQUEST" ? (
            <FormField label="Pilih Purchase Request yang Sudah Disetujui / Dikirim" required>
              <SearchableSelect
                value={
                  selectedReq
                    ? `${selectedReq.nomor} — ${selectedReq.purpose || selectedReq.tujuan || "Request"}`
                    : ""
                }
                onChange={(label) => {
                  const match = eligibleRequests.find(
                    (r) => `${r.nomor} — ${r.purpose || r.tujuan || "Request"}` === label
                  );
                  if (match) handleSelectRequest(String(match.id));
                }}
                options={eligibleRequests.map((r) => `${r.nomor} — ${r.purpose || r.tujuan || "Request"}`)}
                placeholder="Pilih nomor purchase request"
              />
            </FormField>
          ) : sourceType === "PO" ? (
            <FormField label="Pilih PO Supplier" required>
              <SearchableSelect
                value={selectedPo}
                onChange={(value) => handleSelectPo(value)}
                options={pos.map((p) => p.nomor)}
                placeholder="Pilih nomor PO"
              />
            </FormField>
          ) : (
            <FormField label="Nama Supplier / Toko / Vendor" required>
              <Input
                value={directSupplier}
                onChangeText={setDirectSupplier}
                placeholder="Contoh: PT Hikvision Pratama / Toko Listrik Glodok"
              />
            </FormField>
          )}

          {sourceType === "DRAFT" && selectedDraft && (
            <View className="bg-panel/50 border-border rounded-xl border p-3.5 gap-1.5">
              <Text className="text-text-secondary text-xs">Informasi Draft Penerimaan:</Text>
              <Text className="text-sm font-semibold">{selectedDraft.supplier || selectedDraft.supplierName || "-"}</Text>
              {selectedDraft.requestNumber && selectedDraft.requestNumber !== "-" && (
                <Text className="text-xs text-primary font-medium">Ref Request: {selectedDraft.requestNumber}</Text>
              )}
              {selectedDraft.po && selectedDraft.po !== "-" && (
                <Text className="text-xs text-muted-foreground">Ref PO: {selectedDraft.po}</Text>
              )}
              <Text className="text-muted-foreground text-xs">Ringkasan Barang: {selectedDraft.item || "-"}</Text>
            </View>
          )}

          {sourceType === "REQUEST" && selectedReq && (
            <View className="bg-panel/50 border-border rounded-xl border p-3.5 gap-1.5">
              <Text className="text-text-secondary text-xs">Informasi Request Barang:</Text>
              <Text className="text-sm font-semibold">{selectedReq.nomor} — {selectedReq.tujuan || selectedReq.purpose}</Text>
              <Text className="text-xs text-muted-foreground">Supplier: {selectedReq.supplier || "Supplier Ritel"}</Text>
              <Text className="text-xs text-muted-foreground">Item: {selectedReq.item || "-"}</Text>
            </View>
          )}

          {sourceType === "PO" && po && (
            <View className="bg-panel/50 border-border rounded-xl border p-3.5 gap-1.5">
              <Text className="text-text-secondary text-xs">Informasi PO Supplier:</Text>
              <Text className="text-sm font-semibold">{po.supplier}</Text>
              <Text className="text-muted-foreground text-xs">Barang PO: {po.item || "-"}</Text>
            </View>
          )}

          <View className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Gudang Penerima" required>
              <SearchableSelect
                value={selectedGudang}
                onChange={setSelectedGudang}
                options={warehouses.map((w) => String(w.nama))}
                placeholder="Pilih gudang penerima"
              />
            </FormField>

            <FormField label="Tanggal Penerimaan" required>
              <DatePicker
                value={tanggalTerima}
                onChange={setTanggalTerima}
                placeholder="Pilih tanggal terima"
              />
            </FormField>
          </View>

          <FormField label="Catatan Kondisi Fisik / Nomor DO Supplier">
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Contoh: No DO DO-2026/089, kardus utuh, segel baik"
            />
          </FormField>
        </View>
      </Panel>

      {/* Panel 2: Rincian Produk yang Tiba */}
      <Panel
        title={`Rincian Barang yang Diterima (${items.length} Barang)`}
        subtitle="Barang otomatis terisi dari dokumen referensi, verifikasi kuantitas & Serial Number"
        right={
          <View className="flex-row gap-2">
            <Button size="sm" variant="outline" onPress={() => setNewProductOpen(true)}>
              <Plus size={14} color={colors.text} />
              <Text className="text-xs">+ Produk Baru</Text>
            </Button>
            <Button size="sm" onPress={handleAddItem}>
              <Plus size={14} color={colors.background} />
              <Text className="text-xs">Tambah Baris</Text>
            </Button>
          </View>
        }
      >
        <View className="gap-4">
          {items.map((line, idx) => {
            const prod = products.find((p) => Number(p.id) === line.productId);
            const isSerial = line.hasSerial !== undefined
              ? !!line.hasSerial
              : (prod?.berSN !== undefined || prod?.hasSerial !== undefined
                ? !!(prod.berSN || prod.hasSerial)
                : true);
            const satuan = prod?.satuan || prod?.unit || "unit";

            return (
              <View
                key={line.id}
                className="bg-card border-border/80 rounded-2xl border p-4 gap-3.5 shadow-sm"
              >
                <View className="flex-row items-center justify-between pb-2 border-b border-border/50">
                  <View className="flex-row items-center gap-2">
                    <View className="size-6 rounded-full bg-primary/10 items-center justify-center">
                      <Text className="text-xs font-bold text-primary">{idx + 1}</Text>
                    </View>
                    <Text className="text-sm font-bold text-foreground">
                      {prod?.nama || "Pilih Produk"}
                    </Text>
                    {prod?.merk || prod?.brand ? (
                      <View className="bg-panel border-border/60 rounded px-1.5 py-0.5 border">
                        <Text className="text-[10px] font-medium text-muted-foreground">{prod.merk || prod.brand}</Text>
                      </View>
                    ) : null}
                  </View>

                  {items.length > 1 && (
                    <Pressable
                      onPress={() => handleRemoveItem(line.id)}
                      hitSlop={8}
                      className="size-7 items-center justify-center rounded-lg hover:bg-danger/10"
                    >
                      <Trash2 size={15} color={colors.danger} />
                    </Pressable>
                  )}
                </View>

                {/* Pilih Produk & Jumlah */}
                <View className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <View className="md:col-span-2">
                    <FormField label="Pilih Produk Master" required>
                      <SearchableSelect
                        value={prod?.nama ? String(prod.nama) : ""}
                        onChange={(name) => {
                          const found = products.find((p) => p.nama === name);
                          if (found) handleUpdateItem(line.id, { productId: Number(found.id) });
                        }}
                        options={products.map((p) => String(p.nama))}
                        placeholder="Cari nama produk / SKU"
                      />
                    </FormField>
                  </View>

                  <FormField label={`Jumlah (${satuan})`} required>
                    <Input
                      value={String(line.qty)}
                      onChangeText={(v) => handleUpdateItem(line.id, { qty: Math.max(1, Number(v.replace(/\D/g, "")) || 1) })}
                      keyboardType="numeric"
                      placeholder="1"
                    />
                  </FormField>
                </View>

                {/* Serial Number atau Badge Curah dengan Toggle */}
                {isSerial ? (
                  <View className="bg-panel/40 border-border/70 rounded-xl border p-3 gap-2">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1.5">
                        <Barcode size={15} color={colors.primary} />
                        <Text className="text-xs font-semibold text-foreground">
                          Serial Number (Wajib diisi {line.qty} SN)
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-[11px] text-muted-foreground">Pisahkan dengan koma atau baris baru</Text>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => handleUpdateItem(line.id, { hasSerial: false })}
                          className="h-6 px-2"
                        >
                          <Text className="text-[10px] text-muted-foreground">Ubah ke Curah</Text>
                        </Button>
                      </View>
                    </View>
                    <Textarea
                      value={line.snInput}
                      onChangeText={(v) => handleUpdateItem(line.id, { snInput: v })}
                      placeholder={`Contoh: SN-${prod?.sku || "DEV"}-001\nSN-${prod?.sku || "DEV"}-002`}
                      numberOfLines={2}
                    />
                    {(() => {
                      const count = line.snInput.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).length;
                      const isMatch = count === line.qty;
                      return (
                        <Text
                          className={`text-[11px] ${
                            isMatch ? "text-success font-medium" : "text-amber-500 font-semibold"
                          }`}
                        >
                          {isMatch
                            ? `✓ ${count} dari ${line.qty} SN dimasukkan (Pas)`
                            : `Perhatian: ${count} dari ${line.qty} SN dimasukkan (${count < line.qty ? "Kurang" : "Kelebihan"} ${Math.abs(count - line.qty)} SN)`}
                        </Text>
                      );
                    })()}
                  </View>
                ) : (
                  <View className="bg-success/10 border-success/30 rounded-xl border p-3 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1">
                      <Box size={16} color={colors.success} />
                      <Text className="text-xs text-success font-medium">
                        Barang Curah / Kolektif: Tidak memerlukan SN. Stok akan dicatat sebanyak {line.qty} {satuan}.
                      </Text>
                    </View>
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => handleUpdateItem(line.id, { hasSerial: true })}
                      className="h-6 px-2"
                    >
                      <Text className="text-[10px] text-primary font-medium">+ Input SN</Text>
                    </Button>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Panel>

      {/* Panel 3: File DO & Foto Dokumentasi */}
      <Panel title="File Delivery Order (DO) & Foto Dokumentasi">
        <FileUploader
          label="Upload File DO / Surat Jalan Supplier & Bukti Fisik (Gambar / PDF)"
          kind="semua"
          accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
          allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
          hint="Mendukung Gambar (JPG, PNG, WEBP) atau Dokumen PDF. File DO otomatis terhubung ke Penerimaan, Request Barang, dan PO Supplier."
          category="penerimaan"
          handleRef={(h) => { fileHandle.current = h; }}
        />
      </Panel>

      {/* Tombol Simpan */}
      <Button size="lg" onPress={submit} className="h-12">
        <Check size={18} color={colors.background} />
        <Text className="font-bold">Simpan Penerimaan & Masukkan ke Stok</Text>
      </Button>

      {/* Modal Quick Add Product */}
      <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Produk Baru ke Master Data</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Nama Produk / Barang" required>
              <Input
                value={newNama}
                onChangeText={setNewNama}
                placeholder="Contoh: IP Camera 4MP Bullet UNV"
              />
            </FormField>

            <View className="grid grid-cols-2 gap-3">
              <FormField label="Merk / Brand (Pabrikan)">
                <Input
                  value={newMerk}
                  onChangeText={setNewMerk}
                  placeholder="Contoh: Uniview, Belden"
                />
              </FormField>

            <FormField label="Kode SKU" required>
              <Input
                value={newSku}
                onChangeText={setNewSku}
                placeholder="Contoh: CAM-UNV-4K"
              />
            </FormField>
            </View>

            <View className="grid grid-cols-2 gap-3">
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-medium text-foreground">Kategori Produk *</Text>
                  <Pressable onPress={() => setNewCatOpen(true)} hitSlop={6}>
                    <Text className="text-[11px] font-semibold text-primary">+ Kategori</Text>
                  </Pressable>
                </View>
                <SearchableSelect
                  value={newKategori}
                  onChange={setNewKategori}
                  options={categories.map((c) => String(c.nama))}
                />
              </View>

              <FormField label="Unit Satuan" required>
                <SearchableSelect
                  value={newSatuan}
                  onChange={setNewSatuan}
                  options={["unit", "roll", "meter", "box", "pcs", "pack", "set"]}
                />
              </FormField>
            </View>

            <FormField label="Lacak Serial Number (SN)" required>
              <View className="flex-row gap-2">
                <Button
                  size="sm"
                  variant={newHasSerial ? "default" : "outline"}
                  onPress={() => setNewHasSerial(true)}
                  className="flex-1"
                >
                  <Text>Ya (Ada SN)</Text>
                </Button>
                <Button
                  size="sm"
                  variant={!newHasSerial ? "default" : "outline"}
                  onPress={() => setNewHasSerial(false)}
                  className="flex-1"
                >
                  <Text>Tidak (Barang Curah/Kabel)</Text>
                </Button>
              </View>
            </FormField>

            <FormField label="Estimasi Harga Beli (Rp)">
              <Input
                value={newHargaBeli}
                onChangeText={(v) => setNewHargaBeli(v.replace(/\D/g, ""))}
                keyboardType="numeric"
                placeholder="Contoh: 750000"
              />
            </FormField>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={() => setNewProductOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveNewProduct}>
              <Text>Simpan ke Master</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Quick Add Category */}
      <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Kategori Produk Baru</DialogTitle>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Nama Kategori Produk" required>
              <Input
                value={quickCatNama}
                onChangeText={setQuickCatNama}
                placeholder="Contoh: Switch & Networking"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setNewCatOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveQuickCategory}>
              <Text>Simpan Kategori</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
