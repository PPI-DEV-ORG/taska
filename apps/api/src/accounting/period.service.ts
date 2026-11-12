import {
  Injectable,
  Inject,
  forwardRef,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { MappingService } from "./mapping.service.js";
import { PostingService } from "./posting.service.js";
import { round } from "./accounting.types.js";

@Injectable()
export class PeriodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mappingService: MappingService,
    @Inject(forwardRef(() => PostingService))
    private readonly postingService: any,
  ) {}

  async getOrCreatePeriod(date: Date, tx?: any): Promise<{ id: number; year: number; month: number; status: string }> {
    const client = tx || this.prisma.main;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    let period = await (client as any).accountingPeriod.findUnique({
      where: { year_month: { year, month } },
    });

    if (!period) {
      period = await (client as any).accountingPeriod.create({
        data: { year, month, status: "OPEN" },
      });
    }

    return period;
  }

  async assertPeriodOpen(date: Date, bypassRole?: string, tx?: any): Promise<{ id: number; year: number; month: number }> {
    const period = await this.getOrCreatePeriod(date, tx);
    if (period.status === "CLOSED" || period.status === "REQUESTED_CLOSE") {
      throw new ConflictException(
        `Periode akuntansi ${period.year}-${String(period.month).padStart(2, "0")} sedang ${period.status}. Posting transaksi baru ditolak.`,
      );
    }
    return period;
  }

  async listPeriods(year?: number) {
    const now = new Date();
    // Pastikan periode bulan ini selalu terdaftar
    await this.getOrCreatePeriod(now);

    return (this.prisma.main as any).accountingPeriod.findMany({
      where: year ? { year } : undefined,
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  async listFiscalYears() {
    return (this.prisma.main as any).fiscalYear.findMany({
      orderBy: { year: "desc" },
    });
  }

  /**
   * 8.1 & 8.2: Pengajuan Tutup Buku Bulanan (Request Close by FINANCE/ADMIN)
   */
  async requestClose(year: number, month: number, userId: number) {
    const period = await this.getOrCreatePeriod(new Date(year, month - 1, 1));
    if (period.status === "CLOSED") {
      throw new BadRequestException("Periode sudah berstatus CLOSED.");
    }
    if (period.status === "REQUESTED_CLOSE") {
      return period;
    }

    // 8.2 Prasyarat Validasi Tutup Bulan
    // 1. Bulan sebelumnya pada tahun berjalan sudah CLOSED
    if (month > 1) {
      const prev = await (this.prisma.main as any).accountingPeriod.findUnique({
        where: { year_month: { year, month: month - 1 } },
      });
      if (!prev || prev.status !== "CLOSED") {
        throw new BadRequestException(`Bulan sebelumnya (${year}-${String(month - 1).padStart(2, "0")}) belum berstatus CLOSED.`);
      }
    }

    // 2. Keseimbangan Neraca Saldo (Trial Balance)
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const lines = await (this.prisma.main as any).journalLine.findMany({
      where: {
        entry: {
          status: "POSTED",
          date: { lte: endDate },
        },
      },
      select: { debit: true, credit: true },
    });
    let sumDebit = 0;
    let sumCredit = 0;
    for (const l of lines) {
      sumDebit = round(sumDebit + Number(l.debit || 0));
      sumCredit = round(sumCredit + Number(l.credit || 0));
    }
    if (Math.abs(round(sumDebit - sumCredit)) > 100) {
      throw new BadRequestException(
        `Neraca saldo tidak seimbang! Total Debit: Rp ${sumDebit.toLocaleString("id-ID")}, Total Kredit: Rp ${sumCredit.toLocaleString("id-ID")}`,
      );
    }

    // 3. Rekonsiliasi Persediaan: Akun 1200 vs total nilai stok fisik gudang
    const invCode = await this.mappingService.get("INVENTORY", "1200");
    const invLines = await (this.prisma.main as any).journalLine.findMany({
      where: {
        accountCode: invCode,
        entry: {
          status: "POSTED",
          date: { lte: endDate },
        },
      },
      select: { debit: true, credit: true },
    });
    let ledgerInv = 0;
    for (const l of invLines) {
      ledgerInv = round(ledgerInv + (Number(l.debit || 0) - Number(l.credit || 0)));
    }

    const stocks = await (this.prisma.main as any).stockBalance.findMany({
      include: { product: true },
    });
    let stockTotal = 0;
    for (const s of stocks) {
      const qty = Number(s.quantity || 0);
      const cost = Number(s.product?.avgCost || 0);
      if (qty > 0 && cost > 0) {
        stockTotal = round(stockTotal + qty * cost);
      }
    }

    const invDiff = Math.abs(round(ledgerInv - stockTotal));
    if (ledgerInv > 0 && stockTotal > 0 && invDiff > 100) {
      throw new BadRequestException(
        `Rekonsiliasi persediaan selisih > Rp 100! Buku Besar [1200]: Rp ${ledgerInv.toLocaleString("id-ID")}, Fisik Gudang: Rp ${stockTotal.toLocaleString("id-ID")} (Selisih: Rp ${invDiff.toLocaleString("id-ID")})`,
      );
    }

    // 4. Saldo GRNI (2108) tidak minus dan tidak hanging debit
    const grniCode = await this.mappingService.get("GRNI", "2108");
    const grniLines = await (this.prisma.main as any).journalLine.findMany({
      where: {
        accountCode: grniCode,
        entry: {
          status: "POSTED",
          date: { lte: endDate },
        },
      },
      select: { debit: true, credit: true },
    });
    let grniBalance = 0;
    for (const l of grniLines) {
      grniBalance = round(grniBalance + (Number(l.credit || 0) - Number(l.debit || 0)));
    }
    if (grniBalance < 0) {
      throw new BadRequestException(
        `Saldo GRNI [${grniCode}] gantung debit (Rp ${Math.abs(grniBalance).toLocaleString("id-ID")}). Pastikan seluruh penerimaan fisik (Receiving) telah dicatat.`,
      );
    }

    return (this.prisma.main as any).accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: "REQUESTED_CLOSE",
        requestedAt: new Date(),
        requestedById: userId,
      },
    });
  }

  /**
   * 8.1 & 8.2: Persetujuan Tutup Buku Bulanan (Approve Close by BOS/SUPER_ADMIN)
   */
  async approveClose(year: number, month: number, user: any) {
    const roleLower = (user?.role || "").toLowerCase();
    if (!["bos", "super_admin"].includes(roleLower)) {
      throw new ForbiddenException("Hanya Direksi (Bos) atau Super Admin yang dapat menyetujui tutup buku bulanan.");
    }

    const period = await this.getOrCreatePeriod(new Date(year, month - 1, 1));
    if (period.status === "CLOSED") {
      return period;
    }

    return (this.prisma.main as any).accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: user.id,
      },
    });
  }

  /**
   * 8.1: Buka Kembali Periode Bulanan (Reopen by BOS/SUPER_ADMIN dengan alasan wajib)
   */
  async reopenPeriod(year: number, month: number, reason: string, user: any) {
    if (!reason?.trim()) {
      throw new BadRequestException("Alasan pembukaan kembali periode (reopenReason) wajib diisi.");
    }
    const roleLower = (user?.role || "").toLowerCase();
    if (!["bos", "super_admin"].includes(roleLower)) {
      throw new ForbiddenException("Hanya Direksi (Bos) atau Super Admin yang dapat membuka kembali periode akuntansi.");
    }

    const period = await this.getOrCreatePeriod(new Date(year, month - 1, 1));
    return (this.prisma.main as any).accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: "OPEN",
        reopenedAt: new Date(),
        reopenedById: user.id,
        reopenReason: reason.trim(),
      },
    });
  }

  /**
   * 8.3: Tutup Tahun Buku (Fiscal Year Closing by BOS/SUPER_ADMIN)
   */
  async closeFiscalYear(year: number, taxEstimated: number, user: any) {
    const roleLower = (user?.role || "").toLowerCase();
    if (!["bos", "super_admin"].includes(roleLower)) {
      throw new ForbiddenException("Hanya Direksi (Bos) atau Super Admin yang dapat melakukan tutup buku tahunan.");
    }

    return this.prisma.main.$transaction(async (tx) => {
      // 1. Pastikan bulan Jan..Nov berstatus CLOSED
      const periods = await (tx as any).accountingPeriod.findMany({
        where: { year, month: { lte: 11 } },
      });
      const closedCount = periods.filter((p: any) => p.status === "CLOSED").length;
      if (closedCount < 11) {
        throw new BadRequestException(`Bulan Januari s.d. November tahun ${year} wajib berstatus CLOSED sebelum tutup tahun.`);
      }

      // Pastikan Desember berstatus CLOSED
      const decPeriod = await this.getOrCreatePeriod(new Date(year, 11, 31), tx);
      await (tx as any).accountingPeriod.update({
        where: { id: decPeriod.id },
        data: { status: "CLOSED", closedAt: new Date(), closedById: user.id },
      });

      // 2. Hitung Saldo Akun Pendapatan & Beban tahun bersangkutan
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);

      const plLines = await (tx as any).journalLine.findMany({
        where: {
          entry: {
            date: { gte: startOfYear, lte: endOfYear },
            status: "POSTED",
          },
          account: {
            category: {
              in: [
                "Pendapatan",
                "Beban Pokok (HPP)",
                "Beban Operasional",
                "Pendapatan Diluar Usaha",
                "Beban Diluar Usaha",
              ],
            },
          },
        },
        include: { account: true },
      });

      const accountBalances = new Map<string, { cat: string; balance: number; normal: string }>();
      for (const line of plLines) {
        const cur = accountBalances.get(line.accountCode) || {
          cat: line.account.category,
          balance: 0,
          normal: line.account.normalBalance,
        };
        const net = Number(line.debit) - Number(line.credit);
        cur.balance = round(cur.balance + net);
        accountBalances.set(line.accountCode, cur);
      }

      // 4. Posting Jurnal Akrual Pajak PPh Badan (TAX_ACCRUAL) per 31 Des jika ada taksiran
      const taxAmount = round(Number(taxEstimated || 0));
      if (taxAmount > 0) {
        const citExp = await this.mappingService.get("INCOME_TAX_EXPENSE", "7201");
        const pph29Pay = await this.mappingService.get("INCOME_TAX_PAYABLE_29", "2109");
        const pph25Code = await this.mappingService.get("PPH_PREPAID_CORP_25", "1105.02");
        const pph23CustCode = await this.mappingService.get("PPH_PREPAID_CUSTOMER", "1105.01");
        const taxRefundCode = await this.mappingService.get("TAX_REFUND_RECEIVABLE", "1106");

        // Ambil saldo kredit pajak dibayar dimuka (1105.01 dan 1105.02)
        const prepaidLines = await (tx as any).journalLine.findMany({
          where: {
            accountCode: { in: [pph25Code, pph23CustCode] },
            entry: {
              date: { gte: startOfYear, lte: endOfYear },
              status: "POSTED",
            },
          },
        });
        let pph25Bal = 0;
        let pph23Bal = 0;
        for (const pl of prepaidLines) {
          const net = round(Number(pl.debit || 0) - Number(pl.credit || 0));
          if (pl.accountCode === pph25Code) pph25Bal = round(pph25Bal + net);
          if (pl.accountCode === pph23CustCode) pph23Bal = round(pph23Bal + net);
        }

        const totalPrepaid = round(Math.max(0, pph25Bal) + Math.max(0, pph23Bal));
        const taxDiff = round(taxAmount - totalPrepaid);

        const accrualLines: any[] = [
          { accountCode: citExp, debit: taxAmount, credit: 0, memo: `Taksiran Beban PPh Badan ${year}` },
        ];
        if (pph25Bal > 0) {
          accrualLines.push({ accountCode: pph25Code, debit: 0, credit: pph25Bal, memo: `Kredit Angsuran PPh 25 Tahun ${year}` });
        }
        if (pph23Bal > 0) {
          accrualLines.push({ accountCode: pph23CustCode, debit: 0, credit: pph23Bal, memo: `Kredit Potongan PPh 23 Customer Tahun ${year}` });
        }

        if (taxDiff > 0) {
          // Kurang Bayar -> Cr 2109 (Hutang PPh 29)
          accrualLines.push({ accountCode: pph29Pay, debit: 0, credit: taxDiff, memo: `Hutang PPh 29 Tahun ${year}` });
        } else if (taxDiff < 0) {
          // Lebih Bayar -> Dr 1106 (Piutang Restitusi Pajak PPh 28A)
          accrualLines.push({ accountCode: taxRefundCode, debit: Math.abs(taxDiff), credit: 0, memo: `Piutang Restitusi Lebih Bayar PPh 28A ${year}` });
        }

        await this.postingService.post(
          {
            date: new Date(year, 11, 31),
            source: "TAX_ACCRUAL",
            memo: `Akrual Beban PPh Badan Tahun Buku ${year}`,
            createdById: user.id,
            lines: accrualLines,
          },
          tx,
        );
        // Tambahkan akun beban pajak ke saldo penutupan
        const cur = accountBalances.get(citExp) || { cat: "Beban Diluar Usaha", balance: 0, normal: "DEBIT" };
        cur.balance = round(cur.balance + taxAmount);
        accountBalances.set(citExp, cur);
      }

      // Ambil prive / dividen (3200.02) jika ada saldo untuk ditutup ke 3102
      const dividendCode = await this.mappingService.get("DIVIDEND_PRIVE", "3200.02");
      const dividendLines = await (tx as any).journalLine.findMany({
        where: {
          accountCode: dividendCode,
          entry: {
            date: { gte: startOfYear, lte: endOfYear },
            status: "POSTED",
          },
        },
      });
      let dividendBalance = 0;
      for (const dl of dividendLines) {
        dividendBalance = round(dividendBalance + (Number(dl.debit || 0) - Number(dl.credit || 0)));
      }
      if (dividendBalance !== 0) {
        accountBalances.set(dividendCode, {
          cat: "Ekuitas",
          balance: dividendBalance,
          normal: "DEBIT",
        });
      }

      // 5. Posting Jurnal Penutup (source = 'CLOSING' per 31 Des)
      const closingLines: any[] = [];
      let totalDebitOffset = 0;
      let totalCreditOffset = 0;

      for (const [code, info] of accountBalances.entries()) {
        if (info.balance === 0) continue;
        if (info.balance > 0) {
          // Bersaldo debit (misal beban) -> ditutup dengan Kredit
          closingLines.push({
            accountCode: code,
            debit: 0,
            credit: info.balance,
            memo: `Tutup Buku ${year} Akun ${code}`,
          });
          totalCreditOffset = round(totalCreditOffset + info.balance);
        } else {
          // Bersaldo kredit (misal pendapatan) -> ditutup dengan Debit
          const absVal = Math.abs(info.balance);
          closingLines.push({
            accountCode: code,
            debit: absVal,
            credit: 0,
            memo: `Tutup Buku ${year} Akun ${code}`,
          });
          totalDebitOffset = round(totalDebitOffset + absVal);
        }
      }

      // Selisih laba/rugi dipindahkan ke RETAINED_EARNINGS (3102)
      const netProfit = round(totalDebitOffset - totalCreditOffset);
      const retainedEarningsCode = await this.mappingService.get("RETAINED_EARNINGS", "3102");
      if (netProfit > 0) {
        // Laba bersih -> Kredit Ekuitas
        closingLines.push({
          accountCode: retainedEarningsCode,
          debit: 0,
          credit: netProfit,
          memo: `Laba Bersih Ditahan Tutup Tahun ${year}`,
        });
      } else if (netProfit < 0) {
        // Rugi bersih -> Debit Ekuitas
        closingLines.push({
          accountCode: retainedEarningsCode,
          debit: Math.abs(netProfit),
          credit: 0,
          memo: `Rugi Bersih Ditahan Tutup Tahun ${year}`,
        });
      }

      let closingEntry: any = null;
      if (closingLines.length >= 2) {
        closingEntry = await this.postingService.post(
          {
            date: new Date(year, 11, 31),
            source: "CLOSING",
            memo: `Jurnal Penutup Akhir Tahun Buku ${year}`,
            createdById: user.id,
            lines: closingLines,
          },
          tx,
        );
      }

      // Simpan FiscalYear
      const fy = await (tx as any).fiscalYear.upsert({
        where: { year },
        create: {
          year,
          status: "CLOSED",
          closingEntryId: closingEntry?.id || null,
          closedAt: new Date(),
          closedById: user.id,
        },
        update: {
          status: "CLOSED",
          closingEntryId: closingEntry?.id || null,
          closedAt: new Date(),
          closedById: user.id,
        },
      });

      // Buka otomatis Januari tahun berikutnya
      await this.getOrCreatePeriod(new Date(year + 1, 0, 1), tx);

      return fy;
    });
  }

  /**
   * 8.1: Buka Kembali Tahun Buku (Reopen Fiscal Year khusus SUPER_ADMIN)
   */
  async reopenFiscalYear(year: number, reason: string, user: any) {
    if (!reason?.trim()) {
      throw new BadRequestException("Alasan pembukaan kembali tahun buku wajib diisi.");
    }
    const roleLower = (user?.role || "").toLowerCase();
    if (roleLower !== "super_admin") {
      throw new ForbiddenException("Hanya Super Admin yang berhak membuka kembali tahun buku yang sudah ditutup.");
    }

    return this.prisma.main.$transaction(async (tx) => {
      const fy = await (tx as any).fiscalYear.findUnique({ where: { year } });
      if (!fy || fy.status !== "CLOSED") {
        throw new BadRequestException(`Tahun buku ${year} tidak dalam status CLOSED.`);
      }

      // Balik jurnal penutup jika ada
      if (fy.closingEntryId) {
        await this.postingService.reverse(fy.closingEntryId, `Buka kembali tahun buku ${year}: ${reason}`, user.id, undefined, undefined, tx);
      }

      // Update status fiscal year & buka kembali periode Desember
      await (tx as any).accountingPeriod.updateMany({
        where: { year, month: 12 },
        data: { status: "OPEN", reopenReason: reason.trim() },
      });

      return (tx as any).fiscalYear.update({
        where: { year },
        data: {
          status: "OPEN",
          reopenedAt: new Date(),
          reopenedById: user.id,
          reopenReason: reason.trim(),
        },
      });
    });
  }
}
