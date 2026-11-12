import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { PostingService } from "./posting.service.js";
import { MappingService } from "./mapping.service.js";
import { round } from "./accounting.types.js";

@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingService: PostingService,
    private readonly mappingService: MappingService,
  ) {}

  /**
   * 7.1 Rekap Bulanan Pajak (GET /accounting/tax/summary)
   */
  async getTaxSummary(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Ambil kode akun pajak dari mapping
    const vatOutCode = await this.mappingService.get("VAT_OUT", "2100");
    const vatInCode = await this.mappingService.get("VAT_IN", "1600");
    const pph23CustomerCode = await this.mappingService.get("PPH_PREPAID_CUSTOMER", "1105.01");
    const pph25Code = await this.mappingService.get("PPH_PREPAID_CORP_25", "1105.02");
    const pph21Code = await this.mappingService.get("PPH_PAYABLE_21", "2105");
    const pph23VendorCode = await this.mappingService.get("PPH_PAYABLE_23", "2106");
    const pph42Code = await this.mappingService.get("PPH_PAYABLE_4_2", "2104");
    const bpjsCode = await this.mappingService.get("BPJS_PAYABLE", "2107");

    const taxAccounts = [
      vatOutCode,
      vatInCode,
      pph23CustomerCode,
      pph25Code,
      pph21Code,
      pph23VendorCode,
      pph42Code,
      bpjsCode,
    ];

    // Ambil seluruh mutasi s.d. akhir masa pajak untuk menghitung mutasi masa & saldo berjalan
    const allLines = await (this.prisma.main as any).journalLine.findMany({
      where: {
        accountCode: { in: taxAccounts },
        entry: {
          status: "POSTED",
          date: { lte: endDate },
        },
      },
      include: {
        entry: { select: { date: true, source: true } },
      },
    });

    const periodMap = new Map<string, { debit: number; credit: number }>();
    const runningMap = new Map<string, { debit: number; credit: number }>();
    const priorMap = new Map<string, { debit: number; credit: number }>();

    for (const code of taxAccounts) {
      periodMap.set(code, { debit: 0, credit: 0 });
      runningMap.set(code, { debit: 0, credit: 0 });
      priorMap.set(code, { debit: 0, credit: 0 });
    }

    for (const l of allLines) {
      const entryDate = new Date(l.entry.date);
      const d = Number(l.debit || 0);
      const c = Number(l.credit || 0);

      const run = runningMap.get(l.accountCode);
      if (run) {
        run.debit = round(run.debit + d);
        run.credit = round(run.credit + c);
      }

      if (entryDate >= startDate && entryDate <= endDate) {
        const cur = periodMap.get(l.accountCode);
        if (cur) {
          cur.debit = round(cur.debit + d);
          cur.credit = round(cur.credit + c);
        }
      } else if (entryDate < startDate) {
        const pri = priorMap.get(l.accountCode);
        if (pri) {
          pri.debit = round(pri.debit + d);
          pri.credit = round(pri.credit + c);
        }
      }
    }

    // PPN Keluaran: saldo berjalan kredit - debit (atau mutasi bulan berjalan)
    const vatOutRun = runningMap.get(vatOutCode)!;
    const vatOutput = Math.max(0, round(vatOutRun.credit - vatOutRun.debit));

    // PPN Masukan: mutasi debit - kredit bulan ini + sisa lebih bayar bulan sebelumnya (= saldo berjalan 1600)
    const vatInRun = runningMap.get(vatInCode)!;
    const vatInPrior = priorMap.get(vatInCode)!;
    const priorCarryForward = Math.max(0, round(vatInPrior.debit - vatInPrior.credit));
    const vatInput = Math.max(0, round(vatInRun.debit - vatInRun.credit));

    const vatNet = round(vatOutput - vatInput); // > 0: Kurang Bayar; < 0: Lebih Bayar (Kompensasi)
    const netPayable = vatNet > 0 ? vatNet : 0;
    const compensation = vatNet < 0 ? Math.abs(vatNet) : 0;

    // PPh 23 bukti potong dari customer & PPh 25 angsuran
    const pph23CustRun = runningMap.get(pph23CustomerCode)!;
    const pph23Customer = Math.max(0, round(pph23CustRun.debit - pph23CustRun.credit));

    const pph25Run = runningMap.get(pph25Code)!;
    const pph25Prepaid = Math.max(0, round(pph25Run.debit - pph25Run.credit));

    // Saldo berjalan Hutang PPh 21, 23, 4(2), BPJS
    const pph21Run = runningMap.get(pph21Code)!;
    const pph21 = Math.max(0, round(pph21Run.credit - pph21Run.debit));

    const pph23VendorRun = runningMap.get(pph23VendorCode)!;
    const pph23Vendor = Math.max(0, round(pph23VendorRun.credit - pph23VendorRun.debit));

    const pph42Run = runningMap.get(pph42Code)!;
    const pph42 = Math.max(0, round(pph42Run.credit - pph42Run.debit));

    const bpjsRun = runningMap.get(bpjsCode)!;
    const bpjs = Math.max(0, round(bpjsRun.credit - bpjsRun.debit));

    const totalWithholding = round(pph21 + pph23Vendor + pph42 + bpjs);

    return {
      period: { year, month },
      vat: {
        output: vatOutput,
        vatOut: vatOutput,
        input: vatInput,
        vatIn: vatInput,
        priorCarryForward,
        netPayable,
        vatPayable: netPayable,
        compensation,
        vatCompensation: compensation,
      },
      prepaidTax: {
        pph23Customer,
        pph25Prepaid,
      },
      prepaid: {
        pph23Customer,
        pph25Prepaid,
      },
      withholdingPayables: {
        pph21,
        pph23Vendor,
        pph42,
        bpjs,
        total: totalWithholding,
      },
      withholding: {
        pph21,
        pph23Vendor,
        pph42,
        bpjs,
        total: totalWithholding,
      },
    };
  }

  /**
   * 7.2 Setor / Kompensasi PPN Masa (POST /accounting/tax/vat-settlement)
   */
  async settleVat(dto: {
    year: number;
    month: number;
    date?: string | Date;
    payAccountCode?: string;
  }, user: any) {
    const summary = await this.getTaxSummary(dto.year, dto.month);
    const vatOutCode = await this.mappingService.get("VAT_OUT", "2100");
    const vatInCode = await this.mappingService.get("VAT_IN", "1600");
    const entryDate = dto.date ? new Date(dto.date) : new Date();

    const outputAmt = summary.vat.output;
    const inputAmt = summary.vat.input;

    if (outputAmt <= 0 && inputAmt <= 0) {
      throw new BadRequestException("Tidak ada saldo PPN Keluaran maupun Masukan pada masa pajak ini.");
    }

    if (outputAmt >= inputAmt) {
      // Keluaran >= Masukan: PPN Kurang Bayar -> Setor Kas
      const payable = round(outputAmt - inputAmt);
      if (payable > 0 && !dto.payAccountCode) {
        throw new BadRequestException("Akun kas/bank (payAccountCode) wajib dipilih untuk penyetoran PPN Kurang Bayar.");
      }

      const lines: any[] = [
        { accountCode: vatOutCode, debit: outputAmt, credit: 0, memo: `Tutup PPN Keluaran Masa ${dto.year}-${dto.month}` },
      ];
      if (inputAmt > 0) {
        lines.push({ accountCode: vatInCode, debit: 0, credit: inputAmt, memo: `Kredit PPN Masukan Masa ${dto.year}-${dto.month}` });
      }
      if (payable > 0) {
        lines.push({
          accountCode: dto.payAccountCode!,
          debit: 0,
          credit: payable,
          memo: `Setoran PPN Kurang Bayar Masa ${dto.year}-${dto.month}`,
        });
      }

      return this.postingService.post({
        date: entryDate,
        source: "TAX_SETTLEMENT",
        memo: `Penyetoran PPN Masa ${dto.year}-${dto.month}`,
        createdById: user?.id,
        lines,
      });
    } else {
      // Masukan > Keluaran: PPN Lebih Bayar -> Kompensasi (offset sebesar keluaran, sisa saldo 1600 utuh)
      if (outputAmt <= 0) {
        return {
          status: "CARRIED_FORWARD",
          compensation: inputAmt,
          message: `PPN Lebih Bayar sebesar Rp ${inputAmt.toLocaleString("id-ID")} tetap tersimpan di akun [${vatInCode}] sebagai kompensasi masa pajak berikutnya.`,
        };
      }
      const lines: any[] = [
        { accountCode: vatOutCode, debit: outputAmt, credit: 0, memo: `Offset PPN Keluaran Masa ${dto.year}-${dto.month}` },
        { accountCode: vatInCode, debit: 0, credit: outputAmt, memo: `Offset PPN Masukan Masa ${dto.year}-${dto.month}` },
      ];

      return this.postingService.post({
        date: entryDate,
        source: "TAX_SETTLEMENT",
        refNo: `SPT-PPN/${dto.year}/${String(dto.month).padStart(2, "0")}`,
        memo: `Kompensasi Lebih Bayar PPN Masa ${dto.year}-${dto.month}`,
        createdById: user?.id,
        lines,
      });
    }
  }

  /**
   * 7.3 Setor PPh & BPJS (POST /accounting/tax/withholding-remittance)
   */
  async remitWithholding(dto: {
    taxType: "PPH21" | "PPH23" | "PPH42" | "BPJS" | "PPH25";
    amount: number;
    date?: string | Date;
    payAccountCode: string;
    memo?: string;
  }, user: any) {
    if (!dto.payAccountCode) {
      throw new BadRequestException("Akun kas/bank (payAccountCode) wajib dipilih.");
    }
    const amt = round(Number(dto.amount));
    if (amt <= 0) {
      throw new BadRequestException("Nominal penyetoran pajak harus lebih besar dari 0.");
    }

    let debitAccount: string;
    let label = dto.taxType;

    if (dto.taxType === "PPH21") {
      debitAccount = await this.mappingService.get("PPH_PAYABLE_21", "2105");
    } else if (dto.taxType === "PPH23") {
      debitAccount = await this.mappingService.get("PPH_PAYABLE_23", "2106");
    } else if (dto.taxType === "PPH42") {
      debitAccount = await this.mappingService.get("PPH_PAYABLE_4_2", "2104");
    } else if (dto.taxType === "BPJS") {
      debitAccount = await this.mappingService.get("BPJS_PAYABLE", "2107");
    } else if (dto.taxType === "PPH25") {
      debitAccount = await this.mappingService.get("PPH_PREPAID_CORP_25", "1105.02");
    } else {
      throw new BadRequestException(`Jenis pajak ${dto.taxType} tidak dikenal.`);
    }

    return this.postingService.post({
      date: dto.date ? new Date(dto.date) : new Date(),
      source: "TAX_SETTLEMENT",
      memo: dto.memo || `Setoran Pajak / BPJS ${label}`,
      createdById: user?.id,
      lines: [
        { accountCode: debitAccount, debit: amt, credit: 0, memo: `Penyetoran ${label}` },
        { accountCode: dto.payAccountCode, debit: 0, credit: amt, memo: `Kas Keluar Penyetoran ${label}` },
      ],
    });
  }
}
