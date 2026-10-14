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
  Pencil,
  ShoppingCart,
  Trash2,
  Upload,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, Chip, EmptyState, InfoGrid, Timeline } from "@/components/taska/basics";
import { ConfirmDialog, FormDialog } from "@/components/taska/dialogs";
import { StatusBadge } from "@/components/taska/status-badge";
import { DocumentViewerList, DocumentViewerItem, resolveModuleDocs } from "@/components/taska/document-viewer";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { MODULES, type Row } from "@/constants/modules";
import { colors } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";

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
  const { data, user, addRow, setStatus, patchRow, deleteRow, history, toast, reload } = useApp();

  const [activeTab, setActiveTab] = React.useState<TabKey>("Ringkasan");
  const [taskModalOpen, setTaskModalOpen] = React.useState(false);
  const [reqModalOpen, setReqModalOpen] = React.useState(false);
  const [editProjectOpen, setEditProjectOpen] = React.useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = React.useState(false);
  const [requirements, setRequirements] = React.useState<any[]>([]);

  const project = data.projects.find((p) => p.id === id);

  const loadRequirements = React.useCallback(async () => {
    if (!id) return;
    try {
      const res = await api<any[]>("GET", `/projects/${id}/requirements`);
      if (Array.isArray(res)) setRequirements(res);
    } catch {}
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    api<any[]>("GET", `/projects/${id}/requirements`)
      .then((res) => {
        if (active && Array.isArray(res)) setRequirements(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);

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

  const tasks = data.tasks.filter(
    (t) =>
      String(t.projectId) === String(project.id) ||
      t.project === project.id ||
      t.project === project.nama
  );
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
        onRefresh={loadRequirements}
        action={
          <View className="flex-row flex-wrap items-center gap-2">
            {!isLunas ? (
              <View className="bg-warning/15 flex-row items-center gap-1.5 rounded-full px-3 py-1">
                <AlertTriangle size={14} color={colors.warning} />
                <Text className="text-warning text-xs font-medium">Belum lunas (Handover dicatat)</Text>
              </View>
            ) : null}
            <Button size="sm" variant="outline" onPress={() => setEditProjectOpen(true)}>
              <Pencil size={14} color={colors.text} />
              <Text>Ubah</Text>
            </Button>
            <Button size="sm" variant="outline" onPress={() => setDeleteProjectOpen(true)}>
              <Trash2 size={14} color={colors.danger} />
              <Text className="text-danger">Hapus</Text>
            </Button>
            {project.status !== "Selesai" && (user?.role === "super_admin" || user?.role === "pm" || user?.role === "bos" || user?.role === "admin") ? (
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
              <DocumentViewerItem
                item={resolveModuleDocs("projects", "Berita Acara Serah Terima (BAST)", project)}
              />
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
              <View className="flex-row gap-2">
                <Button size="sm" onPress={() => setTaskModalOpen(true)}>
                  <Plus size={14} color={colors.background} />
                  <Text className="text-xs">Tambah Tugas</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => router.push("/purchase-requests/new" as any)}>
                  <ShoppingCart size={14} color={colors.text} />
                  <Text className="text-xs">Request Barang</Text>
                </Button>
              </View>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onPress={() => void deleteRow("tasks", t.id)}
                      >
                        <Trash2 size={14} color={colors.danger} />
                      </Button>
                    </View>
                  </View>
                </View>
              ))
            )}
          </Panel>
        </View>
      )}

      <FormDialog
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        title="Tambah Tugas Project"
        fields={[
          { key: "nama", label: "Nama Tugas", type: "text", required: true, placeholder: "Contoh: Penarikan kabel lantai 2" },
          {
            key: "parentTask",
            label: "Sub-tugas dari (Opsional)",
            type: "select",
            options: ["(Tugas Utama)", ...tasks.filter((t) => !t.parent).map((t) => String(t.nama))],
          },
          { key: "pic", label: "PIC Tugas", type: "select", required: true, placeholder: "Pilih PIC" },
          { key: "tenggat", label: "Tenggat Waktu", type: "date" },
          { key: "perluBarang", label: "Perlu Pembelian Barang?", type: "select", options: ["Tidak", "Ya"] },
        ]}
        submitLabel="Simpan Tugas"
        onSubmit={(v) => {
          const parentRow =
            v.parentTask && v.parentTask !== "(Tugas Utama)"
              ? tasks.find((t) => t.nama === v.parentTask)
              : undefined;
          addRow("tasks", {
            projectId: project.id,
            project: project.nama,
            parentId: parentRow?.id,
            nama: v.nama,
            pic: v.pic,
            tenggat: v.tenggat || new Date().toISOString().slice(0, 10),
            perluBarang: v.perluBarang === "Ya",
            status: "TODO",
          });
        }}
      />

      <FormDialog
        open={reqModalOpen}
        onOpenChange={setReqModalOpen}
        title="Tambah Kebutuhan Barang Project"
        fields={[
          {
            key: "produk",
            label: "Pilih Barang / Perangkat",
            type: "select",
            required: true,
            options: (data.products ?? []).map((p) => String(p.nama)),
          },
          { key: "qty", label: "Jumlah yang Dibutuhkan", type: "number", required: true, placeholder: "Contoh: 4" },
        ]}
        submitLabel="Cek Stok & Simpan"
        onSubmit={async (v) => {
          const prod = (data.products ?? []).find((p) => p.nama === v.produk);
          if (!prod) return;
          try {
            const res = await api<any>("POST", `/projects/${project.id}/requirements`, {
              items: [{ productId: Number(prod.id), neededQty: Number(v.qty) || 1 }],
            });
            await loadRequirements();
            await reload();
            toast(
              res?.purchaseRequestCreated
                ? "Stok tersedia di-reserve & kekurangan otomatis dibuatkan Request ke Procurement"
                : "Kebutuhan barang dicatat & stok di-reserve",
            );
          } catch (e: any) {
            toast(e?.message ?? "Gagal menyimpan kebutuhan barang", "danger");
          }
        }}
      />

      <FormDialog
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        def={MODULES.projects}
        title="Ubah Project"
        fields={MODULES.projects?.createFields || []}
        initialRow={project}
        mode="edit"
        submitLabel="Simpan Perubahan"
        onSubmit={(patch) => patchRow("projects", project.id, patch)}
      />

      <ConfirmDialog
        open={deleteProjectOpen}
        onOpenChange={setDeleteProjectOpen}
        title="Hapus project ini?"
        description="Project yang dihapus tidak dapat dikembalikan."
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={() => {
          void deleteRow("projects", project.id).then((ok) => {
            if (ok) router.replace("/projects");
          });
        }}
      />

      {/* Tab 3: Kebutuhan Barang & Reservasi */}
      {activeTab === "Barang" && (
        <View className="gap-4">
          <Panel
            title="Kebutuhan Barang Project"
            subtitle="Sistem otomatis mengecek stok, menahan (reserve) yang tersedia, dan mengajukan kekurangan ke Procurement"
            right={
              <View className="flex-row gap-2">
                <Button size="sm" onPress={() => setReqModalOpen(true)}>
                  <Plus size={14} color={colors.background} />
                  <Text className="text-xs">Isi Kebutuhan Barang</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => router.push("/purchase-requests/new" as any)}>
                  <Text className="text-xs">Request Manual</Text>
                </Button>
              </View>
            }
          >
            {requirements.length === 0 ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">
                Belum ada kebutuhan barang untuk project ini. Klik &quot;Isi Kebutuhan Barang&quot; untuk menambahkan.
              </Text>
            ) : (
              requirements.map((r: any) => (
                <View key={r.id} className="border-border flex-row items-center justify-between border-b py-3 last:border-b-0">
                  <View className="flex-1 pr-3">
                    <View className="flex-row justify-between">
                      <Text className="text-sm font-medium">{r.product?.name ?? "Barang"}</Text>
                      <Text className="text-sm font-semibold">
                        Dibutuhkan: {r.neededQty} {r.product?.unit ?? "unit"}
                      </Text>
                    </View>
                    <Text className={Number(r.shortageQty) > 0 ? "text-warning text-xs mt-0.5" : "text-success text-xs mt-0.5"}>
                      Tersedia & Di-reserve: {r.reservedQty} {r.product?.unit ?? "unit"}
                      {Number(r.shortageQty) > 0
                        ? ` · Kekurangan: ${r.shortageQty} ${r.product?.unit ?? "unit"} (Otomatis masuk Request Procurement)`
                        : " (Stok aman, siap pasang)"}
                    </Text>
                  </View>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onPress={async () => {
                      try {
                        await api("DELETE", `/projects/${project.id}/requirements/${r.id}`);
                        await loadRequirements();
                        await reload();
                        toast("Kebutuhan barang dihapus & reservasi dilepas");
                      } catch (e: any) {
                        toast(e?.message ?? "Gagal menghapus", "danger");
                      }
                    }}
                  >
                    <Trash2 size={14} color={colors.danger} />
                  </Button>
                </View>
              ))
            )}
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
            <DocumentViewerList
              moduleKey="projects"
              docs={[
                "Dokumen PRD & Spesifikasi Teknis",
                "Berita Acara Hasil Pekerjaan (BAHP)",
                "Berita Acara Serah Terima (BAST)",
                "Delivery Order (DO) / Surat Jalan Bertandatangan",
              ]}
              row={project}
              onUploadFile={async (fieldKey, fileId, item) => {
                try {
                  await patchRow("projects", project.id, { [fieldKey]: fileId });
                  toast(`${item.label} berhasil diperbarui`);
                  await reload();
                } catch (err: any) {
                  toast(err?.message || "Gagal memperbarui file", "danger");
                }
              }}
            />
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
