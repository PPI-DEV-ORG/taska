import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Panel, QuickActionButton } from "@/components/akuntra/basics";
import {
  Command,
  Plus,
  ShoppingCart,
  ScanLine,
  FileText,
  Truck,
  ClipboardCheck,
  Calendar,
  Boxes,
  BookOpen,
  Wallet,
  PackageCheck,
  Briefcase,
  ListChecks,
  UserCheck,
  type LucideIcon,
} from "lucide-react-native";
import { useApp } from "@/store/app-store";
import type { ActionCode } from "@/constants/modules";

type Can = (module: string, action?: ActionCode) => boolean;
type QuickAction = { label: string; icon: LucideIcon; href: string; show: (can: Can) => boolean };
const has = (m: string, a: ActionCode) => (can: Can) => can(m, a);

/**
 * Aksi cepat diurutkan dari pekerjaan inti; yang tampil hanya yang sesuai hak akses peran (Pengaturan Peran),
 * maksimal 6 supaya tidak ramai.
 */
const ACTIONS: QuickAction[] = [
  { label: "Persetujuan", icon: ClipboardCheck, href: "/approvals", show: has("approvals", "V") },
  { label: "Proyek", icon: Briefcase, href: "/projects", show: has("projects", "U") },
  { label: "Tugas Saya", icon: ListChecks, href: "/tasks", show: has("tasks", "U") },
  { label: "Buat Prospek", icon: Plus, href: "/leads", show: has("leads", "C") },
  { label: "Buat Penawaran", icon: FileText, href: "/quotations/new", show: has("quotations", "C") },
  // Membuat PO = Procurement (Finance juga punya hak "buat" di PO, tapi untuk mencatat tagihan supplier)
  { label: "Buat PO Supplier", icon: Truck, href: "/supplier-pos", show: (can) => can("supplier-pos", "C") && can("shipments", "U") },
  { label: "Terima Barang", icon: PackageCheck, href: "/receiving", show: has("receiving", "C") },
  { label: "Buat Surat Jalan", icon: Truck, href: "/delivery-notes/new", show: has("delivery-notes", "C") },
  { label: "Buku Besar & Laporan", icon: BookOpen, href: "/accounting", show: has("accounting", "L") },
  { label: "Faktur & Tagihan", icon: FileText, href: "/invoices", show: has("invoices", "C") },
  { label: "Absensi & Gaji", icon: UserCheck, href: "/hr", show: has("hr", "V") },
  { label: "Permintaan Barang", icon: ShoppingCart, href: "/purchase-requests/new", show: has("purchase-requests", "C") },
  { label: "Scan Serial Number", icon: ScanLine, href: "/stock", show: has("stock", "U") },
  { label: "Stok Gudang", icon: Boxes, href: "/stock", show: has("stock", "C") },
  { label: "Ajukan Survey", icon: Calendar, href: "/surveys", show: has("surveys", "C") },
  { label: "Catat Pengeluaran", icon: Wallet, href: "/expenses/new", show: has("expenses", "C") },
];

export function QuickActionsCard(_props: { role?: string }) {
  const router = useRouter();
  const { can } = useApp();
  const shown = ACTIONS.filter((a) => a.show(can))
    // satu tujuan cukup sekali (mis. Stok Gudang & Scan SN)
    .filter((a, i, list) => list.findIndex((x) => x.href === a.href) === i)
    .slice(0, 6);
  if (!shown.length) return null;

  return (
    <Panel title="Aksi Cepat" subtitle="Pekerjaan yang paling sering Anda lakukan" icon={Command}>
      <View className="flex-row flex-wrap gap-3 py-1 w-full">
        {shown.map((a) => (
          <QuickActionButton
            key={a.label}
            label={a.label}
            icon={a.icon}
            className="flex-1 min-w-[170px]"
            onPress={() => router.push(a.href as any)}
          />
        ))}
      </View>
    </Panel>
  );
}
