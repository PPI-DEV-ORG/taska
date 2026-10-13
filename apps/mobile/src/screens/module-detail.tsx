import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown, Pencil, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pressable } from "react-native";
import { EmptyState, InfoGrid, PageHeader, Panel, Timeline } from "@/components/taska/basics";
import { ApprovalBar, ConfirmDialog, FormDialog } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { StatusBadge } from "@/components/taska/status-badge";
import { ModuleExtras, downloadQuotationTemplate } from "@/screens/module-extras";
import { useApp } from "@/store/app-store";
import { CAN_APPROVE, MODULES, type ModuleAction } from "@/constants/modules";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";

export function ModuleDetail({ moduleKey, id }: { moduleKey: string; id: string }) {
  const router = useRouter();
  const { data, user, addRow, patchRow, deleteRow, setStatus, history, approvals, decide, toast } = useApp();
  const def = MODULES[moduleKey];
  const row = data[moduleKey]?.find((r: { id: string }) => r.id === id);
  const lostReasons: string[] = (data.lostReasons ?? []).map((r: any) => String(r.nama)).filter(Boolean);
  const [menu, setMenu] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  if (!def || !row) {
    return <EmptyState title="Data tidak ditemukan" text="Dokumen ini mungkin sudah diarsipkan atau tautannya salah." actionLabel="Kembali ke daftar" onAction={() => router.replace(`/${moduleKey}` as any)} />;
  }

  const status = def.statusKey ? String(row[def.statusKey] ?? "") : "";
  const approval = approvals.find((a) => a.module === moduleKey && a.refId === id && a.status === "Menunggu");
  const canDecide = !!approval && CAN_APPROVE.includes(user!.role);
  const editableFields = def.createFields?.length ? def.createFields : def.fields.map((f) => ({ key: f.key, label: f.label, type: f.fmt === "rp" || f.fmt === "num" ? "number" as const : f.fmt === "date" ? "date" as const : "text" as const }));

  function pick(s: string) {
    setMenu(false);
    if (s === status) return;
    if (def?.confirmStatuses?.includes(s)) setPending(s);
    else setStatus(moduleKey, id, s);
  }
  function run(a: ModuleAction) {
    if (a.label === "Minta survey") {
      addRow("surveys", {
        lead: row.nama,
        lokasi: row.perusahaan || "Lokasi Klien",
        jadwal: new Date().toISOString().slice(0, 10),
        se: data.users?.find((u: any) => u.role === "se")?.nama || "Andi Pratama",
        status: "Terjadwal",
      });
    } else if (a.label === "Jadikan project") {
      addRow("projects", {
        nama: `Project ${row.customer}`,
        customer: row.customer,
        jenis: "Instalasi",
        pm: data.users?.find((u: any) => u.role === "pm")?.nama || "Dimas Prasetyo",
        mulai: new Date().toISOString().slice(0, 10),
        selesai: row.targetSelesai || new Date().toISOString().slice(0, 10),
        status: "Berjalan",
      });
    } else if (a.label === "Buat PO supplier") {
      addRow("supplier-pos", {
        supplier: data.suppliers?.[0]?.nama || "Supplier Utama",
        request: row.nomor,
        item: row.item,
        total: row.estimasi || 0,
        status: "Draft",
      });
    } else if (a.label === "Catat pembayaran") {
      patchRow("invoices", id, { terbayar: row.nilai, status: "Lunas" });
    }
    if (a.status) setStatus(moduleKey, id, a.status);
    else if (a.toast) toast(a.toast);
    if (a.to && row) router.push(a.to(row) as any);
  }

  const isLead = moduleKey === "leads";
  const canOfferLead = ["Qualification", "Proposal", "Negotiation"].includes(String(row.status));
  const filteredActions = (def.actions ?? []).filter((a) => {
    if (isLead && a.label === "Download template penawaran") {
      return canOfferLead;
    }
    return true;
  });

  const [primary, ...secondary] = filteredActions;
  const isLost = pending === "Lost";

  function handlePrimaryAction(a: ModuleAction) {
    if (isLead && a.label === "Download template penawaran") {
      downloadQuotationTemplate({
        leadId: row?.id,
        customer: row?.perusahaan,
        lead: row?.nama,
        signer: row?.pemilik,
      });
      toast(a.toast || "Template Excel penawaran (.xlsx) berhasil diunduh");
      return;
    }
    run(a);
  }

  return (
    <>
      <PageHeader
        back
        title={def.titleOf(row)}
        subtitle={def.subtitleOf?.(row)}
        status={status || undefined}
        action={
          <>
            {editableFields.length > 0 ? (
              <Button variant="outline" onPress={() => setEditOpen(true)}>
                <Pencil size={15} color={colors.text} />
                <Text>Ubah</Text>
              </Button>
            ) : null}
            <Button variant="outline" onPress={() => setDeleteOpen(true)}>
              <Trash2 size={15} color={colors.danger} />
              <Text className="text-danger">Hapus</Text>
            </Button>
            {def.statuses.length > 1 && !(isLead && (user?.role === "bos" || user?.role === "admin")) ? (
              <Button variant="outline" onPress={() => setMenu(true)}>
                <Text>Ubah status</Text>
                <ChevronDown size={16} color={colors.text} />
              </Button>
            ) : null}
            {secondary.map((a) => (
              <Button key={a.label} variant="outline" onPress={() => handlePrimaryAction(a)}><Text>{a.label}</Text></Button>
            ))}
            {primary ? <Button onPress={() => handlePrimaryAction(primary)}><Text>{primary.label}</Text></Button> : null}
          </>
        }
      />

      <View className="gap-4">
        {canDecide ? (
          <ApprovalBar
            amount={approval!.nilai}
            financeOk={(approval as any).financeOk}
            onApprove={() => decide(approval!.id, "Disetujui")}
            onReject={(r) => decide(approval!.id, "Ditolak", r)}
          />
        ) : null}

        {def.fields.length ? (
          <Panel title="Informasi"><InfoGrid fields={def.fields} row={row} /></Panel>
        ) : null}

        <ModuleExtras moduleKey={moduleKey} row={row} />

        {def.docs?.length ? (
          <Panel title="File dan bukti">
            <View className="gap-4">
              {def.docs.map((d) => (
                <FileUploader key={d} label={d} kind={/foto|nota|video/i.test(d) ? "foto" : "semua"} autoFlush />
              ))}
            </View>
          </Panel>
        ) : null}

        <Panel title="Riwayat"><Timeline items={history(moduleKey, id)} /></Panel>
      </View>

      <Dialog open={menu} onOpenChange={setMenu}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Ubah status</DialogTitle></DialogHeader>
          <Text className="text-muted-foreground text-sm">Status boleh dipilih bebas. Setiap perubahan tercatat di riwayat.</Text>
          {def.statuses.map((s) => (
            <Pressable key={s} onPress={() => pick(s)} className={cn("hover:bg-panel active:bg-panel min-h-[44px] justify-center rounded-lg px-2", s === status && "bg-primary/15")}>
              <StatusBadge status={s} />
            </Pressable>
          ))}
        </DialogContent>
      </Dialog>

      <FormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title={`Ubah ${def.singular}`}
        fields={editableFields}
        initialRow={row}
        mode="edit"
        submitLabel="Simpan Perubahan"
        onSubmit={(patch) => patchRow(moduleKey, id, patch)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Hapus ${def.singular} ini?`}
        description="Data yang dihapus tidak dapat dikembalikan."
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={() => {
          void deleteRow(moduleKey, id).then((ok) => {
            if (ok) router.replace(`/${moduleKey}` as any);
          });
        }}
      />

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={isLost ? "Tandai lead ini Lost?" : `Ubah status ke ${pending}?`}
        description={
          isLost
            ? "Lead pindah ke kolom Lost dan tidak muncul di pipeline aktif. Data tetap tersimpan dan bisa dibuka lagi."
            : "Pihak terkait akan diberi tahu. Perubahan ini tercatat di audit log."
        }
        confirmLabel="Ya, ubah"
        destructive
        reasonLabel={isLost ? "Alasan Lost" : undefined}
        reasonOptions={isLost ? lostReasons : undefined}
        onConfirm={(r) => pending && setStatus(moduleKey, id, pending, r)}
      />
    </>
  );
}
