import * as React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Check, ChevronDown, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, FormField, InfoGrid, PageHeader, Panel, Timeline, Cell } from "@/components/taska/basics";
import { ApprovalBar, ConfirmDialog, DatePicker, SearchableSelect, MultiSelect, getDynamicOptions, formatThousands } from "@/components/taska/dialogs";
import { DocumentViewerList, type ResolvedDocItem } from "@/components/taska/document-viewer";
import { StatusBadge } from "@/components/taska/status-badge";
import { ModuleExtras, downloadQuotationTemplate } from "@/screens/module-extras";
import { useApp } from "@/store/app-store";
import { CAN_APPROVE, MODULES, type ModuleAction, type Row, type CreateField } from "@/constants/modules";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { PATHS, adaptRow } from "@/services/adapters";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rupiah } from "@/lib/format";

export function ModuleDetail({ moduleKey, id }: { moduleKey: string; id: string }) {
  const router = useRouter();
  const { data, user, addRow, patchRow, deleteRow, setStatus, history, approvals, decide, toast } = useApp();
  const def = MODULES[moduleKey];
  const rowFromStore = data[moduleKey]?.find((r: { id: string }) => r.id === id);
  const [remoteRow, setRemoteRow] = React.useState<Row | null>(null);

  React.useEffect(() => {
    const path = PATHS[moduleKey];
    if (!path || !id || String(id).startsWith("offline-")) return;
    let active = true;
    api<any>("GET", `${path}/${id}`)
      .then((res) => {
        if (!res || !active) return;
        const adapted = adaptRow(moduleKey, res);
        setRemoteRow(adapted);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [moduleKey, id]);

  const row = remoteRow ? { ...rowFromStore, ...remoteRow } : rowFromStore;
  const lostReasons: string[] = (data.lostReasons ?? []).map((r: any) => String(r.nama)).filter(Boolean);
  const [menu, setMenu] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [approveExpenseOpen, setApproveExpenseOpen] = React.useState(false);
  const [rejectExpenseOpen, setRejectExpenseOpen] = React.useState(false);
  const [expenseTransferNote, setExpenseTransferNote] = React.useState("");
  const [submittingExpense, setSubmittingExpense] = React.useState(false);
  const expenseFileHandle = React.useRef<FileUploaderHandle | null>(null);

  const editableFields: CreateField[] = React.useMemo(() => {
    if (!def) return [];
    const raw = def.createFields?.length
      ? def.createFields
      : def.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: (f.fmt === "rupiah" || f.fmt === "number" ? "number" : f.fmt === "date" ? "date" : "text") as any,
        }));
    return raw.filter((f) => f.type !== "file");
  }, [def]);

  const editableKeySet = React.useMemo(() => new Set(editableFields.map((f) => f.key)), [editableFields]);
  const readOnlyFields = React.useMemo(() => {
    if (!def) return [];
    return def.fields.filter((f) => !editableKeySet.has(f.key) && f.key !== def.statusKey);
  }, [def, editableKeySet]);

  function getInitialFieldValue(f: CreateField, r: Row) {
    if (f.type === "password") return "";
    const rawVal = r[f.key];
    if (rawVal != null && rawVal !== "-") {
      return f.type === "number" ? formatThousands(String(rawVal)) : String(rawVal);
    }
    return "";
  }

  const [edits, setEdits] = React.useState<Record<string, any>>({});
  const [errs, setErrs] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [fallbackUsers, setFallbackUsers] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!data.users || data.users.length === 0) {
      api<any[]>("GET", "/users/options")
        .then((res) => {
          if (Array.isArray(res) && res.length) setFallbackUsers(res);
        })
        .catch(() => {});
    }
  }, [data.users]);

  function getFieldValue(f: CreateField) {
    if (!row) return "";
    if (f.key in edits) return edits[f.key];
    return getInitialFieldValue(f, row);
  }

  function setFieldValue(key: string, val: any) {
    setEdits((prev) => ({ ...prev, [key]: val }));
    setErrs((e) => ({ ...e, [key]: "" }));
  }

  const isFinanceOrBos = ["finance", "bos", "super_admin"].includes(user?.role ?? "");
  const canEdit = moduleKey === "expenses" ? isFinanceOrBos : true;
  const canDelete = moduleKey === "expenses" ? isFinanceOrBos : true;

  const isDirty = React.useMemo(() => {
    if (!row || !canEdit) return false;
    return editableFields.some((f) => {
      if (!(f.key in edits)) return false;
      if (f.type === "password") return Boolean(edits[f.key]?.trim());
      const current = String(edits[f.key] ?? "");
      const original = getInitialFieldValue(f, row);
      return current !== original;
    });
  }, [editableFields, edits, row, canEdit]);

  function handleReset() {
    setEdits({});
    setErrs({});
  }

  async function handleSaveForm() {
    if (!def || !row) return;
    const e: Record<string, string> = {};
    editableFields.forEach((f) => {
      if (f.type === "password") return;
      const val = f.key in edits ? edits[f.key] : getInitialFieldValue(f, row);
      if (f.required && !String(val ?? "").trim()) {
        e[f.key] = "Wajib diisi.";
      }
    });
    setErrs(e);
    if (Object.keys(e).length > 0) {
      toast("Harap lengkapi kolom yang wajib diisi", "danger");
      return;
    }

    const patch: Record<string, any> = {};
    editableFields.forEach((f) => {
      if (f.type === "password") {
        if (edits[f.key]?.trim()) patch[f.key] = edits[f.key].trim();
        return;
      }
      const raw = f.key in edits ? edits[f.key] : getInitialFieldValue(f, row);
      if (f.type === "number") {
        patch[f.key] = Number(String(raw ?? "0").replace(/\D/g, ""));
      } else if (f.type === "multiselect") {
        patch[f.key] = Array.isArray(raw) ? raw.join(", ") : raw ?? "";
      } else {
        patch[f.key] = raw ?? "";
      }
    });

    if (moduleKey === "invoices") {
      const nilai = patch.nilai || 0;
      patch.ppn = Math.round(nilai * 0.11);
      patch.total = nilai + patch.ppn;
    }

    setSaving(true);
    try {
      await patchRow(moduleKey, id, patch);
      setEdits({});
      toast(`${def.singular} berhasil disimpan`);
      const path = PATHS[moduleKey];
      if (path) {
        const fresh = await api<any>("GET", `${path}/${id}`).catch(() => null);
        if (fresh) setRemoteRow(adaptRow(moduleKey, fresh));
      }
    } catch (err: any) {
      toast(err?.message || "Gagal menyimpan perubahan", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (!def || !row) {
    return <EmptyState title="Data tidak ditemukan" text="Dokumen ini mungkin sudah diarsipkan atau tautannya salah." actionLabel="Kembali ke daftar" onAction={() => router.replace(`/${moduleKey}` as any)} />;
  }

  const status = def.statusKey ? String(row[def.statusKey] ?? "") : "";
  const approval = approvals.find((a) => a.module === moduleKey && a.refId === id && a.status === "Menunggu");
  const canDecide = !!approval && CAN_APPROVE.includes(user!.role);
  const isExpenseFinanceActionable = moduleKey === "expenses" && isFinanceOrBos && status !== "Ditolak" && status !== "Dibayar";

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
            {canDelete ? (
              <Button variant="outline" onPress={() => setDeleteOpen(true)}>
                <Trash2 size={15} color={colors.danger} />
                <Text className="text-danger">Hapus</Text>
              </Button>
            ) : null}
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
        {isExpenseFinanceActionable ? (
          <View className="bg-card border-border rounded-xl border p-4 gap-3">
            <View className="flex-row items-center justify-between flex-wrap gap-3">
              <View className="gap-1 flex-1 min-w-[200px]">
                <Text className="text-sm font-semibold text-foreground">
                  Persetujuan & Reimbursement Finance
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {status === "Disetujui"
                    ? "Pengeluaran sudah disetujui. Silakan selesaikan pembayaran dan lampirkan bukti transfer reimbursement."
                    : "Periksa bukti nota pengeluaran dan tentukan persetujuan atau pembayaran reimbursement."}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Button variant="outline" onPress={() => setRejectExpenseOpen(true)}>
                  <Text className="text-danger font-medium">Tolak</Text>
                </Button>
                <Button onPress={() => setApproveExpenseOpen(true)}>
                  <Check size={15} color={colors.background} className="mr-1.5" />
                  <Text>Setujui & Bayar</Text>
                </Button>
              </View>
            </View>
          </View>
        ) : canDecide ? (
          <ApprovalBar
            amount={approval!.nilai}
            amountLabel={moduleKey === "opname" ? `${approval!.nilai} SKU selisih` : undefined}
            financeOk={(approval as any).financeOk}
            onApprove={() => decide(approval!.id, "Disetujui")}
            onReject={(r) => decide(approval!.id, "Ditolak", r)}
          />
        ) : null}

        {!canEdit ? (
          <Panel title="Informasi" subtitle="Data pengeluaran hanya dapat diubah oleh Finance atau Super Admin">
            <InfoGrid fields={def.fields} row={row} />
          </Panel>
        ) : editableFields.length > 0 || readOnlyFields.length > 0 ? (
          <Panel
            title="Informasi"
            right={
              isDirty ? (
                <View className="flex-row items-center gap-2">
                  <Button variant="outline" size="sm" onPress={handleReset} disabled={saving}>
                    <Text className="text-xs">Batal</Text>
                  </Button>
                  <Button size="sm" onPress={handleSaveForm} disabled={saving}>
                    <Check size={14} color={colors.background} className="mr-1" />
                    <Text className="text-xs">{saving ? "Menyimpan..." : "Simpan Perubahan"}</Text>
                  </Button>
                </View>
              ) : null
            }
          >
            {readOnlyFields.length > 0 ? (
              <View className="mb-4 p-3 bg-panel/40 rounded-xl border border-border/70 flex-row flex-wrap gap-y-3">
                {readOnlyFields.map((f) => (
                  <View key={f.key} className="gap-0.5 pr-4 min-w-[130px] flex-1">
                    <Text className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
                      {f.label}
                    </Text>
                    <Cell fmt={f.fmt} value={row[f.key]} />
                  </View>
                ))}
              </View>
            ) : null}

            <View className="flex-row flex-wrap -mx-2">
              {editableFields.map((f) => {
                const isFullWidth = f.type === "textarea" || f.type === "multiselect";
                return (
                  <View
                    key={f.key}
                    className={cn("px-2 py-2", isFullWidth ? "w-full" : "w-full sm:w-1/2")}
                  >
                    <FormField label={f.label} required={f.required} error={errs[f.key]}>
                      {f.type === "select" ? (
                        <SearchableSelect
                          value={getFieldValue(f)}
                          onChange={(v) => setFieldValue(f.key, v)}
                          options={getDynamicOptions(f, data, def.key, fallbackUsers) ?? []}
                          placeholder={`Pilih ${f.label.toLowerCase()}`}
                          error={!!errs[f.key]}
                        />
                      ) : f.type === "multiselect" ? (
                        <MultiSelect
                          values={(() => {
                            const val = getFieldValue(f);
                            return Array.isArray(val)
                              ? val
                              : val
                              ? String(val).split(",").map((s) => s.trim()).filter(Boolean)
                              : [];
                          })()}
                          onChange={(vals) => setFieldValue(f.key, vals)}
                          options={getDynamicOptions(f, data, def.key, fallbackUsers) ?? []}
                          placeholder={`Pilih ${f.label.toLowerCase()}`}
                          error={!!errs[f.key]}
                        />
                      ) : f.type === "date" ? (
                        <DatePicker
                          value={getFieldValue(f)}
                          onChange={(v) => setFieldValue(f.key, v)}
                          placeholder="Pilih tanggal"
                          error={!!errs[f.key]}
                        />
                      ) : f.type === "number" ? (
                        <Input
                          value={getFieldValue(f)}
                          onChangeText={(v) => setFieldValue(f.key, formatThousands(v))}
                          keyboardType="numeric"
                          placeholder={`Masukkan ${f.label.toLowerCase()}`}
                          className={cn(errs[f.key] && "border-danger")}
                        />
                      ) : f.type === "textarea" ? (
                        <Textarea
                          value={getFieldValue(f)}
                          onChangeText={(v) => setFieldValue(f.key, v)}
                          placeholder={`Tulis ${f.label.toLowerCase()}`}
                          className={cn(errs[f.key] && "border-danger")}
                        />
                      ) : (
                        <Input
                          value={getFieldValue(f)}
                          onChangeText={(v) => setFieldValue(f.key, v)}
                          placeholder={`Masukkan ${f.label.toLowerCase()}`}
                          className={cn(errs[f.key] && "border-danger")}
                        />
                      )}
                    </FormField>
                  </View>
                );
              })}
            </View>

            {isDirty ? (
              <View className="flex-row items-center justify-end gap-2 pt-4 mt-2 border-t border-border">
                <Button variant="outline" onPress={handleReset} disabled={saving}>
                  <Text>Batal</Text>
                </Button>
                <Button onPress={handleSaveForm} disabled={saving}>
                  <Check size={15} color={colors.background} className="mr-1.5" />
                  <Text>{saving ? "Menyimpan..." : "Simpan Perubahan"}</Text>
                </Button>
              </View>
            ) : null}
          </Panel>
        ) : null}

        <ModuleExtras moduleKey={moduleKey} row={row} />

        {def.docs?.length ? (
          <Panel title="File dan bukti">
            <DocumentViewerList
              moduleKey={moduleKey}
              docs={def.docs}
              row={row}
              canUpload={canEdit}
              onUploadFile={async (fieldKey, fileId, item) => {
                try {
                  const patchPayload: Record<string, any> = { [fieldKey]: fileId };
                  if (fieldKey === "receiptFileId") {
                    patchPayload.fileId = fileId;
                  }
                  if (fieldKey === "scanFileId") {
                    patchPayload.fileId = fileId;
                  }

                  if (moduleKey === "expenses" && fieldKey === "paidFileId") {
                    await setStatus("expenses", id, "Dibayar", undefined, { paidFileId: fileId });
                    toast("Bukti transfer reimbursement berhasil dilampirkan & status diubah menjadi Dibayar");
                  } else {
                    await patchRow(moduleKey, id, patchPayload);
                    toast(`${item.label} berhasil diperbarui`);
                  }

                  const path = PATHS[moduleKey];
                  if (path) {
                    const fresh = await api<any>("GET", `${path}/${id}`).catch(() => null);
                    if (fresh) setRemoteRow(adaptRow(moduleKey, fresh));
                  }
                } catch (err: any) {
                  toast(err?.message || "Gagal memperbarui file", "danger");
                }
              }}
            />
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

      <Dialog open={approveExpenseOpen} onOpenChange={setApproveExpenseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Setujui & Bayar Reimbursement</DialogTitle>
            <DialogDescription>
              Klaim pengeluaran sebesar <Text className="font-semibold text-primary">{rupiah(row.nominal || 0)}</Text> untuk pelapor <Text className="font-semibold text-foreground">{row.pelapor || "-"}</Text>.
            </DialogDescription>
          </DialogHeader>

          <View className="gap-3 py-2">
            <FormField label="Bukti Transfer Reimbursement (Opsional)">
              <FileUploader
                label="Upload Bukti Transfer Bank / E-Wallet (JPG, PNG, PDF)"
                kind="semua"
                category="foto-struk"
                handleRef={(h) => { expenseFileHandle.current = h; }}
              />
            </FormField>

            <FormField label="Catatan / Nomor Referensi Transfer (Opsional)">
              <Input
                value={expenseTransferNote}
                onChangeText={setExpenseTransferNote}
                placeholder="Contoh: TRF-BCA-981290 / Transfer via BCA"
              />
            </FormField>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={() => setApproveExpenseOpen(false)} disabled={submittingExpense}>
              <Text>Batal</Text>
            </Button>
            <Button
              onPress={async () => {
                setSubmittingExpense(true);
                try {
                  const paidFileId = (await expenseFileHandle.current?.flush()) ?? undefined;
                  const targetStatus = paidFileId ? "Dibayar" : "Disetujui";
                  await setStatus("expenses", id, targetStatus, expenseTransferNote.trim() || undefined, { paidFileId });
                  if (approval) {
                    await decide(approval.id, "Disetujui", expenseTransferNote.trim() || undefined).catch(() => {});
                  }
                  const path = PATHS[moduleKey];
                  if (path) {
                    const fresh = await api<any>("GET", `${path}/${id}`).catch(() => null);
                    if (fresh) setRemoteRow(adaptRow(moduleKey, fresh));
                  }
                  toast(paidFileId ? "Reimbursement berhasil dibayar & bukti transfer dilampirkan" : "Pengeluaran disetujui");
                  setApproveExpenseOpen(false);
                  setExpenseTransferNote("");
                } catch (e: any) {
                  toast(e?.message || "Gagal menyetujui pengeluaran", "danger");
                } finally {
                  setSubmittingExpense(false);
                }
              }}
              disabled={submittingExpense}
            >
              <Check size={16} color={colors.background} className="mr-1.5" />
              <Text>{submittingExpense ? "Menyimpan..." : "Setujui & Selesaikan"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={rejectExpenseOpen}
        onOpenChange={setRejectExpenseOpen}
        title="Tolak Pengeluaran ini?"
        description="Pengeluaran akan ditolak. Berikan alasan penolakan agar pelapor mengetahui perbaikan yang diperlukan."
        confirmLabel="Tolak Pengeluaran"
        destructive
        reasonLabel="Alasan penolakan (Wajib diisi)"
        onConfirm={async (reason) => {
          if (!reason?.trim()) {
            toast("Alasan penolakan wajib diisi", "danger");
            return;
          }
          await setStatus("expenses", id, "Ditolak", reason.trim());
          if (approval) {
            await decide(approval.id, "Ditolak", reason.trim()).catch(() => {});
          }
          const path = PATHS[moduleKey];
          if (path) {
            const fresh = await api<any>("GET", `${path}/${id}`).catch(() => null);
            if (fresh) setRemoteRow(adaptRow(moduleKey, fresh));
          }
          toast("Pengeluaran ditolak", "danger");
          setRejectExpenseOpen(false);
        }}
      />
    </>
  );
}
