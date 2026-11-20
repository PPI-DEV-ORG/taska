import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/akuntra/basics";
import { useApp } from "@/store/app-store";
import { api } from "@/services/api";
import { AccountSelect, useCashAccounts } from "@/modules/cash-advance/cash-advance-dialogs";
import { formatRupiah, formatPeriodLabel } from "../types";

export type PayTarget =
  | { mode: "one"; id: number | string; name: string; amount: number }
  | { mode: "all"; period: string; count: number; amount: number };

/** Bayar gaji dari akun kas / bank: satu slip atau semua slip DRAFT satu periode. */
export function PayrollPayDialog({ target, onClose, onPaid }: { target: PayTarget | null; onClose: () => void; onPaid: (slip?: any) => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      {target ? <PayInner target={target} onClose={onClose} onPaid={onPaid} /> : null}
    </Dialog>
  );
}

function PayInner({ target, onClose, onPaid }: { target: PayTarget; onClose: () => void; onPaid: (slip?: any) => void }) {
  const { toast } = useApp();
  const accounts = useCashAccounts();
  const [account, setAccount] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function pay() {
    if (!account) return toast("Pilih akun kas / bank", "danger");
    setBusy(true);
    try {
      if (target.mode === "one") {
        const slip = await api<any>("POST", `/hr/payroll/slips/${target.id}/pay`, { paidAccountCode: account });
        toast(`Gaji ${target.name} dibayar`, "success");
        onPaid(slip);
      } else {
        const res = await api<any>("POST", "/hr/payroll/pay-period", { period: target.period, paidAccountCode: account });
        const failed = Array.isArray(res?.failed) ? res.failed.length : 0;
        toast(failed ? `${res.paid} slip dibayar, ${failed} gagal: ${res.failed[0]?.error ?? ""}` : `${res.paid} slip gaji dibayar`, failed ? "danger" : "success");
        onPaid();
      }
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Gagal membayar gaji", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="w-[94vw] max-w-md">
      <DialogHeader className="pr-8">
        <DialogTitle>{target.mode === "one" ? `Bayar gaji ${target.name}` : `Bayar semua gaji ${formatPeriodLabel(target.period)}`}</DialogTitle>
      </DialogHeader>
      <View className="gap-3 py-1">
        <View className="rounded-xl bg-primary/10 px-4 py-3">
          <Text className="text-xs text-muted-foreground">{target.mode === "one" ? "Gaji bersih" : `${target.count} slip · total gaji bersih`}</Text>
          <Text className="text-2xl font-bold text-primary">{formatRupiah(target.amount)}</Text>
        </View>
        <FormField label="Dibayar dari" required>
          <AccountSelect value={account} onChange={setAccount} accounts={accounts} />
        </FormField>
        <Text className="text-[11px] text-muted-foreground">
          Jurnal otomatis: beban gaji & BPJS perusahaan, hutang PPh 21 & BPJS (disetor terpisah), lalu kas/bank keluar sebesar gaji bersih.
        </Text>
      </View>
      <DialogFooter className="flex-row justify-end gap-2">
        <Button variant="outline" onPress={onClose} disabled={busy}>
          <Text>Batal</Text>
        </Button>
        <Button onPress={pay} disabled={busy} className="bg-emerald-600">
          <Text className="text-white font-semibold">{busy ? "Memproses..." : "Bayar"}</Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
