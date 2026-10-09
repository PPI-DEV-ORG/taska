import { View } from "react-native";
import {
  AlertTriangle, ArrowLeftRight, CheckCircle2, Circle, Clock, Info, Play, Send, Truck, XCircle,
  type LucideIcon,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { toneColor, type Tone } from "@/tokens";

const S: Record<string, [Tone, LucideIcon]> = {};
const add = (tone: Tone, icon: LucideIcon, names: string[]) => names.forEach((n) => (S[n] = [tone, icon]));

add("success", CheckCircle2, ["Lunas", "Disetujui", "Diterima", "Selesai", "Dibayar", "Aktif", "Won", "Sampai", "DONE", "Done", "Masuk"]);
add("warning", Clock, [
  "Menunggu persetujuan", "Menunggu", "Menunggu penerimaan", "Dilaporkan", "Diajukan", "Cek stok", "Draft",
  "Dibayar sebagian", "Diterima sebagian", "Pending", "Diminta", "Belum dikirim", "Belum lunas", "Dijadwalkan",
  "Di Supplier", "TODO", "Diproses", "Revisi", "Prospecting", "Ditunda", "Reserved", "Menunggu Bos", "Planned",
]);
add("danger", AlertTriangle, ["Terlambat", "Kedaluwarsa", "Rusak", "Kurang", "Salah barang", "BLOCKED"]);
add("danger", XCircle, ["Ditolak", "Dibatalkan", "Lost", "Nonaktif"]);
add("info", Send, ["Terkirim", "Dikirim", "Keluar"]);
add("info", Play, ["Berjalan", "IN PROGRESS", "In Progress", "In Review", "Qualification", "Proposal", "Negotiation", "PO dibuat"]);
add("info", Truck, ["Di gudang", "Terpasang"]);
add("info", ArrowLeftRight, ["Transfer"]);
add("neutral", Info, ["Kebutuhan"]);

export function statusTone(status: string): Tone {
  return (S[status] ?? ["neutral"])[0];
}

export function StatusBadge({ status }: { status: string }) {
  const [tone, Icon] = S[status] ?? (["neutral", Circle] as [Tone, LucideIcon]);
  const color = toneColor[tone];
  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 border"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}33` }}
    >
      <Icon size={11} color={color} />
      <Text className="text-[11px] font-semibold tracking-wide" style={{ color }}>
        {status}
      </Text>
    </View>
  );
}

export const ALL_STATUSES = Object.keys(S);
