import * as React from "react";
import { View } from "react-native";
import { FileSpreadsheet, FileText } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/tokens";
import type { DownloadFormat } from "../types";

export function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral" | "primary";
}) {
  const color =
    tone === "primary"
      ? colors.primary
      : tone === "success"
        ? colors.success
        : tone === "warning"
          ? colors.warning
          : tone === "danger"
            ? colors.danger
            : tone === "info"
              ? colors.info
              : colors.textSecondary;

  return (
    <View
      className="self-start rounded-full px-2.5 py-0.5 border"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}33` }}
    >
      <Text className="text-[11px] font-semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

export function ExportBar({
  type,
  title,
  onDownload,
}: {
  type: string;
  title: string;
  onDownload: (type: string, title: string, format: DownloadFormat) => void;
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onPress={() => onDownload(type, title, "xlsx")}>
        <FileSpreadsheet size={14} color={colors.success} />
        <Text className="text-xs">Excel / CSV</Text>
      </Button>
      <Button variant="outline" size="sm" onPress={() => onDownload(type, title, "pdf")}>
        <FileText size={14} color={colors.danger} />
        <Text className="text-xs">PDF Resmi</Text>
      </Button>
      <Button variant="outline" size="sm" onPress={() => onDownload(type, title, "docx")}>
        <FileText size={14} color={colors.info} />
        <Text className="text-xs">Word (.doc)</Text>
      </Button>
    </View>
  );
}

