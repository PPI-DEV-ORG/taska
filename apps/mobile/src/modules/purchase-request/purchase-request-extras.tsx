import * as React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, FileText, PackageCheck, Plus, Truck, Wallet, XCircle, Ban } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Panel, FormField } from "@/components/taska/basics";
import { FileUploader } from "@/components/taska/file-uploader";
import { FlowTracker, NextStepCard } from "@/components/taska/flow-tracker";
import { SearchableSelect, DatePicker, QuickAddSupplierDialog, SupplierSelect } from "@/components/taska/dialogs";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah, formatThousands } from "@/lib/format";
import { type Row } from "@/constants/modules";
import { toEnum } from "@/services/adapters";
import { canOwnerAct } from "@/lib/flow";
import { evaluatePurchase, needsPrepayment, purchaseKind } from "@/lib/purchase-flow";

const SOURCE_LABEL = { SUPPLIER: "Via PO Pemasok", RETAIL: "Beli Ritel / Toko", GUDANG: "Ambil Stok Gudang" } as const;

/**
 * Detail request barang: satu pelacak alur + satu kartu "Langkah berikutnya".
 * Aturan urutan diverifikasi ulang di backend, jadi tombol di sini hanya muncul bila memang gilirannya.
 */
export function PurchaseRequestExtras({ row, onRefresh }: { row: Row; onRefresh?: () => Promise<void> | void }) {
  const router = useRouter();
  const { user, data, addRow, setStatus, toast, reload } = useApp();
  const [dialog, setDialog] = React.useState<null | "reject" | "pay" | "po" | "ship" | "receive" | "cancel">(null);
  const [reason, setReason] = React.useState("");
  const [proofId, setProofId] = React.useState<number | null>(null);
  const [fundingSource, setFundingSource] = React.useState("1000.01");
  const [busy, setBusy] = React.useState(false);
  const [quickSupplierOpen, setQuickSupplierOpen] = React.useState(false);
  const [poSupplierId, setPoSupplierId] = React.useState("");
  const [poTerms, setPoTerms] = React.useState("Utang / Tempo (Net 30)");
  const [poEta, setPoEta] = React.useState("");
  const [poTotal, setPoTotal] = React.useState("");

  const role = user?.role ?? "";
  const isRequester = String(row.pemohonId) === String(user?.id);
  const source = purchaseKind(row.procurementSource);
  const payMethod = String(row.paymentMethod || "UTANG").toUpperCase();
  const prepay = needsPrepayment(source, payMethod);

  const rawStatus = String(
    row.rawStatus || (row.status ? toEnum("purchase-requests", row.status) : "DIAJUKAN") || "DIAJUKAN",
  ).toUpperCase();

  const linkedPos: Row[] = React.useMemo(() => {
    const fromList = (data["supplier-pos"] ?? []).filter(
      (sp: Row) => sp.requestId != null && String(sp.requestId) === String(row.id),
    );
    if (fromList.length) return fromList;
    return Array.isArray(row.supplierPOs)
      ? row.supplierPOs.map((p: any) => ({ id: String(p.id), nomor: p.number, status: p.status, total: p.total }))
      : [];
  }, [data, row.id, row.supplierPOs]);
  const activePos = linkedPos.filter((p) => !/ditolak|dibatalkan/i.test(String(p.status)));
  const poApproved = activePos.some((p) => !/menunggu|MENUNGGU_PERSETUJUAN/i.test(String(p.status)));

  // Satu sumber (sama dengan backend): paymentStatus. Status DIBAYAR selalu ikut menyetelnya.
  const isPaid = rawStatus === "DIBAYAR" || String(row.paymentStatus || "").toUpperCase() === "DIBAYAR";

  const flow = React.useMemo(
    () =>
      evaluatePurchase({
        source,
        paymentMethod: payMethod,
        rawStatus,
        isPaid,
        poCount: activePos.length,
        poApproved,
        rejectReason: row.rejectReason,
      }),
    [source, payMethod, rawStatus, isPaid, activePos.length, poApproved, row.rejectReason],
  );

  const can = (key: string) => {
    const step = flow.actionable.find((s) => s.key === key);
    return !!step && canOwnerAct(step.owner, role, isRequester);
  };
  // PO baru boleh dibuat bila belum ada PO aktif; bayar boleh diulang untuk tempo setelah barang diterima.
  const canApprove = can("approve");
  const canPo = can("po") && activePos.length === 0;
  const canPay = can("pay") || can("settle");
  const canShip = can("ship");
  const canReceive = can("receive");
  const canCancel =
    !flow.stopped &&
    ["DIAJUKAN", "CEK_STOK", "DISETUJUI", "PO_DIBUAT"].includes(rawStatus) &&
    !isPaid &&
    activePos.length === 0 &&
    (isRequester || ["procurement", "finance", "bos", "admin", "super_admin"].includes(role));

  const items: any[] = Array.isArray(row.items) ? row.items : [];
  const stockInfo: any[] = Array.isArray(row.stock) ? row.stock : [];
  const receivings: Row[] = (data.receiving ?? []).filter(
    (rc: Row) =>
      (rc.requestId && String(rc.requestId) === String(row.id)) ||
      activePos.some((p) => String(rc.supplierPoId) === String(p.id)),
  );

  async function run(fn: () => Promise<void>, close = true) {
    setBusy(true);
    try {
      await fn();
      if (close) setDialog(null);
      if (onRefresh) await onRefresh();
      await reload();
    } catch (e: any) {
      toast(e?.message ?? "Gagal memproses", "danger");
    } finally {
      setBusy(false);
    }
  }

  const approve = () => run(() => setStatus("purchase-requests", row.id, "Disetujui"), false);
  const reject = () => {
    if (!reason.trim()) return toast("Alasan penolakan wajib diisi", "danger");
    return run(async () => {
      await setStatus("purchase-requests", row.id, "Ditolak", reason.trim());
      setReason("");
    });
  };
  const cancel = () => run(() => setStatus("purchase-requests", row.id, "Dibatalkan", reason.trim() || undefined));
  const pay = () => {
    if (!proofId) return toast("Unggah bukti pembayaran terlebih dahulu", "danger");
    return run(async () => {
      await setStatus("purchase-requests", row.id, "Dibayar", undefined, {
        paymentProofFileId: proofId,
        fundingSource,
        paymentStatus: "DIBAYAR",
      });
      setProofId(null);
    });
  };
  const ship = () =>
    run(() => setStatus("purchase-requests", row.id, "Dikirim"));
  const confirmStockReceived = () => run(() => setStatus("purchase-requests", row.id, "Diterima"));

  function openCreatePo() {
    const suppliers: Row[] = data.suppliers ?? [];
    const match =
      suppliers.find((s) => row.supplierId && String(s.id) === String(row.supplierId)) ??
      suppliers.find((s) => row.supplier && String(s.nama || s.name).toLowerCase() === String(row.supplier).toLowerCase());
    setPoSupplierId(match?.id ? String(match.id) : "");
    setPoTerms(prepay ? "Tunai / Kas" : "Utang / Tempo (Net 30)");
    setPoEta(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    setPoTotal(row.estimasi ? formatThousands(row.estimasi) : "");
    setDialog("po");
  }

  function submitPo() {
    const supplier = (data.suppliers ?? []).find((s: Row) => String(s.id) === String(poSupplierId));
    if (!supplier) return toast("Pilih pemasok terlebih dahulu", "danger");
    const total = Number(String(poTotal).replace(/\./g, "").replace(/,/g, ".")) || Number(row.estimasi) || 0;
    if (total <= 0) return toast("Total PO wajib diisi", "danger");
    return run(async () => {
      const perItem = items.length ? Math.round(total / items.length) : 0;
      await addRow("supplier-pos", {
        supplier: supplier.nama ?? supplier.name,
        supplierId: Number(supplier.id),
        request: row.nomor,
        requestId: Number(row.id),
        projectId: row.projectId != null ? Number(row.projectId) : undefined,
        project: row.project,
        payment: poTerms,
        paymentTerms: poTerms,
        item: row.item || row.tujuan || "Barang Permintaan",
        items: items.map((i: any) => ({
          productId: i.productId ? Number(i.productId) : undefined,
          customName: i.customName || undefined,
          customUnit: i.customUnit || undefined,
          qty: Number(i.qty) || 1,
          price: Number(i.unitCost) || perItem,
        })),
        total,
        eta: poEta || undefined,
      });
    });
  }

  function goReceive() {
    const pending = receivings.find((rc) => String(rc.rawStatus || rc.status).match(/MENUNGGU|Menunggu/));
    router.push(
      (pending
        ? `/receiving/new?receivingId=${pending.id}`
        : `/receiving/new?requestId=${row.id}${activePos[0] ? `&poId=${activePos[0].id}` : ""}`) as any,
    );
  }

  return (
    <>
      {/* 1. Ringkas: jenis & pembayaran */}
      <View className="flex-row flex-wrap gap-2">
        <Chip text={SOURCE_LABEL[source]} />
        {source !== "GUDANG" ? (
          <Chip text={prepay ? "Bayar dulu (Finance)" : "Tempo / Utang"} tone={prepay ? "info" : "warn"} />
        ) : null}
        {row.project && row.project !== "-" ? <Chip text={`Project: ${row.project}`} /> : null}
        {!prepay && source !== "GUDANG" && (row.dueDate || row.jatuhTempo) ? (
          <Chip text={`Jatuh tempo ${row.jatuhTempo || row.dueDate}`} tone="warn" />
        ) : null}
      </View>

      {/* 2. Langkah berikutnya + tombol aksi */}
      <NextStepCard flow={flow} role={role} isRequester={isRequester}>
        {canApprove ? (
          <>
            <Button size="sm" onPress={approve} disabled={busy} className="bg-emerald-600">
              <CheckCircle2 size={14} color="#fff" />
              <Text className="text-xs font-semibold text-white">Setujui</Text>
            </Button>
            <Button size="sm" variant="destructive" onPress={() => setDialog("reject")} disabled={busy}>
              <XCircle size={14} color="#fff" />
              <Text className="text-xs font-semibold">Tolak</Text>
            </Button>
          </>
        ) : null}
        {canPo ? (
          <Button size="sm" onPress={openCreatePo} disabled={busy}>
            <Plus size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">Buat PO Pemasok</Text>
          </Button>
        ) : null}
        {canPay ? (
          <Button size="sm" onPress={() => setDialog("pay")} disabled={busy} className="bg-emerald-600">
            <Wallet size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">{can("settle") ? "Lunasi Tagihan" : "Bayar & Unggah Bukti"}</Text>
          </Button>
        ) : null}
        {canShip ? (
          <Button size="sm" onPress={() => setDialog("ship")} disabled={busy} className="bg-sky-600">
            <Truck size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">{source === "GUDANG" ? "Serahkan Barang" : "Tandai Dikirim"}</Text>
          </Button>
        ) : null}
        {canReceive ? (
          source === "GUDANG" ? (
            <Button size="sm" onPress={() => setDialog("receive")} disabled={busy} className="bg-emerald-600">
              <PackageCheck size={14} color="#fff" />
              <Text className="text-xs font-semibold text-white">Konfirmasi Barang Diterima</Text>
            </Button>
          ) : (
            <Button size="sm" onPress={goReceive} disabled={busy} className="bg-emerald-600">
              <PackageCheck size={14} color="#fff" />
              <Text className="text-xs font-semibold text-white">Terima di Penerimaan Barang</Text>
            </Button>
          )
        ) : null}
        {canCancel ? (
          <Button size="sm" variant="outline" onPress={() => setDialog("cancel")} disabled={busy}>
            <Ban size={14} color={colors.text} />
            <Text className="text-xs">Batalkan</Text>
          </Button>
        ) : null}
      </NextStepCard>

      {/* 3. Alur */}
      <Panel title="Alur Pembelian" subtitle="Dokumen ini sekarang ada di langkah yang ditandai">
        <FlowTracker flow={flow} role={role} isRequester={isRequester} />
      </Panel>

      {/* 4. Barang */}
      <Panel title={`Barang (${items.length})`}>
        {items.length === 0 ? (
          <Text className="text-sm text-muted-foreground">{row.item || row.tujuan || "-"}</Text>
        ) : (
          <View>
            {items.map((it, idx) => {
              const name = it.product?.name || String(it.customName || "").replace("[PAKAI_HABIS] ", "") || `Barang #${idx + 1}`;
              const unit = it.product?.unit || it.customUnit || "";
              const cost = Number(it.unitCost || 0);
              const avail = it.productId ? stockInfo.find((s) => s.productId === it.productId)?.available : undefined;
              return (
                <View key={it.id ?? idx} className="flex-row items-center justify-between border-b border-border/60 py-2.5">
                  <View className="min-w-0 flex-1 pr-3">
                    <Text className="text-sm font-semibold" numberOfLines={2}>{name}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {it.qty} {unit}
                      {cost > 0 ? ` · @ ${rupiah(cost)}` : ""}
                    </Text>
                  </View>
                  {source === "GUDANG" && avail != null ? (
                    <Text className={`text-xs font-semibold ${avail >= it.qty ? "text-emerald-600" : "text-amber-600"}`}>
                      Stok {avail}
                    </Text>
                  ) : cost > 0 ? (
                    <Text className="text-sm font-medium">{rupiah(cost * it.qty)}</Text>
                  ) : null}
                </View>
              );
            })}
            <View className="flex-row items-center justify-between pt-3">
              <Text className="text-sm font-bold">Total</Text>
              <Text className="text-base font-bold text-primary">{rupiah(Number(row.estimasi || 0))}</Text>
            </View>
          </View>
        )}
      </Panel>

      {/* 5. Dokumen terkait */}
      {linkedPos.length || receivings.length ? (
        <Panel title="Dokumen Terkait">
          <View className="gap-1">
            {linkedPos.map((p) => (
              <DocLink key={`po-${p.id}`} label={`PO ${p.nomor}`} status={String(p.status)} onPress={() => router.push(`/supplier-pos/${p.id}` as any)} />
            ))}
            {receivings.map((rc) => (
              <DocLink key={`rc-${rc.id}`} label={`Penerimaan ${rc.nomor}`} status={String(rc.status)} onPress={() => router.push(`/receiving/${rc.id}` as any)} />
            ))}
          </View>
        </Panel>
      ) : null}

      {/* ─── Dialog ─── */}
      <Dialog open={dialog === "reject"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Permintaan</DialogTitle>
            <DialogDescription>Tulis alasan agar pemohon tahu apa yang perlu diperbaiki.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChangeText={setReason} placeholder="Alasan penolakan (wajib)" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setDialog(null)} disabled={busy}><Text>Batal</Text></Button>
            <Button variant="destructive" onPress={reject} disabled={busy}><Text>Tolak Permintaan</Text></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "cancel"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan Permintaan?</DialogTitle>
            <DialogDescription>Permintaan yang dibatalkan tidak bisa dilanjutkan lagi.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChangeText={setReason} placeholder="Alasan (opsional)" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setDialog(null)} disabled={busy}><Text>Kembali</Text></Button>
            <Button variant="destructive" onPress={cancel} disabled={busy}><Text>Ya, Batalkan</Text></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "pay"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{can("settle") ? "Lunasi Tagihan" : "Bayar Pembelian"}</DialogTitle>
            <DialogDescription>
              Unggah bukti transfer / struk. Pembayaran tercatat otomatis di akuntansi.
            </DialogDescription>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Dibayar dari" required>
              <SearchableSelect
                value={fundingSource === "1000.02" ? "Bank Mandiri PT GMP [1000.02]" : "Kas Kecil / Tunai [1000.01]"}
                options={["Kas Kecil / Tunai [1000.01]", "Bank Mandiri PT GMP [1000.02]"]}
                onChange={(v) => setFundingSource(v.includes("1000.02") ? "1000.02" : "1000.01")}
                placeholder="Pilih kas / bank"
              />
            </FormField>
            <FormField label="Bukti pembayaran" required>
              <FileUploader
                label="Unggah bukti bayar (foto / PDF)"
                kind="semua"
                accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                allowedExtensions={["jpg", "jpeg", "png", "webp", "pdf"]}
                category="bukti-bayar"
                autoFlush
                onUploaded={(id) => setProofId(id)}
              />
            </FormField>
          </View>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setDialog(null)} disabled={busy}><Text>Batal</Text></Button>
            <Button onPress={pay} disabled={busy || !proofId} className="bg-emerald-600">
              <Text className="text-white font-semibold">{busy ? "Memproses..." : "Konfirmasi Pembayaran"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "ship"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{source === "GUDANG" ? "Serahkan barang ke pemohon?" : "Tandai barang sudah dikirim?"}</DialogTitle>
            <DialogDescription>
              {source === "GUDANG"
                ? "Stok gudang akan berkurang sesuai barang yang diserahkan."
                : "Dokumen Penerimaan otomatis dibuat untuk Gudang. Gudang yang mengonfirmasi saat barang tiba."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setDialog(null)} disabled={busy}><Text>Batal</Text></Button>
            <Button onPress={ship} disabled={busy}><Text className="text-white font-semibold">Ya, Lanjutkan</Text></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "receive"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Barang sudah diterima?</DialogTitle>
            <DialogDescription>Konfirmasi bahwa barang dari gudang sudah sampai ke Anda / tim proyek.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setDialog(null)} disabled={busy}><Text>Batal</Text></Button>
            <Button onPress={confirmStockReceived} disabled={busy} className="bg-emerald-600">
              <Text className="text-white font-semibold">Ya, Sudah Diterima</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "po"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buat PO Pemasok</DialogTitle>
            <DialogDescription>Barang diambil dari request {row.nomor}. Cukup pilih supplier dan cek total.</DialogDescription>
          </DialogHeader>
          <View className="gap-3 py-2">
            <FormField label="Pemasok" required>
              <SupplierSelect
                supplierId={poSupplierId}
                value={(data.suppliers ?? []).find((s: Row) => String(s.id) === String(poSupplierId))?.nama ?? ""}
                onChange={(_v, match) => setPoSupplierId(match ? String(match.id) : "")}
                onAddNew={() => setQuickSupplierOpen(true)}
                addNewLabel="+ Tambah Pemasok Baru"
                placeholder="Pilih pemasok..."
              />
            </FormField>
            <FormField label="Syarat pembayaran" required>
              <SearchableSelect
                value={poTerms}
                options={["Utang / Tempo (Net 30)", "Utang / Tempo (Net 14)", "Tunai / Kas", "Termin DP & Pelunasan"]}
                onChange={setPoTerms}
                placeholder="Pilih syarat"
              />
            </FormField>
            <FormField label="Perkiraan tiba">
              <DatePicker value={poEta} onChange={setPoEta} placeholder="Pilih tanggal" />
            </FormField>
            <FormField label="Total PO (Rp)" required>
              <Input value={poTotal} onChangeText={(v) => setPoTotal(formatThousands(v))} keyboardType="numeric" placeholder="10.000.000" />
            </FormField>
          </View>
          <DialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setDialog(null)} disabled={busy}><Text>Batal</Text></Button>
            <Button onPress={submitPo} disabled={busy}><Text className="text-white font-semibold">{busy ? "Menyimpan..." : "Buat PO"}</Text></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddSupplierDialog
        open={quickSupplierOpen}
        onOpenChange={setQuickSupplierOpen}
        onSuccess={(s) => setPoSupplierId(String(s.id))}
      />
    </>
  );
}

function Chip({ text, tone }: { text: string; tone?: "info" | "warn" }) {
  const cls =
    tone === "warn"
      ? "border-amber-500/40 bg-amber-500/15"
      : tone === "info"
      ? "border-info/40 bg-info/15"
      : "border-border bg-muted";
  return (
    <View className={`rounded-full border px-2.5 py-1 ${cls}`}>
      <Text className="text-[11px] font-semibold">{text}</Text>
    </View>
  );
}

function DocLink({ label, status, onPress }: { label: string; status: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
      <View className="flex-row items-center gap-2">
        <FileText size={14} color={colors.muted} />
        <Text className="text-sm font-medium">{label}</Text>
      </View>
      <Text className="text-xs text-muted-foreground">{status}</Text>
    </Pressable>
  );
}
