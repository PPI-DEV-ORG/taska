import { Dialog } from "@/components/ui/dialog";
import type { Row } from "@/constants/modules";
import { CreateInvoiceForm } from "./create-invoice-form";

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  initialQuotation,
  initialLead,
  initialPo,
  defaultDirectSale,
  defaultDirectPurchase,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuotation?: Row;
  initialLead?: Row;
  initialPo?: Row;
  defaultDirectSale?: boolean;
  defaultDirectPurchase?: boolean;
  onSuccess?: () => void;
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CreateInvoiceForm
        key={`${open ? "open" : "closed"}-${initialPo?.id ?? "nopo"}-${initialQuotation?.id ?? "noq"}-${initialLead?.id ?? "nolead"}`}
        initialQuotation={initialQuotation}
        initialLead={initialLead}
        initialPo={initialPo}
        defaultDirectSale={defaultDirectSale}
        defaultDirectPurchase={defaultDirectPurchase}
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}
