import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowDown,
  BookOpen,
  Boxes,
  Briefcase,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  FileCheck,
  FileSignature,
  FileText,
  HandCoins,
  ListChecks,
  type LucideIcon,
  PackageCheck,
  Receipt,
  ShoppingCart,
  Target,
  TriangleAlert,
  Truck,
  Wallet,
  Workflow,
  BarChart3,
  GitBranch,
  Users,
  UserCheck,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useApp } from "@/store/app-store";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { colors } from "@/tokens";
import type { Row } from "@/constants/modules";

/**
 * Peta alur kerja di dashboard: menu disusun sebagai urutan proses (Penjualan, Pembelian, Gudang, Proyek, Keuangan)
 * supaya pengguna baru langsung paham "setelah ini, lanjut ke mana". Tiap langkah bisa diklik untuk membuka menunya
 * dan menampilkan jumlah data yang masih perlu ditindaklanjuti.
 */

type Step = {
  /** Kunci modul untuk cek hak akses */
  perm: string;
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  /** Hitung data yang masih perlu ditindaklanjuti */
  count?: (ctx: { data: Record<string, Row[] | undefined>; approvals: any[] }) => number | null;
  countLabel?: string;
};

/** Jalur alternatif setelah langkah bersama (mis. pembelian lewat PO vs beli langsung di toko). */
type Branch = { title: string; hint: string; steps: Step[] };
type Can = (module: string, action?: any) => boolean;
type Flow = {
  key: string;
  title: string;
  summary: string;
  steps: Step[];
  branches?: Branch[];
  /** Peran yang memegang alur ini sebagai tugas pokok (bukan sekadar ikut menyetujui / melihat). */
  owner: (can: Can) => boolean;
};

const prSource = (r: Row) => String(r?.procurementSource ?? r?.sumberPengadaan ?? "").toUpperCase();

const st = (r: Row) => String(r?.status ?? "");
const countBy = (rows: Row[] | undefined, open: (r: Row) => boolean) => (Array.isArray(rows) ? rows.filter(open).length : null);
const isIn = (list: string[]) => (r: Row) => list.includes(st(r));
const notIn = (list: string[]) => (r: Row) => !list.includes(st(r));

const FLOWS: Flow[] = [
  {
    key: "penjualan",
    title: "Penjualan",
    summary: "Dari prospek sampai faktur dibayar pelanggan.",
    owner: (can) => can("leads", "M"),
    steps: [
      {
        perm: "leads",
        label: "Prospek",
        desc: "Catat calon pelanggan & follow-up",
        href: "/leads",
        icon: Target,
        count: ({ data }) => countBy(data.leads, notIn(["Won", "Lost"])),
        countLabel: "aktif",
      },
      {
        perm: "quotations",
        label: "Penawaran",
        desc: "Buat harga & kirim ke pelanggan",
        href: "/quotations",
        icon: FileText,
        count: ({ data }) => countBy(data.quotations, isIn(["Not Yet", "Menunggu persetujuan", "Revisi"])),
        countLabel: "diproses",
      },
      {
        perm: "po-client",
        label: "Pesanan (SO)",
        desc: "Pelanggan setuju, pesanan dicatat",
        href: "/po-client",
        icon: FileCheck,
        count: ({ data }) => countBy(data["po-client"], notIn(["Lunas"])),
        countLabel: "belum lunas",
      },
      {
        perm: "delivery-notes",
        label: "Surat Jalan",
        desc: "Kirim barang ke pelanggan",
        href: "/delivery-notes",
        icon: FileSignature,
        count: ({ data }) => countBy(data["delivery-notes"], isIn(["Menunggu pengiriman"])),
        countLabel: "siap kirim",
      },
      {
        perm: "invoices",
        label: "Faktur & Pembayaran",
        desc: "Tagih pelanggan & catat pembayaran",
        href: "/invoices",
        icon: Receipt,
        count: ({ data }) => countBy(data.invoices, isIn(["Belum lunas", "Belum dikirim", "Terkirim", "Dibayar sebagian", "Terlambat"])),
        countLabel: "belum lunas",
      },
    ],
  },
  {
    key: "pembelian",
    title: "Pembelian",
    // Pemegang proses PO & pengirimannya (Procurement / pimpinan). Finance ikut di alur Keuangan (bayar tagihan).
    owner: (can) => can("supplier-pos", "C") && can("shipments", "U"),
    summary: "Ajukan permintaan, tunggu persetujuan, lalu ikuti salah satu jalur di bawah sesuai cara pengadaannya.",
    steps: [
      {
        perm: "purchase-requests",
        label: "Permintaan Barang",
        desc: "Ajukan barang yang dibutuhkan",
        href: "/purchase-requests",
        icon: ShoppingCart,
        count: ({ data }) => countBy(data["purchase-requests"], isIn(["Diajukan", "Cek stok"])),
        countLabel: "menunggu",
      },
      {
        perm: "approvals",
        label: "Persetujuan",
        desc: "Finance / atasan menyetujui",
        href: "/approvals",
        icon: CheckSquare,
        count: ({ approvals }) => (Array.isArray(approvals) ? approvals.filter((a) => a.status === "Menunggu").length : null),
        countLabel: "menunggu",
      },
    ],
    branches: [
      {
        title: "Lewat PO Supplier",
        hint: "Pembelian resmi ke supplier / distributor",
        steps: [
          {
            perm: "supplier-pos",
            label: "PO Supplier",
            desc: "Pesan barang ke supplier",
            href: "/supplier-pos",
            icon: Truck,
            count: ({ data }) => countBy(data["supplier-pos"], isIn(["Menunggu persetujuan", "Disetujui", "Di Supplier", "Dikirim", "Terlambat"])),
            countLabel: "berjalan",
          },
          {
            perm: "receiving",
            label: "Penerimaan Barang",
            desc: "Gudang cek & terima barang",
            href: "/receiving",
            icon: PackageCheck,
            count: ({ data }) => countBy(data.receiving, isIn(["Menunggu penerimaan", "Diterima sebagian"])),
            countLabel: "menunggu",
          },
          {
            perm: "invoices",
            label: "Tagihan & Pembayaran",
            desc: "Catat tagihan supplier lalu bayar",
            href: "/invoices",
            icon: Wallet,
            count: ({ data }) => countBy(data.invoiceIn, notIn(["Lunas", "Batal"])),
            countLabel: "belum dibayar",
          },
        ],
      },
      {
        title: "Beli langsung di toko (tanpa PO)",
        hint: "Tunai dibayar dulu · tempo dilunasi setelah barang diterima",
        steps: [
          {
            perm: "purchase-requests",
            label: "Bayar ke Toko",
            desc: "Finance bayar & unggah bukti / nota",
            href: "/purchase-requests",
            icon: Wallet,
            count: ({ data }) =>
              countBy(data["purchase-requests"], (r) => prSource(r).includes("RETAIL") && ["Disetujui", "Diterima (Belum Lunas)"].includes(st(r))),
            countLabel: "perlu dibayar",
          },
          {
            perm: "receiving",
            label: "Penerimaan Barang",
            desc: "Gudang cek & terima barang",
            href: "/receiving",
            icon: PackageCheck,
          },
        ],
      },
      {
        title: "Ambil dari stok gudang",
        hint: "Barang sudah ada, tidak perlu beli",
        steps: [
          {
            perm: "purchase-requests",
            label: "Gudang Serahkan",
            desc: "Barang keluar dari gudang ke proyek",
            href: "/purchase-requests",
            icon: Boxes,
            count: ({ data }) => countBy(data["purchase-requests"], (r) => prSource(r).includes("GUDANG") && st(r) === "Disetujui"),
            countLabel: "siap diserahkan",
          },
          {
            perm: "purchase-requests",
            label: "Konfirmasi Diterima",
            desc: "Tim proyek konfirmasi barang sampai",
            href: "/purchase-requests",
            icon: PackageCheck,
            count: ({ data }) => countBy(data["purchase-requests"], (r) => prSource(r).includes("GUDANG") && st(r) === "Dikirim"),
            countLabel: "menunggu",
          },
        ],
      },
    ],
  },
  {
    key: "gudang",
    title: "Gudang",
    summary: "Barang masuk, tersimpan, lalu keluar ke pelanggan / proyek.",
    owner: (can) => can("stock", "C") && can("delivery-notes", "C"),
    steps: [
      {
        perm: "receiving",
        label: "Barang Masuk",
        desc: "Terima barang dari supplier",
        href: "/receiving",
        icon: PackageCheck,
        count: ({ data }) => countBy(data.receiving, isIn(["Menunggu penerimaan", "Diterima sebagian"])),
        countLabel: "menunggu",
      },
      {
        perm: "stock",
        label: "Stok & SN",
        desc: "Cek jumlah stok & nomor seri",
        href: "/stock",
        icon: Boxes,
      },
      {
        perm: "delivery-notes",
        label: "Barang Keluar",
        desc: "Surat jalan ke pelanggan / proyek",
        href: "/delivery-notes",
        icon: FileSignature,
        count: ({ data }) => countBy(data["delivery-notes"], isIn(["Menunggu pengiriman"])),
        countLabel: "siap kirim",
      },
      {
        perm: "opname",
        label: "Stok Opname",
        desc: "Hitung fisik & samakan stok",
        href: "/opname",
        icon: ClipboardCheck,
        count: ({ data }) => countBy(data.opname, isIn(["Draft", "Menunggu persetujuan"])),
        countLabel: "proses",
      },
      {
        perm: "damage-reports",
        label: "Kerusakan & Retur",
        desc: "Laporkan barang rusak / retur",
        href: "/damage-reports",
        icon: TriangleAlert,
        count: ({ data }) => countBy(data["damage-reports"], isIn(["Dilaporkan", "Diproses"])),
        countLabel: "diproses",
      },
    ],
  },
  {
    key: "proyek",
    title: "Proyek",
    summary: "Survey lokasi, kerjakan proyek, minta barang & petty cash, lalu laporkan biayanya.",
    owner: (can) => can("tasks", "U") || can("projects", "U") || can("surveys", "U"),
    steps: [
      {
        perm: "surveys",
        label: "Survey",
        desc: "Cek lokasi & kebutuhan, ajukan petty cash survey",
        href: "/surveys",
        icon: ClipboardList,
        count: ({ data }) => countBy(data.surveys, isIn(["Diminta", "Dijadwalkan", "Berjalan"])),
        countLabel: "berjalan",
      },
      {
        perm: "projects",
        label: "Proyek",
        desc: "Lihat proyek, progres & laba-rugi",
        href: "/projects",
        icon: Briefcase,
        count: ({ data }) => countBy(data.projects, isIn(["Berjalan", "Terlambat"])),
        countLabel: "berjalan",
      },
      {
        perm: "tasks",
        label: "Tugas",
        desc: "Bagi & selesaikan pekerjaan tim",
        href: "/tasks",
        icon: ListChecks,
        count: ({ data }) => countBy(data.tasks, notIn(["Selesai", "Done", "Dibatalkan"])),
        countLabel: "terbuka",
      },
      {
        perm: "purchase-requests",
        label: "Permintaan Barang",
        desc: "Minta barang / material proyek",
        href: "/purchase-requests",
        icon: ShoppingCart,
        count: ({ data }) => countBy(data["purchase-requests"], isIn(["Diajukan", "Cek stok"])),
        countLabel: "menunggu",
      },
      {
        perm: "expenses",
        label: "Petty Cash",
        desc: "Pakai saldo petty cash + foto nota",
        href: "/cash-advances",
        icon: HandCoins,
      },
      {
        perm: "expenses",
        label: "Laporan Biaya",
        desc: "Catat pengeluaran + foto nota",
        href: "/expenses",
        icon: Wallet,
        count: ({ data }) => countBy(data.expenses, isIn(["Dilaporkan", "Disetujui"])),
        countLabel: "menunggu",
      },
    ],
  },
  {
    key: "keuangan",
    title: "Keuangan",
    summary: "Setujui, tagih, bayar, lalu semua tercatat di buku besar.",
    owner: (can) => can("accounting", "L"),
    steps: [
      {
        perm: "approvals",
        label: "Persetujuan",
        desc: "Setujui permintaan & pengeluaran",
        href: "/approvals",
        icon: CheckSquare,
        count: ({ approvals }) => (Array.isArray(approvals) ? approvals.filter((a) => a.status === "Menunggu").length : null),
        countLabel: "menunggu",
      },
      {
        perm: "invoices",
        label: "Faktur & Tagihan",
        desc: "Piutang pelanggan & hutang supplier",
        href: "/invoices",
        icon: Receipt,
        count: ({ data }) =>
          (countBy(data.invoices, isIn(["Belum lunas", "Terlambat", "Dibayar sebagian"])) ?? 0) +
          (countBy(data.invoiceIn, notIn(["Lunas", "Batal"])) ?? 0),
        countLabel: "belum lunas",
      },
      {
        perm: "expenses",
        label: "Pengeluaran & Petty Cash",
        desc: "Isi saldo petty cash & verifikasi nota",
        href: "/expenses",
        icon: Wallet,
        count: ({ data }) => countBy(data.expenses, isIn(["Dilaporkan", "Disetujui"])),
        countLabel: "menunggu",
      },
      {
        perm: "accounting",
        label: "Buku Besar",
        desc: "Jurnal otomatis & COA",
        href: "/accounting",
        icon: BookOpen,
      },
      {
        perm: "reports",
        label: "Laporan",
        desc: "Laba-rugi, neraca & lainnya",
        href: "/reports",
        icon: BarChart3,
      },
    ],
  },
];

FLOWS.push({
  key: "sdm",
  title: "SDM",
  summary: "Data karyawan, absensi, lalu penggajian.",
  owner: (can) => can("hr", "V"),
  steps: [
    { perm: "users", label: "Karyawan & Akun", desc: "Data karyawan & akun login", href: "/users", icon: Users },
    { perm: "hr", label: "Absensi & Lembur", desc: "Rekap kehadiran & lembur", href: "/hr", icon: UserCheck },
    { perm: "hr", label: "Penggajian", desc: "Hitung gaji & slip karyawan", href: "/hr", icon: Wallet },
  ],
});

/** Alur yang dibuka pertama sesuai peran. */
const DEFAULT_FLOW: Record<string, string> = {
  sales: "penjualan",
  se: "penjualan",
  procurement: "pembelian",
  gudang: "gudang",
  pm: "proyek",
  teknisi: "proyek",
  finance: "keuangan",
  hr: "sdm",
};

const STORAGE_KEY = "taska.workflowMap.v1";
function readPref(): { flow?: string; collapsed?: boolean } {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    }
  } catch {}
  return {};
}
function writePref(p: { flow?: string; collapsed?: boolean }) {
  try {
    if (typeof window !== "undefined" && window.localStorage) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {}
}

export function WorkflowMap() {
  const router = useRouter();
  const { user, data, approvals, can } = useApp();
  const { isMobile } = useBreakpoint();

  const flows = React.useMemo(
    () => FLOWS.filter((f) => f.owner(can)),
    [can],
  );
  const [pref, setPref] = React.useState(readPref);
  const role = String(user?.role ?? "").toLowerCase();
  const activeKey =
    (pref.flow && flows.some((f) => f.key === pref.flow) ? pref.flow : undefined) ??
    (flows.some((f) => f.key === DEFAULT_FLOW[role]) ? DEFAULT_FLOW[role] : flows[0]?.key);
  const flow = flows.find((f) => f.key === activeKey);
  const collapsed = !!pref.collapsed;

  function update(p: Partial<typeof pref>) {
    setPref((prev) => {
      const next = { ...prev, ...p };
      writePref(next);
      return next;
    });
  }

  if (!flow) return null;

  const ctx = { data: data as Record<string, Row[] | undefined>, approvals };

  const node = (s: Step, idx: number, keyPrefix = "") => {
    const allowed = can(s.perm, "L");
    const n = allowed && s.count ? s.count(ctx) : null;
    const Icon = s.icon;
    return (
      <Pressable
        key={`${keyPrefix}${s.label}-${idx}`}
        disabled={!allowed}
        onPress={() => router.push(s.href as any)}
        className={`rounded-xl border p-3 ${
          allowed ? "bg-card border-border active:bg-muted" : "bg-muted/40 border-dashed border-border"
        } ${isMobile ? "flex-row items-center gap-3" : "w-[168px] gap-2"}`}
      >
        <View className="flex-row items-center gap-2">
          <View className={`size-9 rounded-lg items-center justify-center ${allowed ? "bg-primary/10" : "bg-muted"}`}>
            <Icon size={18} color={allowed ? colors.primary : colors.muted} />
          </View>
          {!isMobile ? <Text className="text-[11px] font-semibold text-muted-foreground">Langkah {idx + 1}</Text> : null}
        </View>
        <View className={isMobile ? "flex-1 min-w-0" : "gap-0.5"}>
          <Text className={`text-sm font-semibold ${allowed ? "text-foreground" : "text-muted-foreground"}`} numberOfLines={1}>
            {isMobile ? `${idx + 1}. ` : ""}
            {s.label}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={2}>
            {allowed ? s.desc : "Dikerjakan tim lain"}
          </Text>
        </View>
        {n && n > 0 ? (
          <View className="self-start rounded-full bg-amber-500/15 px-2 py-0.5">
            <Text className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              {n} {s.countLabel}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="bg-card border-border/80 rounded-2xl border shadow-sm overflow-hidden">
      <View className="flex-row items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border/60">
        <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
          <View className="size-8 rounded-lg bg-primary/10 items-center justify-center">
            <Workflow size={18} color={colors.primary} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-sm sm:text-base font-semibold">Alur Kerja</Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              Klik langkah untuk membuka menunya
            </Text>
          </View>
        </View>
        <Pressable onPress={() => update({ collapsed: !collapsed })} className="flex-row items-center gap-1 px-2 py-1">
          <Text className="text-xs text-muted-foreground">{collapsed ? "Tampilkan" : "Sembunyikan"}</Text>
          {collapsed ? <ChevronDown size={14} color={colors.muted} /> : <ChevronUp size={14} color={colors.muted} />}
        </Pressable>
      </View>

      {!collapsed ? (
        <View className="p-4 sm:p-5 gap-4">
          {/* Pilihan alur */}
          {flows.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {flows.map((f) => {
                const active = f.key === flow.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => update({ flow: f.key })}
                    className={`rounded-full border px-3.5 py-1.5 ${active ? "bg-primary border-primary" : "bg-card border-border"}`}
                  >
                    <Text className={`text-xs font-semibold ${active ? "text-primary-foreground" : "text-foreground"}`}>{f.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <Text className="text-xs text-muted-foreground">{flow.summary}</Text>

          {/* Langkah-langkah */}
          {renderRow(flow.steps, 0, "main-")}

          {/* Cabang jalur */}
          {flow.branches?.length ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                {isMobile ? <ArrowDown size={14} color={colors.muted} /> : <GitBranch size={14} color={colors.muted} />}
                <Text className="text-xs font-semibold text-foreground">Lalu pilih salah satu jalur:</Text>
              </View>
              {flow.branches.map((b, bi) => (
                <View key={b.title} className="rounded-xl border border-border bg-muted/30 p-3 gap-2.5">
                  <View className="flex-row items-start gap-2">
                    <View className="size-5 rounded-full bg-primary items-center justify-center mt-0.5">
                      <Text className="text-[10px] font-bold text-primary-foreground">{String.fromCharCode(65 + bi)}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">{b.title}</Text>
                      <Text className="text-xs text-muted-foreground">{b.hint}</Text>
                    </View>
                  </View>
                  {renderRow(b.steps, flow.steps.length, `b${bi}-`)}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  function renderRow(steps: Step[], offset: number, keyPrefix: string) {
    return isMobile ? (
            <View>
              {steps.map((s, i) => (
                <React.Fragment key={`${keyPrefix}${s.label}-${i}`}>
                  {node(s, offset + i, keyPrefix)}
                  {i < steps.length - 1 ? (
                    <View className="items-center py-1">
                      <ArrowDown size={14} color={colors.muted} />
                    </View>
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row items-stretch">
                {steps.map((s, i) => (
                  <React.Fragment key={`${keyPrefix}${s.label}-${i}`}>
                    {node(s, offset + i, keyPrefix)}
                    {i < steps.length - 1 ? (
                      <View className="justify-center px-1.5">
                        <ChevronRight size={18} color={colors.muted} />
                      </View>
                    ) : null}
                  </React.Fragment>
                ))}
              </View>
            </ScrollView>
          );
  }
}
