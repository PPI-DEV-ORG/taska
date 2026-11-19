import * as React from "react";
import { View, Pressable } from "react-native";
import { UserCheck } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Panel, FormField } from "@/components/akuntra/basics";
import { SearchableSelect } from "@/components/akuntra/dialogs";
import { UserSelect } from "@/components/akuntra/document-select";
import { useApp } from "@/store/app-store";
import { colors } from "@/tokens";
import type { Row } from "@/constants/modules";

type Person = { id: string; name: string };

// ─────────────── Pengirim: karyawan / ojol / ekspedisi ───────────────

export type SenderMode = "KARYAWAN" | "OJOL" | "EKSPEDISI";
export type SenderValue = {
  mode: SenderMode;
  /** Karyawan pengirim (mode KARYAWAN). */
  sender: Person | null;
  /** Layanan ojol / nama ekspedisi (mode OJOL / EKSPEDISI). */
  provider: string;
  /** Nama driver / kurir (opsional). */
  driver: string;
  /** Plat nomor (karyawan / ojol) atau no. resi (ekspedisi). */
  vehicleNo: string;
};

export const OJOL_PROVIDERS = ["GoSend", "GrabExpress", "Maxim", "Lalamove", "ShopeeFood/SPX"];
export const EXPEDITION_SUGGESTIONS = ["JNE", "J&T", "SiCepat", "Deliveree", "Lalamove", "Indah Cargo"];
const isOjol = (provider: string) => OJOL_PROVIDERS.some((p) => p.toLowerCase() === provider.trim().toLowerCase()) || /gojek|gosend|grab|maxim/i.test(provider);

/** senderName tersimpan sebagai "Layanan · Nama driver". */
export function parseSender(row: Row | null, me?: { id: string | number; name?: string } | null): SenderValue {
  const ex = row ?? ({} as Row);
  if (ex.pengirimId || !ex.pengirimEkspedisi) {
    return {
      mode: "KARYAWAN",
      sender: ex.pengirimId ? { id: String(ex.pengirimId), name: String(ex.pengirim || "-") } : me ? { id: String(me.id), name: String(me.name || "Saya") } : null,
      provider: "",
      driver: "",
      vehicleNo: ex.kendaraan ?? "",
    };
  }
  const [first, ...rest] = String(ex.pengirimEkspedisi).split(" · ");
  const provider = (first ?? "").trim();
  return { mode: isOjol(provider) ? "OJOL" : "EKSPEDISI", sender: null, provider, driver: rest.join(" · ").trim(), vehicleNo: ex.kendaraan ?? "" };
}

export function senderPayload(v: SenderValue) {
  const external = v.mode !== "KARYAWAN";
  return {
    senderId: !external && v.sender ? Number(v.sender.id) : null,
    senderName: external ? [v.provider.trim(), v.driver.trim()].filter(Boolean).join(" · ") : "",
    vehicleNo: v.vehicleNo.trim(),
  };
}

export function validateSender(v: SenderValue): string | null {
  if (v.mode === "KARYAWAN" && !v.sender) return "Pilih karyawan yang mengirim barang";
  if (v.mode === "OJOL" && !v.provider.trim()) return "Pilih layanan ojol (GoSend, GrabExpress, dll.)";
  if (v.mode === "EKSPEDISI" && !v.provider.trim()) return "Isi nama ekspedisi";
  return null;
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`rounded-full border px-3 py-1.5 ${active ? "bg-primary border-primary" : "bg-card border-border"}`}>
      <Text className={`text-xs ${active ? "text-white font-semibold" : "text-foreground"}`}>{label}</Text>
    </Pressable>
  );
}

const toPerson = (u: Row | null): Person | null => (u ? { id: String(u.id), name: String(u.nama || u.name || "-") } : null);

/** Isian pengirim (dipakai di form surat jalan & dialog "Ubah pengirim"). */
export function SenderFields({ value, onChange }: { value: SenderValue; onChange: (v: SenderValue) => void }) {
  const set = <K extends keyof SenderValue>(k: K, v: SenderValue[K]) => onChange({ ...value, [k]: v });
  const suggestions = value.mode === "OJOL" ? OJOL_PROVIDERS : EXPEDITION_SUGGESTIONS;
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-1.5">
        <Chip active={value.mode === "KARYAWAN"} label="Karyawan kita" onPress={() => set("mode", "KARYAWAN")} />
        <Chip active={value.mode === "OJOL"} label="Ojol (Gojek / Grab)" onPress={() => onChange({ ...value, mode: "OJOL", provider: isOjol(value.provider) ? value.provider : "" })} />
        <Chip active={value.mode === "EKSPEDISI"} label="Ekspedisi" onPress={() => onChange({ ...value, mode: "EKSPEDISI", provider: isOjol(value.provider) ? "" : value.provider })} />
      </View>

      {value.mode === "KARYAWAN" ? (
        <View className="flex-row flex-wrap gap-2">
          <View className="flex-1 min-w-[180px]">
            <UserSelect value={value.sender?.name} userId={value.sender?.id} onChange={(u) => set("sender", toPerson(u))} placeholder="Pilih karyawan pengirim..." allowClear={false} />
          </View>
          <View className="flex-1 min-w-[140px]">
            <Input value={value.vehicleNo} onChangeText={(v) => set("vehicleNo", v.toUpperCase())} placeholder="Plat kendaraan (opsional)" autoCapitalize="characters" />
          </View>
        </View>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-1.5">
            {suggestions.map((p) => (
              <Pressable
                key={p}
                onPress={() => set("provider", p)}
                className={`rounded-lg border px-2.5 py-1 ${value.provider === p ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <Text className={`text-xs ${value.provider === p ? "text-primary font-semibold" : "text-foreground"}`}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[150px]">
              <Input
                value={value.provider}
                onChangeText={(v) => set("provider", v)}
                placeholder={value.mode === "OJOL" ? "Layanan, mis. GoSend" : "Nama ekspedisi, mis. JNE"}
              />
            </View>
            <View className="flex-1 min-w-[150px]">
              <Input value={value.driver} onChangeText={(v) => set("driver", v)} placeholder={value.mode === "OJOL" ? "Nama driver (opsional)" : "Nama kurir / sopir (opsional)"} />
            </View>
            <View className="flex-1 min-w-[140px]">
              <Input
                value={value.vehicleNo}
                onChangeText={(v) => set("vehicleNo", v.toUpperCase())}
                placeholder={value.mode === "OJOL" ? "Plat nomor (opsional)" : "No. resi / plat (opsional)"}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ─────────────── Penanda tangan lengkap (form surat jalan) ───────────────

export type SignersValue = {
  warehouseId: string | null;
  warehouseStaff: Person | null;
  sender: SenderValue;
  /** null = otomatis (PM project); diisi = penerima lain yang dipilih. */
  recipientUser: Person | null;
  recipientName: string;
  recipientTitle: string;
  recipientPhone: string;
};

/** Nilai awal dari surat jalan yang diedit (atau pengirim = pengguna saat ini). */
export function initialSigners(existing: Row | null, me: { id: string | number; name?: string } | null): SignersValue {
  const ex = existing ?? ({} as Row);
  return {
    warehouseId: ex.gudangId ?? null,
    warehouseStaff: ex.petugasGudangId ? { id: String(ex.petugasGudangId), name: String(ex.petugasGudang || "-") } : null,
    sender: parseSender(existing, me),
    recipientUser: ex.penerimaId ? { id: String(ex.penerimaId), name: String(ex.penerimaNama || "-") } : null,
    recipientName: ex.penerimaNama ?? "",
    recipientTitle: ex.penerimaJabatan ?? "",
    recipientPhone: ex.penerimaKontak ?? "",
  };
}

/** Payload API penanda tangan. Surat jalan project: penerima = PM project bila tidak diganti. */
export function signersPayload(v: SignersValue, project: Row | null | undefined) {
  const pm = project?.pmId ? { id: String(project.pmId), name: String(project.pm || "PM") } : null;
  const recipientUser = v.recipientUser ?? (project ? pm : null);
  const isPm = !!recipientUser && !!pm && recipientUser.id === pm.id;
  return {
    warehouseId: v.warehouseId ? Number(v.warehouseId) : null,
    warehouseStaffId: v.warehouseStaff ? Number(v.warehouseStaff.id) : null,
    ...senderPayload(v.sender),
    recipientUserId: recipientUser ? Number(recipientUser.id) : null,
    recipientName: recipientUser ? recipientUser.name : v.recipientName.trim(),
    recipientTitle: recipientUser ? (isPm ? "Project Manager" : v.recipientTitle.trim() || "Penerima") : v.recipientTitle.trim(),
    recipientPhone: recipientUser ? "" : v.recipientPhone.trim(),
  };
}

export function validateSigners(v: SignersValue): string | null {
  return validateSender(v.sender);
}

/** Form "Pengiriman & Tanda Tangan": gudang asal + petugas gudang, pengirim, dan penerima. */
export function DeliverySignersForm({
  value,
  onChange,
  project,
}: {
  value: SignersValue;
  onChange: (v: SignersValue) => void;
  project: Row | null | undefined;
}) {
  const { data } = useApp();
  const set = <K extends keyof SignersValue>(k: K, v: SignersValue[K]) => onChange({ ...value, [k]: v });
  const warehouses: Row[] = data.warehouses ?? [];
  const whName = (w: Row) => String(w.nama || w.name || `Gudang #${w.id}`);
  const currentWh = warehouses.find((w) => String(w.id) === String(value.warehouseId));
  const pmName = project?.pm && project.pm !== "-" ? String(project.pm) : null;
  const pmId = project?.pmId ? String(project.pmId) : null;
  const usingPm = !!project && !!pmName && (!value.recipientUser || value.recipientUser.id === pmId);

  return (
    <Panel title="Pengiriman & Tanda Tangan" subtitle="Nama-nama ini tercetak di kolom tanda tangan surat jalan">
      <View className="gap-4">
        {/* 1. Gudang */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">1. Dikeluarkan oleh (Gudang)</Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[180px]">
              <FormField label="Gudang asal">
                <SearchableSelect
                  value={currentWh ? whName(currentWh) : ""}
                  options={warehouses.map(whName)}
                  onChange={(v) => set("warehouseId", warehouses.find((w) => whName(w) === v)?.id?.toString() ?? null)}
                  placeholder="Pilih gudang..."
                />
              </FormField>
            </View>
            <View className="flex-1 min-w-[180px]">
              <FormField label="Petugas gudang" hint="Kosongkan bila belum tahu — terisi otomatis saat gudang menyiapkan barang">
                <UserSelect
                  value={value.warehouseStaff?.name}
                  userId={value.warehouseStaff?.id}
                  onChange={(u) => set("warehouseStaff", toPerson(u))}
                  placeholder="Pilih petugas gudang..."
                />
              </FormField>
            </View>
          </View>
        </View>

        {/* 2. Pengirim */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">2. Dikirim oleh</Text>
          <SenderFields value={value.sender} onChange={(s) => set("sender", s)} />
        </View>

        {/* 3. Penerima */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">3. Diterima oleh</Text>
          {project ? (
            <>
              <View className="flex-row items-center gap-2.5 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5">
                <UserCheck size={16} color={colors.primary} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">
                    {usingPm ? pmName : value.recipientUser?.name || "Belum ada PM di project ini"}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    {usingPm ? "PM project — menerima barang di lokasi & mendapat notifikasi" : "Penerima di lokasi (bukan PM project)"}
                  </Text>
                </View>
                {value.recipientUser && !usingPm ? (
                  <Pressable onPress={() => set("recipientUser", null)}>
                    <Text className="text-xs font-semibold text-primary">Pakai PM</Text>
                  </Pressable>
                ) : null}
              </View>
              <UserSelect
                value={undefined}
                userId={value.recipientUser?.id}
                onChange={(u) => set("recipientUser", toPerson(u))}
                placeholder="Ganti penerima (opsional)..."
              />
            </>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              <View className="flex-1 min-w-[160px]">
                <Input value={value.recipientName} onChangeText={(v) => set("recipientName", v)} placeholder="Nama penerima (PIC pelanggan)" />
              </View>
              <View className="flex-1 min-w-[140px]">
                <Input value={value.recipientTitle} onChangeText={(v) => set("recipientTitle", v)} placeholder="Jabatan (opsional)" />
              </View>
              <View className="flex-1 min-w-[140px]">
                <Input value={value.recipientPhone} onChangeText={(v) => set("recipientPhone", v)} placeholder="No. HP (opsional)" keyboardType="phone-pad" />
              </View>
            </View>
          )}
        </View>
      </View>
    </Panel>
  );
}
