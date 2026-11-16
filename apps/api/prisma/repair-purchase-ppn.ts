/**
 * Koreksi jurnal pembelian lama yang PPN-nya masuk ke Persediaan / GRNI (sebelum perbaikan PPN pembelian).
 *
 *   pnpm --filter api db:repair-purchase-ppn             -> HANYA laporan (dry-run)
 *   pnpm --filter api db:repair-purchase-ppn -- --apply  -> buat jurnal koreksi (bisa diaudit, jurnal asli tidak diubah)
 *
 * Temuan:
 *   A. Terima barang dari Request/PO "include PPN": Persediaan dicatat termasuk PPN.
 *      Koreksi: Dr GRNI  Cr Persediaan (sebesar PPN yang ikut masuk).
 *   B. Pembayaran Request (include PPN) / tandai PO Lunas (include/exclude PPN) tanpa baris PPN Masukan.
 *      Koreksi: Dr PPN Masukan  Cr GRNI / HPP Proyek (sebesar PPN-nya).
 *      Dilewati (hanya dilaporkan) bila sudah ada Tagihan Supplier untuk pembelian itu — PPN-nya sudah diakui di tagihan.
 *   C. Harga beli / rata-rata produk yang tersimpan termasuk PPN (dari penerimaan di A) -> diubah ke harga sebelum PPN.
 *      Hanya bila nilainya masih sama persis dengan harga include PPN; selain itu dilaporkan untuk dicek manual.
 *
 * Jurnal koreksi memakai event "ppn-fix", jadi script aman dijalankan ulang. Selalu backup database sebelum --apply.
 */
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url) });
dotenv.config();
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { netUnitCost, purchasePpnMode, receivingUnitCost, splitPurchasePayment } from "../src/accounting/purchase-vat.js";

const APPLY = process.argv.includes("--apply");
const FIX_EVENT = "ppn-fix";

function adapter(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL tidak di-set");
  const u = new URL(url);
  if (!u.searchParams.has("allowPublicKeyRetrieval")) u.searchParams.set("allowPublicKeyRetrieval", "true");
  return new PrismaMariaDb(u.toString());
}

const rp = (n: unknown) => `Rp${Math.round(Number(n || 0)).toLocaleString("id-ID")}`;

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

type Fix = {
  kind: "A" | "B";
  original: any;
  ref: string;
  amount: number;
  debit: string;
  credit: string;
  memo: string;
};

async function main() {
  const prisma = new PrismaClient({ adapter: adapter(process.env["DATABASE_URL"]) }) as any;
  console.log(APPLY ? "MODE: APPLY (jurnal koreksi akan dibuat)\n" : "MODE: DRY-RUN (hanya laporan; tambahkan --apply untuk memperbaiki)\n");

  const maps = Object.fromEntries(
    (await prisma.accountMapping.findMany({ select: { key: true, accountCode: true } }).catch(() => [])).map((m: any) => [m.key, m.accountCode]),
  ) as Record<string, string>;
  const INVENTORY = maps.INVENTORY || "1200";
  const GRNI = maps.GRNI || "2108";
  const VAT_IN = maps.VAT_IN || "1600";

  const alreadyFixed = async (sourceType: string, sourceId: number) =>
    (await prisma.journalEntry.count({ where: { sourceType, sourceId, event: FIX_EVENT, status: "POSTED" } })) > 0;

  const fixes: Fix[] = [];
  const skipped: string[] = [];
  /** productId -> harga include PPN & harga sebelum PPN dari penerimaan include PPN */
  const productFixes = new Map<number, { name: string; gross: number; net: number }>();

  // ── A. Jurnal terima barang ──
  const recJournals = await prisma.journalEntry.findMany({
    where: { sourceType: "Receiving", event: "received", status: "POSTED" },
    include: { lines: true },
  });
  for (const e of recJournals) {
    if (await alreadyFixed("Receiving", e.sourceId)) continue;
    const rec = await prisma.receiving.findUnique({
      where: { id: e.sourceId },
      include: { items: { include: { product: true } }, supplierPo: { include: { items: true } }, request: { include: { items: true } } },
    });
    if (!rec) continue;
    if (purchasePpnMode(rec.supplierPo?.ppnMode ?? rec.request?.ppnMode) !== "include") continue;
    for (const it of rec.items) {
      const poItem = rec.supplierPo?.items?.find((x: any) => x.productId === it.productId);
      const reqItem = rec.request?.items?.find((x: any) => x.productId === it.productId);
      const gross = Number(poItem?.price || 0) || Number(reqItem?.unitCost || 0);
      const mode = Number(poItem?.price || 0) ? (rec.supplierPo?.ppnMode ?? rec.request?.ppnMode) : rec.request?.ppnMode;
      if (gross > 0 && purchasePpnMode(mode) === "include") {
        productFixes.set(it.productId, { name: it.product?.name ?? `#${it.productId}`, gross, net: Math.round(netUnitCost(gross, "include") * 100) / 100 });
      }
    }
    let correct = 0;
    for (const it of rec.items) correct += Number(it.qtyReceived || 0) * (await receivingUnitCost(prisma, rec, it));
    correct = Math.round(correct);
    const invLine = e.lines.find((l: any) => l.accountCode === INVENTORY && Number(l.debit) > 0) ?? e.lines.find((l: any) => Number(l.debit) > 0);
    const posted = Number(invLine?.debit || 0);
    const diff = Math.round(posted - correct);
    if (correct <= 0 || diff <= 1) continue;
    fixes.push({
      kind: "A",
      original: e,
      ref: rec.number,
      amount: diff,
      debit: GRNI,
      credit: invLine.accountCode,
      memo: `Koreksi PPN yang masuk Persediaan BPB ${rec.number} (tercatat ${rp(posted)}, seharusnya ${rp(correct)})`,
    });
  }

  // ── B. Jurnal pembayaran Request / PO tanpa PPN Masukan ──
  const payJournals = await prisma.journalEntry.findMany({
    where: { sourceType: { in: ["PurchaseRequest", "SupplierPO"] }, event: "paid", status: "POSTED" },
    include: { lines: true },
  });
  for (const e of payJournals) {
    if (e.lines.some((l: any) => l.accountCode === VAT_IN && Number(l.debit) > 0)) continue;
    if (await alreadyFixed(e.sourceType, e.sourceId)) continue;
    const paid = e.lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
    const goodsLine = e.lines.find((l: any) => Number(l.debit) > 0);
    if (!goodsLine || paid <= 0) continue;

    let ref = "";
    let split = { goods: paid, vat: 0 };
    let poIds: number[] = [];
    if (e.sourceType === "PurchaseRequest") {
      const pr = await prisma.purchaseRequest.findUnique({ where: { id: e.sourceId }, include: { items: true } });
      if (!pr || purchasePpnMode(pr.ppnMode) !== "include") continue;
      ref = pr.number;
      split = splitPurchasePayment({
        paid,
        itemsSum: pr.items.reduce((s: number, it: any) => s + Number(it.unitCost || 0) * Number(it.qty || 1), 0),
        mode: pr.ppnMode,
      });
      poIds = (await prisma.supplierPO.findMany({ where: { requestId: pr.id }, select: { id: true } })).map((p: any) => p.id);
    } else {
      const po = await prisma.supplierPO.findUnique({ where: { id: e.sourceId }, include: { items: true, request: { select: { ppnMode: true } } } });
      const mode = purchasePpnMode(po?.ppnMode ?? po?.request?.ppnMode);
      if (!po || mode === "none") continue;
      ref = po.number;
      split = splitPurchasePayment({
        paid,
        itemsSum: po.items.reduce((s: number, it: any) => s + it.qty * Number(it.price || 0), 0),
        mode,
        ppn: po.ppn != null ? Number(po.ppn) : null,
      });
      poIds = [po.id];
    }
    if (split.vat <= 1) continue;
    const bills = poIds.length ? await prisma.invoiceIn.count({ where: { supplierPoId: { in: poIds }, status: { not: "BATAL" } } }) : 0;
    if (bills > 0) {
      skipped.push(`${e.number} (${ref}) PPN ${rp(split.vat)} — sudah ada Tagihan Supplier, periksa manual dengan Finance`);
      continue;
    }
    fixes.push({
      kind: "B",
      original: e,
      ref,
      amount: split.vat,
      debit: VAT_IN,
      credit: goodsLine.accountCode,
      memo: `Koreksi PPN Masukan pembayaran ${ref} (PPN ${rp(split.vat)} dari total ${rp(paid)})`,
    });
  }

  console.log(`A. Terima barang include PPN yang Persediaannya termasuk PPN: ${fixes.filter((f) => f.kind === "A").length}`);
  for (const f of fixes.filter((x) => x.kind === "A")) console.log(`   - ${f.original.number}: ${f.memo} -> Dr ${f.debit} Cr ${f.credit} ${rp(f.amount)}`);
  console.log(`\nB. Pembayaran pembelian tanpa PPN Masukan: ${fixes.filter((f) => f.kind === "B").length}`);
  for (const f of fixes.filter((x) => x.kind === "B")) console.log(`   - ${f.original.number}: ${f.memo} -> Dr ${f.debit} Cr ${f.credit} ${rp(f.amount)}`);
  const productUpdates: Array<{ id: number; label: string; data: Record<string, number> }> = [];
  for (const [id, f] of productFixes) {
    const prod = await prisma.product.findUnique({ where: { id }, select: { purchasePrice: true, avgCost: true } });
    if (!prod) continue;
    const data: Record<string, number> = {};
    if (Math.abs(Number(prod.purchasePrice || 0) - f.gross) < 1) data.purchasePrice = f.net;
    if (Math.abs(Number(prod.avgCost || 0) - f.gross) < 1) data.avgCost = f.net;
    if (Object.keys(data).length) productUpdates.push({ id, label: `${f.name}: ${rp(f.gross)} -> ${rp(f.net)} (${Object.keys(data).join(", ")})`, data });
    else if (Number(prod.avgCost || 0) > f.net + 1)
      skipped.push(`Produk ${f.name}: harga rata-rata ${rp(prod.avgCost)} mungkin masih termasuk PPN (bercampur pembelian lain), cek manual`);
  }
  console.log(`
C. Harga pokok produk yang masih termasuk PPN: ${productUpdates.length}`);
  for (const u of productUpdates) console.log(`   - ${u.label}`);
  if (skipped.length) {
    console.log(`\nDilewati (perlu dicek manual): ${skipped.length}`);
    for (const s of skipped) console.log(`   - ${s}`);
  }

  if (!APPLY) {
    console.log("\nTidak ada data yang diubah. Jalankan ulang dengan --apply setelah backup database.");
    await prisma.$disconnect();
    return;
  }

  for (const f of fixes) {
    await prisma.$transaction(
      async (tx: any) => {
        const now = new Date();
        const period = await openPeriod(tx, now);
        const e = f.original;
        await tx.journalEntry.create({
          data: {
            number: await nextJournalNumber(tx, now),
            date: now,
            source: e.source,
            sourceType: e.sourceType,
            sourceId: e.sourceId,
            event: FIX_EVENT,
            memo: f.memo.slice(0, 190),
            refNo: e.number,
            projectId: e.projectId,
            periodId: period.id,
            status: "POSTED",
            lines: {
              create: [
                { lineNo: 1, accountCode: f.debit, debit: f.amount, credit: 0, memo: f.memo.slice(0, 190), projectId: e.projectId },
                { lineNo: 2, accountCode: f.credit, debit: 0, credit: f.amount, memo: f.memo.slice(0, 190), projectId: e.projectId },
              ],
            },
          },
        });
      },
      { timeout: 30_000 },
    );
    console.log(`✓ ${f.kind}: ${f.ref} dikoreksi ${rp(f.amount)}`);
  }

  for (const u of productUpdates) {
    await prisma.product.update({ where: { id: u.id }, data: u.data });
    console.log(`✓ C: ${u.label}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
