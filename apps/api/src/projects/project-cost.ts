import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { PostingService } from "../accounting/posting.service.js";
import { MappingService } from "../accounting/mapping.service.js";

import { PROJECT_DIRECT_COST_DEFAULT, surveyIdsForProject } from "../accounting/project-cost.rules.js";

/**
 * Reklasifikasi biaya project ke HPP. Survey terjadi sebelum project ada; saat prospeknya menjadi project,
 * biaya survey yang sudah dibukukan sebagai beban dipindah:  Dr HPP Biaya Langsung Project  /  Cr akun beban semula.
 */
const BACKFILL_KEY = "accounting.projectCostHpp.v1";
const RECLASS_EVENT = "reclass-hpp";

@Injectable()
export class ProjectCostService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: PostingService,
    private readonly mapping: MappingService,
  ) {}

  onModuleInit() {
    // Sekali saja: biaya project lama (dulu dibukukan ke beban operasional) dipindah ke HPP project.
    setTimeout(() => void this.backfillOnce().catch((e) => console.warn("Reklasifikasi biaya project ke HPP gagal:", e?.message)), 5000);
  }

  private async backfillOnce() {
    const db = this.prisma.main as any;
    const done = await db.systemSetting.findUnique({ where: { key: BACKFILL_KEY } });
    if (done) return;
    // Tunggu sampai akun HPP biaya langsung tersedia (migration) — jangan tandai selesai sebelum itu
    const map = await this.mapping.getAll();
    const acc = await db.coaAccount.findUnique({ where: { code: map.PROJECT_DIRECT_COST || PROJECT_DIRECT_COST_DEFAULT }, select: { isPostable: true } });
    if (!acc?.isPostable) return;
    const projects = await db.project.findMany({ select: { id: true } });
    let moved = 0;
    for (const p of projects) {
      moved += await this.reclassProject(p.id).catch((e) => {
        console.warn(`Reklasifikasi biaya project #${p.id} ke HPP gagal:`, e?.message);
        return 0;
      });
    }
    await db.systemSetting.upsert({
      where: { key: BACKFILL_KEY },
      update: { value: String(moved) },
      create: { key: BACKFILL_KEY, value: String(moved), description: "Reklasifikasi biaya langsung project ke HPP (jumlah pengeluaran)" },
    });
    if (moved) console.log(`Reklasifikasi ${moved} biaya project ke HPP project.`);
  }

  /**
   * Pindahkan biaya project (termasuk survey prospeknya) yang masih di akun beban ke HPP project.
   * Aman dipanggil berulang. Mengembalikan jumlah pengeluaran yang direklasifikasi.
   */
  async reclassProject(projectId: number, userId?: number): Promise<number> {
    const db = this.prisma.main as any;
    const map = await this.mapping.getAll();
    const hpp = map.PROJECT_DIRECT_COST || PROJECT_DIRECT_COST_DEFAULT;
    const hasHppAccount = await db.coaAccount.findUnique({ where: { code: hpp }, select: { code: true, isPostable: true } });
    if (!hasHppAccount?.isPostable) return 0;
    const surveyIds = await surveyIdsForProject(db, projectId);
    const rows = await db.expense.findMany({
      where: {
        status: { in: ["DISETUJUI", "DIBAYAR"] },
        OR: [{ projectId }, ...(surveyIds.length ? [{ projectId: null, surveyId: { in: surveyIds } }] : [])],
      },
      select: {
        id: true,
        amount: true,
        description: true,
        projectId: true,
        fundingSource: true,
        cashAdvanceId: true,
        category: { select: { coaAccount: true } },
      },
    });

    let moved = 0;
    for (const e of rows) {
      const code = `EXP-${String(e.id).padStart(3, "0")}`;
      const linkProject = async () => {
        if (!e.projectId) await db.expense.update({ where: { id: e.id }, data: { projectId } });
      };
      const already = await db.journalEntry.findFirst({ where: { sourceType: "Expense", sourceId: e.id, event: RECLASS_EVENT, status: "POSTED" } });
      if (already) {
        await linkProject();
        continue;
      }
      const from = await this.postedExpenseAccount(e, map);
      if (!from || from === hpp) {
        // Belum pernah dijurnal (mis. sebelum cut-off) atau sudah langsung ke HPP — cukup tautkan ke project.
        await linkProject();
        continue;
      }
      const amount = Math.round(Number(e.amount || 0));
      if (amount <= 0) continue;
      await this.posting.post({
        sourceType: "Expense",
        sourceId: e.id,
        event: RECLASS_EVENT,
        source: "EXPENSE",
        date: new Date(),
        memo: `Reklasifikasi biaya ${code} ke HPP project${e.description ? ` — ${e.description}` : ""}`,
        refNo: code,
        projectId,
        createdById: userId,
        lines: [
          { accountCode: hpp, debit: amount, credit: 0, memo: `HPP biaya langsung project — ${code}`, projectId },
          { accountCode: from, debit: 0, credit: amount, memo: `Dipindah ke HPP project — ${code}`, projectId },
        ],
      });
      await linkProject();
      moved += 1;
    }
    return moved;
  }

  /** Akun beban yang sebenarnya didebit saat pengeluaran ini dijurnal (null bila belum ada jurnal). */
  private async postedExpenseAccount(
    e: { id: number; fundingSource: string | null; cashAdvanceId: number | null; category: { coaAccount: string | null } | null },
    map: Record<string, string>,
  ): Promise<string | null> {
    const db = this.prisma.main as any;
    const skip = new Set([map.EXPENSE_PAYABLE || "2103", map.EMPLOYEE_ADVANCE || "1107"]);
    if (e.fundingSource === "UANG_JALAN" && e.cashAdvanceId) {
      // Biaya dari laporan petty cash: dijurnal bersama di jurnal penyelesaian petty cash
      const entry = await db.journalEntry.findFirst({
        where: { sourceType: "CashAdvance", sourceId: e.cashAdvanceId, event: "settled", status: "POSTED" },
        include: { lines: true },
      });
      if (!entry) return null;
      const expected = e.category?.coaAccount || map.EXPENSE_DEFAULT || "6202";
      const debits = entry.lines.filter((l: any) => Number(l.debit) > 0 && !skip.has(l.accountCode));
      if (debits.some((l: any) => l.accountCode === (map.PROJECT_DIRECT_COST || PROJECT_DIRECT_COST_DEFAULT))) return null;
      return debits.some((l: any) => l.accountCode === expected) ? expected : debits[0]?.accountCode ?? null;
    }
    const entry = await db.journalEntry.findFirst({
      where: { sourceType: "Expense", sourceId: e.id, event: "approved", status: "POSTED" },
      include: { lines: true },
    });
    const line = entry?.lines.find((l: any) => Number(l.debit) > 0 && !skip.has(l.accountCode));
    return line?.accountCode ?? null;
  }
}
