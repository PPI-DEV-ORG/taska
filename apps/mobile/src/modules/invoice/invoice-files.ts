import { Linking } from "react-native";
import { apiBase } from "@/services/api";

export function downloadInvoiceExcel(info: { invoiceId: string | number }) {
  const url = `${apiBase()}/invoices/${info.invoiceId}/excel?t=${Date.now()}`;
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

export function downloadInvoicePdf(info: { invoiceId: string | number }) {
  const url = `${apiBase()}/invoices/${info.invoiceId}/pdf?t=${Date.now()}`;
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

