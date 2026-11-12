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

  /**
   * Sync unposted invoices and delivery notes that have been issued/shipped but lack journal entries
   */
  async syncUnpostedDocuments(userId?: number): Promise<{
    syncedInvoices: number;
    syncedDeliveries: number;
    syncedReceivings: number;
    syncedInvoiceIns: number;
    syncedPurchaseRequests: number;
  }> {
    const { PostingRules } = await import("./posting.rules.js");
    let syncedInvoices = 0;
    let syncedDeliveries = 0;

    // 1. Sync Invoices (SENT, PAID, PARTIAL, OVERDUE / yang ada pembayaran) yang belum memiliki JournalEntry
    const eligibleInvoices = await (this.prisma.main as any).invoiceOut.findMany({
      where: {
        OR: [
          { status: { in: ["SENT", "PAID", "PARTIAL", "LUNAS", "OVERDUE"] } },
          { paidAmount: { gt: 0 } },
          { payments: { some: {} } },
        ],
        NOT: { status: "BATAL" },
      },
      include: { customer: true, payments: true },
    });

    for (const inv of eligibleInvoices) {
      const effectiveDate = inv.date
        ? new Date(inv.date)
        : (inv.payments?.[0]?.date ? new Date(inv.payments[0].date) : (inv.createdAt ? new Date(inv.createdAt) : new Date()));
      const validDate = isNaN(effectiveDate.getTime()) || effectiveDate < CUTOFF_DATE ? new Date() : effectiveDate;

      const existing = await (this.prisma.main as any).journalEntry.findFirst({
        where: {
          sourceType: "InvoiceOut",
          sourceId: inv.id,
          event: "issued",
          status: "POSTED",
        },
      });
      if (!existing) {
        try {
          const mappings = await this.mappingService.getAll();
          let rawItems: any[] = [];
          if (Array.isArray(inv.items)) {
            rawItems = inv.items;
          } else {
            // Check meta if any
            const metaFile = await (this.prisma.main as any).invoiceOut.findUnique({
              where: { id: inv.id },
              select: { description: true },
            });
          }

          const targetDpp = Number(inv.amount || (Number(inv.total) - Number(inv.ppn || 0)));
          const lines = (inv.type === "DP")
            ? PostingRules.buildCustomerDpLines(
                {
                  number: inv.number,
                  customerId: inv.customerId || 0,
                  projectId: inv.projectId,
                  dpp: targetDpp,
                  ppn: Number(inv.ppn || 0),
                  total: Number(inv.total),
                },
                mappings,
              )
            : PostingRules.buildInvoiceOutLines(
                {
                  id: inv.id,
                  number: inv.number,
                  type: inv.type,
                  customerId: inv.customerId || 0,
                  projectId: inv.projectId,
                  dpp: targetDpp,
                  ppn: Number(inv.ppn || 0),
                  total: Number(inv.total),
                  dpApplied: Number(inv.dpApplied || 0),
                  retentionPercent: Number(inv.retentionPercent || 0),
                  retentionAmount: Number(inv.retentionAmount || 0),
                  items: rawItems.map((it: any) => ({
                    type: /jasa|instalasi|service|pasang/i.test(it.name || it.item || it.productName || "") ? "SERVICE" : "PRODUCT",
                    amount: Number(it.subtotal || it.amount || (Number(it.harga || it.price || 0) * Number(it.qty || 1)) || 0),
                  })),
                },
                mappings,
              );

          await this.post({
            sourceType: "InvoiceOut",
            sourceId: inv.id,
            event: "issued",
            source: "INVOICE_OUT",
            date: validDate,
            memo: `Penerbitan Invoice Penjualan ${inv.number}`,
            refNo: inv.number,
            projectId: inv.projectId,
            createdById: userId,
            lines,
          });
          syncedInvoices++;
        } catch (err) {
          console.error(`Gagal sync jurnal invoice #${inv.id}:`, err);
        }
      }

      // Sync pembayaran faktur yang belum tercatat jurnalnya
      if (Array.isArray(inv.payments)) {
        for (const p of inv.payments) {
          const existingPayJournal = await (this.prisma.main as any).journalEntry.findFirst({
            where: {
              sourceType: "Payment",
              sourceId: p.id,
              status: "POSTED",
            },
          });
          if (!existingPayJournal && Number(p.amount) > 0) {
            try {
              const mappings = await this.mappingService.getAll();
              const pLines = PostingRules.buildCustomerPaymentLines(
                {
                  id: p.id,
                  sourceType: "INVOICE_OUT",
                  sourceId: inv.id,
                  amount: Number(p.amount),
                  accountCode: p.accountCode || mappings.CASH_DEFAULT || "1000.02",
                  pph23Amount: 0,
                  partyType: "CUSTOMER",
                  partyId: inv.customerId || 0,
                  projectId: inv.projectId,
                },
                mappings,
              );
              const pDate = p.date ? new Date(p.date) : validDate;
              await this.post({
                sourceType: "Payment",
                sourceId: p.id,
                event: "received",
                source: "INVOICE_OUT_PAYMENT",
                date: isNaN(pDate.getTime()) || pDate < CUTOFF_DATE ? new Date() : pDate,
                memo: `Penerimaan Pembayaran Inv ${inv.number}`,
                refNo: `${inv.number}/PAY`,
                projectId: inv.projectId,
                createdById: userId,
                lines: pLines,
              });
            } catch (pErr) {
              console.error(`Gagal sync jurnal payment #${p.id}:`, pErr);
            }
          }
        }
      }
    }

    // 2. Sync Delivery Notes (DIKIRIM, DITERIMA) yang belum memiliki JournalEntry
    const eligibleDeliveries = await (this.prisma.main as any).deliveryNote.findMany({
      where: {
        status: { in: ["DIKIRIM", "DITERIMA"] },
        date: { gte: CUTOFF_DATE },
      },
      include: {
        locations: true,
        items: { include: { product: true } },
        movements: { include: { product: true } },
      },
    });

    for (const dn of eligibleDeliveries) {
      try {
        // 1. Ekstrak kaitan dokumen SO / ClientPO / Invoice
        const fullText = [
          dn.reportText || "",
          ...(dn.locations || []).map((l: any) => `${l.destination || ""} ${l.reason || ""}`),
        ].join(" ");

        const soIdMatch = fullText.match(/\[so:(\d+)\]/i);
        const invIdMatch = fullText.match(/\[inv:(\d+)\]/i);
        const invNumMatch = fullText.match(/\[invNum:([^\]]+)\]/i);
        const soNumMatch = fullText.match(/\b(SO[\-\/][^\s\)\]]+)\b/i);

        let clientPo: any = null;
        if (soIdMatch?.[1]) {
          clientPo = await (this.prisma.main as any).clientPO.findUnique({
            where: { id: parseInt(soIdMatch[1], 10) },
            include: { invoices: true },
          }).catch(() => null);
        } else if (soNumMatch?.[1]) {
          clientPo = await (this.prisma.main as any).clientPO.findFirst({
            where: { OR: [{ number: soNumMatch[1] }, { soNumber: soNumMatch[1] }] },
            include: { invoices: true },
          }).catch(() => null);
        }

        let invoice: any = null;
        if (invIdMatch?.[1]) {
          invoice = await (this.prisma.main as any).invoiceOut.findUnique({
            where: { id: parseInt(invIdMatch[1], 10) },
          }).catch(() => null);
        } else if (invNumMatch?.[1]) {
          invoice = await (this.prisma.main as any).invoiceOut.findFirst({
            where: { number: invNumMatch[1] },
          }).catch(() => null);
        } else if (clientPo?.invoices?.length) {
          invoice = clientPo.invoices[0];
        }

        const firstLocation = dn.locations[0];
        if (!clientPo && firstLocation?.destination && firstLocation.destination !== "-") {
          clientPo = await (this.prisma.main as any).clientPO.findFirst({
            where: {
              OR: [
                { customer: { name: { contains: firstLocation.destination.trim() } } },
                { notes: { contains: firstLocation.destination.trim() } },
              ],
            },
            orderBy: { id: "desc" },
            include: { invoices: true },
          }).catch(() => null);
          if (!invoice && clientPo?.invoices?.length) {
            invoice = clientPo.invoices[0];
          }
        }

        // 2. Tentukan item yang dikirim & agregasi kuantitas sebenarnya
        const poItems = Array.isArray(clientPo?.items) ? (clientPo.items as any[]) : [];
        const invItems = Array.isArray(invoice?.items) ? (invoice.items as any[]) : [];

        type DnCostGroup = {
          productId?: number;
          product?: any;
          name: string;
          qty: number;
          unitCost?: number;
        };

        const groupMap = new Map<string, DnCostGroup>();

        for (const it of (dn.items || [])) {
          const pId = it.productId ? Number(it.productId) : undefined;
          const key = pId ? `pid:${pId}` : `note:${(it.note || "").trim().toLowerCase()}`;
          const existing = groupMap.get(key);
          const q = Number(it.qty) || 1;
          if (existing) {
            existing.qty += q;
          } else {
            groupMap.set(key, {
              productId: pId,
              product: it.product,
              name: it.note || it.product?.name || "Barang",
              qty: q,
            });
          }
        }

        for (const m of (dn.movements || [])) {
          if (m.type !== "OUT") continue;
          const pId = m.productId ? Number(m.productId) : undefined;
          const key = pId ? `pid:${pId}` : `note:${(m.reason || "").trim().toLowerCase()}`;
          const existing = groupMap.get(key);
          const q = Number(m.qty) || 1;
          if (existing) {
            if (pId) {
              const totalMoveQty = (dn.movements || [])
                .filter((x: any) => x.type === "OUT" && Number(x.productId) === pId)
                .reduce((s: number, x: any) => s + (Number(x.qty) || 1), 0);
              existing.qty = Math.max(existing.qty, totalMoveQty);
            }
          } else {
            groupMap.set(key, {
              productId: pId,
              product: m.product,
              name: m.reason || m.product?.name || "Barang",
              qty: q,
              unitCost: Number(m.unitCost) > 0 ? Number(m.unitCost) : undefined,
            });
          }
        }

        if (groupMap.size === 0) {
          const sourceGoods = (poItems.length > 0 ? poItems : invItems).filter(
            (p: any) => !/jasa|instalasi|service|pasang/i.test(p.item || p.name || p.productName || "")
          );
          for (const it of sourceGoods) {
            const pId = it.productId ? Number(it.productId) : undefined;
            const key = pId ? `pid:${pId}` : `note:${(it.item || it.name || it.productName || "").trim().toLowerCase()}`;
            const q = Number(it.qty) || 1;
            groupMap.set(key, {
              productId: pId,
              name: it.item || it.name || it.productName || "Barang",
              qty: q,
            });
          }
        } else {
          for (const itemGroup of groupMap.values()) {
            const matchedPo = poItems.find(
              (p: any) =>
                (itemGroup.productId && Number(p.productId) === itemGroup.productId) ||
                (itemGroup.name && [p.item, p.name, p.productName].some((n: string) => n && itemGroup.name.toLowerCase().includes(n.toLowerCase())))
            );
            if (matchedPo && Number(matchedPo.qty) > itemGroup.qty) {
              itemGroup.qty = Number(matchedPo.qty);
            }
            const matchedInv = invItems.find(
              (p: any) =>
                (itemGroup.productId && Number(p.productId) === itemGroup.productId) ||
                (itemGroup.name && [p.item, p.name, p.productName].some((n: string) => n && itemGroup.name.toLowerCase().includes(n.toLowerCase())))
            );
            if (matchedInv && Number(matchedInv.qty) > itemGroup.qty) {
              itemGroup.qty = Math.max(itemGroup.qty, Number(matchedInv.qty));
            }
          }
        }

        let costTotal = 0;

        for (const item of groupMap.values()) {
          const qty = Math.max(1, item.qty);
          let unitCost = 0;

          let freshProd = item.product;
          if (item.productId) {
            freshProd = await (this.prisma.main as any).product.findUnique({
              where: { id: item.productId },
            }).catch(() => null);
          }

          const matchedPo = poItems.find(
            (p: any) =>
              (item.productId && Number(p.productId) === item.productId) ||
              (item.name && [p.item, p.name, p.productName].some((n: string) => n && item.name.toLowerCase().includes(n.toLowerCase())))
          );

          // Prioritas 1: Harga modal / beli di item SO (jika ada)
          if (matchedPo) {
            const poCost = Number(matchedPo.cost ?? matchedPo.hargaBeli ?? matchedPo.purchasePrice ?? 0);
            if (poCost > 0) unitCost = poCost;
          }

          // Prioritas 2: Harga Beli Master Data (Purchase Price)
          if (unitCost <= 0 && freshProd?.purchasePrice && Number(freshProd.purchasePrice) > 0) {
            unitCost = Number(freshProd.purchasePrice);
          }

          // Prioritas 3: Moving Average Cost (avgCost)
          if (unitCost <= 0 && freshProd?.avgCost && Number(freshProd.avgCost) > 0) {
            unitCost = Number(freshProd.avgCost);
          }

          // Prioritas 4: Unit cost di stock movement
          if (unitCost <= 0 && item.unitCost && item.unitCost > 0) {
            unitCost = item.unitCost;
          }

          // Prioritas 5: Riwayat Supplier PO
          if (unitCost <= 0 && item.productId) {
            const lastPo = await (this.prisma.main as any).supplierPOItem.findFirst({
              where: { productId: item.productId, price: { gt: 0 } },
              orderBy: { id: "desc" },
            }).catch(() => null);
            if (lastPo?.price && Number(lastPo.price) > 0) {
              unitCost = Number(lastPo.price);
            }
          }

          // Prioritas 6: Riwayat stok masuk (IN)
          if (unitCost <= 0 && item.productId) {
            const inMove = await (this.prisma.main as any).stockMovement.findFirst({
              where: { productId: item.productId, type: "IN", unitCost: { gt: 0 } },
              orderBy: { date: "desc" },
            }).catch(() => null);
            if (inMove?.unitCost && Number(inMove.unitCost) > 0) {
              unitCost = Number(inMove.unitCost);
            }
          }

          // Prioritas 7: 70% harga jual SO
          if (unitCost <= 0 && matchedPo) {
            const sellPrice = Number(
              matchedPo.price ??
              matchedPo.harga ??
              (matchedPo.subtotal && matchedPo.qty ? matchedPo.subtotal / matchedPo.qty : 0),
            );
            if (sellPrice > 0) {
              unitCost = Math.round(sellPrice * 0.7);
            }
          }

          // Prioritas 8: Fallback invoice
          if (unitCost <= 0 && invoice?.amount) {
            const totalInv = Number(invoice.amount);
            if (totalInv > 0) {
              const count = groupMap.size || 1;
              unitCost = Math.round(((totalInv / count) * 0.7) / qty);
            }
          }

          // Prioritas 9: Batas minimum
          if (unitCost <= 0) {
            unitCost = 100_000;
          }

          if (item.productId && (!freshProd?.avgCost || Number(freshProd.avgCost) <= 0)) {
            await (this.prisma.main as any).product.update({
              where: { id: item.productId },
              data: { avgCost: unitCost },
            }).catch(() => {});
          }

          costTotal += qty * unitCost;
        }

        if (costTotal <= 0) {
          if (clientPo?.amount) {
            costTotal = Math.round(Number(clientPo.amount) * 0.7);
          } else if (invoice?.amount) {
            costTotal = Math.round(Number(invoice.amount) * 0.7);
          } else {
            costTotal = 100_000;
          }
        }

        const existing = await (this.prisma.main as any).journalEntry.findFirst({
          where: {
            sourceType: "DeliveryNote",
            sourceId: dn.id,
            event: "shipped",
            status: "POSTED",
          },
          include: { lines: true },
          orderBy: { version: "desc" },
        });

        if (existing) {
          const exDebit = existing.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
          if (Math.round(exDebit) === Math.round(costTotal)) {
            continue; // Sudah sesuai
          }
          await this.reverse(existing.id, "Penyesuaian nilai HPP Surat Jalan", userId);
        }

        const mappings = await this.mappingService.getAll();
        const dLines = PostingRules.buildDeliveryLines(
          {
            number: dn.number,
            costTotal: Math.round(costTotal),
            isProject: !!firstLocation?.projectId,
            projectId: firstLocation?.projectId,
            customerId: clientPo?.customerId ?? invoice?.customerId,
          },
          mappings,
        );
        await this.post({
          sourceType: "DeliveryNote",
          sourceId: dn.id,
          event: "shipped",
          source: "DELIVERY",
          date: dn.date,
          memo: `HPP Pengiriman Barang SJ ${dn.number}`,
          refNo: dn.number,
          projectId: firstLocation?.projectId,
          createdById: userId,
          lines: dLines,
        });
        syncedDeliveries++;
      } catch (err) {
        console.error(`Gagal sync jurnal delivery note #${dn.id}:`, err);
      }
    }

    // 3. Sync Receivings (DITERIMA, DITERIMA_SEBAGIAN) yang belum memiliki JournalEntry
    let syncedReceivings = 0;
    const eligibleReceivings = await (this.prisma.main as any).receiving.findMany({
      where: {
        status: { in: ["DITERIMA", "DITERIMA_SEBAGIAN"] },
        date: { gte: CUTOFF_DATE },
      },
      include: {
        items: { include: { product: true } },
        supplierPo: { include: { items: true } },
      },
    });

    for (const rec of eligibleReceivings) {
      const existing = await (this.prisma.main as any).journalEntry.findFirst({
        where: {
          sourceType: "Receiving",
          sourceId: rec.id,
          event: "received",
          status: "POSTED",
        },
      });
      if (!existing) {
        try {
          let totalVal = 0;
          for (const item of (rec.items || [])) {
            const poItem = rec.supplierPo?.items?.find((p: any) => p.productId === item.productId);
            let pPrice = Number(poItem?.price ?? item.product?.purchasePrice ?? item.product?.avgCost ?? 0);
            if (pPrice <= 0 && item.productId) {
              const lastPo = await (this.prisma.main as any).supplierPOItem.findFirst({
                where: { productId: item.productId, price: { gt: 0 } },
                orderBy: { id: "desc" },
              }).catch(() => null);
              if (lastPo?.price && Number(lastPo.price) > 0) {
                pPrice = Number(lastPo.price);
              }
            }
            if (pPrice <= 0 && rec.supplierPo?.total) {
              const totalPo = Number(rec.supplierPo.total);
              const totalQty = (rec.items || []).reduce((s: number, it: any) => s + (Number(it.qtyReceived) || 1), 0) || 1;
              pPrice = Math.round(totalPo / totalQty);
            }
            if (pPrice <= 0) {
              pPrice = 100_000;
            }
            if (item.productId) {
              const updateData: any = {};
              if (!item.product?.avgCost || Number(item.product.avgCost) <= 0) {
                updateData.avgCost = pPrice;
              }
              if (!item.product?.purchasePrice || Number(item.product.purchasePrice) <= 0) {
                updateData.purchasePrice = pPrice;
              }
              if (Object.keys(updateData).length > 0) {
                await (this.prisma.main as any).product.update({
                  where: { id: item.productId },
                  data: updateData,
                }).catch(() => {});
              }
            }
            totalVal += Number(item.qtyReceived || 0) * pPrice;
          }

          if (totalVal > 0) {
            const mappings = await this.mappingService.getAll();
            const rLines = PostingRules.buildReceivingLines(
              {
                number: rec.number,
                supplierId: rec.supplierPo?.supplierId || 0,
                totalValue: Math.round(totalVal),
                projectId: rec.projectId,
              },
              mappings,
            );
            await this.post({
              sourceType: "Receiving",
              sourceId: rec.id,
              event: "received",
              source: "RECEIVING",
              date: rec.date,
              memo: `Penerimaan Barang BPB ${rec.number}`,
              refNo: rec.number,
              projectId: rec.projectId,
              createdById: rec.receiverId,
              lines: rLines,
            });
            syncedReceivings++;
          }
        } catch (err) {
          console.error(`Gagal sync jurnal receiving #${rec.id}:`, err);
        }
      }
    }

    // 4. Sync Invoice In (UNPAID, PAID) yang belum memiliki JournalEntry
    let syncedInvoiceIns = 0;
    const eligibleInvoiceIns = await (this.prisma.main as any).invoiceIn.findMany({
      where: {
        status: { in: ["UNPAID", "PAID"] },
        date: { gte: CUTOFF_DATE },
      },
      include: { supplier: true },
    });

    for (const invIn of eligibleInvoiceIns) {
      const existing = await (this.prisma.main as any).journalEntry.findFirst({
        where: {
          sourceType: "InvoiceIn",
          sourceId: invIn.id,
          event: "issued",
          status: "POSTED",
        },
      });
      if (!existing) {
        try {
          const mappings = await this.mappingService.getAll();
          const inLines = PostingRules.buildInvoiceInLines(
            {
              number: invIn.number || `INV-IN-${invIn.id}`,
              supplierId: invIn.supplierId,
              dpp: Number(invIn.amount),
              ppn: Number(invIn.ppn || 0),
              total: Number(invIn.total),
              isExpense: !invIn.supplierPoId,
              expenseAccountCode: invIn.debitAccount || invIn.coaAccount || undefined,
            },
            mappings,
          );
          await this.post({
            sourceType: "InvoiceIn",
            sourceId: invIn.id,
            event: "issued",
            source: "INVOICE_IN",
            date: invIn.date || new Date(),
            memo: `Tagihan Supplier #${invIn.number || invIn.id} (${invIn.supplier?.name || "Supplier"})`,
            refNo: invIn.number || `INV-IN-${String(invIn.id).padStart(3, "0")}`,
            createdById: userId,
            lines: inLines,
          });
          syncedInvoiceIns++;
        } catch (err) {
          console.error(`Gagal sync jurnal invoice in #${invIn.id}:`, err);
        }
      }
    }

    // 5. Sync Purchase Requests (DIBAYAR, LUNAS, DITERIMA) yang paymentStatus === "DIBAYAR" / ada bukti bayar tapi belum memiliki JournalEntry
    let syncedPurchaseRequests = 0;
    const eligiblePrs = await (this.prisma.main as any).purchaseRequest.findMany({
      where: {
        OR: [
          { paymentStatus: "DIBAYAR" },
          { status: "DIBAYAR" },
          { paymentProofFileId: { not: null } },
        ],
        procurementSource: { in: ["RETAIL", "SUPPLIER"] },
        date: { gte: CUTOFF_DATE },
      },
      include: {
        items: true,
      },
    });

    for (const pr of eligiblePrs) {
      const existing = await (this.prisma.main as any).journalEntry.findFirst({
        where: {
          sourceType: "PurchaseRequest",
          sourceId: pr.id,
          event: "paid",
          status: "POSTED",
        },
      });

      if (!existing) {
        try {
          const mappings = await this.mappingService.getAll();
          const payAccount = pr.paymentAccountCode || mappings.CASH_DEFAULT || "1000.02";
          const costTotal = Number(pr.estimatedCost || 0) ||
            (pr.items || []).reduce((acc: number, it: any) => acc + (Number(it.unitCost || 0) * Number(it.qty || 1)), 0);

          if (costTotal > 0) {
            const isProjectConsumable =
              Boolean(pr.projectId) &&
              (String(pr.otherNote || "").includes("[ALL_CONSUMABLES]") ||
                (pr.items.length > 0 &&
                  pr.items.every((it: any) => String(it.customName || "").includes("[PAKAI_HABIS]"))));

            const lines = (pr.projectId && isProjectConsumable)
              ? [
                  { accountCode: mappings.COGS_PROJECT || "5101", debit: costTotal, credit: 0, memo: `HPP Material Proyek #${pr.number}`, projectId: pr.projectId },
                  { accountCode: payAccount, debit: 0, credit: costTotal, memo: `Kas Keluar #${pr.number}`, projectId: pr.projectId },
                ]
              : [
                  { accountCode: mappings.GRNI || "2108", debit: costTotal, credit: 0, memo: `Kliring GRNI Pembelian #${pr.number}`, projectId: pr.projectId },
                  { accountCode: payAccount, debit: 0, credit: costTotal, memo: `Kas Keluar Pembelian #${pr.number}`, projectId: pr.projectId },
                ];

            await this.post({
              sourceType: "PurchaseRequest",
              sourceId: pr.id,
              event: "paid",
              source: "RETAIL_PURCHASE",
              date: pr.date || new Date(),
              memo: `Pembayaran Request Barang #${pr.number}`,
              refNo: pr.number,
              projectId: pr.projectId,
              createdById: pr.requesterId,
              lines,
            });
            syncedPurchaseRequests++;
          }
        } catch (err) {
          console.error(`Gagal sync jurnal purchase request #${pr.id}:`, err);
        }
      }
    }

    return { syncedInvoices, syncedDeliveries, syncedReceivings, syncedInvoiceIns, syncedPurchaseRequests };
  }
}
