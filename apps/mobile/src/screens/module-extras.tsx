import * as React from "react";
import { View } from "react-native";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Panel, Cell } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { ScanInput } from "@/components/taska/scan-input";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import type { Row } from "@/mock/data";

const PRICE_ROLES = ["procurement", "finance", "pm", "bos"];

function Line({ left, right, sub }: { left: string; right?: React.ReactNode; sub?: string }) {
  return (
    <View className="border-border flex-row items-center justify-between gap-3 border-b py-2.5">
      <View className="flex-1">
        <Text className="text-sm">{left}</Text>
        {sub ? <Text className="text-muted-foreground text-[13px]">{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function ModuleExtras({ moduleKey, row }: { moduleKey: string; row: Row }) {
  const { user, patchRow, setStatus, toast, data } = useApp();

  if (moduleKey === "leads") {
    const fu = [
      ["Telepon", "Membahas ruang lingkup dan jadwal survey", row.sepi],
      ["WhatsApp", "Mengirim contoh penawaran sebelumnya", row.sepi + 4],
      ["Email", "Perkenalan dan permintaan data kebutuhan", row.sepi + 9],
    ];
    return (
      <>
        {row.status === "Lost" ? (
          <Panel title="Alasan Lost"><Text className="text-danger text-sm">{row.alasanLost || "-"}</Text></Panel>
        ) : null}
        {row.sepi > 7 && row.status !== "Won" && row.status !== "Lost" ? (
          <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
            <AlertTriangle size={16} color={colors.warning} />
            <Text className="text-warning flex-1 text-sm">Belum ada tindak lanjut selama {row.sepi} hari.</Text>
          </View>
        ) : null}
        <Panel title="Riwayat tindak lanjut">
          {fu.map(([m, n, d]) => (
            <Line key={String(n)} left={`${m}: ${n}`} sub={`${d} hari lalu`} />
          ))}
        </Panel>
      </>
    );
  }

  if (moduleKey === "quotations") {
    const versions = Array.from({ length: row.versi }, (_, i) => row.versi - i);
    return (
      <Panel title="Riwayat versi" subtitle="Revisi tidak menimpa versi lama. Hanya versi terakhir dipakai sebagai acuan nilai.">
        {versions.map((v, i) => (
          <Line
            key={v}
            left={`Versi ${v}`}
            sub={`${row.nomor.replace(/\//g, "-")}-v${v}.pdf`}
            right={
              <View className="items-end gap-1">
                <Text className="text-sm font-medium">{rupiah(row.nilai * (1 + i * 0.04))}</Text>
                {i === 0 ? <StatusBadge status="Disetujui" /> : null}
              </View>
            }
          />
        ))}
      </Panel>
    );
  }

  if (moduleKey === "po-client") {
    const sisa = row.nilai - row.totalInvoice;
    return (
      <>
        {row.totalInvoice > row.nilai ? (
          <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
            <AlertTriangle size={16} color={colors.warning} />
            <Text className="text-warning flex-1 text-sm">Total invoice melebihi nilai PO sebesar {rupiah(-sisa)}. Ini hanya peringatan, data tetap tersimpan.</Text>
          </View>
        ) : null}
        <Panel title="Ringkasan PO">
          <Line left="Total PO" right={<Text className="text-sm font-medium">{rupiah(row.nilai)}</Text>} />
          <Line left="Total invoice" right={<Text className="text-sm font-medium">{rupiah(row.totalInvoice)}</Text>} />
          <Line left="Sisa" right={<Text className="text-sm font-medium">{rupiah(Math.max(0, sisa))}</Text>} />
        </Panel>
      </>
    );
  }

  if (moduleKey === "invoices") {
    const sisa = row.total - row.terbayar;
    function pay() {
      const amount = Math.min(sisa, Math.round(row.total * 0.3));
      if (amount <= 0) { toast("Invoice sudah lunas", "info"); return; }
      const terbayar = row.terbayar + amount;
      patchRow("invoices", row.id, { terbayar, status: terbayar >= row.total ? "Lunas" : "Dibayar sebagian" });
      toast(`Pembayaran ${rupiah(amount)} dicatat`);
    }
    return (
      <>
        <Panel title="Ringkasan pembayaran" right={user!.role === "finance" || user!.role === "bos" ? <Button variant="outline" size="sm" onPress={pay}><Text>Catat pembayaran</Text></Button> : undefined}>
          <Line left="Total tagihan" right={<Text className="text-sm font-medium">{rupiah(row.total)}</Text>} />
          <Line left="Sudah dibayar" right={<Text className="text-success text-sm font-medium">{rupiah(row.terbayar)}</Text>} />
          <Line left="Sisa" right={<Text className="text-sm font-medium">{rupiah(sisa)}</Text>} />
        </Panel>
        <Panel title="Pembayaran masuk">
          {row.terbayar > 0 ? (
            <Line left="Transfer bank" sub="Bukti: bukti-transfer.jpg" right={<Text className="text-sm">{rupiah(row.terbayar)}</Text>} />
          ) : (
            <Text className="text-muted-foreground text-sm">Belum ada pembayaran.</Text>
          )}
        </Panel>
      </>
    );
  }

  if (moduleKey === "supplier-pos") {
    const steps = ["Di Supplier", "Dikirim", "Sampai"];
    const cur = steps.indexOf(row.pengiriman);
    const showPrice = PRICE_ROLES.includes(user!.role);
    function go(s: string) {
      patchRow("supplier-pos", row.id, { pengiriman: s, status: s });
      setStatus("supplier-pos", row.id, s);
    }
    return (
      <>
        <Panel title="Pengiriman dari supplier" subtitle="Status diubah manual oleh Procurement dengan bukti DO">
          {steps.map((s, i) => (
            <View key={s} className="flex-row items-center gap-3 py-2">
              {i <= cur ? <CheckCircle2 size={20} color={colors.success} /> : <Circle size={20} color={colors.border} />}
              <Text className={i <= cur ? "text-sm font-medium" : "text-muted-foreground text-sm"}>{s}</Text>
            </View>
          ))}
          {(user!.role === "procurement" || user!.role === "bos") && cur < 2 && steps[cur + 1] ? (
            <Button
              className="mt-2 self-start"
              variant="outline"
              onPress={() => {
                const nextStep = steps[cur + 1];
                if (nextStep) go(nextStep);
              }}
            >
              <Text>Tandai {steps[cur + 1]}</Text>
            </Button>
          ) : null}
        </Panel>
        <Panel title="Barang di PO ini">
          {String(row.item).split(", ").map((it) => (
            <Line key={it} left={it} right={showPrice ? <Text className="text-muted-foreground text-sm">Harga beli tampil</Text> : undefined} />
          ))}
          {showPrice ? <Line left="Total harga beli" right={<Text className="text-sm font-semibold">{rupiah(row.total)}</Text>} /> : null}
          <Text className="text-muted-foreground mt-2 text-[13px]">Penerimaan sebagian diperbolehkan di Gudang.</Text>
        </Panel>
      </>
    );
  }

  if (moduleKey === "delivery-notes") {
    return (
      <>
        <Panel title="Barang yang dibawa">
          {row.barang === "-" ? (
            <Text className="text-muted-foreground text-sm">Surat jalan ini tanpa barang.</Text>
          ) : (
            <>
              <Line left={row.barang} sub="Barang ber-SN wajib di-scan sebelum berangkat" />
              {user!.role === "gudang" || user!.role === "bos" ? (
                <View className="mt-3"><ScanInput /></View>
              ) : null}
            </>
          )}
        </Panel>
        {row.status === "Dikirim" && row.barang !== "-" && (user!.role === "teknisi" || user!.role === "bos") ? (
          <Button className="self-start" variant="outline" onPress={() => setStatus("delivery-notes", row.id, "Diterima")}><Text>Tandai diterima di lokasi</Text></Button>
        ) : null}
      </>
    );
  }

  if (moduleKey === "expenses") {
    return row.nominal > 10_000_000 ? (
      <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
        <AlertTriangle size={16} color={colors.warning} />
        <Text className="text-warning flex-1 text-sm">Nominal besar. Perlu persetujuan Bos selain Finance.</Text>
      </View>
    ) : null;
  }

  if (moduleKey === "receiving") {
    return (
      <Panel title="Isi penerimaan">
        <Line left={row.item} sub={`PO ${row.po}`} right={<StatusBadge status={row.status} />} />
        <Text className="text-muted-foreground mt-2 text-[13px]">Disetujui Gudang dan Procurement.</Text>
      </Panel>
    );
  }

  if (moduleKey === "customers") {
    const leads = data.leads.filter((l) => l.perusahaan === row.nama);
    return (
      <Panel title={`Lead milik customer ini (${leads.length})`}>
        {leads.length === 0 ? <Text className="text-muted-foreground text-sm">Belum ada lead.</Text> : leads.map((l) => (
          <Line key={l.id} left={l.nama} sub={`Perkiraan closing ${tanggal(l.closing)}`} right={<Cell fmt="status" value={l.status} />} />
        ))}
      </Panel>
    );
  }

  return null;
}
