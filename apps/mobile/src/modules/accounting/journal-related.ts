import type { Row } from "@/constants/modules";
import type { JournalLine } from "@/lib/accounting";

export type JournalRelatedDocument = {
  label: string;
  href: string;
};

type DataLike = Record<string, Row[] | undefined>;

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function rowId(row: Row | null | undefined): string {
  if (!row) return "";
  const value = row.id ?? row.rawId;
  return value != null ? String(value) : "";
}

function byId(rows: Row[] | undefined, id: string | undefined): Row | null {
  if (!id) return null;
  return (rows ?? []).find((row) => rowId(row) === String(id)) ?? null;
}

function byNumber(rows: Row[] | undefined, ...numbers: (string | undefined)[]): Row | null {
  const targets = new Set(
    numbers
      .map((value) => String(value ?? "").trim())
      .filter((value) => value && value !== "-"),
  );
  if (targets.size === 0) return null;

  return (
    (rows ?? []).find((row) => {
      const candidates = [
        row.nomor,
        row.number,
        row.nomorSo,
        row.nomorPoClient,
        row.invoiceNomor,
      ]
        .map((value) => String(value ?? "").trim())
        .filter((value) => value && value !== "-");
      return candidates.some((value) => targets.has(value));
    }) ?? null
  );
}

function cleanPayReference(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\/PAY$/i, "");
}

function paymentsOf(row: Row): Record<string, any>[] {
  return Array.isArray(row._payments) ? (row._payments as Record<string, any>[]) : [];
}

function invoiceByPayment(paymentId: string, data: DataLike): Row | null {
  if (!paymentId) return null;
  return (
    (data.invoices ?? []).find((invoice) =>
      paymentsOf(invoice).some((payment) => String(payment.id) === String(paymentId)),
    ) ?? null
  );
}

function invoiceInByPayment(paymentId: string, data: DataLike): Row | null {
  if (!paymentId) return null;
  return (
    (data.invoiceIn ?? []).find((invoice) =>
      paymentsOf(invoice).some((payment) => String(payment.id) === String(paymentId)),
    ) ?? null
  );
}

function supplierPoLink(invoiceIn: Row | null, data: DataLike): JournalRelatedDocument | null {
  if (!invoiceIn) return null;

  const directPoId = invoiceIn.supplierPoId ?? invoiceIn.poId;
  const poById = byId(
    data["supplier-pos"],
    directPoId != null ? String(directPoId) : undefined,
  );
  if (poById) {
    return {
      label: "Buka PO Pemasok",
      href: `/supplier-pos/${rowId(poById)}`,
    };
  }

  const poByNumber = byNumber(data["supplier-pos"], invoiceIn.po, invoiceIn.supplierPoNumber);
  if (poByNumber) {
    return {
      label: "Buka PO Pemasok",
      href: `/supplier-pos/${rowId(poByNumber)}`,
    };
  }

  return null;
}

function invoiceInLink(invoiceIn: Row | null, data: DataLike): JournalRelatedDocument | null {
  return supplierPoLink(invoiceIn, data);
}

function findByReference(reference: string, data: DataLike): JournalRelatedDocument | null {
  const ref = String(reference ?? "").trim();
  if (!ref || ref === "-") return null;

  const invoice = byNumber(data.invoices, ref);
  if (invoice) {
    return {
      label: "Buka Faktur Penjualan",
      href: `/invoices/${rowId(invoice)}`,
    };
  }

  const invoiceIn = byNumber(data.invoiceIn, ref);
  if (invoiceIn) {
    return invoiceInLink(invoiceIn, data);
  }

  const expense = byNumber(data.expenses, ref);
  if (expense) {
    return {
      label: "Buka Pengeluaran",
      href: `/expenses/${rowId(expense)}`,
    };
  }

  const deliveryNote = byNumber(data["delivery-notes"], ref);
  if (deliveryNote) {
    return {
      label: "Buka Surat Jalan",
      href: `/delivery-notes/${rowId(deliveryNote)}`,
    };
  }

  const receiving = byNumber(data.receiving, ref);
  if (receiving) {
    return {
      label: "Buka Penerimaan Barang",
      href: `/receiving/${rowId(receiving)}`,
    };
  }

  const request = byNumber(data["purchase-requests"], ref);
  if (request) {
    return {
      label: "Buka Permintaan Barang",
      href: `/purchase-requests/${rowId(request)}`,
    };
  }

  return null;
}

/**
 * Cari dokumen sumber yang bisa dibuka dari satu baris jurnal.
 * Sumber pembayaran (Payment) memakai ID pembayaran, jadi invoice/PO-nya
 * diresolusi dulu lewat daftar pembayaran atau nomor referensi.
 */
export function resolveJournalRelatedDocument(
  line: JournalLine | null | undefined,
  data: DataLike,
): JournalRelatedDocument | null {
  if (!line) return null;

  const sourceType = norm(line.sourceType);
  const source = norm(line.source);
  const sourceId = String(line.sourceId ?? "").trim();
  const reference = String(line.refNo ?? "").trim();
  const fallbackReference = cleanPayReference(reference);

  if (sourceType === "invoiceout" || source === "invoiceout") {
    return sourceId
      ? { label: "Buka Faktur Penjualan", href: `/invoices/${sourceId}` }
      : findByReference(reference, data);
  }

  if (sourceType === "invoicein" || source === "invoicein") {
    return (
      invoiceInLink(byId(data.invoiceIn, sourceId), data) ??
      findByReference(reference, data)
    );
  }

  if (
    sourceType === "payment" ||
    (source.includes("payment") && !source.includes("expense"))
  ) {
    if (source.includes("invoicein")) {
      return (
        invoiceInLink(invoiceInByPayment(sourceId, data), data) ??
        invoiceInLink(byNumber(data.invoiceIn, fallbackReference), data) ??
        findByReference(fallbackReference, data)
      );
    }

    const invoice =
      invoiceByPayment(sourceId, data) ??
      byNumber(data.invoices, fallbackReference);

    if (invoice) {
      return {
        label: "Buka Faktur Penjualan",
        href: `/invoices/${rowId(invoice)}`,
      };
    }

    const invoiceIn =
      invoiceInByPayment(sourceId, data) ??
      byNumber(data.invoiceIn, fallbackReference);

    return (
      invoiceInLink(invoiceIn, data) ??
      findByReference(fallbackReference, data)
    );
  }

  if (sourceType === "expense" || source.includes("expense")) {
    return sourceId
      ? { label: "Buka Pengeluaran", href: `/expenses/${sourceId}` }
      : findByReference(fallbackReference, data);
  }

  if (sourceType === "deliverynote" || source === "deliverynote") {
    return sourceId
      ? { label: "Buka Surat Jalan", href: `/delivery-notes/${sourceId}` }
      : findByReference(reference, data);
  }

  if (sourceType === "receiving" || source === "receiving") {
    return sourceId
      ? { label: "Buka Penerimaan Barang", href: `/receiving/${sourceId}` }
      : findByReference(reference, data);
  }

  if (sourceType === "purchaserequest" || source === "purchaserequest") {
    return sourceId
      ? { label: "Buka Permintaan Barang", href: `/purchase-requests/${sourceId}` }
      : findByReference(reference, data);
  }

  if (sourceType === "payrollslip" || source === "payroll") {
    return { label: "Buka Penggajian", href: "/hr" };
  }

  return findByReference(fallbackReference, data);
}
