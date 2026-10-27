import * as React from "react";
import { View } from "react-native";
import { FileSpreadsheet, FileText } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/tokens";
import { Pill } from "./report-ui-helpers";
import type { ReportCardItem, DownloadFormat } from "../types";

interface ReportCardsTabProps {
  cards: ReportCardItem[];
  onDownload: (type: string, title: string, format: DownloadFormat) => void;
  onDownloadEfaktur: () => void;
}

export function ReportCardsTab({
  cards,
  onDownload,
  onDownloadEfaktur,
}: ReportCardsTabProps) {
  return (
    <View className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
      {cards.map((rc) => (
        <View
          key={rc.title}
          className="bg-card border-border rounded-xl border p-5 justify-between gap-4 w-full"
        >
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-base font-semibold flex-1">{rc.title}</Text>
              {rc.badge ? <Pill label={rc.badge} tone="primary" /> : null}
            </View>
            <Text className="text-text-secondary text-sm">{rc.desc}</Text>
            <View className="bg-panel/40 border-border mt-2 rounded-lg border p-2.5">
              <Text className="text-xs text-muted-foreground font-mono">{rc.stat}</Text>
            </View>
          </View>

          {rc.isEfaktur ? (
            <View className="border-border border-t pt-3 flex-row gap-2">
              <Button
                size="sm"
                className="flex-1 flex-row items-center justify-center gap-2"
                onPress={onDownloadEfaktur}
              >
                <FileSpreadsheet size={15} color={colors.background} />
                <Text className="text-xs font-semibold">Download CSV E-Faktur DJP</Text>
              </Button>
            </View>
          ) : (
            <View className="border-border border-t pt-3 flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onPress={() => onDownload(rc.type, rc.title, "xlsx")}
              >
                <FileSpreadsheet size={14} color={colors.success} />
                <Text className="text-xs">Excel</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onPress={() => onDownload(rc.type, rc.title, "pdf")}
              >
                <FileText size={14} color={colors.danger} />
                <Text className="text-xs">PDF</Text>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onPress={() => onDownload(rc.type, rc.title, "docx")}
              >
                <FileText size={14} color={colors.info} />
                <Text className="text-xs">Word</Text>
              </Button>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

