import { Linking } from "react-native";
import { apiBase, queryString } from "@/services/api";

export function downloadQuotationTemplate(info?: {
  quotationId?: string | number;
  leadId?: string | number;
  customer?: string;
  lead?: string;
  nomor?: string;
  signer?: string;
}) {
  const url = info?.quotationId
    ? `${apiBase()}/quotations/${info.quotationId}/excel?t=${Date.now()}`
    : `${apiBase()}/quotations/template-excel${queryString({
        leadId: info?.leadId,
        customer: info?.customer,
        lead: info?.lead,
        nomor: info?.nomor,
        signer: info?.signer,
      })}`;

  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

export function downloadQuotationPdf(info?: {
  quotationId?: string | number;
  leadId?: string | number;
  customer?: string;
  lead?: string;
  nomor?: string;
  signer?: string;
}) {
  const url = info?.quotationId
    ? `${apiBase()}/quotations/${info.quotationId}/pdf?t=${Date.now()}`
    : `${apiBase()}/quotations/template-pdf${queryString({
        leadId: info?.leadId,
        customer: info?.customer,
        lead: info?.lead,
        nomor: info?.nomor,
        signer: info?.signer,
      })}`;

  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}
