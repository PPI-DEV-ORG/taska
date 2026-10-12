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
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import type { CreateField, ModuleDef } from "@/mock/modules";

/** Format angka saat diketik: "1000000" → "1.000.000". Hanya digit yang disimpan. */
function formatThousands(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

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

export function MultiSelect({
  values = [], onChange, options, placeholder = "Pilih", error,
}: { values?: string[]; onChange: (v: string[]) => void; options: string[]; placeholder?: string; error?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const list = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));

  function toggle(o: string) {
    if (values.includes(o)) {
      onChange(values.filter((x) => x !== o));
    } else {
      onChange([...values, o]);
    }
  }

  const displayText = values.length === 0
    ? placeholder
    : values.length <= 2
    ? values.join(", ")
    : `${values.length} staf dipilih (${values.slice(0, 2).join(", ")}...)`;

  return (
    <>
      <Pressable
        onPress={() => { setQ(""); setOpen(true); }}
        className={cn("bg-input border-border min-h-[44px] flex-row items-center justify-between rounded-lg border px-3 py-2", error && "border-danger")}
      >
        <Text className={cn("text-base md:text-sm flex-1 mr-2", values.length === 0 && "text-muted-foreground")} numberOfLines={2}>
          {displayText}
        </Text>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{placeholder}</DialogTitle>
          </DialogHeader>
          {options.length > 5 ? (
            <View className="bg-input border-border h-11 flex-row items-center gap-2 rounded-lg border px-3">
              <Search size={16} color={colors.muted} />
              <Input
                value={q}
                onChangeText={setQ}
                placeholder="Cari karyawan / staf..."
                className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
              />
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 320 }} contentContainerClassName="gap-1">
            {list.map((o) => {
              const selected = values.includes(o);
              return (
                <Pressable
                  key={o}
                  onPress={() => toggle(o)}
                  className={cn(
                    "hover:bg-panel active:bg-panel min-h-[42px] flex-row items-center justify-between rounded-lg px-3 py-2 transition-colors",
                    selected && "bg-primary/10"
                  )}
                >
                  <Text className={cn("flex-1 text-sm", selected ? "font-semibold text-primary" : "text-foreground")}>{o}</Text>
                  {selected ? <Check size={16} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
            {list.length === 0 ? <Text className="text-muted-foreground px-3 py-4 text-sm">Tidak ditemukan.</Text> : null}
          </ScrollView>
          <DialogFooter>
            <Button size="sm" onPress={() => setOpen(false)} className="w-full">
              <Text>Selesai ({values.length} Dipilih)</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FileField({
  fieldKey, label, required, onCount, handleRef,
}: {
  fieldKey: string;
  label: string;
  required?: boolean;
  onCount: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleRef?: (h: FileUploaderHandle | null) => void;
}) {
  // stable per-field callback so FileUploader's useEffect doesn't re-fire
  // every parent render (would loop setVals → render → new fn)
  const handleCount = React.useCallback(
    (count: number) => {
      onCount((s) => ({ ...s, [fieldKey]: `${count} file terlampir` }));
    },
    [fieldKey, onCount],
  );
  return (
    <FileUploader label={label} kind="dokumen" required={required} onChange={handleCount} handleRef={handleRef} />
  );
}

export function FormDialog({ def, open, onOpenChange }: { def: ModuleDef; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addRow, data } = useApp();
  const [prevOpen, setPrevOpen] = React.useState(open);
  const [vals, setVals] = React.useState<Record<string, string>>({});
  const [errs, setErrs] = React.useState<Record<string, string>>({});
  const fileHandles = React.useRef<(FileUploaderHandle | null)[]>([]);
  const fileHandleAt = (i: number) => (h: FileUploaderHandle | null) => { fileHandles.current[i] = h; };

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
      fileHandles.current = [];
    }
    onOpenChange(v);
  }

  function dynamicOptions(f: CreateField): string[] | undefined {
    if (!["select", "multiselect"].includes(f.type)) return f.options;
    switch (f.key) {
      case "perusahaan":
      case "customer":
        return (data.customers ?? []).map((r) => String(r.nama));
      case "supplier":
        return (data.suppliers ?? []).map((r) => String(r.nama));
      default:
        return f.options;
    }
  }

  function findById(rows: any[], nama?: string): any | undefined {
    return rows.find((r) => String(r.nama) === nama);
  }

  function resolveSelectIds(module: string, row: Record<string, any>): Record<string, any> {
    const out = { ...row };
    const nameToId = (rows: any[], nama: any): number | undefined => {
      const r = findById(rows, String(nama ?? ""));
      return r ? Number(r.id) : undefined;
    };

    switch (module) {
      case "leads":
        if (row.perusahaan != null) out.customerId = nameToId(data.customers ?? [], row.perusahaan);
        break;
      case "surveys":
      case "po-client":
      case "invoices":
        if (row.customer != null) out.customerId = nameToId(data.customers ?? [], row.customer);
        if (module === "surveys" && row.tim != null) {
          const names = String(row.tim)
            .split(",")
            .map((s) => (s.split("(")[0] ?? "").trim())
            .filter(Boolean);
          out.memberIds = (data.users ?? [])
            .filter((u) => names.includes(String(u.name)))
            .map((u) => Number(u.id));
        }
        break;
      case "projects":
        if (row.customer != null && row.customer !== "-")
          out.customerId = nameToId(data.customers ?? [], row.customer);
        break;
      case "supplier-pos":
        if (row.supplier != null) out.supplierId = nameToId(data.suppliers ?? [], row.supplier);
        break;
      case "damage-reports":
        if (row.produk != null) out.productId = nameToId(data.products ?? [], row.produk);
        break;
      default:
        break;
    }
    return out;
  }

  const fields = def.createFields ?? [];
  async function submit() {
    const e: Record<string, string> = {};
    fields.forEach((f) => { if (f.required && !vals[f.key]?.trim()) e[f.key] = "Wajib diisi."; });
    setErrs(e);
    if (Object.keys(e).length) return;
    let row: Record<string, any> = {};
    fields.forEach((f) => { row[f.key] = f.type === "number" ? Number(String(vals[f.key] ?? "0").replace(/\D/g, "")) : vals[f.key] ?? ""; });
    if (def.key === "invoices") {
      const nilai = row.nilai || 0;
      row.ppn = Math.round(nilai * 0.11);
      row.total = nilai + row.ppn;
    }
    // upload file staged sebelum submit, supaya tidak numpuk di storage
    await Promise.all(fileHandles.current.map((h) => h?.flush() ?? Promise.resolve(null)));
    row = resolveSelectIds(def.key, row);
    const saved = await addRow(def.key, row);
    if (saved) handleOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader><DialogTitle>{def.createLabel ?? `Tambah ${def.singular}`}</DialogTitle></DialogHeader>
        <ScrollView style={{ maxHeight: 520 }} contentContainerClassName="gap-4 pb-1">
          {fields.map((f, i) => {
            if (f.type === "file") {
              return (
                <FileField
                  key={f.key}
                  fieldKey={f.key}
                  label={f.label}
                  required={f.required}
                  onCount={setVals}
                  handleRef={fileHandleAt(i)}
                />
              );
            }
            return (
              <FormField key={f.key} label={f.label} required={f.required} error={errs[f.key]}>
                {f.type === "select" ? (
                  <SearchableSelect value={vals[f.key]} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} options={dynamicOptions(f) ?? []} placeholder={`Pilih ${f.label.toLowerCase()}`} error={!!errs[f.key]} />
                ) : f.type === "multiselect" ? (
                  <MultiSelect
                    values={vals[f.key]?.split(", ").filter(Boolean) ?? []}
                    onChange={(selectedArr) => setVals((s) => ({ ...s, [f.key]: selectedArr.join(", ") }))}
                    options={dynamicOptions(f) ?? []}
                    placeholder={`Pilih ${f.label.toLowerCase()}`}
                    error={!!errs[f.key]}
                  />
                ) : f.type === "textarea" ? (
                  <Textarea value={vals[f.key] ?? ""} onChangeText={(v) => setVals((s) => ({ ...s, [f.key]: v }))} placeholder={f.placeholder} />
                ) : (
                  <Input
                    value={vals[f.key] ?? ""}
                    onChangeText={(v) =>
                      setVals((s) => ({
                        ...s,
                        [f.key]: f.type === "number" ? formatThousands(v) : v,
                      }))
                    }
                    placeholder={f.type === "date" ? "2026-10-31" : f.placeholder}
                    keyboardType={f.type === "number" ? "numeric" : "default"}
                    secureTextEntry={f.type === "password"}
                    className={cn("h-11 sm:h-11", errs[f.key] && "border-danger")}
                  />
                )}
              </FormField>
            );
          })}
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
