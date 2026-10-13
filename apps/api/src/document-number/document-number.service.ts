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
  invoiceIn: "nomor.supplier",
  proyek: "nomor.proyek",
} as const;

export type DocType = keyof typeof DOC_TYPES;

const FORMAT_UMUM: Record<DocType, string> = {
  penawaran: "PNW/YYYY/MM/NNN",
  clientPO: "POC/YYYY/MM/NNN",
  permintaan: "PNJ/YYYY/MM/NNN",
  pesanan: "POD/YYYY/MM/NNN",
  suratJalan: "SJN/YYYY/MM/NNN",
  penerimaan: "RCP/YYYY/MM/NNN",
  invoiceOut: "INV/YYYY/MM/NNN",
  invoiceIn: "RNC/YYYY/MM/NNN",
  proyek: "PRJ/YYYY/NNN",
};

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function applyFormat(format: string, year: number, month: number, seq: number): string {
  return format
    .replace(/YYYY/g, String(year))
    .replace(/MM/g, pad(month, 2))
    .replace(/N{4}/g, pad(seq, 4))
    .replace(/N{3}/g, pad(seq, 3))
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
      format = await this.settings.getValue(DOC_TYPES[docType]);
    } catch {
      /* pakai format bawaan */
    }
    return applyFormat(format, year, month, seq);
  }

  /** Nomor berikutnya: mengunci inkrement per jenis dokumen per bulan. */
  async next(docType: DocType, at: Date = new Date()): Promise<string> {
    const year = at.getFullYear();
    const month = at.getMonth() + 1;
    const period = `${year}-${pad(month, 2)}`;

    const row = await this.prisma.main.documentNumber.upsert({
      where: { docType_period: { docType, period } },
      update: { seq: { increment: 1 } },
      create: { docType, period, seq: 1 },
    });

    return this.format(docType, year, month, row.seq);
  }

  /** Saran nomor (tanpa mengunci) untuk tampilan form. */
  async suggest(docType: DocType, at: Date = new Date()): Promise<string> {
    const year = at.getFullYear();
    const month = at.getMonth() + 1;
    const period = `${year}-${pad(month, 2)}`;
    const row = await this.prisma.main.documentNumber.findUnique({
      where: { docType_period: { docType, period } },
    });
    return this.format(docType, year, month, (row?.seq ?? 0) + 1);
  }

  /** Validasi nomor manual: unik per jenis dokumen (PRD: sistem menjaga keunikan). */
  async assertUnique(value: string, exists: (v: string) => Promise<boolean>): Promise<void> {
    if (await exists(value)) throw new ConflictException(`Nomor ${value} sudah dipakai`);
  }
}
