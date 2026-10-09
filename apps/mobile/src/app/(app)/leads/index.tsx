import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Plus, FileText } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Chip, PageHeader } from "@/components/taska/basics";
import { FilterBar } from "@/components/taska/data-table";
import { ConfirmDialog, FormDialog } from "@/components/taska/dialogs";
import { ModuleList } from "@/screens/module-list";
import { useApp } from "@/store/app-store";
import { MODULES } from "@/mock/modules";
import { LEAD_STAGES, LOST_REASONS, type Row } from "@/mock/data";
import { chartSeries, colors } from "@/tokens";
import { rupiahShort, tanggal } from "@/lib/format";

const def = MODULES.leads!;

function ViewToggle({ view, onView }: { view: string; onView: (v: string) => void }) {
  return (
    <View className="mb-4 flex-row gap-2">
      <Chip label="Papan" active={view === "papan"} onPress={() => onView("papan")} />
      <Chip label="Tabel" active={view === "tabel"} onPress={() => onView("tabel")} />
    </View>
  );
}

export default function LeadsScreen() {
  const router = useRouter();
  const { data, setStatus, user, createQuotationFromLead, toast } = useApp();
  const [view, setView] = React.useState("papan");
  const [q, setQ] = React.useState("");
  const [form, setForm] = React.useState(false);
  const [lost, setLost] = React.useState<Row | null>(null);

  if (view === "tabel") return <ModuleList def={def} headerExtra={<ViewToggle view={view} onView={setView} />} />;

  const s = q.trim().toLowerCase();
  const leads = data.leads.filter((l) => !s || `${l.nama} ${l.perusahaan}`.toLowerCase().includes(s));
  const canAdd = ["sales", "pm"].includes(user!.role);

  function move(l: Row, dir: -1 | 1) {
    const i = LEAD_STAGES.indexOf(l.status as typeof LEAD_STAGES[number]) + dir;
    if (i < 0 || i >= LEAD_STAGES.length) return;
    const next = LEAD_STAGES[i];
    if (!next) return;
    if (next === "Lost") setLost(l);
    else setStatus("leads", l.id, next);
  }

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} lead`}
        action={canAdd ? <Button onPress={() => setForm(true)}><Plus size={16} color={colors.background} /><Text>Tambah lead</Text></Button> : undefined}
      />
      <ViewToggle view={view} onView={setView} />
      <FilterBar search={q} onSearch={setQ} placeholder="Cari lead atau perusahaan" />
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerClassName="gap-3 pb-3">
        {LEAD_STAGES.map((stage, si) => {
          const col = leads.filter((l) => l.status === stage);
          const sum = col.reduce((a, l) => a + l.nilai, 0);
          return (
            <View key={stage} className="bg-card/60 border-border w-[272px] rounded-xl border">
              <View className="border-border gap-1 border-b p-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="size-2.5 rounded-full" style={{ backgroundColor: chartSeries[si] }} />
                    <Text className="text-sm font-semibold">{stage}</Text>
                  </View>
                  <Text className="text-muted-foreground text-sm">{col.length}</Text>
                </View>
                <Text className="text-muted-foreground text-[13px]">{rupiahShort(sum)}</Text>
              </View>
              <View className="gap-2 p-2">
                {col.length === 0 ? <Text className="text-muted-foreground px-2 py-4 text-center text-[13px]">Belum ada lead</Text> : null}
                {col.map((l) => (
                  <View key={l.id} className="bg-card border-border gap-2 rounded-lg border p-3">
                    <Pressable onPress={() => router.push(`/leads/${l.id}` as any)} className="gap-1">
                      <Text className="text-sm font-semibold" numberOfLines={2}>{l.nama}</Text>
                      <Text className="text-text-secondary text-[13px]" numberOfLines={1}>{l.perusahaan}</Text>
                      <View className="mt-1 flex-row items-center justify-between">
                        <Text className="text-sm font-medium">{rupiahShort(l.nilai)}</Text>
                        <Text className="text-muted-foreground text-[13px]">{l.peluang}%</Text>
                      </View>
                      <Text className="text-muted-foreground text-[13px]">{l.pemilik} · {tanggal(l.closing)}</Text>
                    </Pressable>

                    {["Qualification", "Proposal", "Negotiation", "Won"].includes(stage) ? (
                      (() => {
                        const qRow = (data.quotations ?? []).find(
                          (q) => (q.leadId && q.leadId === l.id) || (q.lead && q.lead.toLowerCase() === l.nama.toLowerCase())
                        );
                        return (
                          <View className="border-border/60 border-t pt-2 gap-1.5">
                            <Pressable
                              onPress={() => {
                                if (qRow) {
                                  router.push(`/quotations/${qRow.id}` as any);
                                } else {
                                  const newQ = createQuotationFromLead(l);
                                  toast("Draf penawaran otomatis dibuat!");
                                  router.push(`/quotations/${newQ.id}` as any);
                                }
                              }}
                              className="bg-primary/10 border-primary/25 active:bg-primary/20 flex-row items-center justify-between rounded-md border px-2.5 py-1.5"
                            >
                              <View className="flex-row items-center gap-1.5 flex-1 mr-1">
                                <FileText size={13} color={colors.primary} />
                                <Text className="text-primary text-[11px] font-semibold" numberOfLines={1}>
                                  {qRow ? qRow.nomor : "Buat Penawaran"}
                                </Text>
                              </View>
                              <View className="bg-primary/20 rounded px-1.5 py-0.5">
                                <Text className="text-[10px] font-bold text-primary">
                                  {qRow ? qRow.status : "Auto"}
                                </Text>
                              </View>
                            </Pressable>
                          </View>
                        );
                      })()
                    ) : null}

                    <View className="border-border flex-row items-center justify-between border-t pt-2">
                      <Pressable disabled={si === 0} onPress={() => move(l, -1)} hitSlop={8} className="size-9 items-center justify-center rounded-md" style={{ opacity: si === 0 ? 0.3 : 1 }}>
                        <ChevronLeft size={18} color={colors.textSecondary} />
                      </Pressable>
                      <Text className="text-muted-foreground text-[12px]">Pindahkan</Text>
                      <Pressable disabled={si === LEAD_STAGES.length - 1} onPress={() => move(l, 1)} hitSlop={8} className="size-9 items-center justify-center rounded-md" style={{ opacity: si === LEAD_STAGES.length - 1 ? 0.3 : 1 }}>
                        <ChevronRight size={18} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <FormDialog def={def} open={form} onOpenChange={setForm} />
      <ConfirmDialog
        open={!!lost}
        onOpenChange={(v) => !v && setLost(null)}
        title="Tandai lead ini Lost?"
        description="Lead pindah ke kolom Lost dan tidak muncul di pipeline aktif. Data tetap tersimpan."
        confirmLabel="Ya, tandai Lost"
        destructive
        reasonLabel="Alasan Lost"
        reasonOptions={LOST_REASONS}
        onConfirm={(r) => lost && setStatus("leads", lost.id, "Lost", r)}
      />
    </>
  );
}
