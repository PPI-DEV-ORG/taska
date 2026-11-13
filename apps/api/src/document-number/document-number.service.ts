import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { SettingsService } from "../settings/settings.service.js";

export const DOC_TYPES = {
  penawaran: "nomor.penawaran",
  clientPO: "nomor.clientPO",
  permintaan: "nomor.permintaan",
  pesanan: "nomor.pesanan",
  suratJalan: "nomor.suratJalan",
  penerimaan: "nomor.penerimaan",
  invoiceOut: "nomor.pelanggan",
  proforma: "nomor.proforma",
  uangJalan: "nomor.uangJalan",
  invoiceIn: "nomor.supplier",
  proyek: "nomor.proyek",
} as const;

export type DocType = keyof typeof DOC_TYPES;

export const FORMAT_UMUM: Record<DocType, string> = {
  penawaran: "PNW/YYYY/MM/NNN",
  clientPO: "SO/YYYY/MM/NNN",
  permintaan: "PNJ/YYYY/MM/NNN",
  pesanan: "PO/YYYY/MM/NNN",
  suratJalan: "SJN/YYYY/MM/NNN",
  penerimaan: "RCP/YYYY/MM/NNN",
  invoiceOut: "INV/YYYY/MM/NNN",
  proforma: "PI/YYYY/MM/NNN",
  uangJalan: "UJ/YYYY/MM/NNN",
  invoiceIn: "RNC/YYYY/MM/NNN",
  proyek: "PRJ/YYYY/NNN",
};

const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function applyFormat(format: string, year: number, month: number, seq: number): string {
  const romanMonth = ROMAN_MONTHS[Math.max(0, Math.min(11, month - 1))] || "I";
  const yy = String(year).slice(-2);
  return format
    .replace(/\{YYYY\}|YYYY/g, String(year))
    .replace(/\{YY\}|\bYY\b/g, yy)
    .replace(/\{ROMAN_MM\}|ROMAN_MM/g, romanMonth)
    .replace(/\{MM\}|MM/g, pad(month, 2))
    .replace(/\{NNNN\}|\{SEQ4\}|N{4}/g, pad(seq, 4))
    .replace(/\{NNN\}|\{SEQ\}|N{3}/g, pad(seq, 3))
    .replace(/##{3}/g, pad(seq, 3))
    .replace(/##/g, pad(seq, 2));
}

@Injectable()
export class DocumentNumberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private async format(docType: DocType, year: number, month: number, seq: number): Promise<string> {
    let format = FORMAT_UMUM[docType];
    try {
      const saved = await this.settings.getValue(DOC_TYPES[docType]);
      if (saved && saved.trim()) format = saved.trim();
    } catch {
      /* pakai format bawaan */
    }
    if (docType === "pesanan") {
      format = format.replace(/^(?:POD|PO-S)\//i, "PO/");
    } else if (docType === "clientPO") {
      format = format.replace(/^POC\//i, "SO/");
    }
    return applyFormat(format, year, month, seq);
  }

  private async existsInDb(docType: DocType, candidate: string): Promise<boolean> {
    try {
      switch (docType) {
        case "penawaran":
          return Boolean(await this.prisma.main.quotation.findFirst({ where: { number: candidate } }));
        case "clientPO":
          return Boolean(await this.prisma.main.clientPO.findFirst({ where: { number: candidate } }));
        case "permintaan":
          return Boolean(await this.prisma.main.purchaseRequest.findFirst({ where: { number: candidate } }));
        case "pesanan":
          return Boolean(await this.prisma.main.supplierPO.findFirst({ where: { number: candidate } }));
        case "suratJalan":
          return Boolean(await this.prisma.main.deliveryNote.findFirst({ where: { number: candidate } }));
        case "penerimaan":
          return Boolean(await this.prisma.main.receiving.findFirst({ where: { number: candidate } }));
        case "invoiceOut":
        case "proforma":
          return Boolean(await this.prisma.main.invoiceOut.findFirst({ where: { number: candidate } }));
        case "uangJalan":
          return Boolean(await this.prisma.main.cashAdvance.findFirst({ where: { number: candidate } }));
        case "invoiceIn":
          return Boolean(await this.prisma.main.invoiceIn.findFirst({ where: { number: candidate } }));
        case "proyek":
          return Boolean(await this.prisma.main.project.findFirst({ where: { name: candidate } }));
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /** Nomor berikutnya: mengunci inkrement per jenis dokumen per bulan dan mencegah nomor kembar di database. */
  async next(docType: DocType, at: Date = new Date()): Promise<string> {
    const year = at.getFullYear();
    const month = at.getMonth() + 1;
    const period = `${year}-${pad(month, 2)}`;

    let candidate: string;
    do {
      const row = await this.prisma.main.documentNumber.upsert({
        where: { docType_period: { docType, period } },
        update: { seq: { increment: 1 } },
        create: { docType, period, seq: 1 },
      });
      candidate = await this.format(docType, year, month, row.seq);
    } while (await this.existsInDb(docType, candidate));

    return candidate;
  }

  /** Saran nomor (tanpa mengunci) untuk tampilan form. */
  async suggest(docType: DocType, at: Date = new Date()): Promise<string> {
    const year = at.getFullYear();
    const month = at.getMonth() + 1;
    const period = `${year}-${pad(month, 2)}`;
    const row = await this.prisma.main.documentNumber.findUnique({
      where: { docType_period: { docType, period } },
    });
    let seq = (row?.seq ?? 0) + 1;
    let candidate = await this.format(docType, year, month, seq);
    while (await this.existsInDb(docType, candidate)) {
      seq++;
      candidate = await this.format(docType, year, month, seq);
    }
    return candidate;
  }

  /** Validasi nomor manual: unik per jenis dokumen (PRD: sistem menjaga keunikan). */
  async assertUnique(value: string, exists: (v: string) => Promise<boolean>): Promise<void> {
    if (await exists(value)) throw new ConflictException(`Nomor ${value} sudah dipakai`);
  }
}
