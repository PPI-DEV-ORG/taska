import { CreateInvoiceFormView } from "./create-invoice-form-view";
import {
  type CreateInvoiceFormProps,
  useInvoiceForm,
} from "./use-invoice-form";

export function CreateInvoiceForm(props: CreateInvoiceFormProps) {
  const form = useInvoiceForm(props);
  return <CreateInvoiceFormView form={form} />;
}
