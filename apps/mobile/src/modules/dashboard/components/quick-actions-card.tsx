import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Panel, QuickActionButton } from "@/components/taska/basics";
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
} from "lucide-react-native";

export function QuickActionsCard({ role }: { role: string }) {
  const router = useRouter();
  const isSuper = role === "super_admin";
  return (
    <Panel
      title="Quick Actions"
      subtitle="Common Tasks and Workflows"
      icon={Command}
    >
      <View className="flex-row flex-wrap gap-3 py-1 w-full">
        {isSuper || role === "bos" || role === "sales" ? (
          <QuickActionButton
            label="Buat Lead Baru"
            icon={Plus}
            shortcut="⌘L"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/leads")}
          />
        ) : null}
        {isSuper || role === "bos" || role === "pm" || role === "teknisi" || role === "procurement" || role === "gudang" ? (
          <QuickActionButton
            label="Request Barang"
            icon={ShoppingCart}
            shortcut="⌘R"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push(role === "gudang" ? ("/purchase-requests" as any) : ("/purchase-requests/new" as any))}
          />
        ) : null}
        {isSuper || role === "gudang" || role === "teknisi" ? (
          <QuickActionButton
            label="Scan Serial Number"
            icon={ScanLine}
            shortcut="⌘S"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/stock")}
          />
        ) : null}
        {isSuper || role === "bos" || role === "finance" ? (
          <QuickActionButton
            label="Buat Invoice"
            icon={FileText}
            shortcut="⌘I"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/invoices")}
          />
        ) : null}
        {isSuper || role === "teknisi" || role === "gudang" || role === "pm" ? (
          <QuickActionButton
            label="Buat Surat Jalan"
            icon={Truck}
            shortcut="⌘J"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/delivery-notes/new" as any)}
          />
        ) : null}
        {isSuper || role === "finance" || role === "bos" || role === "gudang" || role === "procurement" ? (
          <QuickActionButton
            label="Approval Center"
            icon={ClipboardCheck}
            shortcut="⌘A"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/approvals")}
          />
        ) : null}
        {role === "bos" || role === "admin" ? (
          <QuickActionButton
            label="Lihat Penawaran"
            icon={FileText}
            shortcut="⌘Q"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/quotations")}
          />
        ) : null}
        {isSuper || role === "sales" ? (
          <>
            <QuickActionButton
              label="Buat Penawaran"
              icon={FileText}
              shortcut="⌘Q"
              className="flex-1 min-w-[170px]"
              onPress={() => router.push("/quotations/new" as any)}
            />
            <QuickActionButton
              label="Ajukan Survey"
              icon={Calendar}
              shortcut="⌘S"
              className="flex-1 min-w-[170px]"
              onPress={() => router.push("/surveys")}
            />
          </>
        ) : null}
        {isSuper || role === "bos" || role === "admin" || role === "gudang" || role === "procurement" ? (
          <QuickActionButton
            label="Lihat Stok Gudang"
            icon={Boxes}
            shortcut="⌘G"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/stock")}
          />
        ) : null}
        {isSuper || role === "bos" || role === "admin" || role === "finance" ? (
          <QuickActionButton
            label="Buku Besar & COA"
            icon={BookOpen}
            shortcut="⌘K"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/accounting")}
          />
        ) : null}
        {role === "sales" || role === "procurement" || role === "finance" ? (
          <QuickActionButton
            label="Catat Pengeluaran"
            icon={Wallet}
            shortcut="⌘E"
            className="flex-1 min-w-[170px]"
            onPress={() => router.push("/expenses/new" as any)}
          />
        ) : null}
      </View>
    </Panel>
  );
}

