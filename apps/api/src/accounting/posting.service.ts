import {
  Injectable,
  Inject,
  forwardRef,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { MappingService } from "./mapping.service.js";
import { PeriodService } from "./period.service.js";
import { PostRequest, JournalLineSpec, round, CUTOFF_DATE } from "./accounting.types.js";

@Injectable()
export class PostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mappingService: MappingService,
    @Inject(forwardRef(() => PeriodService))
    private readonly periodService: any,
  ) {}

  private async generateJournalNumber(date: Date, client: any): Promise<string> {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const prefix = `JU/${year}/${month}/`;
    const lastEntry = await (client as any).journalEntry.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    let nextSeq = 1;
    if (lastEntry?.number) {
      const parts = lastEntry.number.split("/");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  }

  /**
   * Post single balanced journal entry
   */
  async post(request: PostRequest, tx?: any): Promise<any> {
    const runInTx = async (client: any) => {
      const entryDate = new Date(request.date);

      // P7: Cut-off date rule: jika sebelum tanggal cut-off, skip posting
      if (entryDate < CUTOFF_DATE) {
        return null;
      }

      // 1. Validasi baris jurnal
      if (!request.lines || request.lines.length < 2) {
        throw new BadRequestException("Jurnal harus memiliki minimal 2 baris (Debit & Kredit).");
      }

      let totalDebit = 0;
      let totalCredit = 0;
      const cleanLines: JournalLineSpec[] = [];

      for (const line of request.lines) {
        const d = round(Number(line.debit || 0));
        const c = round(Number(line.credit || 0));
        if (d < 0 || c < 0) {
          throw new BadRequestException("Nilai debit dan kredit tidak boleh negatif.");
        }
        if (d === 0 && c === 0) continue;
        if (d > 0 && c > 0) {
          throw new BadRequestException("Satu baris jurnal tidak boleh memiliki Debit dan Kredit sekaligus.");
        }
        totalDebit = round(totalDebit + d);
        totalCredit = round(totalCredit + c);
        cleanLines.push({
          ...line,
          debit: d,
          credit: c,
        });
      }

      if (cleanLines.length === 0) {
        throw new BadRequestException("Tidak ada baris transaksi yang valid untuk dijurnal.");
      }

      // Keseimbangan jurnal: toleransi selisih pembulatan rupiah ≤ 2
      const diff = round(totalDebit - totalCredit);
      if (Math.abs(diff) > 2) {
        throw new BadRequestException(
          `Jurnal tidak seimbang! Total Debit: ${totalDebit}, Total Kredit: ${totalCredit}, Selisih: ${diff}`,
        );
      } else if (diff !== 0) {
        const roundingAccount = await this.mappingService.get("ROUNDING", "7200.02");
        if (diff > 0) {
          cleanLines.push({
            accountCode: roundingAccount,
            debit: 0,
            credit: diff,
            memo: "Selisih pembulatan otomatis",
          });
          totalCredit = round(totalCredit + diff);
        } else {
          cleanLines.push({
            accountCode: roundingAccount,
            debit: Math.abs(diff),
            credit: 0,
            memo: "Selisih pembulatan otomatis",
          });
          totalDebit = round(totalDebit + Math.abs(diff));
        }
      }

      // 2. Validasi Akun
      const accountCodes = Array.from(new Set(cleanLines.map((l) => l.accountCode)));
      const accounts = await (client as any).coaAccount.findMany({
        where: { code: { in: accountCodes } },
      });
      const accountMap = new Map<string, any>(accounts.map((a: any) => [a.code, a]));

      for (const code of accountCodes) {
        const acc = accountMap.get(code);
        if (!acc) {
          throw new BadRequestException(`Akun ${code} tidak ditemukan di Bagan Akun.`);
        }
        if (acc.status !== "AKTIF") {
          throw new BadRequestException(`Akun ${code} (${acc.name}) berstatus TIDAK AKTIF.`);
        }
        if (acc.isPostable === false) {
          throw new BadRequestException(`Akun ${code} (${acc.name}) adalah akun Header dan tidak dapat dijurnal langsung.`);
        }
      }

      // 3. Validasi Periode Akuntansi
      // Pengecualian sistem: source CLOSING dan TAX_ACCRUAL dibolehkan pada periode tutup tahun
      const isSystemClosing = ["CLOSING", "TAX_ACCRUAL"].includes(request.source);
      let period: any;
      if (isSystemClosing) {
        period = await this.periodService.getOrCreatePeriod(entryDate, client);
      } else {
        period = await this.periodService.assertPeriodOpen(entryDate, undefined, client);
      }

      // 4. Idempotensi
      if (request.sourceType && request.sourceId && request.event) {
        const existing = await (client as any).journalEntry.findFirst({
          where: {
            sourceType: request.sourceType,
            sourceId: request.sourceId,
            event: request.event,
            status: "POSTED",
          },
          include: { lines: true },
          orderBy: { version: "desc" },
        });

        if (existing) {
          const exDebit = existing.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
          const exCredit = existing.lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
          if (round(exDebit) === totalDebit && round(exCredit) === totalCredit) {
            return existing;
          }
        }
      }

      // 5. Simpan Journal Entry & Lines
      const number = await this.generateJournalNumber(entryDate, client);
      const entry = await (client as any).journalEntry.create({
        data: {
          number,
          date: entryDate,
          source: request.source,
          sourceType: request.sourceType,
          sourceId: request.sourceId,
          event: request.event,
          memo: request.memo,
          refNo: request.refNo,
          projectId: request.projectId,
          periodId: period.id,
          createdById: request.createdById,
          status: "POSTED",
          lines: {
            create: cleanLines.map((line, idx) => ({
              lineNo: idx + 1,
              accountCode: line.accountCode,
              debit: line.debit,
              credit: line.credit,
              memo: line.memo || request.memo,
              projectId: line.projectId || request.projectId,
              partyType: line.partyType,
              partyId: line.partyId,
            })),
          },
        },
        include: { lines: true },
      });

      return entry;
    };

    if (tx) {
      return runInTx(tx);
    } else {
      return this.prisma.main.$transaction(async (client) => runInTx(client));
    }
  }

  /**
   * Reverse journal entry
   */
  async reverse(
    sourceTypeOrId: string | number,
    sourceIdOrReason?: number | string,
    eventOrUserId?: string | number,
    reason?: string,
    userId?: number,
    tx?: any,
  ): Promise<any> {
    const runInTx = async (client: any) => {
      let existing: any = null;
      let effectiveReason = "Pembalikan jurnal otomatis";
      let effectiveUserId: number | undefined = userId;

      if (typeof sourceTypeOrId === "number") {
        existing = await (client as any).journalEntry.findUnique({
          where: { id: sourceTypeOrId },
          include: { lines: true, period: true },
        });
        if (typeof sourceIdOrReason === "string") effectiveReason = sourceIdOrReason;
        if (typeof eventOrUserId === "number") effectiveUserId = eventOrUserId;
      } else {
        existing = await (client as any).journalEntry.findFirst({
          where: {
            sourceType: sourceTypeOrId,
            sourceId: Number(sourceIdOrReason),
            event: typeof eventOrUserId === "string" ? eventOrUserId : undefined,
            status: "POSTED",
          },
          include: { lines: true, period: true },
          orderBy: { version: "desc" },
        });
        if (reason) effectiveReason = reason;
      }

      if (!existing) {
        return null; // Tidak ada jurnal aktif untuk dibalik
      }

      if (existing.status === "REVERSED") {
        return null;
      }

      // P6 & 4.1.7: Jika periode jurnal asli berstatus CLOSED, edit/batal DITOLAK keras
      if (existing.period?.status === "CLOSED") {
        throw new ConflictException(
          "Dokumen tidak dapat diubah/dibatalkan karena periode pembukuan sudah ditutup (CLOSED).",
        );
      }

      // Pastikan periode reversal OPEN
      const reversalDate = new Date();
      await this.periodService.assertPeriodOpen(reversalDate, undefined, client);

      const reverseLines: JournalLineSpec[] = existing.lines.map((l: any) => ({
        accountCode: l.accountCode,
        debit: Number(l.credit),
        credit: Number(l.debit),
        memo: `[REVERSAL] ${l.memo || existing.memo}`,
        projectId: l.projectId,
        partyType: l.partyType,
        partyId: l.partyId,
      }));

      const reversalNumber = await this.generateJournalNumber(reversalDate, client);
      const reversalEntry = await (client as any).journalEntry.create({
        data: {
          number: reversalNumber,
          date: reversalDate,
          source: existing.source,
          sourceType: existing.sourceType,
          sourceId: existing.sourceId,
          event: `${existing.event || "post"}:rev`,
          version: existing.version,
          memo: `Pembalikan Jurnal ${existing.number}: ${effectiveReason}`,
          refNo: existing.number,
          projectId: existing.projectId,
          periodId: existing.periodId,
          createdById: effectiveUserId,
          reversalOfId: existing.id,
          status: "POSTED",
          lines: {
            create: reverseLines.map((line, idx) => ({
              lineNo: idx + 1,
              accountCode: line.accountCode,
              debit: line.debit,
              credit: line.credit,
              memo: line.memo,
              projectId: line.projectId,
              partyType: line.partyType,
              partyId: line.partyId,
            })),
          },
        },
      });

      await (client as any).journalEntry.update({
        where: { id: existing.id },
        data: {
          status: "REVERSED",
        },
      });

      return reversalEntry;
    };

    const actualTx = typeof sourceTypeOrId === "number"
      ? (typeof reason === "object" ? reason : tx)
      : tx;

    if (actualTx) {
      return runInTx(actualTx);
    } else {
      return this.prisma.main.$transaction(async (client) => runInTx(client));
    }
  }

  /**
   * Repost (Reverse versi lama jika ada, lalu post versi baru dengan version naik)
   */
  async repost(request: PostRequest, tx?: any): Promise<any> {
    const runInTx = async (client: any) => {
      if (request.sourceType && request.sourceId) {
        const existing = await (client as any).journalEntry.findFirst({
          where: {
            sourceType: request.sourceType,
            sourceId: request.sourceId,
            event: request.event,
            status: "POSTED",
          },
          include: { period: true },
          orderBy: { version: "desc" },
        });

        if (existing) {
          if (existing.period?.status === "CLOSED") {
            throw new ConflictException(
              "Dokumen tidak dapat diubah karena periode pembukuan sudah ditutup (CLOSED).",
            );
          }
          await this.reverse(existing.id, "Koreksi data dokumen (Repost)", request.createdById || undefined, undefined, undefined, client);
        }
      }
      return this.post(request, client);
    };

    if (tx) {
      return runInTx(tx);
    } else {
      return this.prisma.main.$transaction(async (client) => runInTx(client));
    }
  }

  /**
   * E13: Posting Retur Penjualan (Customer Return)
   */
  async postSalesReturn(dto: {
    number: string;
    date?: string | Date;
    dpp: number;
    ppn?: number;
    total?: number;
    costTotal?: number;
    isCashRefund?: boolean;
    paidAccountCode?: string;
    customerId?: number;
    projectId?: number | null;
    isProject?: boolean;
    memo?: string;
    items?: Array<{ productId: number; warehouseId: number; quantity: number; unitCost?: number }>;
  }, userId?: number) {
    const entryDate = dto.date ? new Date(dto.date) : new Date();
    await this.periodService.assertPeriodOpen(entryDate);

    const dpp = round(Number(dto.dpp));
    const ppn = round(Number(dto.ppn || 0));
    const total = round(Number(dto.total || dpp + ppn));
    const costTotal = round(Number(dto.costTotal || 0));

    if (dpp <= 0) {
      throw new BadRequestException("DPP nilai retur penjualan harus lebih besar dari 0.");
    }
    if (dto.isCashRefund && !dto.paidAccountCode) {
      throw new BadRequestException("Akun Kas/Bank wajib dipilih jika retur penjualan dikembalikan secara tunai/transfer.");
    }

    const { PostingRules } = await import("./posting.rules.js");
    const map = await this.mappingService.getAll();

    const { financialLines, inventoryLines } = PostingRules.buildSalesReturnLines(
      {
        number: dto.number,
        dpp,
        ppn,
        total,
        costTotal,
        isCashRefund: dto.isCashRefund,
        paidAccountCode: dto.paidAccountCode,
        customerId: dto.customerId,
        projectId: dto.projectId,
        isProject: dto.isProject,
      },
      map,
    );

    const allLines = [...financialLines];
    if (costTotal > 0) {
      allLines.push(...inventoryLines);
    }

    return this.prisma.main.$transaction(async (tx) => {
      // 1. Post jurnal pembalik pendapatan dan pemulihan persediaan
      const entry = await this.post(
        {
          date: entryDate,
          source: "SALES_RETURN",
          sourceType: "SALES_RETURN",
          memo: dto.memo || `Retur Penjualan #${dto.number}`,
          refNo: dto.number,
          projectId: dto.projectId,
          createdById: userId,
          lines: allLines,
        },
        tx,
      );

      // 2. Pemulihan stok fisik jika item disertakan
      if (Array.isArray(dto.items) && dto.items.length > 0) {
        for (const it of dto.items) {
          const qty = Number(it.quantity || 0);
          if (qty > 0 && it.productId && it.warehouseId) {
            await (tx as any).stockBalance.upsert({
              where: {
                productId_warehouseId: {
                  productId: it.productId,
                  warehouseId: it.warehouseId,
                },
              },
              create: {
                productId: it.productId,
                warehouseId: it.warehouseId,
                quantity: qty,
              },
              update: {
                quantity: { increment: qty },
              },
            });

            await (tx as any).stockMovement.create({
              data: {
                productId: it.productId,
                warehouseId: it.warehouseId,
                type: "IN",
                quantity: qty,
                refType: "SALES_RETURN",
                refId: entry.id,
                notes: `Pemulihan Stok Retur Penjualan #${dto.number}`,
                createdById: userId,
              },
            });
          }
        }
      }

      return entry;
    });
  }

  /**
   * E14: Posting Retur Pembelian (Vendor Return)
   */
  async postPurchaseReturn(dto: {
    number: string;
    date?: string | Date;
    dpp: number;
    ppn?: number;
    total?: number;
    isCashRefund?: boolean;
    paidAccountCode?: string;
    supplierId?: number;
    projectId?: number | null;
    memo?: string;
    items?: Array<{ productId: number; warehouseId: number; quantity: number }>;
  }, userId?: number) {
    const entryDate = dto.date ? new Date(dto.date) : new Date();
    await this.periodService.assertPeriodOpen(entryDate);

    const dpp = round(Number(dto.dpp));
    const ppn = round(Number(dto.ppn || 0));
    const total = round(Number(dto.total || dpp + ppn));

    if (dpp <= 0) {
      throw new BadRequestException("DPP nilai retur pembelian harus lebih besar dari 0.");
    }
    if (dto.isCashRefund && !dto.paidAccountCode) {
      throw new BadRequestException("Akun Kas/Bank wajib dipilih jika pengembalian retur pembelian diterima secara tunai/transfer.");
    }

    const { PostingRules } = await import("./posting.rules.js");
    const map = await this.mappingService.getAll();

    const lines = PostingRules.buildPurchaseReturnLines(
      {
        number: dto.number,
        dpp,
        ppn,
        total,
        isCashRefund: dto.isCashRefund,
        paidAccountCode: dto.paidAccountCode,
        supplierId: dto.supplierId,
        projectId: dto.projectId,
      },
      map,
    );

    return this.prisma.main.$transaction(async (tx) => {
      // 1. Post jurnal pembalik hutang/kas dan persediaan
      const entry = await this.post(
        {
          date: entryDate,
          source: "PURCHASE_RETURN",
          sourceType: "PURCHASE_RETURN",
          memo: dto.memo || `Retur Pembelian #${dto.number}`,
          refNo: dto.number,
          projectId: dto.projectId,
          createdById: userId,
          lines,
        },
        tx,
      );

      // 2. Pengurangan stok fisik jika item disertakan
      if (Array.isArray(dto.items) && dto.items.length > 0) {
        for (const it of dto.items) {
          const qty = Number(it.quantity || 0);
          if (qty > 0 && it.productId && it.warehouseId) {
            await (tx as any).stockBalance.updateMany({
              where: {
                productId: it.productId,
                warehouseId: it.warehouseId,
              },
              data: {
                quantity: { decrement: qty },
              },
            });

            await (tx as any).stockMovement.create({
              data: {
                productId: it.productId,
                warehouseId: it.warehouseId,
                type: "OUT",
                quantity: qty,
                refType: "PURCHASE_RETURN",
                refId: entry.id,
                notes: `Pengurangan Stok Retur Pembelian #${dto.number}`,
                createdById: userId,
              },
            });
          }
        }
      }

      return entry;
    });
  }
}
