import * as React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Panel } from "@/components/taska/basics";
import { FlowTracker, NextStepCard } from "@/components/taska/flow-tracker";
import { useApp } from "@/store/app-store";
import type { Row } from "@/constants/modules";
import { evaluateSales } from "@/lib/sales-flow";

/** Rantai penjualan: Penawaran → Sales Order → Surat Jalan + Invoice → Pembayaran. */
export function SalesChainPanel({ moduleKey, row }: { moduleKey: string; row: Row }) {
  const { data, user } = useApp();
  const flow = React.useMemo(() => evaluateSales(moduleKey, row, data as Record<string, Row[]>), [moduleKey, row, data]);
  const role = user?.role ?? "";
  const here = flow.steps.find((s) => s.key === flow.currentKey);
  return (
    <View className="gap-3">
      <NextStepCard flow={flow} role={role} />
      <Panel
        title="Alur Penjualan"
        subtitle={here ? `Anda sedang membuka dokumen: ${here.label}` : undefined}
      >
        <FlowTracker flow={flow} role={role} />
        <Text className="mt-1 text-[11px] text-muted-foreground">
          Dokumen terkait dicari otomatis dari penawaran, Sales Order, dan project yang sama.
        </Text>
      </Panel>
    </View>
  );
}
