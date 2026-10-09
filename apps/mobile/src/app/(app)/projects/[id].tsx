import * as React from "react";
import { View, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  ShoppingCart,
  Upload,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, Chip, EmptyState, InfoGrid, Timeline } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { FileUploader } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import type { Row } from "@/mock/data";

const TABS = [
  "Ringkasan",
  "Tugas",
  "Barang",
  "Pengiriman",
  "Dokumen",
  "Biaya",
  "Riwayat",
] as const;

type TabKey = typeof TABS[number];

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, user, setStatus, patchRow, history, toast } = useApp();

  const [activeTab, setActiveTab] = React.useState<TabKey>("Ringkasan");

  const project = data.projects.find((p) => p.id === id);

  if (!project) {
    return (
      <EmptyState
        title="Project tidak ditemukan"
        text="Data project tidak tersedia atau telah dihapus."
        actionLabel="Kembali ke daftar project"
        onAction={() => router.replace("/projects")}
      />
    );
  }

  const tasks = data.tasks.filter((t) => t.project === project.id);
  const reservations = (data as any).reservations?.filter?.(
    (r: any) => r.project === project.nama
  ) || [];
  const expenses = data.expenses.filter((e) => e.project === project.nama);
  const deliveryNotes = data["delivery-notes"].filter(
    (dn) => dn.project === project.nama
  );

  const isLunas = project.pembayaran === "Lunas";

  function toggleTask(taskId: string, currentStatus: string) {
    const next = currentStatus === "DONE" ? "IN PROGRESS" : "DONE";
    patchRow("tasks", taskId, { status: next });
    toast(`Status tugas diubah ke ${next}`);
  }

  function markCompleted() {
    if (!project) return;
    setStatus("projects", project.id, "Selesai");
    toast("Project ditandai selesai");
  }

  return (
    <View className="gap-5">
      <PageHeader
        back
        title={project.nama}
        subtitle={`${project.jenis} · Customer: ${project.customer}`}
        status={project.status}
        action={
          <View className="flex-row items-center gap-2">
            {!isLunas ? (
              <View className="bg-warning/15 flex-row items-center gap-1.5 rounded-full px-3 py-1">
                <AlertTriangle size={14} color={colors.warning} />
                <Text className="text-warning text-xs font-medium">Belum lunas (Handover dicatat)</Text>
              </View>
            ) : null}
            {project.status !== "Selesai" && (user?.role === "pm" || user?.role === "bos") ? (
              <Button size="sm" onPress={markCompleted}>
                <Text>Selesaikan Project</Text>
              </Button>
            ) : null}
          </View>
        }
      />

      {/* Tabs Menu */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {TABS.map((tab) => (
          <Chip
            key={tab}
            label={tab}
            active={activeTab === tab}
            onPress={() => setActiveTab(tab)}
          />
        ))}
      </ScrollView>

      {/* Tab 1: Ringkasan */}
      {activeTab === "Ringkasan" && (
        <View className="gap-4">
          <Panel title="Informasi Project">
            <InfoGrid
              fields={[
                { label: "Project Manager (PIC)", key: "pm" },
                { label: "Tim Lapangan (SE / Teknisi)", key: "tim" },
                { label: "Tanggal Mulai", key: "mulai", fmt: "date" },
                { label: "Target Selesai", key: "selesai", fmt: "date" },
                { label: "Status Logistik Barang", key: "barang" },
                { label: "Status Pembayaran", key: "pembayaran" },
                { label: "Progres Pekerjaan", key: "progres", fmt: "pct" },
              ]}
              row={project}
            />
          </Panel>

          <Panel title="Handover & Serah Terima Dokumen">
            <Text className="text-text-secondary text-sm">
              Handover dilakukan setelah invoice lunas. Sistem mencatat dokumen serah terima (BAST/BAHP) tanpa memblokir penutupan project bila ada kesepakatan internal.
            </Text>
            <View className="mt-4">
              <FileUploader label="Dokumen BAST / BAHP Akhir" kind="dokumen" />
            </View>
          </Panel>
        </View>
      )}

      {/* Tab 2: Tugas Bertingkat */}
      {activeTab === "Tugas" && (
        <View className="gap-4">
          <Panel
            title="Daftar Tugas Bertingkat"
            subtitle="Tugas induk dan sub-tugas project"
            right={
              <Button size="sm" variant="outline" onPress={() => router.push("/purchase-requests/new" as any)}>
                <ShoppingCart size={14} color={colors.text} />
                <Text className="text-xs">Request Barang</Text>
              </Button>
            }
          >
            {tasks.length === 0 ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">Belum ada tugas untuk project ini.</Text>
            ) : (
              tasks.map((t) => (
                <View
                  key={t.id}
                  className={`border-border border-b py-3 last:border-b-0 ${
                    t.parent ? "ml-6 pl-3 border-l-2 border-primary/40" : ""
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-sm font-semibold">{t.nama}</Text>
                      <Text className="text-text-secondary text-xs">
                        PIC: {t.pic} · Tenggat: {tanggal(t.tenggat)}
                        {t.perluBarang ? " · (Perlu pembelian barang)" : ""}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <StatusBadge status={t.status} />
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => toggleTask(t.id, t.status)}
                      >
                        <Text className="text-xs">{t.status === "DONE" ? "Buka lagi" : "Selesai"}</Text>
                      </Button>
                    </View>
                  </View>
                </View>
              ))
            )}
          </Panel>
        </View>
      )}

      {/* Tab 3: Kebutuhan Barang & Reservasi */}
      {activeTab === "Barang" && (
        <View className="gap-4">
          <Panel
            title="Kebutuhan Barang Project"
            subtitle="Sistem otomatis mengecek stok dan menahan (reserve) yang tersedia"
            right={
              <Button size="sm" onPress={() => router.push("/purchase-requests/new" as any)}>
                <Plus size={14} color={colors.background} />
                <Text>Ajukan Request</Text>
              </Button>
            }
          >
            <View className="border-border border-b py-2.5">
              <View className="flex-row justify-between">
                <Text className="text-sm font-medium">Reader Fingerprint</Text>
                <Text className="text-sm font-semibold">Dibutuhkan: 6 pcs</Text>
              </View>
              <Text className="text-text-secondary text-xs">Tersedia di gudang: 2 pcs (Otomatis di-reserve) · Kekurangan: 4 pcs (Diajukan ke PO)</Text>
            </View>

            <View className="border-border border-b py-2.5">
              <View className="flex-row justify-between">
                <Text className="text-sm font-medium">Access Controller 4 Pintu</Text>
                <Text className="text-sm font-semibold">Dibutuhkan: 2 pcs</Text>
              </View>
              <Text className="text-success text-xs">Tersedia di gudang: 2 pcs (Stok aman, siap pasang)</Text>
            </View>

            <View className="py-2.5">
              <View className="flex-row justify-between">
                <Text className="text-sm font-medium">Kabel LAN UTP Cat6</Text>
                <Text className="text-sm font-semibold">Dibutuhkan: 500 meter</Text>
              </View>
              <Text className="text-success text-xs">Tersedia di Gudang Jakarta: 1.850 meter</Text>
            </View>
          </Panel>
        </View>
      )}

      {/* Tab 4: Pengiriman & Surat Jalan */}
      {activeTab === "Pengiriman" && (
        <View className="gap-4">
          <Panel
            title="Surat Jalan & Pengiriman Lapangan"
            right={
              <Button size="sm" variant="outline" onPress={() => router.push("/delivery-notes/new" as any)}>
                <Text>Buat Surat Jalan</Text>
              </Button>
            }
          >
            {deliveryNotes.length === 0 ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">Belum ada surat jalan untuk project ini.</Text>
            ) : (
              deliveryNotes.map((dn) => (
                <Pressable
                  key={dn.id}
                  onPress={() => router.push(`/delivery-notes/${dn.id}` as any)}
                  className="border-border flex-row items-center justify-between border-b py-3 last:border-b-0"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-semibold">{dn.nomor}</Text>
                    <Text className="text-text-secondary text-xs">{dn.alasan} · Pembawa: {dn.pembuat}</Text>
                  </View>
                  <StatusBadge status={dn.status} />
                </Pressable>
              ))
            )}
          </Panel>
        </View>
      )}

      {/* Tab 5: Dokumen (PRD, BAST, DO) */}
      {activeTab === "Dokumen" && (
        <View className="gap-4">
          <Panel title="File & Lampiran Dokumen Project">
            <View className="gap-4">
              <FileUploader label="Dokumen PRD & Spesifikasi Teknis" kind="dokumen" />
              <FileUploader label="Berita Acara Hasil Pekerjaan (BAHP)" kind="dokumen" />
              <FileUploader label="Berita Acara Serah Terima (BAST)" kind="dokumen" />
              <FileUploader label="Delivery Order (DO) / Surat Jalan Bertandatangan" kind="foto" />
            </View>
          </Panel>
        </View>
      )}

      {/* Tab 6: Biaya & Pengeluaran Lapangan */}
      {activeTab === "Biaya" && (
        <View className="gap-4">
          <Panel
            title="Pengeluaran Lapangan Project"
            subtitle="Bensin, makan, transport, perlengkapan teknisi"
            right={
              <Button size="sm" variant="outline" onPress={() => router.push("/expenses/new" as any)}>
                <Text>Catat Pengeluaran</Text>
              </Button>
            }
          >
            {expenses.length === 0 ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">Belum ada pengeluaran yang dicatat untuk project ini.</Text>
            ) : (
              expenses.map((e) => (
                <View key={e.id} className="border-border flex-row items-center justify-between border-b py-2.5 last:border-b-0">
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-medium">{e.alasan}</Text>
                    <Text className="text-muted-foreground text-xs">{e.pelapor} · {e.kategori} · {tanggal(e.tanggal)}</Text>
                  </View>
                  <View className="items-end gap-1">
                    <Text className="text-sm font-semibold">{rupiah(e.nominal)}</Text>
                    <StatusBadge status={e.status} />
                  </View>
                </View>
              ))
            )}
          </Panel>
        </View>
      )}

      {/* Tab 7: Riwayat Timeline */}
      {activeTab === "Riwayat" && (
        <Panel title="Riwayat Aktivitas Project">
          <Timeline items={history("projects", project.id)} />
        </Panel>
      )}
    </View>
  );
}
