import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pressable } from "react-native";
import { EmptyState, InfoGrid, PageHeader, Panel, Timeline } from "@/components/taska/basics";
import { ApprovalBar, ConfirmDialog } from "@/components/taska/dialogs";
import { FileUploader } from "@/components/taska/file-uploader";
import { StatusBadge } from "@/components/taska/status-badge";
import { ModuleExtras } from "@/screens/module-extras";
import { useApp } from "@/store/app-store";
import { CAN_APPROVE, MODULES, type ModuleAction } from "@/mock/modules";
import { LOST_REASONS } from "@/mock/data";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";

export function ModuleDetail({ moduleKey, id }: { moduleKey: string; id: string }) {
  const router = useRouter();
  const { data, user, setStatus, history, approvals, decide, toast } = useApp();
  const def = MODULES[moduleKey];
  const row = data[moduleKey]?.find((r) => r.id === id);
  const [menu, setMenu] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);

  if (!def || !row) {
    return <EmptyState title="Data tidak ditemukan" text="Dokumen ini mungkin sudah diarsipkan atau tautannya salah." actionLabel="Kembali ke daftar" onAction={() => router.replace(`/${moduleKey}` as any)} />;
  }

  const status = def.statusKey ? String(row[def.statusKey] ?? "") : "";
  const approval = approvals.find((a) => a.module === moduleKey && a.refId === id && a.status === "Menunggu");
  const canDecide = !!approval && CAN_APPROVE.includes(user!.role);

  function pick(s: string) {
    setMenu(false);
    if (s === status) return;
    if (def?.confirmStatuses?.includes(s)) setPending(s);
    else setStatus(moduleKey, id, s);
  }
  function run(a: ModuleAction) {
    if (a.status) setStatus(moduleKey, id, a.status);
    else if (a.toast) toast(a.toast);
    if (a.to && row) router.push(a.to(row) as any);
  }

  const [primary, ...secondary] = def.actions ?? [];
  const isLost = pending === "Lost";

  return (
    <>
      <PageHeader
        back
        title={def.titleOf(row)}
        subtitle={def.subtitleOf?.(row)}
        status={status || undefined}
        action={
          <>
            {def.statuses.length > 1 ? (
              <Button variant="outline" onPress={() => setMenu(true)}>
                <Text>Ubah status</Text>
                <ChevronDown size={16} color={colors.text} />
              </Button>
            ) : null}
            {secondary.map((a) => (
              <Button key={a.label} variant="outline" onPress={() => run(a)}><Text>{a.label}</Text></Button>
            ))}
            {primary ? <Button onPress={() => run(primary)}><Text>{primary.label}</Text></Button> : null}
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
                <FileUploader key={d} label={d} kind={/foto|nota|video/i.test(d) ? "foto" : "semua"} />
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
        reasonOptions={isLost ? LOST_REASONS : undefined}
        onConfirm={(r) => pending && setStatus(moduleKey, id, pending, r)}
      />
    </>
  );
}
