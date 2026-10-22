import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Calendar as CalendarIcon, Check, ChevronDown, ChevronLeft, ChevronRight, Search, FileDown } from "lucide-react-native";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { colors, BOS_THRESHOLD } from "@/tokens";
import { rupiah, tanggal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { downloadQuotationPdf } from "@/modules/quotation/quotation-files";
import type { CreateField, ModuleDef, Row } from "@/constants/modules";

/** Format angka saat diketik: "1000000" → "1.000.000". Hanya digit yang disimpan. */
export function formatThousands(raw: any): string {
  if (raw == null || raw === "") return "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const DAYS_ID = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(v?: string): Date {
  if (v && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [y, m, d] = v.slice(0, 10).split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  return new Date();
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pilih tanggal",
  error,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const initial = parseIsoDate(value);
  const [viewYear, setViewYear] = React.useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(initial.getMonth());

  function openPicker() {
    const cur = parseIsoDate(value);
    setViewYear(cur.getFullYear());
    setViewMonth(cur.getMonth());
    setOpen(true);
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectQuick(offsetDays: number) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    onChange(toIsoDate(d));
    setOpen(false);
  }

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  // Senin = 0 ... Minggu = 6
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayIso = toIsoDate(new Date());
  const selectedIso = value ? value.slice(0, 10) : "";

  return (
    <>
      <Pressable
        onPress={openPicker}
        className={cn(
          "bg-input border-border h-11 flex-row items-center justify-between rounded-lg border px-3",
          error && "border-danger"
        )}
      >
        <Text className={cn("text-base md:text-sm", !selectedIso && "text-muted-foreground")} numberOfLines={1}>
          {selectedIso ? `${tanggal(selectedIso)} (${selectedIso})` : placeholder}
        </Text>
        <CalendarIcon size={16} color={colors.muted} />
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{placeholder}</DialogTitle>
          </DialogHeader>

          <View className="gap-3">
            {/* Quick shortcuts */}
            <View className="flex-row flex-wrap gap-1.5">
              {[
                { label: "Hari ini", offset: 0 },
                { label: "Besok", offset: 1 },
                { label: "+7 Hari", offset: 7 },
                { label: "+14 Hari", offset: 14 },
                { label: "+30 Hari", offset: 30 },
              ].map((q) => (
                <Pressable
                  key={q.label}
                  onPress={() => selectQuick(q.offset)}
                  className="bg-panel border-border hover:bg-primary/15 active:bg-primary/20 rounded-lg border px-2.5 py-1.5"
                >
                  <Text className="text-xs font-medium text-foreground">{q.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Month & Year Navigator */}
            <View className="bg-panel/60 border-border flex-row items-center justify-between rounded-xl border px-2 py-1.5">
              <Pressable
                onPress={prevMonth}
                hitSlop={8}
                className="size-9 items-center justify-center rounded-lg hover:bg-card active:bg-card"
              >
                <ChevronLeft size={18} color={colors.text} />
              </Pressable>
              <Text className="text-sm font-bold text-foreground">
                {MONTHS_ID[viewMonth]} {viewYear}
              </Text>
              <Pressable
                onPress={nextMonth}
                hitSlop={8}
                className="size-9 items-center justify-center rounded-lg hover:bg-card active:bg-card"
              >
                <ChevronRight size={18} color={colors.text} />
              </Pressable>
            </View>

            {/* Day Headers */}
            <View className="flex-row">
              {DAYS_ID.map((d) => (
                <View key={d} className="flex-1 items-center py-1">
                  <Text className="text-[11px] font-semibold text-muted-foreground">{d}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid */}
            <View className="gap-1">
              {Array.from({ length: cells.length / 7 }, (_, weekIdx) => (
                <View key={weekIdx} className="flex-row">
                  {cells.slice(weekIdx * 7, weekIdx * 7 + 7).map((dayNum, di) => {
                    if (!dayNum) {
                      return <View key={`empty-${di}`} className="flex-1 h-10" />;
                    }
                    const iso = toIsoDate(new Date(viewYear, viewMonth, dayNum));
                    const isSelected = iso === selectedIso;
                    const isToday = iso === todayIso;
                    return (
                      <Pressable
                        key={iso}
                        onPress={() => {
                          onChange(iso);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex-1 h-10 items-center justify-center rounded-lg m-0.5",
                          isSelected
                            ? "bg-primary"
                            : isToday
                              ? "border border-primary/60 bg-primary/10"
                              : "hover:bg-panel active:bg-panel"
                        )}
                      >
                        <Text
                          className={cn(
                            "text-xs font-medium",
                            isSelected ? "text-background font-bold" : isToday ? "text-primary font-bold" : "text-foreground"
                          )}
                        >
                          {dayNum}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={() => setOpen(false)}>
              <Text>Tutup</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
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
  const displayLabel = options.find((o) => o === value || (value && value !== "-" && (o.startsWith(`${value} -`) || o.startsWith(`${value} ·`) || o.startsWith(`${value} (`)))) || value;
  return (
    <>
      <Pressable
        onPress={() => { setQ(""); setOpen(true); }}
        className={cn("bg-input border-border h-11 flex-row items-center justify-between rounded-lg border px-3", error && "border-danger")}
      >
        <Text className={cn("text-base md:text-sm", !value && "text-muted-foreground")} numberOfLines={1}>{displayLabel || placeholder}</Text>
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
            {list.map((o) => {
              const isSelected = o === value || (value && value !== "-" && (o.startsWith(`${value} -`) || o.startsWith(`${value} ·`) || o.startsWith(`${value} (`)));
              return (
                <Pressable
                  key={o}
                  onPress={() => { onChange(o); setOpen(false); }}
                  className="active:bg-panel hover:bg-panel min-h-[44px] flex-row items-center justify-between rounded-lg px-3"
                >
                  <Text className={cn("flex-1 text-sm", isSelected && "font-semibold text-primary")}>{o}</Text>
                  {isSelected ? <Check size={16} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
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

  const norm = (s?: string) => (s ? (s.split("(")[0] ?? "").trim().toLowerCase() : "");
  const isSelected = (o: string) => (values ?? []).some((v) => norm(v) === norm(o) || (v ?? "").trim() === o.trim());

  function toggle(o: string) {
    if (isSelected(o)) {
      onChange((values ?? []).filter((x) => norm(x) !== norm(o) && (x ?? "").trim() !== o.trim()));
    } else {
      onChange([...(values ?? []), o]);
    }
  }

  const displayText = values.length === 0
    ? placeholder
    : values.length <= 2
    ? values.join(", ")
    : `${values.length} dipilih (${values.slice(0, 2).join(", ")}...)`;

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
                placeholder={`Cari ${placeholder.replace(/^Pilih\s*/i, "").toLowerCase()}...`}
                className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent outline-none ring-0 web:focus-visible:ring-0 web:focus-visible:outline-none"
              />
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 320 }} contentContainerClassName="gap-1">
            {list.map((o) => {
              const selected = isSelected(o);
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
  fieldKey, label, kind, category, required, onCount, handleRef,
}: {
  fieldKey: string;
  label: string;
  kind?: "foto" | "dokumen" | "video" | "semua";
  category?: string;
  required?: boolean;
  onCount: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleRef?: (h: FileUploaderHandle | null) => void;
}) {
  const handleCount = React.useCallback(
    (count: number) => {
      onCount((s) => ({ ...s, [fieldKey]: `${count} file terlampir` }));
    },
    [fieldKey, onCount],
  );
  const effectiveKind = kind ?? (/foto|gambar|image|nota/i.test(label) ? "foto" : "dokumen");
  return (
    <FileUploader
      label={label}
      kind={effectiveKind}
      category={category}
      required={required}
      onChange={handleCount}
      handleRef={handleRef}
    />
  );
}

export function getDynamicOptions(
  f: CreateField,
  data: any,
  moduleKey?: string,
  fallbackUsers: any[] = [],
  fallbackProjects: any[] = [],
  fallbackSupplierPos: any[] = []
): string[] | undefined {
  if (!["select", "multiselect"].includes(f.type)) return f.options;
  const nonEmpty = (arr: string[], fallback?: string[]) => (arr.length > 0 ? Array.from(new Set(arr)) : fallback);
  switch (f.key) {
    case "perusahaan":
    case "customer": {
      const custs = (data.customers ?? []).map((r: any) => String(r.nama || r.name || "")).filter(Boolean);
      if (moduleKey === "projects") return nonEmpty(["-", ...custs], f.options);
      return nonEmpty(custs, f.options);
    }
    case "sumber":
      return nonEmpty((data.leadSources ?? []).map((r: any) => String(r.nama)).filter(Boolean), f.options);
    case "supplier":
      return nonEmpty((data.suppliers ?? []).map((r: any) => String(r.nama)).filter(Boolean), f.options);
    case "lead": {
      const lList = (data.leads ?? []);
      return nonEmpty(
        [
          "-",
          ...lList.map((l: any) => {
            const name = l.nama || l.name || "";
            const comp = l.perusahaan || l.customer || "";
            return comp ? `${name} · ${comp}` : name;
          }).filter(Boolean),
        ],
        f.options
      );
    }
    case "produk":
    case "item":
      return nonEmpty((data.products ?? []).map((r: any) => String(r.nama)).filter(Boolean), f.options);
    case "penawaran": {
      const qList = (data.quotations ?? []);
      if (moduleKey === "po-client") {
        return nonEmpty(
          [
            "-",
            ...qList.map((q: any) => {
              const num = q.nomor || q.number || "";
              const info = [q.customer, q.lead || q.nama].filter(Boolean).join(" · ");
              return info ? `${num} - ${info}` : num;
            }).filter(Boolean),
          ],
          f.options
        );
      }
      return nonEmpty(["-", ...qList.map((r: any) => String(r.nomor)).filter(Boolean)], f.options);
    }
    case "po": {
      if (moduleKey === "invoices") {
        return nonEmpty(["-", ...(data["po-client"] ?? []).map((r: any) => String(r.nomor)).filter(Boolean)], f.options);
      }
      const rawPos = (data["supplier-pos"] && data["supplier-pos"].length > 0) ? data["supplier-pos"] : fallbackSupplierPos;
      const suppList = rawPos.map((r: any) => {
        const no = String(r.nomor || r.number || "");
        if (!no) return "";
        const extra = [r.supplier, r.item].filter(Boolean).join(" · ");
        return extra ? `${no} - ${extra}` : no;
      }).filter(Boolean);
      if (moduleKey === "damage-reports") {
        const clientPos = (data["po-client"] ?? []).map((r: any) => {
          const no = String(r.nomor || r.number || "");
          if (!no) return "";
          return r.customer ? `${no} - ${r.customer} (SO/PO Client)` : no;
        }).filter(Boolean);
        const invs = (data.invoices ?? [])
          .filter((r: any) => r.direction !== "in")
          .map((r: any) => {
            const no = String(r.nomor || r.number || "");
            if (!no) return "";
            return r.customer ? `${no} - ${r.customer} (Invoice)` : no;
          }).filter(Boolean);
        return nonEmpty(["-", ...suppList, ...clientPos, ...invs], f.options);
      }
      return nonEmpty(["-", ...suppList], f.options);
    }
    case "project": {
      const projList = (data.projects && data.projects.length > 0) ? data.projects : fallbackProjects;
      return nonEmpty(
        ["-", ...projList.map((r: any) => String(r.nama || r.name || "")).filter(Boolean)],
        f.options
      );
    }
    case "survey":
      return nonEmpty(
        ["-", ...(data.surveys ?? []).map((s: any) => `Survey #${s.id} - ${s.lead || s.customer || s.lokasi || "Survey"}`)],
        f.options
      );
    case "gudang":
    case "warehouse":
      return nonEmpty(["-", ...(data.warehouses ?? []).map((r: any) => String(r.nama)).filter(Boolean)], f.options);
    case "kategori":
      if (moduleKey === "expenses") {
        return nonEmpty((data.expenseCategories ?? []).map((r: any) => String(r.nama)).filter(Boolean), f.options);
      }
      return nonEmpty((data.productCategories ?? []).map((r: any) => String(r.nama)).filter(Boolean), f.options);
    case "tim": {
      const userList = (data.users && data.users.length > 0) ? data.users : fallbackUsers;
      return nonEmpty(
        userList
          .map((u: any) => {
            const nm = u.name || u.nama;
            const rl = u.roleLabel || u.peran || (u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1).toLowerCase()) : "");
            return nm ? `${nm}${rl ? ` (${rl})` : ""}` : "";
          })
          .filter(Boolean),
        f.options
      );
    }
    case "pm":
    case "pemilik":
    case "pic": {
      const userList = (data.users && data.users.length > 0) ? data.users : fallbackUsers;
      return nonEmpty(userList.map((u: any) => String(u.name || u.nama || "")).filter(Boolean), f.options);
    }
    default:
      return f.options;
  }
}

export function FormDialog({
  def,
  open,
  onOpenChange,
  initialRow,
  mode = "create",
  title,
  fields: customFields,
  submitLabel,
  onSubmit,
}: {
  def?: ModuleDef;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialRow?: Row;
  mode?: "create" | "edit";
  title?: string;
  fields?: CreateField[];
  submitLabel?: string;
  onSubmit?: (row: Record<string, any>) => void | Promise<any>;
}) {
  const { addRow, patchRow, data, toast } = useApp();
  const [prevOpen, setPrevOpen] = React.useState(open);
  const [vals, setVals] = React.useState<Record<string, string>>({});
  const [errs, setErrs] = React.useState<Record<string, string>>({});
  const [fallbackUsers, setFallbackUsers] = React.useState<any[]>([]);
  const [fallbackProjects, setFallbackProjects] = React.useState<any[]>([]);
  const [fallbackSupplierPos, setFallbackSupplierPos] = React.useState<any[]>([]);
  const [fallbackSerials, setFallbackSerials] = React.useState<any[]>([]);
  const fileHandles = React.useRef<(FileUploaderHandle | null)[]>([]);
  const fileHandleAt = (i: number) => (h: FileUploaderHandle | null) => { fileHandles.current[i] = h; };

  React.useEffect(() => {
    if (open && (!data.users || data.users.length === 0)) {
      api<any[]>("GET", "/users/options")
        .then((res) => {
          if (Array.isArray(res) && res.length) setFallbackUsers(res);
        })
        .catch(() => {});
    }
    if (open && (!data.projects || data.projects.length === 0)) {
      api<any>("GET", "/projects?limit=200")
        .then((res) => {
          const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
          if (items.length) setFallbackProjects(items);
        })
        .catch(() => {});
    }
    if (open && (def?.key === "damage-reports" || def?.key === "receiving") && (!data["supplier-pos"] || data["supplier-pos"].length === 0)) {
      api<any>("GET", "/supplier-pos?limit=200")
        .then((res) => {
          const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
          if (items.length) {
            setFallbackSupplierPos(items.map((r: any) => ({
              ...r,
              nomor: r.number ?? r.nomor,
              supplier: r.supplier?.name ?? r.supplier,
              item: r.items?.[0]?.product?.name ?? r.item,
            })));
          }
        })
        .catch(() => {});
    }
    if (open && def?.key === "damage-reports" && (!data.serials || data.serials.length === 0)) {
      api<any>("GET", "/serials?limit=500")
        .then((res) => {
          const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
          if (items.length) {
            setFallbackSerials(
              items.map((s: any) => ({
                ...s,
                produk: s.product?.name ?? s.produk ?? "",
                sku: s.product?.sku ?? s.sku ?? "",
                gudang: s.warehouse?.name ?? s.gudang ?? "-",
              })),
            );
          }
        })
        .catch(() => {});
    }
  }, [open, data.users, data.projects, data["supplier-pos"], data.serials, def?.key]);

  const fields = customFields ?? def?.createFields ?? [];

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (mode === "edit" && initialRow) {
        const init: Record<string, string> = {};
        fields.forEach((f) => {
          if (f.type === "file" || f.type === "password") return;
          const rawVal = initialRow[f.key];
          if (rawVal != null && rawVal !== "-") {
            init[f.key] = f.type === "number" ? formatThousands(String(rawVal)) : String(rawVal);
          }
        });
        if (initialRow.sn && initialRow.sn !== "-") {
          init.sn = String(initialRow.sn);
        }
        setVals(init);
      } else {
        const init: Record<string, string> = {};
        const today = toIsoDate(new Date());
        fields.forEach((f) => {
          if (f.type === "date" && def?.defaults?.[f.key]) {
            init[f.key] = today;
          } else if (f.type === "date" && f.required) {
            init[f.key] = today;
          }
        });
        setVals(init);
      }
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
    return getDynamicOptions(f, data, def?.key, fallbackUsers, fallbackProjects, fallbackSupplierPos);
  }

  async function submit() {
    const e: Record<string, string> = {};
    fields.forEach((f) => {
      if (mode === "edit" && f.type === "password") return;
      if (f.required && !vals[f.key]?.trim()) e[f.key] = "Wajib diisi.";
    });
    setErrs(e);
    if (Object.keys(e).length) return;
    const row: Record<string, any> = {};
    fields.forEach((f) => {
      if (f.type === "file") return;
      if (mode === "edit" && f.type === "password" && !vals[f.key]?.trim()) return;
      row[f.key] = f.type === "number" ? Number(String(vals[f.key] ?? "0").replace(/\D/g, "")) : vals[f.key] ?? "";
    });
    if ((def?.key === "damage-reports" || def?.key === "receiving") && row.po) {
      row.po = (String(row.po).split(" - ")[0] ?? "").trim();
    }
    if (def?.key === "damage-reports" && vals.sn) {
      const cleanSn = (String(vals.sn).split(" (")[0] ?? "").trim();
      row.sn = cleanSn;
      const allSerials = (data.serials && data.serials.length > 0) ? data.serials : fallbackSerials;
      const matchedSn = allSerials.find(
        (s: any) => String(s.sn || "").trim().toLowerCase() === cleanSn.toLowerCase(),
      );
      if (matchedSn?.id) {
        row.serialUnitId = Number(matchedSn.id);
      }
    }
    if (def?.key === "po-client" && row.penawaran) {
      row.penawaran = (String(row.penawaran).split(" - ")[0] ?? "").trim();
    }
    if (def?.key === "projects") {
      if (row.lead) {
        row.lead = (String(row.lead).split(" · ")[0] ?? "").trim();
      }
      const allUsers = (data.users && data.users.length > 0) ? data.users : fallbackUsers;
      if (row.pm) {
        const pmMatch = allUsers.find((u: any) => {
          const nm = String(u.name || u.nama || "").trim().toLowerCase();
          return nm === String(row.pm).trim().toLowerCase();
        });
        if (pmMatch?.id) row.pmId = Number(pmMatch.id);
      }
      if (row.tim !== undefined) {
        const names = String(row.tim)
          .split(",")
          .map((s) => (s.split("(")[0] ?? "").trim().toLowerCase())
          .filter(Boolean);
        row.memberIds = allUsers
          .filter((u: any) => names.includes(String(u.name ?? u.nama ?? "").trim().toLowerCase()))
          .map((u: any) => Number(u.id))
          .filter((x: number) => !Number.isNaN(x) && x > 0);
      }
    }
    if (def?.key === "invoices") {
      const nilai = row.nilai || 0;
      row.ppn = Math.round(nilai * 0.11);
      row.total = nilai + row.ppn;
    }
    if (def?.key === "quotations") {
      const tot = Number(row.nilai || row.total || 0);
      const disc = Number(row.disc || 0);
      const net = Math.max(0, tot - disc);
      const tipe = String(row.tipePpn || "Exclude");
      if (tipe.toLowerCase().includes("no") || tipe.toLowerCase().includes("tanpa")) {
        row.ppn = 0;
        row.totalAfterDisc = net;
      } else if (tipe.toLowerCase().includes("include")) {
        row.ppn = Math.round(net - (net / 1.11));
        row.totalAfterDisc = net;
      } else {
        row.ppn = Math.round(net * 0.11);
        row.totalAfterDisc = net + row.ppn;
      }
      row.total = tot;
      row.grandTotal = row.totalAfterDisc;
    }
    const uploadedIds = await Promise.all(fileHandles.current.map((h) => h?.flush() ?? Promise.resolve(null)));
    const firstFileId = uploadedIds.find((id) => id != null);
    if (firstFileId != null) {
      row.fileId = firstFileId;
    }

    if (onSubmit) {
      await onSubmit(row);
      handleOpenChange(false);
    } else if (def) {
      if (mode === "edit" && initialRow) {
        await patchRow(def.key, initialRow.id, row);
        toast(`${def.singular} diperbarui`);
        handleOpenChange(false);
      } else {
        const saved = await addRow(def.key, row);
        if (saved) handleOpenChange(false);
      }
    }
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {title ?? (mode === "edit" ? `Ubah ${def?.singular ?? "Data"}` : (def?.createLabel ?? `Tambah ${def?.singular ?? "Data"}`))}
          </DialogTitle>
        </DialogHeader>
        <ScrollView style={{ maxHeight: 520 }} contentContainerClassName="gap-4 pb-1">
          {fields.map((f, i) => {
            if (f.type === "file") {
              return (
                <FileField
                  key={f.key}
                  fieldKey={f.key}
                  label={f.label}
                  kind={f.kind}
                  category={f.category}
                  required={f.required}
                  onCount={setVals}
                  handleRef={fileHandleAt(i)}
                />
              );
            }
            if (def?.key === "quotations" && f.key === "nilai") {
              const currentTipe = vals.tipePpn || "Exclude PPN (11%)";
              const rawNilai = Number(String(vals.nilai || "").replace(/\D/g, "")) || 0;
              const rawDisc = Number(String(vals.disc || "").replace(/\D/g, "")) || 0;
              const netVal = Math.max(0, rawNilai - rawDisc);
              const previewPpn = currentTipe.includes("Exclude") ? Math.round(netVal * 0.11) : 0;
              const previewGrand = currentTipe.includes("Exclude") ? netVal + previewPpn : netVal;

              return (
                <View key={f.key} className="gap-2">
                  <FormField
                    label={f.label}
                    required={f.required}
                    error={errs[f.key]}
                  >
                    <Input
                      value={vals[f.key] ?? ""}
                      onChangeText={(v) => {
                        const newNilai = Number(v.replace(/\D/g, "")) || 0;
                        setVals((s) => {
                          let nextDisc = s.disc;
                          if (s.discType === "percent" && s.discPercent) {
                            const pct = Number(s.discPercent) || 0;
                            nextDisc = formatThousands(Math.round(newNilai * (pct / 100)));
                          }
                          return {
                            ...s,
                            [f.key]: formatThousands(v),
                            ...(nextDisc !== undefined ? { disc: nextDisc } : {}),
                          };
                        });
                      }}
                      placeholder={f.placeholder || "Contoh: 10.000.000"}
                      keyboardType="numeric"
                      className={cn("h-11 sm:h-11", errs[f.key] && "border-danger")}
                    />
                  </FormField>

                  {/* Switch Include / Exclude PPN / No PPN */}
                  <View className="bg-panel border-border/80 rounded-xl border p-3 gap-2">
                    <Text className="text-xs font-semibold text-foreground">
                      Switch Ketentuan PPN:
                    </Text>
                    <View className="flex-row gap-1.5">
                      {[
                        { id: "Exclude PPN (11%)", label: "Exclude PPN (11%)" },
                        { id: "Include PPN (Sudah termasuk)", label: "Include PPN" },
                        { id: "No PPN (Tanpa PPN)", label: "No PPN" },
                      ].map((opt) => {
                        const active = currentTipe === opt.id || (opt.id.startsWith("Exclude") && !vals.tipePpn);
                        return (
                          <Button
                            key={opt.id}
                            size="sm"
                            variant={active ? "default" : "outline"}
                            onPress={() => setVals((s) => ({ ...s, tipePpn: opt.id }))}
                            className="flex-1 h-8 px-2"
                          >
                            <Text className="text-xs">{opt.label}</Text>
                          </Button>
                        );
                      })}
                    </View>
                    {rawNilai > 0 ? (
                      <View className="bg-card border-border/60 rounded-lg border p-2 gap-0.5 mt-0.5">
                        <View className="flex-row justify-between">
                          <Text className="text-[11px] text-muted-foreground">DPP / Net Setelah Diskon:</Text>
                          <Text className="text-[11px] font-medium text-foreground">{rupiah(netVal)}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-[11px] text-muted-foreground">PPN:</Text>
                          <Text className="text-[11px] font-medium text-foreground">
                            {currentTipe.includes("Include")
                              ? "Sudah Termasuk dalam Harga"
                              : currentTipe.includes("No")
                              ? "Tanpa PPN (Rp 0)"
                              : rupiah(previewPpn)}
                          </Text>
                        </View>
                        <View className="flex-row justify-between border-t border-border/50 pt-1 mt-0.5">
                          <Text className="text-xs font-bold text-foreground">Estimasi Total Akhir:</Text>
                          <Text className="text-xs font-bold text-primary">{rupiah(previewGrand)}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            }

            if (def?.key === "quotations" && f.key === "disc") {
              const rawNilai = Number(String(vals.nilai || "").replace(/\D/g, "")) || 0;
              const rawDisc = Number(String(vals.disc || "").replace(/\D/g, "")) || 0;
              const isPercent = vals.discType === "percent";
              return (
                <View key={f.key} className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-foreground">Diskon</Text>
                    <View className="flex-row rounded-lg bg-panel p-0.5 border border-border">
                      <Button
                        size="sm"
                        variant={!isPercent ? "default" : "ghost"}
                        className="h-6 px-2.5 py-0"
                        onPress={() => setVals((s) => ({ ...s, discType: "nominal" }))}
                      >
                        <Text className={`text-xs ${!isPercent ? "text-primary-foreground font-semibold" : "text-muted-foreground"}`}>
                          Nominal (Rp)
                        </Text>
                      </Button>
                      <Button
                        size="sm"
                        variant={isPercent ? "default" : "ghost"}
                        className="h-6 px-2.5 py-0"
                        onPress={() => {
                          const pct = rawNilai > 0 && rawDisc > 0 ? String(Math.round((rawDisc / rawNilai) * 100)) : "";
                          setVals((s) => ({ ...s, discType: "percent", discPercent: pct }));
                        }}
                      >
                        <Text className={`text-xs ${isPercent ? "text-primary-foreground font-semibold" : "text-muted-foreground"}`}>
                          Persen (%)
                        </Text>
                      </Button>
                    </View>
                  </View>
                  {isPercent ? (
                    <View className="gap-1">
                      <Input
                        value={vals.discPercent ?? ""}
                        onChangeText={(p) => {
                          const pctStr = p.replace(/\D/g, "");
                          const pct = Number(pctStr) || 0;
                          const calculatedDisc = Math.round(rawNilai * (pct / 100));
                          setVals((s) => ({
                            ...s,
                            discPercent: pctStr,
                            disc: formatThousands(calculatedDisc),
                          }));
                        }}
                        placeholder="Contoh: 10"
                        keyboardType="numeric"
                        className={cn("h-11 sm:h-11", errs[f.key] && "border-danger")}
                      />
                      <Text className="text-[11px] text-muted-foreground">
                        Nilai diskon: {rupiah(rawDisc)}
                      </Text>
                    </View>
                  ) : (
                    <View className="gap-1">
                      <Input
                        value={vals[f.key] ?? ""}
                        onChangeText={(v) =>
                          setVals((s) => ({
                            ...s,
                            [f.key]: formatThousands(v),
                          }))
                        }
                        placeholder={f.placeholder || "Contoh: 500.000"}
                        keyboardType="numeric"
                        className={cn("h-11 sm:h-11", errs[f.key] && "border-danger")}
                      />
                      {rawNilai > 0 && rawDisc > 0 ? (
                        <Text className="text-[11px] text-muted-foreground">
                          Setara dengan {Math.round((rawDisc / rawNilai) * 100)}%
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            }

            return (
              <FormField
                key={f.key}
                label={mode === "edit" && f.type === "password" ? `${f.label} (Kosongkan jika tidak diubah)` : f.label}
                required={mode === "edit" && f.type === "password" ? false : f.required}
                error={errs[f.key]}
              >
                {f.type === "select" ? (
                  <View className="gap-1.5">
                    <SearchableSelect
                      value={vals[f.key]}
                      onChange={(v) => {
                        if (def?.key === "po-client" && f.key === "penawaran") {
                          const selNo = v.split(" - ")[0]?.trim() || v;
                          const quote = (data.quotations ?? []).find(
                            (q: any) => q.nomor === selNo || `${q.nomor} - ${q.customer || "-"} - ${q.lead || q.nama || "-"}` === v
                          );
                          setVals((s) => ({
                            ...s,
                            [f.key]: v,
                            ...(quote ? {
                              nilai: formatThousands(String(quote.totalAfterDisc || quote.nilai || quote.total || 0)),
                              customer: quote.customer || s.customer || "",
                            } : {}),
                          }));
                        } else if (def?.key === "projects" && f.key === "lead") {
                          const selName = (v.split(" · ")[0] ?? v).trim().toLowerCase();
                          const lead = v === "-" ? null : (data.leads ?? []).find(
                            (l: any) => l.nama?.toLowerCase() === selName || l.name?.toLowerCase() === selName
                          );
                          const cust = lead?.perusahaan || lead?.customer || "";
                          setVals((s) => ({
                            ...s,
                            [f.key]: v,
                            ...(cust && (!s.customer || s.customer === "-") ? { customer: cust } : {}),
                            ...(lead && !s.nama ? { nama: `Project ${lead.nama}` } : {}),
                          }));
                        } else if (def?.key === "damage-reports" && f.key === "po") {
                          const selNo = v.split(" - ")[0]?.trim() || v;
                          const poList = (data["supplier-pos"] && data["supplier-pos"].length > 0) ? data["supplier-pos"] : fallbackSupplierPos;
                          const matchedPo = v === "-" ? null : poList.find((p: any) => p.nomor === selNo);
                          const prodName = matchedPo?.item;
                          setVals((s) => ({
                            ...s,
                            [f.key]: v,
                            ...(prodName && (!s.produk || s.produk === "-") ? { produk: prodName } : {}),
                          }));
                        } else if (def?.key === "damage-reports" && f.key === "produk") {
                          setVals((s) => ({ ...s, [f.key]: v, sn: "" }));
                        } else {
                          setVals((s) => ({ ...s, [f.key]: v }));
                        }
                      }}
                      options={dynamicOptions(f) ?? []}
                      placeholder={`Pilih ${f.label.toLowerCase()}`}
                      error={!!errs[f.key]}
                    />
                    {def?.key === "damage-reports" && f.key === "produk" && vals.produk ? (() => {
                      const prodObj = (data.products ?? []).find(
                        (p: any) => p.nama === vals.produk || p.name === vals.produk,
                      );
                      if (!prodObj || !(prodObj.berSN || prodObj.hasSerial)) return null;
                      const allSerials = (data.serials && data.serials.length > 0) ? data.serials : fallbackSerials;
                      const prodSerials = allSerials.filter(
                        (s: any) =>
                          String(s.productId) === String(prodObj.id) ||
                          s.produk === prodObj.nama ||
                          (s.sku && prodObj.sku && s.sku === prodObj.sku),
                      );
                      const snOptions = prodSerials.map((s: any) => {
                        const loc = s.gudang && s.gudang !== "-" ? s.gudang : "Gudang";
                        const st = s.status || s.rawStatus || "Tersedia";
                        return `${s.sn} (${loc} · ${st})`;
                      });
                      return (
                        <View className="mt-2 pt-2 border-t border-border/60 gap-1.5">
                          <Text className="text-sm font-medium text-foreground">
                            Serial Number (SN) Barang <Text className="text-danger">*</Text>
                          </Text>
                          <SearchableSelect
                            value={vals.sn ?? ""}
                            onChange={(snVal) => {
                              const cleanSn = (snVal.split(" (")[0] ?? snVal).trim();
                              setVals((s) => ({
                                ...s,
                                sn: cleanSn,
                                qty: "1",
                              }));
                            }}
                            options={snOptions}
                            placeholder={
                              snOptions.length > 0
                                ? `Pilih SN dari ${prodObj.nama} (${snOptions.length} unit)...`
                                : `Belum ada unit SN terdaftar untuk ${prodObj.nama}`
                            }
                          />
                        </View>
                      );
                    })() : null}
                    {def?.key === "projects" && f.key === "lead" && vals[f.key] && vals[f.key] !== "-" ? (() => {
                      const selName = (vals[f.key]?.split(" · ")[0] ?? vals[f.key] ?? "").trim().toLowerCase();
                      const matchedLead = (data.leads ?? []).find(
                        (l: any) => l.nama?.toLowerCase() === selName || l.name?.toLowerCase() === selName
                      );
                      if (!matchedLead) return null;
                      return (
                        <View className="flex-row items-center justify-between p-2 rounded-lg bg-panel border border-border/80 mt-1">
                          <View className="flex-1 mr-2">
                            <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                              Lead: {matchedLead.nama}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              Customer: {matchedLead.perusahaan || matchedLead.customer || "-"} · Nilai: {rupiah(matchedLead.nilai || 0)}
                            </Text>
                          </View>
                        </View>
                      );
                    })() : null}
                    {def?.key === "po-client" && f.key === "penawaran" && vals[f.key] ? (() => {
                      const selNo = vals[f.key]?.split(" - ")[0]?.trim() || vals[f.key];
                      const matchedQuote = (data.quotations ?? []).find(
                        (q: any) => q.nomor === selNo || `${q.nomor} - ${q.customer || "-"} - ${q.lead || q.nama || "-"}` === vals[f.key]
                      );
                      if (!matchedQuote) return null;
                      return (
                        <View className="flex-row items-center justify-between p-2 rounded-lg bg-panel border border-border/80 mt-1">
                          <View className="flex-1 mr-2">
                            <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                              {matchedQuote.nomor} · {matchedQuote.customer}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              Total Penawaran: {rupiah(matchedQuote.totalAfterDisc || matchedQuote.nilai || matchedQuote.total || 0)}
                            </Text>
                          </View>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 flex-row items-center gap-1"
                            onPress={() =>
                              downloadQuotationPdf({
                                quotationId: matchedQuote.id,
                                customer: matchedQuote.customer,
                                lead: matchedQuote.lead,
                                nomor: matchedQuote.nomor,
                              })
                            }
                          >
                            <FileDown size={12} color={colors.primary} />
                            <Text className="text-[11px] text-primary font-medium">Download PDF</Text>
                          </Button>
                        </View>
                      );
                    })() : null}
                  </View>
                ) : f.type === "multiselect" ? (
                  <MultiSelect
                    values={vals[f.key]?.split(", ").filter(Boolean) ?? []}
                    onChange={(selectedArr) => setVals((s) => ({ ...s, [f.key]: selectedArr.join(", ") }))}
                    options={dynamicOptions(f) ?? []}
                    placeholder={`Pilih ${f.label.toLowerCase()}`}
                    error={!!errs[f.key]}
                  />
                ) : f.type === "date" ? (
                  <DatePicker
                    value={vals[f.key]}
                    onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))}
                    placeholder={f.placeholder || `Pilih ${f.label.toLowerCase()}`}
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
                    placeholder={f.placeholder}
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
          <Button onPress={submit}><Text>{submitLabel ?? "Simpan"}</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApprovalBar({
  amount, amountLabel, financeOk, onApprove, onReject, compact,
}: { amount: number; amountLabel?: string; financeOk?: boolean; onApprove: () => void; onReject: (reason?: string) => void; compact?: boolean }) {
  const [rej, setRej] = React.useState(false);
  const big = amount > BOS_THRESHOLD;
  const labelText = amountLabel !== undefined ? amountLabel : (amount > 0 ? rupiah(amount) : null);
  return (
    <View className={cn("flex-row flex-wrap items-center justify-between gap-3", !compact && "bg-card border-border rounded-xl border p-4")}>
      <View className="gap-1">
        {labelText ? <Text className="text-base font-semibold">{labelText}</Text> : null}
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
