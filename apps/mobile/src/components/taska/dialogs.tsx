import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Check, ChevronDown, Search } from "lucide-react-native";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { colors, BOS_THRESHOLD } from "@/tokens";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ModuleDef } from "@/mock/modules";

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "Ya, lanjutkan", destructive, onConfirm, reasonLabel, reasonOptions,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description: string; confirmLabel?: string;
  destructive?: boolean; onConfirm: (reason?: string) => void; reasonLabel?: string; reasonOptions?: string[];
}) {
  const [prevOpen, setPrevOpen] = React.useState(open);
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState("");

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setReason("");
      setErr("");
    }
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setReason("");
      setErr("");
    }
    onOpenChange(v);
  }

  function go() {
    if (reasonLabel && !reason.trim()) { setErr(`${reasonLabel} wajib diisi.`); return; }
    handleOpenChange(false);
    onConfirm(reason.trim() || undefined);
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {reasonLabel ? (
          <FormField label={reasonLabel} required error={err}>
            {reasonOptions ? (
              <SearchableSelect value={reason} onChange={setReason} options={reasonOptions} placeholder="Pilih alasan" />
            ) : (
              <Textarea value={reason} onChangeText={setReason} placeholder="Tulis alasan singkat" />
            )}
          </FormField>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onPress={() => onOpenChange(false)}><Text>Batal</Text></Button>
          <Button variant={destructive ? "destructive" : "default"} onPress={go}><Text>{confirmLabel}</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SearchableSelect({
  value, onChange, options, placeholder = "Pilih", error,
}: { value?: string; onChange: (v: string) => void; options: string[]; placeholder?: string; error?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const list = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Pressable
        onPress={() => { setQ(""); setOpen(true); }}
        className={cn("bg-input border-border h-11 flex-row items-center justify-between rounded-lg border px-3", error && "border-danger")}
      >
        <Text className={cn("text-base md:text-sm", !value && "text-muted-foreground")} numberOfLines={1}>{value || placeholder}</Text>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{placeholder}</DialogTitle></DialogHeader>
          {options.length > 6 ? (
            <View className="bg-input border-border h-11 flex-row items-center gap-2 rounded-lg border px-3">
              <Search size={16} color={colors.muted} />
              <Input
                value={q}
                onChangeText={setQ}
                placeholder="Cari"
                className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
              />
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 320 }}>
            {list.map((o) => (
              <Pressable
                key={o}
                onPress={() => { onChange(o); setOpen(false); }}
                className="active:bg-panel hover:bg-panel min-h-[44px] flex-row items-center justify-between rounded-lg px-3"
              >
                <Text className="flex-1 text-sm">{o}</Text>
                {o === value ? <Check size={16} color={colors.primary} /> : null}
              </Pressable>
            ))}
            {list.length === 0 ? <Text className="text-muted-foreground px-3 py-4 text-sm">Tidak ditemukan.</Text> : null}
          </ScrollView>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FormDialog({ def, open, onOpenChange }: { def: ModuleDef; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addRow, toast } = useApp();
  const [prevOpen, setPrevOpen] = React.useState(open);
  const [vals, setVals] = React.useState<Record<string, string>>({});
  const [errs, setErrs] = React.useState<Record<string, string>>({});

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setVals({});
      setErrs({});
    }
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setVals({});
      setErrs({});
    }
    onOpenChange(v);
  }

  const fields = def.createFields ?? [];
  function submit() {
    const e: Record<string, string> = {};
    fields.forEach((f) => { if (f.required && !vals[f.key]?.trim()) e[f.key] = "Wajib diisi."; });
    setErrs(e);
    if (Object.keys(e).length) return;
    const row: Record<string, any> = {};
    fields.forEach((f) => { row[f.key] = f.type === "number" ? Number(String(vals[f.key] ?? "0").replace(/\D/g, "")) : vals[f.key] ?? ""; });
    if (def.key === "invoices") {
      const nilai = row.nilai || 0;
      row.ppn = Math.round(nilai * 0.11);
      row.total = nilai + row.ppn;
    }
    addRow(def.key, row);
    handleOpenChange(false);
    toast(`${def.singular} disimpan`);
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader><DialogTitle>{def.createLabel ?? `Tambah ${def.singular}`}</DialogTitle></DialogHeader>
        <ScrollView style={{ maxHeight: 520 }} contentContainerClassName="gap-4 pb-1">
          {fields.map((f) => (
            <FormField key={f.key} label={f.label} required={f.required} error={errs[f.key]}>
              {f.type === "select" ? (
                <SearchableSelect value={vals[f.key]} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} options={f.options ?? []} placeholder={`Pilih ${f.label.toLowerCase()}`} error={!!errs[f.key]} />
              ) : f.type === "textarea" ? (
                <Textarea value={vals[f.key] ?? ""} onChangeText={(v) => setVals((s) => ({ ...s, [f.key]: v }))} placeholder={f.placeholder} />
              ) : (
                <Input
                  value={vals[f.key] ?? ""}
                  onChangeText={(v) => setVals((s) => ({ ...s, [f.key]: v }))}
                  placeholder={f.type === "date" ? "2026-10-31" : f.placeholder}
                  keyboardType={f.type === "number" ? "numeric" : "default"}
                  className={cn("h-11 sm:h-11", errs[f.key] && "border-danger")}
                />
              )}
            </FormField>
          ))}
        </ScrollView>
        <DialogFooter>
          <Button variant="outline" onPress={() => onOpenChange(false)}><Text>Batal</Text></Button>
          <Button onPress={submit}><Text>Simpan</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApprovalBar({
  amount, financeOk, onApprove, onReject, compact,
}: { amount: number; financeOk?: boolean; onApprove: () => void; onReject: (reason?: string) => void; compact?: boolean }) {
  const [rej, setRej] = React.useState(false);
  const big = amount > BOS_THRESHOLD;
  return (
    <View className={cn("flex-row flex-wrap items-center justify-between gap-3", !compact && "bg-card border-border rounded-xl border p-4")}>
      <View className="gap-1">
        {amount > 0 ? <Text className="text-base font-semibold">{rupiah(amount)}</Text> : null}
        {big ? (
          <Text className="text-warning text-[13px]">{financeOk ? "Finance sudah setuju. Menunggu Bos" : "Perlu persetujuan Bos"}</Text>
        ) : null}
      </View>
      <View className="flex-row gap-2">
        <Button variant="outline" onPress={() => setRej(true)}><Text>Tolak</Text></Button>
        <Button onPress={onApprove}><Text>Setujui</Text></Button>
      </View>
      <ConfirmDialog
        open={rej}
        onOpenChange={setRej}
        title="Tolak dokumen ini?"
        description="Pengaju akan diberi tahu dan dokumen kembali ke dia untuk diperbaiki."
        confirmLabel="Tolak"
        destructive
        reasonLabel="Alasan penolakan"
        onConfirm={(r) => onReject(r)}
      />
    </View>
  );
}
