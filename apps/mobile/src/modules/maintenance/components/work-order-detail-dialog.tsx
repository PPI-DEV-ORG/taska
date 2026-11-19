import * as React from "react";
import { View, ScrollView, Pressable, Platform, Alert } from "react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  X,
  Wrench,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  DollarSign,
  Package,
  FileText,
  ShieldCheck,
  CheckSquare,
  Plus,
  Trash2,
  Building,
  UploadCloud,
  FileCheck2,
} from "lucide-react-native";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect, DatePicker } from "@/components/akuntra/dialogs";
import { UserSelect } from "@/components/akuntra/document-selects/user-select";
import { FileUploader } from "@/components/akuntra/file-uploader";
import { colors } from "@/tokens";
import {
  WorkOrderStatusBadge,
  PriorityBadge,
  AssetConditionBadge,
} from "./maintenance-ui";
import { formatRupiah, formatDate, formatDateTime } from "../maintenance-utils";
import type { MaintWorkOrder, MaintLookups } from "../types";

export function WorkOrderDetailDialog(props: {
  visible: boolean;
  onClose: () => void;
  workOrder?: MaintWorkOrder | null;
  lookups: MaintLookups;
  onUpdateStatus: (id: number, status: string, notes?: string) => Promise<void>;
  onAddTask: (id: number, task: any) => Promise<void>;
  onUpdateTask: (taskId: number, data: any) => Promise<void>;
  onDeleteTask: (taskId: number) => Promise<void>;
  onUpdateChecklist: (checklistId: number, answers: any[]) => Promise<void>;
  onAddMaterial: (id: number, mat: any) => Promise<void>;
  onDeleteMaterial: (materialId: number) => Promise<void>;
  onAddLabor: (id: number, labor: any) => Promise<void>;
  onDeleteLabor: (laborId: number) => Promise<void>;
  onAddCost: (id: number, cost: any) => Promise<void>;
  onDeleteCost: (costId: number) => Promise<void>;
  onRecordDowntime: (id: number, downtime: any) => Promise<void>;
  onAddAttachment: (id: number, att: any) => Promise<void>;
  onVerify: (id: number, notes: string) => Promise<void>;
  onCloseWo: (id: number, finalStatus: string, notes?: string) => Promise<void>;
  onEvaluateCapitalization: (id: number, approved: boolean, notes?: string) => Promise<void>;
  onRefresh: () => void;
}) {
  if (!props.visible || !props.workOrder) return null;
  return <DetailContent key={props.workOrder.id} {...props} workOrder={props.workOrder} />;
}

function DetailContent({
  onClose,
  workOrder,
  lookups,
  onUpdateStatus,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onUpdateChecklist,
  onAddMaterial,
  onDeleteMaterial,
  onAddLabor,
  onDeleteLabor,
  onAddCost,
  onDeleteCost,
  onRecordDowntime,
  onAddAttachment,
  onVerify,
  onCloseWo,
  onEvaluateCapitalization,
  onRefresh,
}: {
  onClose: () => void;
  workOrder: MaintWorkOrder;
  lookups: MaintLookups;
  onUpdateStatus: (id: number, status: string, notes?: string) => Promise<void>;
  onAddTask: (id: number, task: any) => Promise<void>;
  onUpdateTask: (taskId: number, data: any) => Promise<void>;
  onDeleteTask: (taskId: number) => Promise<void>;
  onUpdateChecklist: (checklistId: number, data: any) => Promise<void>;
  onAddMaterial: (id: number, material: any) => Promise<void>;
  onDeleteMaterial: (materialId: number) => Promise<void>;
  onAddLabor: (id: number, labor: any) => Promise<void>;
  onDeleteLabor: (laborId: number) => Promise<void>;
  onAddCost: (id: number, cost: any) => Promise<void>;
  onDeleteCost: (costId: number) => Promise<void>;
  onRecordDowntime: (id: number, downtime: any) => Promise<void>;
  onAddAttachment: (id: number, attachment: any) => Promise<void>;
  onVerify: (id: number, verificationNotes: string) => Promise<void>;
  onCloseWo: (id: number, finalAssetStatus: string, notes?: string) => Promise<void>;
  onEvaluateCapitalization: (id: number, approved: boolean, notes?: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = React.useState<
    "overview" | "checklists" | "materials" | "labor" | "costs" | "downtime" | "verify"
  >("overview");

  // Sub-dialog states
  const [showTaskForm, setShowTaskForm] = React.useState(false);
  const [newTaskName, setNewTaskName] = React.useState("");
  const [newTaskInstruction, setNewTaskInstruction] = React.useState("");

  const [showMaterialForm, setShowMaterialForm] = React.useState(false);
  const [matProductId, setMatProductId] = React.useState<number | "">("");
  const [matName, setMatName] = React.useState("");
  const [matPartNum, setMatPartNum] = React.useState("");
  const [matQty, setMatQty] = React.useState("1");
  const [matUnit, setMatUnit] = React.useState("PCS");
  const [matUnitCost, setMatUnitCost] = React.useState("0");

  const [showLaborForm, setShowLaborForm] = React.useState(false);
  const [laborTechId, setLaborTechId] = React.useState<number | "">("");
  const [laborHours, setLaborHours] = React.useState("1");
  const [laborRate, setLaborRate] = React.useState("50000");
  const [laborDesc, setLaborDesc] = React.useState("");

  const [showCostForm, setShowCostForm] = React.useState(false);
  const [costComp, setCostComp] = React.useState("EXTERNAL_SERVICE");
  const [costDesc, setCostDesc] = React.useState("");
  const [costAmt, setCostAmt] = React.useState("0");
  const [costVendorId, setCostVendorId] = React.useState<number | "">("");

  const [showDowntimeForm, setShowDowntimeForm] = React.useState(false);
  const [dtStart, setDtStart] = React.useState(new Date().toISOString().slice(0, 16));
  const [dtEnd, setDtEnd] = React.useState("");
  const [dtCause, setDtCause] = React.useState("");
  const [dtImpact, setDtImpact] = React.useState("FULL_STOP");

  const [showAttachForm, setShowAttachForm] = React.useState(false);
  const [attachType, setAttachType] = React.useState("BEFORE_PHOTO");
  const [attachTitle, setAttachTitle] = React.useState("");
  const [attachUrl, setAttachUrl] = React.useState("");

  const [verifyNotes, setVerifyNotes] = React.useState(workOrder.verificationNotes || "");
  const [closingNotes, setClosingNotes] = React.useState(workOrder.workResult || "");
  const [finalStatus, setFinalStatus] = React.useState("GOOD");
  const [busy, setBusy] = React.useState(false);

  const currentStatus = (workOrder.status || "DRAFT").toUpperCase();

  const handleStatusChange = async (targetStatus: string) => {
    try {
      setBusy(true);
      await onUpdateStatus(workOrder.id, targetStatus);
      onRefresh();
    } catch (e: any) {
      alert(e?.message || "Gagal mengubah status");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskName.trim()) return;
    try {
      setBusy(true);
      await onAddTask(workOrder.id, {
        taskName: newTaskName.trim(),
        instruction: newTaskInstruction.trim() || undefined,
      });
      setNewTaskName("");
      setNewTaskInstruction("");
      setShowTaskForm(false);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCreateMaterial = async () => {
    if (!matName.trim()) return;
    try {
      setBusy(true);
      await onAddMaterial(workOrder.id, {
        productId: matProductId ? Number(matProductId) : undefined,
        sparePartName: matName.trim(),
        partNumber: matPartNum.trim() || undefined,
        quantity: Number(matQty) || 1,
        unit: matUnit || "PCS",
        unitCost: Number(matUnitCost) || 0,
      });
      setMatName("");
      setMatPartNum("");
      setMatProductId("");
      setShowMaterialForm(false);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCreateLabor = async () => {
    const tech = lookups.users.find((u) => u.id === Number(laborTechId));
    try {
      setBusy(true);
      await onAddLabor(workOrder.id, {
        technicianUserId: laborTechId ? Number(laborTechId) : undefined,
        technicianName: tech ? tech.name : "Teknisi",
        hoursSpent: Number(laborHours) || 0,
        hourlyRate: Number(laborRate) || 0,
        workDescription: laborDesc.trim() || undefined,
      });
      setLaborDesc("");
      setShowLaborForm(false);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCost = async () => {
    if (!costDesc.trim() || Number(costAmt) <= 0) return;
    try {
      setBusy(true);
      await onAddCost(workOrder.id, {
        costComponent: costComp,
        description: costDesc.trim(),
        amount: Number(costAmt),
        vendorId: costVendorId ? Number(costVendorId) : undefined,
        incurredDate: new Date().toISOString().slice(0, 10),
      });
      setCostDesc("");
      setCostAmt("0");
      setShowCostForm(false);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDowntime = async () => {
    if (!dtCause.trim()) return;
    try {
      setBusy(true);
      await onRecordDowntime(workOrder.id, {
        downtimeStart: dtStart,
        downtimeEnd: dtEnd || undefined,
        cause: dtCause.trim(),
        operationalImpact: dtImpact,
      });
      setDtCause("");
      setShowDowntimeForm(false);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAttachment = async () => {
    if (!attachUrl.trim() || !attachTitle.trim()) return;
    try {
      setBusy(true);
      await onAddAttachment(workOrder.id, {
        documentType: attachType,
        title: attachTitle.trim(),
        fileUrl: attachUrl.trim(),
      });
      setAttachTitle("");
      setAttachUrl("");
      setShowAttachForm(false);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleVerifySubmit = async () => {
    if (!verifyNotes.trim()) {
      alert("Catatan verifikasi supervisor harus diisi");
      return;
    }
    try {
      setBusy(true);
      await onVerify(workOrder.id, verifyNotes.trim());
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCloseSubmit = async () => {
    try {
      setBusy(true);
      await onCloseWo(workOrder.id, finalStatus, closingNotes.trim());
      onRefresh();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[96vw] max-w-4xl max-h-[92vh] p-0"
        style={Platform.select({
          web: { width: "min(96vw, 880px)", maxWidth: "880px" } as any,
        })}
      >
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <View className="flex-row justify-between items-start">
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <DialogTitle>
                  Work Order #{workOrder.workOrderNumber}
                </DialogTitle>
                <WorkOrderStatusBadge status={workOrder.status} />
                <PriorityBadge priority={workOrder.priority} />
              </View>
              <Text className="text-xs text-muted-foreground">
                Aset: <Text className="font-semibold text-foreground">{workOrder.asset?.name}</Text> ({workOrder.asset?.assetCode}) · Tipe: {workOrder.maintenanceType}
              </Text>
            </View>
          </View>

          {/* Quick Lifecycle Action Buttons (PRD 3.4 & 5.1) */}
          <View className="flex-row flex-wrap gap-2 pt-2">
              {currentStatus === "DRAFT" && (
                <Button size="sm" onPress={() => handleStatusChange("PENDING_APPROVAL")} disabled={busy}>
                  <Text>Ajukan Persetujuan</Text>
                </Button>
              )}
              {currentStatus === "PENDING_APPROVAL" && (
                <Button size="sm" onPress={() => handleStatusChange("APPROVED")} disabled={busy}>
                  <Text>Setujui Work Order</Text>
                </Button>
              )}
              {currentStatus === "APPROVED" && (
                <Button size="sm" onPress={() => handleStatusChange("ASSIGNED")} disabled={busy}>
                  <Text>Tugaskan Teknisi</Text>
                </Button>
              )}
              {currentStatus === "ASSIGNED" && (
                <Button size="sm" onPress={() => handleStatusChange("IN_PROGRESS")} disabled={busy}>
                  <Text>Mulai Dikerjakan (In Progress)</Text>
                </Button>
              )}
              {currentStatus === "IN_PROGRESS" && (
                <>
                  <Button size="sm" variant="outline" onPress={() => handleStatusChange("WAITING_FOR_PARTS")} disabled={busy}>
                    <Text>Menunggu Spare Part</Text>
                  </Button>
                  <Button size="sm" onPress={() => handleStatusChange("COMPLETED")} disabled={busy}>
                    <Text>Tandai Pekerjaan Selesai</Text>
                  </Button>
                </>
              )}
              {(currentStatus === "WAITING_FOR_PARTS" || currentStatus === "WAITING_FOR_VENDOR") && (
                <Button size="sm" onPress={() => handleStatusChange("IN_PROGRESS")} disabled={busy}>
                  <Text>Lanjutkan Pengerjaan</Text>
                </Button>
              )}
              {currentStatus === "COMPLETED" && (
                <Button size="sm" onPress={() => setActiveTab("verify")} disabled={busy}>
                  <Text>Lakukan Verifikasi Supervisor</Text>
                </Button>
              )}
              {currentStatus === "VERIFIED" && (
                <Button size="sm" onPress={() => setActiveTab("verify")} disabled={busy}>
                  <Text>Tutup Work Order (Close)</Text>
                </Button>
              )}
              {currentStatus !== "CLOSED" && currentStatus !== "CANCELLED" && (
                <Button size="sm" variant="outline" onPress={() => handleStatusChange("CANCELLED")} disabled={busy}>
                  <Text style={{ color: "#dc2626" }}>Batalkan WO</Text>
                </Button>
              )}
            </View>
          </DialogHeader>

          {/* Navigation Tabs */}
          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: 1,
              borderColor: "#e5e7eb",
              backgroundColor: "#ffffff",
              paddingHorizontal: 12,
            }}
          >
            {[
              { key: "overview", label: "Ringkasan" },
              { key: "checklists", label: `Checklist (${workOrder.checklists?.length || 0})` },
              { key: "materials", label: `Spare Part (${workOrder.materials?.length || 0})` },
              { key: "labor", label: `Tenaga Kerja (${workOrder.labor?.length || 0})` },
              { key: "costs", label: "Biaya & Finansial" },
              { key: "downtime", label: `Downtime & Foto (${workOrder.attachments?.length || 0})` },
              { key: "verify", label: "Verifikasi & Tutup" },
            ].map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key as any)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderBottomWidth: 2,
                  borderColor: activeTab === tab.key ? colors.primary : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: activeTab === tab.key ? "700" : "500",
                    color: activeTab === tab.key ? colors.primary : "#64748b",
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Tab Content */}
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* 1. OVERVIEW */}
            {activeTab === "overview" && (
              <View style={{ gap: 16 }}>
                <View
                  style={{
                    backgroundColor: "#f5f5f4",
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }}>
                    Informasi Aset & Pekerjaan
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    <View style={{ minWidth: 180 }}>
                      <Text style={{ fontSize: 11, color: "#64748b" }}>Kode & Nama Aset</Text>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>
                        {workOrder.asset?.assetCode} - {workOrder.asset?.name}
                      </Text>
                    </View>
                    <View style={{ minWidth: 140 }}>
                      <Text style={{ fontSize: 11, color: "#64748b" }}>Kondisi Operasional</Text>
                      <AssetConditionBadge condition={workOrder.asset?.condition} />
                    </View>
                    <View style={{ minWidth: 140 }}>
                      <Text style={{ fontSize: 11, color: "#64748b" }}>Lokasi & Departemen</Text>
                      <Text style={{ fontSize: 13, color: "#334155" }}>
                        {workOrder.asset?.location?.name || "-"} ({workOrder.asset?.department || "-"})
                      </Text>
                    </View>
                    <View style={{ minWidth: 140 }}>
                      <Text style={{ fontSize: 11, color: "#64748b" }}>Teknisi Penanggung Jawab</Text>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>
                        {workOrder.assignedToUser?.name || "Belum Ditugaskan"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Deskripsi & Instruksi */}
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#334155" }}>Deskripsi Masalah</Text>
                  <Text style={{ fontSize: 13, color: "#475569", lineHeight: 20 }}>
                    {workOrder.problemDescription}
                  </Text>
                </View>

                {workOrder.workInstruction && (
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#334155" }}>Instruksi Kerja</Text>
                    <Text style={{ fontSize: 13, color: "#475569", lineHeight: 20 }}>
                      {workOrder.workInstruction}
                    </Text>
                  </View>
                )}

                {/* Rencana vs Aktual Waktu */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 16,
                    padding: 14,
                    backgroundColor: "#f5f5f4",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                  }}
                >
                  <View style={{ minWidth: 140 }}>
                    <Text style={{ fontSize: 11, color: "#64748b" }}>Rencana Mulai - Selesai</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>
                      {formatDate(workOrder.plannedStartDate)} s/d {formatDate(workOrder.plannedFinishDate)}
                    </Text>
                  </View>
                  <View style={{ minWidth: 140 }}>
                    <Text style={{ fontSize: 11, color: "#64748b" }}>Mulai Aktual</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>
                      {formatDateTime(workOrder.actualStartDate)}
                    </Text>
                  </View>
                  <View style={{ minWidth: 140 }}>
                    <Text style={{ fontSize: 11, color: "#64748b" }}>Selesai Aktual</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>
                      {formatDateTime(workOrder.actualFinishDate)}
                    </Text>
                  </View>
                  <View style={{ minWidth: 140 }}>
                    <Text style={{ fontSize: 11, color: "#64748b" }}>Total Biaya Akumulasi</Text>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#059669" }}>
                      {formatRupiah(workOrder.totalCost)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* 2. CHECKLISTS & TASKS */}
            {activeTab === "checklists" && (
              <View style={{ gap: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }}>
                    Daftar Pemeriksaan & Checklist
                  </Text>
                  <Button size="sm" variant="outline" onPress={() => setShowTaskForm(!showTaskForm)}>
                    <Text>+ Tambah Task</Text>
                  </Button>
                </View>

                {showTaskForm && (
                  <View style={{ backgroundColor: "#f5f5f4", padding: 14, borderRadius: 8, gap: 10, borderWidth: 1, borderColor: "#e5e7eb" }}>
                    <Input placeholder="Nama task pekerjaan..." value={newTaskName} onChangeText={setNewTaskName} />
                    <Input placeholder="Instruksi tambahan (opsional)..." value={newTaskInstruction} onChangeText={setNewTaskInstruction} />
                    <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                      <Button size="sm" variant="outline" onPress={() => setShowTaskForm(false)}><Text>Batal</Text></Button>
                      <Button size="sm" onPress={handleCreateTask} disabled={busy}><Text>Simpan Task</Text></Button>
                    </View>
                  </View>
                )}

                {/* Checklist Aktual */}
                {workOrder.checklists && workOrder.checklists.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {workOrder.checklists.map((chk) => (
                      <View
                        key={chk.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: 12,
                          backgroundColor: "#ffffff",
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "#e5e7eb",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>
                            {chk.itemText}
                          </Text>
                          {chk.conditionBefore && (
                            <Text style={{ fontSize: 11, color: "#64748b" }}>
                              Standar: {chk.conditionBefore}
                            </Text>
                          )}
                        </View>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {(["PASS", "FAIL", "NEEDS_ATTENTION"] as const).map((st) => (
                            <Pressable
                              key={st}
                              onPress={() => onUpdateChecklist(chk.id!, { status: st })}
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                                backgroundColor: chk.status === st ? (st === "PASS" ? "#dcfce7" : st === "FAIL" ? "#fee2e2" : "#fef3c7") : "#f5f5f4",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "600",
                                  color: chk.status === st ? (st === "PASS" ? "#16a34a" : st === "FAIL" ? "#dc2626" : "#d97706") : "#64748b",
                                }}
                              >
                                {st}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>
                    Belum ada checklist pada Work Order ini.
                  </Text>
                )}
              </View>
            )}

            {/* 3. MATERIALS / SPARE PARTS */}
            {activeTab === "materials" && (
              <View style={{ gap: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }}>
                    Kebutuhan Spare Part & Material
                  </Text>
                  <Button size="sm" onPress={() => setShowMaterialForm(!showMaterialForm)}>
                    <Text>+ Tambah Spare Part</Text>
                  </Button>
                </View>

                {showMaterialForm && (
                  <View style={{ backgroundColor: "#f5f5f4", padding: 14, borderRadius: 10, gap: 10, borderWidth: 1, borderColor: "#e5e7eb" }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>Pilih dari Stok Gudang (Opsional)</Text>
                    <SearchableSelect
                      placeholder="-- Pilih Produk Gudang --"
                      value={
                        matProductId
                          ? lookups.products.find((p) => p.id === Number(matProductId))
                            ? `${matProductId} - ${lookups.products.find((p) => p.id === Number(matProductId))?.name}`
                            : ""
                          : ""
                      }
                      options={lookups.products.map((p) => `${p.id} - ${p.name} (SKU: ${p.sku || "-"})`)}
                      onChange={(val) => {
                        const pId = val ? Number(val.split(" - ")[0]) : "";
                        setMatProductId(pId);
                        const sel = lookups.products.find((p) => p.id === pId);
                        if (sel) {
                          setMatName(sel.name);
                          setMatUnit(sel.unit || "PCS");
                          setMatUnitCost(String(sel.purchasePrice || 0));
                        }
                      }}
                      clearable
                    />
                    <Input placeholder="Nama spare part / komponen *" value={matName} onChangeText={setMatName} />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Input placeholder="Jumlah (Qty)" value={matQty} onChangeText={setMatQty} keyboardType="numeric" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input placeholder="Satuan (Pcs/Ltr)" value={matUnit} onChangeText={setMatUnit} />
                      </View>
                      <View style={{ flex: 2 }}>
                        <Input placeholder="Harga Satuan (Rp)" value={matUnitCost} onChangeText={setMatUnitCost} keyboardType="numeric" />
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                      <Button size="sm" variant="outline" onPress={() => setShowMaterialForm(false)}><Text>Batal</Text></Button>
                      <Button size="sm" onPress={handleCreateMaterial} disabled={busy}><Text>Simpan Spare Part</Text></Button>
                    </View>
                  </View>
                )}

                {/* Daftar Spare Part */}
                {workOrder.materials && workOrder.materials.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {workOrder.materials.map((mat) => (
                      <View
                        key={mat.id}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: 12,
                          backgroundColor: "#ffffff",
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "#e5e7eb",
                        }}
                      >
                        <View style={{ gap: 2 }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>
                            {mat.sparePartName}
                          </Text>
                          <Text style={{ fontSize: 11, color: "#64748b" }}>
                            {mat.quantity} {mat.unit} @ {formatRupiah(mat.unitCost)} · Sumber: {mat.source}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#059669" }}>
                            {formatRupiah(mat.totalCost)}
                          </Text>
                          <Pressable onPress={() => onDeleteMaterial(mat.id)} hitSlop={6}>
                            <Trash2 size={16} color="#dc2626" />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>
                    Belum ada spare part yang dicatat.
                  </Text>
                )}
              </View>
            )}

            {/* 4. LABOR */}
            {activeTab === "labor" && (
              <View style={{ gap: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }}>
                    Catatan Tenaga Kerja & Jam Kerja
                  </Text>
                  <Button size="sm" onPress={() => setShowLaborForm(!showLaborForm)}>
                    <Text>+ Catat Jam Kerja</Text>
                  </Button>
                </View>

                {showLaborForm && (
                  <View style={{ backgroundColor: "#f5f5f4", padding: 14, borderRadius: 10, gap: 10, borderWidth: 1, borderColor: "#e5e7eb" }}>
                    <UserSelect
                      userId={laborTechId}
                      onChange={(u) => setLaborTechId(u ? Number(u.id) : "")}
                      placeholder="Cari & pilih teknisi penanggung jawab..."
                    />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Input placeholder="Durasi Jam" value={laborHours} onChangeText={setLaborHours} keyboardType="numeric" />
                      </View>
                      <View style={{ flex: 2 }}>
                        <Input placeholder="Tarif Per Jam (Rp)" value={laborRate} onChangeText={setLaborRate} keyboardType="numeric" />
                      </View>
                    </View>
                    <Input placeholder="Uraian pekerjaan yang dilakukan..." value={laborDesc} onChangeText={setLaborDesc} />
                    <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                      <Button size="sm" variant="outline" onPress={() => setShowLaborForm(false)}><Text>Batal</Text></Button>
                      <Button size="sm" onPress={handleCreateLabor} disabled={busy}><Text>Simpan Jam Kerja</Text></Button>
                    </View>
                  </View>
                )}

                {/* Labor list */}
                {workOrder.labor && workOrder.labor.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {workOrder.labor.map((lab) => (
                      <View
                        key={lab.id}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: 12,
                          backgroundColor: "#ffffff",
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "#e5e7eb",
                        }}
                      >
                        <View style={{ gap: 2 }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>
                            {lab.technicianName}
                          </Text>
                          <Text style={{ fontSize: 11, color: "#64748b" }}>
                            {lab.hoursSpent} jam @ {formatRupiah(lab.hourlyRate)}/jam {lab.workDescription ? `· ${lab.workDescription}` : ""}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#059669" }}>
                            {formatRupiah(lab.laborCost)}
                          </Text>
                          <Pressable onPress={() => onDeleteLabor(lab.id)} hitSlop={6}>
                            <Trash2 size={16} color="#dc2626" />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>
                    Belum ada jam kerja yang dicatat.
                  </Text>
                )}
              </View>
            )}

            {/* 5. COSTS & CAPITALIZATION */}
            {activeTab === "costs" && (
              <View style={{ gap: 16 }}>
                {/* 5 Komponen Biaya Sesuai PRD Bab 3.6 */}
                <View
                  style={{
                    backgroundColor: "#f5f5f4",
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }}>
                    Total Biaya Maintenance (5 Komponen PRD)
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    <View style={{ minWidth: 140 }}>
                      <Text style={{ fontSize: 11, color: "#64748b" }}>1. Spare Part Cost</Text>
                      <Text style={{ fontSize: 13, fontWeight: "600" }}>{formatRupiah(workOrder.totalSparePartCost)}</Text>
                    </View>
                    <View style={{ minWidth: 140 }}>
                      <Text style={{ fontSize: 11, color: "#64748b" }}>2. Labor Cost</Text>
                      <Text style={{ fontSize: 13, fontWeight: "600" }}>{formatRupiah(workOrder.totalLaborCost)}</Text>
                    </View>
                    <View style={{ minWidth: 140 }}>
                      <Text style={{ fontSize: 11, color: "#64748b" }}>3. External Service</Text>
                      <Text style={{ fontSize: 13, fontWeight: "600" }}>{formatRupiah(workOrder.totalExternalServiceCost)}</Text>
                    </View>
                    <View style={{ minWidth: 140 }}>
                      <Text style={{ fontSize: 11, color: "#64748b" }}>4. Transportation</Text>
                      <Text style={{ fontSize: 13, fontWeight: "600" }}>{formatRupiah(workOrder.totalTransportationCost)}</Text>
                    </View>
                    <View style={{ minWidth: 140 }}>
                      <Text style={{ fontSize: 11, color: "#64748b" }}>5. Other Cost</Text>
                      <Text style={{ fontSize: 13, fontWeight: "600" }}>{formatRupiah(workOrder.totalOtherCost)}</Text>
                    </View>
                  </View>
                  <View style={{ borderTopWidth: 1, borderColor: "#e5e7eb", paddingTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }}>Grand Total</Text>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: "#059669" }}>{formatRupiah(workOrder.totalCost)}</Text>
                  </View>
                </View>

                {/* Capitalization Card (PRD 4.4) */}
                <View
                  style={{
                    backgroundColor: workOrder.isCapitalized ? "#ecfdf5" : "#f5f5f4",
                    padding: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: workOrder.isCapitalized ? "#a7f3d0" : "#e5e7eb",
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#0f172a" }}>
                    Status Kapitalisasi (Capitalizable Improvement)
                  </Text>
                  <Text style={{ fontSize: 12, color: "#475569" }}>
                    {workOrder.isCapitalized
                      ? "Work order ini DISETUJUI untuk dikapitalisasi dan telah ditambahkan ke nilai buku aset di Fixed Asset Management."
                      : "Biaya ini secara default diperlakukan sebagai Beban Pemeliharaan (Maintenance Expense). Jika perbaikan ini menambah masa manfaat aset secara signifikan, Anda dapat mengajukan kapitalisasi."}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <Button
                      size="sm"
                      variant={workOrder.isCapitalized ? "outline" : "default"}
                      onPress={() => onEvaluateCapitalization(workOrder.id, !workOrder.isCapitalized)}
                    >
                      <Text>{workOrder.isCapitalized ? "Batalkan Kapitalisasi" : "Setujui Kapitalisasi ke Nilai Aset"}</Text>
                    </Button>
                  </View>
                </View>

                {/* Add Cost Button & Form */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }}>Rincian Biaya Eksternal & Lainnya</Text>
                  <Button size="sm" onPress={() => setShowCostForm(!showCostForm)}>
                    <Text>+ Tambah Biaya</Text>
                  </Button>
                </View>

                {showCostForm && (
                  <View style={{ backgroundColor: "#f5f5f4", padding: 14, borderRadius: 10, gap: 10, borderWidth: 1, borderColor: "#e5e7eb" }}>
                    <SearchableSelect
                      value={
                        [
                          "EXTERNAL_SERVICE - Jasa Servis Eksternal / Bengkel",
                          "TRANSPORTATION - Biaya Transportasi / Kurir",
                          "OTHER - Biaya Lain-lain (Other)",
                        ].find((o) => o.startsWith(costComp)) ?? costComp
                      }
                      options={[
                        "EXTERNAL_SERVICE - Jasa Servis Eksternal / Bengkel",
                        "TRANSPORTATION - Biaya Transportasi / Kurir",
                        "OTHER - Biaya Lain-lain (Other)",
                      ]}
                      onChange={(val) => setCostComp(val ? val.split(" - ")[0] ?? "EXTERNAL_SERVICE" : "EXTERNAL_SERVICE")}
                    />
                    <Input placeholder="Uraian biaya *" value={costDesc} onChangeText={setCostDesc} />
                    <Input placeholder="Nominal biaya (Rp) *" value={costAmt} onChangeText={setCostAmt} keyboardType="numeric" />
                    <SearchableSelect
                      placeholder="-- Pilih Vendor (Opsional) --"
                      value={
                        costVendorId
                          ? lookups.vendors.find((v) => v.id === Number(costVendorId))
                            ? `${costVendorId} - ${lookups.vendors.find((v) => v.id === Number(costVendorId))?.name}`
                            : ""
                          : ""
                      }
                      options={lookups.vendors.map((v) => `${v.id} - ${v.name} (${v.code})`)}
                      onChange={(val) => setCostVendorId(val ? Number(val.split(" - ")[0]) : "")}
                      clearable
                    />
                    <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                      <Button size="sm" variant="outline" onPress={() => setShowCostForm(false)}><Text>Batal</Text></Button>
                      <Button size="sm" onPress={handleCreateCost} disabled={busy}><Text>Simpan Biaya</Text></Button>
                    </View>
                  </View>
                )}

                {/* Costs list */}
                {workOrder.costs && workOrder.costs.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {workOrder.costs.map((c) => (
                      <View
                        key={c.id}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: 12,
                          backgroundColor: "#ffffff",
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "#e5e7eb",
                        }}
                      >
                        <View style={{ gap: 2 }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>
                            {c.description}
                          </Text>
                          <Text style={{ fontSize: 11, color: "#64748b" }}>
                            Komponen: {c.costComponent} {c.vendor ? `· Vendor: ${c.vendor.name}` : ""} · Tgl: {formatDate(c.incurredDate)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#059669" }}>
                            {formatRupiah(c.amount)}
                          </Text>
                          <Pressable onPress={() => onDeleteCost(c.id)} hitSlop={6}>
                            <Trash2 size={16} color="#dc2626" />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>
                    Belum ada biaya eksternal tambahan.
                  </Text>
                )}
              </View>
            )}

            {/* 6. DOWNTIME & FOTO */}
            {activeTab === "downtime" && (
              <View style={{ gap: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }}>Catatan Downtime Aset</Text>
                  <Button size="sm" variant="outline" onPress={() => setShowDowntimeForm(!showDowntimeForm)}>
                    <Text>+ Catat Downtime</Text>
                  </Button>
                </View>

                {showDowntimeForm && (
                  <View style={{ backgroundColor: "#f5f5f4", padding: 14, borderRadius: 10, gap: 10, borderWidth: 1, borderColor: "#e5e7eb" }}>
                    <Input placeholder="Waktu Mulai Mati (YYYY-MM-DDTHH:mm)" value={dtStart} onChangeText={setDtStart} />
                    <Input placeholder="Waktu Nyala Kembali (Opsional)" value={dtEnd} onChangeText={setDtEnd} />
                    <Input placeholder="Penyebab downtime *" value={dtCause} onChangeText={setDtCause} />
                    <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                      <Button size="sm" variant="outline" onPress={() => setShowDowntimeForm(false)}><Text>Batal</Text></Button>
                      <Button size="sm" onPress={handleCreateDowntime} disabled={busy}><Text>Simpan Downtime</Text></Button>
                    </View>
                  </View>
                )}

                {/* Downtime items */}
                {workOrder.downtimes && workOrder.downtimes.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {workOrder.downtimes.map((dt) => (
                      <View key={dt.id} style={{ padding: 12, backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb" }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>{dt.cause}</Text>
                        <Text style={{ fontSize: 11, color: "#64748b" }}>
                          Mulai: {formatDateTime(dt.downtimeStart)} · Durasi: {dt.durationHours} jam · Status: {dt.status}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Attachments & Photos */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }}>Foto Sebelum & Sesudah Servis</Text>
                  <Button size="sm" onPress={() => setShowAttachForm(!showAttachForm)}>
                    <Text>+ Unggah Foto / File</Text>
                  </Button>
                </View>

                {showAttachForm && (
                  <View style={{ backgroundColor: "#f5f5f4", padding: 14, borderRadius: 10, gap: 10, borderWidth: 1, borderColor: "#e5e7eb" }}>
                    <SearchableSelect
                      value={
                        [
                          "BEFORE_PHOTO - Foto Sebelum Perbaikan (Before)",
                          "AFTER_PHOTO - Foto Sesudah Perbaikan (After)",
                          "INVOICE - Invoice / Nota Servis",
                          "BAST - Berita Acara / BAST",
                        ].find((o) => o.startsWith(attachType)) ?? attachType
                      }
                      options={[
                        "BEFORE_PHOTO - Foto Sebelum Perbaikan (Before)",
                        "AFTER_PHOTO - Foto Sesudah Perbaikan (After)",
                        "INVOICE - Invoice / Nota Servis",
                        "BAST - Berita Acara / BAST",
                      ]}
                      onChange={(val) => setAttachType(val ? val.split(" - ")[0] ?? "BEFORE_PHOTO" : "BEFORE_PHOTO")}
                    />
                    <Input placeholder="Judul lampiran *" value={attachTitle} onChangeText={setAttachTitle} />
                    <Input placeholder="URL file / ID berkas *" value={attachUrl} onChangeText={setAttachUrl} />
                    <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                      <Button size="sm" variant="outline" onPress={() => setShowAttachForm(false)}><Text>Batal</Text></Button>
                      <Button size="sm" onPress={handleCreateAttachment} disabled={busy}><Text>Simpan Lampiran</Text></Button>
                    </View>
                  </View>
                )}

                {/* Attachments list */}
                {workOrder.attachments && workOrder.attachments.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {workOrder.attachments.map((att) => (
                      <View key={att.id} style={{ padding: 10, backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", minWidth: 160 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#0f172a" }}>{att.title}</Text>
                        <Text style={{ fontSize: 10, color: "#64748b" }}>Tipe: {att.documentType}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>Belum ada foto atau dokumen penunjang.</Text>
                )}
              </View>
            )}

            {/* 7. VERIFICATION & CLOSE */}
            {activeTab === "verify" && (
              <View style={{ gap: 16 }}>
                <View
                  style={{
                    backgroundColor: "#f5f5f4",
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }}>
                    Form Verifikasi Supervisor & Penutupan Resmi
                  </Text>
                  <Text style={{ fontSize: 12, color: "#475569" }}>
                    Sesuai kebijakan Bab 3.4 & Bab 12 PRD: Work Order tidak dapat ditutup sebelum hasil pekerjaan diperiksa dan diverifikasi secara resmi. Saat ditutup, riwayat otomatis dicatat ke histori aset dan kondisi aset disinkronkan kembali.
                  </Text>

                  {/* Verifikasi */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>
                      Catatan Verifikasi Supervisor <Text style={{ color: "#dc2626" }}>*</Text>
                    </Text>
                    <Textarea
                      placeholder="Tuliskan hasil evaluasi pemeriksaan bahwa aset sudah selesai dikerjakan dengan baik..."
                      value={verifyNotes}
                      onChangeText={setVerifyNotes}
                      numberOfLines={3}
                    />
                    <View style={{ alignSelf: "flex-start", marginTop: 4 }}>
                      <Button size="sm" variant="outline" onPress={handleVerifySubmit} disabled={busy}>
                        <Text>Simpan Verifikasi (Status: Verified)</Text>
                      </Button>
                    </View>
                  </View>

                  {/* Penutupan Resmi */}
                  <View style={{ borderTopWidth: 1, borderColor: "#e5e7eb", paddingTop: 12, gap: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>
                      Kondisi Akhir Operasional Aset Setelah Selesai Servis
                    </Text>
                    <SearchableSelect
                      value={
                        [
                          "GOOD - Baik (Good) - Beroperasi Normal",
                          "FAIR - Cukup (Fair) - Perlu Pemantauan Berkala",
                          "POOR - Buruk (Poor) - Masih Bermasalah Sebagian",
                          "DAMAGED - Rusak (Damaged) - Tidak Dapat Diperbaiki",
                        ].find((o) => o.startsWith(finalStatus)) ?? finalStatus
                      }
                      options={[
                        "GOOD - Baik (Good) - Beroperasi Normal",
                        "FAIR - Cukup (Fair) - Perlu Pemantauan Berkala",
                        "POOR - Buruk (Poor) - Masih Bermasalah Sebagian",
                        "DAMAGED - Rusak (Damaged) - Tidak Dapat Diperbaiki",
                      ]}
                      onChange={(val) => setFinalStatus(val ? val.split(" - ")[0] ?? "GOOD" : "GOOD")}
                    />

                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>
                      Catatan Hasil Akhir Pekerjaan (Work Result)
                    </Text>
                    <Textarea
                      placeholder="Kesimpulan penutupan WO, rekomendasi berikutnya..."
                      value={closingNotes}
                      onChangeText={setClosingNotes}
                      numberOfLines={2}
                    />

                    <View style={{ marginTop: 6 }}>
                      <Button onPress={handleCloseSubmit} disabled={busy || currentStatus === "CLOSED"}>
                        <Text>{currentStatus === "CLOSED" ? "Work Order Sudah Ditutup" : "Tutup Work Order Resmi (Close)"}</Text>
                      </Button>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <DialogFooter className="border-t border-border/70 px-6 py-3">
            <Button variant="outline" onPress={onClose}>
              <Text>Tutup Dialog</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
