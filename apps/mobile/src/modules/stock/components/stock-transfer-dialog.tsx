import * as React from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/taska/basics";
import { SearchableSelect } from "@/components/taska/dialogs";
import { api } from "@/services/api";

interface StockTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
  warehouses: any[];
  onSuccess: () => Promise<void>;
  toast: (msg: string, type?: "success" | "danger" | "info" | "warning") => void;
}

export function StockTransferDialog({
  open,
  onOpenChange,
  products,
  warehouses,
  onSuccess,
  toast,
}: StockTransferDialogProps) {
  const [transferProd, setTransferProd] = React.useState("");
  const [transferFrom, setTransferFrom] = React.useState("");
  const [transferTo, setTransferTo] = React.useState("");
  const [transferQty, setTransferQty] = React.useState("5");

  const activeTransferProd = transferProd || String(products[0]?.nama ?? "");
  const activeTransferFrom = transferFrom || String(warehouses[0]?.nama ?? "");
  const activeTransferTo = transferTo || String(warehouses[1]?.nama ?? warehouses[0]?.nama ?? "");

  async function handleTransfer() {
    const prod = products.find((p) => p.nama === activeTransferProd);
    const from = warehouses.find((w) => w.nama === activeTransferFrom);
    const to = warehouses.find((w) => w.nama === activeTransferTo);
    if (!prod || !from || !to) {
      toast("Lengkapi barang, gudang asal, dan tujuan", "danger");
      return;
    }
    try {
      await api("POST", "/movements/transfer", {
        productId: Number(prod.id),
        fromWarehouseId: Number(from.id),
        toWarehouseId: Number(to.id),
        qty: Number(transferQty) || 1,
      });
      onOpenChange(false);
      toast(`Transfer ${transferQty} unit dari ${activeTransferFrom} ke ${activeTransferTo} diproses`);
      await onSuccess();
    } catch (e: any) {
      toast(e?.message ?? "Gagal transfer", "danger");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transfer Antar Gudang</DialogTitle>
        </DialogHeader>
        <View className="gap-4">
          <FormField label="Pilih Barang" required>
            <SearchableSelect
              value={activeTransferProd}
              onChange={setTransferProd}
              options={products.map((p) => String(p.nama))}
            />
          </FormField>
          <FormField label="Gudang Asal" required>
            <SearchableSelect
              value={activeTransferFrom}
              onChange={setTransferFrom}
              options={warehouses.map((w) => String(w.nama))}
            />
          </FormField>
          <FormField label="Gudang Tujuan" required>
            <SearchableSelect
              value={activeTransferTo}
              onChange={setTransferTo}
              options={warehouses.map((w) => String(w.nama))}
            />
          </FormField>
          <FormField label="Jumlah Transfer" required>
            <Input
              value={transferQty}
              onChangeText={setTransferQty}
              keyboardType="numeric"
            />
          </FormField>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            <Text>Batal</Text>
          </Button>
          <Button onPress={handleTransfer}>
            <Text>Kirim Transfer</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

