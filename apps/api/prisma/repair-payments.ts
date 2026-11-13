/**
 * Audit & perbaikan data pembayaran lama (sebelum perbaikan anti bayar-dobel).
 *
 *   pnpm --filter api db:repair-payments                 -> HANYA laporan (dry-run), tidak mengubah apa pun
 *   pnpm --filter api db:repair-payments -- --apply      -> perbaiki temuan A & C (aman, bisa diaudit lewat jurnal pembalik)
 *   ... -- --apply --fix-paid-mismatch                   -> juga samakan paidAmount invoice dengan baris Payment (temuan B)
 *
 * Temuan:
 *   A. Baris Payment palsu "Auto-settle via pelunasan" (tidak ada uang masuk) -> jurnalnya dibalik, baris dihapus.
 *   B. Invoice keluar yang paidAmount-nya != jumlah baris Payment (dulu bisa "ditandai lunas" tanpa uang tercatat).
 *      Butuh keputusan Finance: bila uangnya memang diterima, catat pembayaran resminya setelah paidAmount disamakan.
 *   C. Kas keluar dobel pembelian: jurnal "PurchaseRequest:paid" (dibuat sync otomatis) padahal PO-nya sudah dibayar
 *      lewat Invoice Supplier -> jurnal request dibalik.
 *
 * Selalu backup database sebelum menjalankan --apply.
 */
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url) });
dotenv.config();
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const APPLY = process.argv.includes("--apply");
const FIX_MISMATCH = process.argv.includes("--fix-paid-mismatch");
const AUTO_SETTLE_REF = "Auto-settle via pelunasan";
const OFFSET_REF = "OFFSET-PREPAID";

function adapter(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL tidak di-set");
  const u = new URL(url);
  if (!u.searchParams.has("allowPublicKeyRetrieval")) u.searchParams.set("allowPublicKeyRetrieval", "true");
  return new PrismaMariaDb(u.toString());
}

const rp = (n: unknown) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

async function nextJournalNumber(tx: any, date: Date) {
  const prefix = `JU/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/`;
  const last = await tx.journalEntry.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { number: true } });
  const seq = last ? parseInt(last.number.split("/").pop() || "0", 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function openPeriod(tx: any, date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  let p = await tx.accountingPeriod.findUnique({ where: { year_month: { year, month } } });
  if (!p) p = await tx.accountingPeriod.create({ data: { year, month, status: "OPEN" } });
  if (p.status !== "OPEN") throw new Error(`Periode ${year}-${month} tidak OPEN (${p.status}); buka dulu sebelum --apply.`);
  return p;
}

/** Balik satu jurnal (sama seperti PostingService.reverse). */
async function reverseEntry(tx: any, entryId: number, reason: string) {
  const e = await tx.journalEntry.findUnique({ where: { id: entryId }, include: { lines: true, period: true } });
  if (!e || e.status !== "POSTED") return null;
  if (e.period?.status === "CLOSED") throw new Error(`Jurnal ${e.number} ada di periode CLOSED; tidak bisa dibalik otomatis.`);
  const now = new Date();
  const period = await openPeriod(tx, now);
  const rev = await tx.journalEntry.create({
    data: {
      number: await nextJournalNumber(tx, now),
      date: now,
      source: e.source,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      event: `${e.event || "post"}:rev`,
      version: e.version,
      memo: `Pembalikan Jurnal ${e.number}: ${reason}`,
      refNo: e.number,
      projectId: e.projectId,
      periodId: period.id,
      reversalOfId: e.id,
      status: "POSTED",
      lines: {
        create: e.lines.map((l: any, i: number) => ({
          lineNo: i + 1,
          accountCode: l.accountCode,
          debit: l.credit,
          credit: l.debit,
          memo: `[REVERSAL] ${l.memo || e.memo}`.slice(0, 190),
          projectId: l.projectId,
          partyType: l.partyType,
          partyId: l.partyId,
        })),
      },
    },
  });
  await tx.journalEntry.update({ where: { id: e.id }, data: { status: "REVERSED" } });
  return rev;
}

function invoiceStatus(inv: { status: string; total: unknown; dueDate: Date }, paid: number) {
  if (inv.status === "BATAL") return "BATAL";
  const total = Number(inv.total);
  if (total > 0 && paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  if (inv.status === "DRAFT") return "DRAFT";
  return new Date(inv.dueDate).getTime() < Date.now() ? "OVERDUE" : "SENT";
}

async function main() {
  const prisma = new PrismaClient({ adapter: adapter(process.env["DATABASE_URL"]) }) as any;
  console.log(APPLY ? "MODE: APPLY (data akan diubah)\n" : "MODE: DRY-RUN (hanya laporan; tambahkan --apply untuk memperbaiki)\n");

  // ── A. Payment palsu auto-settle ─────────────────────────────────────────
  const phantom = await prisma.payment.findMany({
    where: { reference: { startsWith: AUTO_SETTLE_REF } },
    include: { invoiceOut: { select: { id: true, number: true } } },
  });
  console.log(`A. Payment palsu "${AUTO_SETTLE_REF}": ${phantom.length}`);
  for (const p of phantom) console.log(`   - Payment #${p.id} ${rp(p.amount)} pada ${p.invoiceOut?.number ?? `invoice #${p.invoiceOutId}`}`);

  // ── B. paidAmount vs baris Payment ───────────────────────────────────────
  const invoices = await prisma.invoiceOut.findMany({ include: { payments: { select: { amount: true, reference: true } } } });
  const mismatch = invoices
    .map((inv: any) => {
      const realPaid = inv.payments
        .filter((p: any) => !String(p.reference || "").startsWith(AUTO_SETTLE_REF))
        .reduce((s: number, p: any) => s + Number(p.amount), 0);
      return { inv, realPaid, diff: Math.round((Number(inv.paidAmount) - realPaid) * 100) / 100 };
    })
    .filter((x: any) => Math.abs(x.diff) > 1);
  console.log(`\nB. Invoice dengan paidAmount != pembayaran tercatat: ${mismatch.length}`);
  for (const m of mismatch) {
    console.log(`   - ${m.inv.number} [${m.inv.status}] paidAmount ${rp(m.inv.paidAmount)} vs Payment ${rp(m.realPaid)} (selisih ${rp(m.diff)})`);
  }

  // ── C. Kas keluar dobel: jurnal PR "paid" padahal invoice supplier PO-nya sudah dibayar ──
  const prJournals = await prisma.journalEntry.findMany({
    where: { sourceType: "PurchaseRequest", event: "paid", status: "POSTED" },
    include: { lines: true },
  });
  const doubleOut: Array<{ entry: any; pr: any; invPays: number }> = [];
  for (const e of prJournals) {
    const pos = await prisma.supplierPO.findMany({ where: { requestId: e.sourceId }, select: { id: true } });
    if (!pos.length) continue;
    const pays = await prisma.payment.findMany({
      where: {
        invoiceIn: { supplierPoId: { in: pos.map((p: any) => p.id) }, status: { not: "BATAL" } },
        NOT: { reference: { startsWith: OFFSET_REF } },
      },
      select: { amount: true },
    });
    if (!pays.length) continue;
    const pr = await prisma.purchaseRequest.findUnique({ where: { id: e.sourceId }, select: { number: true } });
    doubleOut.push({ entry: e, pr, invPays: pays.reduce((s: number, p: any) => s + Number(p.amount), 0) });
  }
  console.log(`\nC. Kas keluar dobel (jurnal Request + pembayaran Invoice Supplier): ${doubleOut.length}`);
  for (const d of doubleOut) {
    const amt = d.entry.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    console.log(`   - ${d.entry.number} (request ${d.pr?.number ?? d.entry.sourceId}) ${rp(amt)}; invoice supplier sudah dibayar ${rp(d.invPays)}`);
  }

  if (!APPLY) {
    console.log("\nTidak ada data yang diubah. Jalankan ulang dengan --apply setelah backup database.");
    await prisma.$disconnect();
    return;
  }

  // ── APPLY ────────────────────────────────────────────────────────────────
  for (const p of phantom) {
    await prisma.$transaction(async (tx: any) => {
      const entries = await tx.journalEntry.findMany({ where: { sourceType: "Payment", sourceId: p.id, status: "POSTED" }, select: { id: true } });
      for (const e of entries) await reverseEntry(tx, e.id, "Pembayaran palsu auto-settle (tidak ada uang masuk)");
      await tx.payment.delete({ where: { id: p.id } });
      if (p.invoiceOutId) {
        const inv = await tx.invoiceOut.findUnique({ where: { id: p.invoiceOutId }, include: { payments: true } });
        const paid = inv.payments.reduce((s: number, x: any) => s + Number(x.amount), 0);
        await tx.invoiceOut.update({ where: { id: inv.id }, data: { paidAmount: paid, status: invoiceStatus(inv, paid) as never } });
      }
    }, { timeout: 30_000 });
    console.log(`✓ A: Payment #${p.id} dihapus & jurnalnya dibalik`);
  }

  for (const d of doubleOut) {
    await prisma.$transaction(async (tx: any) => {
      await reverseEntry(tx, d.entry.id, "Kas keluar dobel: pembelian sudah dibayar lewat Invoice Supplier");
    }, { timeout: 30_000 });
    console.log(`✓ C: ${d.entry.number} dibalik`);
  }

  if (FIX_MISMATCH) {
    for (const m of mismatch) {
      const inv = await prisma.invoiceOut.findUnique({ where: { id: m.inv.id }, include: { payments: true } });
      const paid = inv.payments.reduce((s: number, x: any) => s + Number(x.amount), 0);
      await prisma.invoiceOut.update({ where: { id: inv.id }, data: { paidAmount: paid, status: invoiceStatus(inv, paid) as never } });
      console.log(`✓ B: ${inv.number} paidAmount ${rp(m.inv.paidAmount)} -> ${rp(paid)}`);
    }
  } else if (mismatch.length) {
    console.log("\nB dilewati. Periksa daftarnya dengan Finance, lalu jalankan dengan --apply --fix-paid-mismatch.");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
