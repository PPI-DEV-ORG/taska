import * as React from "react";
import { View } from "react-native";
import { ArrowLeft, Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, FormField } from "@/components/taska/basics";
import { DataTable } from "@/components/taska/data-table";
import { colors } from "@/tokens";

interface MasterSumberLeadViewProps {
  data: any;
  user: any;
  onBack: () => void;
  addRow: (module: string, payload: any) => void;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
  renderActions?: (row: any) => React.ReactNode;
}

export function MasterSumberLeadView({
  data,
  user,
  onBack,
  addRow,
  toast,
  renderActions,
}: MasterSumberLeadViewProps) {
  const [leadSourceOpen, setLeadSourceOpen] = React.useState(false);
  const [leadSourceNama, setLeadSourceNama] = React.useState("");

  const isSuper = user?.role === "super_admin";
  const canAddLeadSource = isSuper || user?.role === "sales" || user?.role === "bos" || user?.role === "admin";

  function handleSaveLeadSource() {
    if (!leadSourceNama.trim()) {
      toast("Nama kanal sumber lead wajib diisi", "danger");
      return;
    }
    addRow("leadSources", {
      nama: leadSourceNama.trim(),
      status: "Aktif",
    });
    setLeadSourceOpen(false);
    setLeadSourceNama("");
    toast("Kanal sumber lead berhasil ditambahkan");
  }

  return (
    <View className="gap-5">
      <PageHeader
        back
        title="Sumber Kedatangan Lead"
        subtitle={`${data.leadSources?.length || 0} kanal akuisisi marketing (Dikelola Sales)`}
        action={
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={onBack}>
              <ArrowLeft size={15} color={colors.text} />
              <Text className="text-xs">Kembali</Text>
            </Button>
            {canAddLeadSource ? (
              <Button size="sm" onPress={() => setLeadSourceOpen(true)}>
                <Plus size={15} color={colors.background} />
                <Text className="text-xs">Tambah Sumber Lead</Text>
              </Button>
            ) : null}
          </View>
        }
      />
      <DataTable
        columns={[
          { key: "nama", label: "Kanal Sumber Lead", primary: true, flex: 2 },
          { key: "status", label: "Status", fmt: "status", flex: 1 },
        ]}
        rows={data.leadSources || []}
        pageSize={8}
        actionsWidth={canAddLeadSource ? 72 : 64}
        renderActions={renderActions}
      />

      <Dialog open={leadSourceOpen} onOpenChange={setLeadSourceOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Kanal Sumber Lead</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <FormField label="Nama Kanal / Sumber Lead" required>
              <Input
                value={leadSourceNama}
                onChangeText={setLeadSourceNama}
                placeholder="Contoh: Webinar Cyber Security 2026"
              />
            </FormField>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setLeadSourceOpen(false)}>
              <Text>Batal</Text>
            </Button>
            <Button onPress={handleSaveLeadSource}>
              <Text>Simpan Sumber Lead</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}

