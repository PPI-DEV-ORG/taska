import * as React from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { Pencil, Plus, Trash2, X } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/taska/dialogs";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { SubCategory, SubProvider } from "./types";
import { BILLING_CYCLE_OPTIONS, CYCLE_LABEL } from "./subscription-utils";
import { SubscriptionTabs } from "./subscription-ui";
import { useSubscriptionAccounts } from "./use-subscription-accounts";

type Props = {
  visible: boolean;
  onClose: () => void;
  categories: SubCategory[];
  providers: SubProvider[];
  onChanged: () => void;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function SubscriptionMasterDialog(props: Props) {
  if (!props.visible) return null;
  return <MasterContent {...props} />;
}

function MasterContent({ onClose, categories, providers, onChanged, canCreate, canUpdate, canDelete }: Props) {
  const { toast } = useApp();
  const { expenseAccounts, prepaidAccounts } = useSubscriptionAccounts();
  const [tab, setTab] = React.useState("categories");
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [cycle, setCycle] = React.useState("ANNUAL");
  const [expenseAccount, setExpenseAccount] = React.useState("6122");
  const [prepaidAccount, setPrepaidAccount] = React.useState("1401");
  const [website, setWebsite] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");

  function resetForm() {
    setEditingId(null);
    setName("");
    setCode("");
    setCycle("ANNUAL");
    setExpenseAccount("6122");
    setPrepaidAccount("1401");
    setWebsite("");
    setEmail("");
    setPhone("");
    setShowForm(false);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
    setEditingId(null);
  }

  function startEdit(row: SubCategory | SubProvider, type: "categories" | "providers") {
    setTab(type);
    setEditingId(row.id);
    setName(row.name);
    setCode(row.code);
    if ("defaultBillingCycle" in row) {
      setCycle(row.defaultBillingCycle);
      setExpenseAccount(row.expenseAccountCode);
      setPrepaidAccount(row.prepaidAccountCode);
      setWebsite("");
      setEmail("");
      setPhone("");
    } else {
      setWebsite(row.website ?? "");
      setEmail(row.supportEmail ?? "");
      setPhone(row.supportPhone ?? "");
    }
    setShowForm(true);
  }

  async function save() {
    if (!name.trim()) {
      toast("Nama wajib diisi", "danger");
      return;
    }
    setSaving(true);
    try {
      if (tab === "categories") {
        const payload = {
          code: code.trim() || undefined,
          name: name.trim(),
          defaultBillingCycle: cycle,
          expenseAccountCode: expenseAccount || "6122",
          prepaidAccountCode: prepaidAccount || "1401",
        };
        if (editingId) await api.patch(`/subscriptions/categories/${editingId}`, payload);
        else await api.post("/subscriptions/categories", payload);
      } else {
        const payload = {
          code: code.trim() || undefined,
          name: name.trim(),
          website: website.trim() || undefined,
          supportEmail: email.trim() || undefined,
          supportPhone: phone.trim() || undefined,
        };
        if (editingId) await api.patch(`/subscriptions/providers/${editingId}`, payload);
        else await api.post("/subscriptions/providers", payload);
      }
      toast(editingId ? "Data berhasil diperbarui" : "Data berhasil ditambahkan");
      resetForm();
      onChanged();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menyimpan data", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: SubCategory | SubProvider) {
    try {
      if (tab === "categories") await api.delete(`/subscriptions/categories/${row.id}`);
      else await api.delete(`/subscriptions/providers/${row.id}`);
      toast("Data berhasil dihapus");
      onChanged();
    } catch (e: any) {
      toast(e?.message ?? "Gagal menghapus data", "danger");
    }
  }

  const rows = tab === "categories" ? categories : providers;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-5xl max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>Master Kategori & Provider Langganan</DialogTitle>
        </DialogHeader>
        <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
          <SubscriptionTabs
            tabs={[
              { value: "categories", label: "Kategori", count: categories.length },
              { value: "providers", label: "Provider / Vendor", count: providers.length },
            ]}
            value={tab}
            onChange={(value) => {
              setTab(value);
              resetForm();
            }}
          />
          {canCreate ? (
            <Button size="sm" className="gap-1.5" onPress={startCreate}>
              <Plus size={14} color="#fff" />
              <Text className="text-xs">{tab === "categories" ? "Kategori" : "Provider"} Baru</Text>
            </Button>
          ) : null}
        </View>

        {showForm && (editingId ? canUpdate : canCreate) ? (
          <View className="mt-3 gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold">
                {editingId ? "Edit" : "Tambah"} {tab === "categories" ? "Kategori" : "Provider"}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <X size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap gap-2.5">
              <View className="min-w-[200px] flex-1 gap-1">
                <Text className="text-xs font-semibold">Nama *</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={tab === "categories" ? "Domain & DNS" : "Amazon Web Services"}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </View>
              <View className="w-32 gap-1">
                <Text className="text-xs font-semibold">Kode</Text>
                <TextInput
                  value={code}
                  onChangeText={(v) => setCode(v.toUpperCase())}
                  placeholder={tab === "categories" ? "DOM" : "PRV-013"}
                  autoCapitalize="characters"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </View>
              {tab === "categories" ? (
                <>
                  <View className="w-44 gap-1">
                    <Text className="text-xs font-semibold">Siklus Default</Text>
                    <SearchableSelect
                      value={CYCLE_LABEL[cycle] ?? cycle}
                      options={BILLING_CYCLE_OPTIONS.map((x) => x.label)}
                      onChange={(label) => {
                        const found = BILLING_CYCLE_OPTIONS.find((x) => x.label === label);
                        setCycle(found?.value ?? "ANNUAL");
                      }}
                      className="h-10 rounded-lg border-border/80 bg-card"
                    />
                  </View>
                  <View className="min-w-[180px] flex-1 gap-1">
                    <Text className="text-xs font-semibold">Akun Beban Operasional</Text>
                    <SearchableSelect
                      value={expenseAccounts.find((a) => a.code === expenseAccount)?.label ?? expenseAccount}
                      options={expenseAccounts.map((a) => a.label)}
                      onChange={(label) => {
                        const found = expenseAccounts.find((a) => a.label === label);
                        if (found) setExpenseAccount(found.code);
                      }}
                      className="h-10 rounded-lg border-border/80 bg-card"
                    />
                  </View>
                  <View className="min-w-[180px] flex-1 gap-1">
                    <Text className="text-xs font-semibold">Akun Prepaid</Text>
                    <SearchableSelect
                      value={prepaidAccounts.find((a) => a.code === prepaidAccount)?.label ?? prepaidAccount}
                      options={prepaidAccounts.map((a) => a.label)}
                      onChange={(label) => {
                        const found = prepaidAccounts.find((a) => a.label === label);
                        if (found) setPrepaidAccount(found.code);
                      }}
                      className="h-10 rounded-lg border-border/80 bg-card"
                    />
                  </View>
                </>
              ) : (
                <>
                  <View className="min-w-[180px] flex-1 gap-1">
                    <Text className="text-xs font-semibold">Website</Text>
                    <TextInput
                      value={website}
                      onChangeText={setWebsite}
                      placeholder="https://..."
                      autoCapitalize="none"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </View>
                  <View className="min-w-[180px] flex-1 gap-1">
                    <Text className="text-xs font-semibold">Email Support</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </View>
                  <View className="w-40 gap-1">
                    <Text className="text-xs font-semibold">Telepon</Text>
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </View>
                </>
              )}
            </View>
            <View className="flex-row justify-end gap-2">
              <Button variant="outline" size="sm" onPress={resetForm} disabled={saving}>
                <Text className="text-xs">Batal</Text>
              </Button>
              <Button size="sm" onPress={save} disabled={saving}>
                <Text className="text-xs">{saving ? "Menyimpan..." : "Simpan"}</Text>
              </Button>
            </View>
          </View>
        ) : null}

        <View className="mt-3 flex-1 overflow-hidden rounded-xl border border-border/80 bg-card">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
            <View className="min-w-[720px] flex-1">
              <View className="flex-row items-center border-b border-border/70 bg-muted/60 px-4 py-2.5">
                <Text className="w-28 text-[11px] font-bold text-muted-foreground">Kode</Text>
                <Text className="min-w-[220px] flex-1 text-[11px] font-bold text-muted-foreground">Nama</Text>
                {tab === "categories" ? (
                  <>
                    <Text className="w-36 px-2 text-[11px] font-bold text-muted-foreground">Siklus</Text>
                    <Text className="w-28 px-2 text-[11px] font-bold text-muted-foreground">Akun Beban</Text>
                    <Text className="w-28 px-2 text-[11px] font-bold text-muted-foreground">Prepaid</Text>
                  </>
                ) : (
                  <>
                    <Text className="w-52 px-2 text-[11px] font-bold text-muted-foreground">Website</Text>
                    <Text className="w-52 px-2 text-[11px] font-bold text-muted-foreground">Kontak</Text>
                  </>
                )}
                <Text className="w-20 text-center text-[11px] font-bold text-muted-foreground">Dipakai</Text>
                <Text className="w-24 text-center text-[11px] font-bold text-muted-foreground">Aksi</Text>
              </View>
              <ScrollView className="max-h-[42vh]" contentContainerClassName="divide-y divide-border/40">
                {rows.length === 0 ? (
                  <View className="items-center justify-center p-8">
                    <Text className="text-xs text-muted-foreground">Belum ada data</Text>
                  </View>
                ) : (
                  rows.map((row) => (
                    <View key={row.id} className="flex-row items-center px-4 py-3">
                      <Text className="w-28 text-xs font-semibold text-muted-foreground">{row.code}</Text>
                      <View className="min-w-[220px] flex-1">
                        <Text className="text-sm font-semibold">{row.name}</Text>
                        {"subcategory" in row && row.subcategory ? (
                          <Text className="text-[11px] text-muted-foreground">{row.subcategory}</Text>
                        ) : null}
                      </View>
                      {"defaultBillingCycle" in row ? (
                        <>
                          <Text className="w-36 px-2 text-xs">{CYCLE_LABEL[row.defaultBillingCycle] ?? row.defaultBillingCycle}</Text>
                          <Text className="w-28 px-2 text-xs">{row.expenseAccountCode}</Text>
                          <Text className="w-28 px-2 text-xs">{row.prepaidAccountCode}</Text>
                        </>
                      ) : (
                        <>
                          <Text className="w-52 px-2 text-[11px] text-muted-foreground" numberOfLines={1}>
                            {row.website || "-"}
                          </Text>
                          <Text className="w-52 px-2 text-[11px] text-muted-foreground" numberOfLines={1}>
                            {row.supportEmail || row.supportPhone || "-"}
                          </Text>
                        </>
                      )}
                      <Text className="w-20 text-center text-xs font-bold text-primary">
                        {row._count?.subscriptions ?? 0}
                      </Text>
                      <View className="w-24 flex-row items-center justify-center gap-1">
                        {canUpdate || canDelete ? (
                          <>
                            {canUpdate ? (
                              <TouchableOpacity onPress={() => startEdit(row, tab as "categories" | "providers")} className="rounded-md p-1.5">
                                <Pencil size={14} color={colors.primary} />
                              </TouchableOpacity>
                            ) : null}
                            {canDelete ? (
                              <TouchableOpacity onPress={() => remove(row)} className="rounded-md p-1.5">
                                <Trash2 size={14} color={colors.danger} />
                              </TouchableOpacity>
                            ) : null}
                          </>
                        ) : (
                          <Text className="text-[11px] text-muted-foreground">-</Text>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </DialogContent>
    </Dialog>
  );
}
