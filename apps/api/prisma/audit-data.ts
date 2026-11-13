/**
 * Audit kebersihan data (HANYA MEMBACA — tidak mengubah apa pun).
 *
 *   pnpm --filter api db:audit
 *
 * Mengecek: data dobel (supplier/customer/produk/tagihan/pembayaran/jurnal), relasi yatim (ID menunjuk data yang
 * sudah tidak ada karena kolomnya tanpa foreign key), dan data yang tidak konsisten antar tabel.
 */
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url) });
dotenv.config();
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function adapter(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL tidak di-set");
  const u = new URL(url);
  if (!u.searchParams.has("allowPublicKeyRetrieval")) u.searchParams.set("allowPublicKeyRetrieval", "true");
  return new PrismaMariaDb(u.toString());
}

const prisma = new PrismaClient({ adapter: adapter(process.env.DATABASE_URL) });

type Check = { group: string; name: string; sql: string; hint?: string };

/** Kolom ID file tanpa foreign key -> cek yang menunjuk file yang sudah tidak ada. */
const FILE_COLS: Array<[string, string]> = [
  ["PurchaseRequest", "evidenceFileId"],
  ["PurchaseRequest", "doFileId"],
  ["PurchaseRequest", "paymentProofFileId"],
  ["SupplierPO", "fileId"],
  ["SupplierPO", "doFileId"],
  ["SupplierPO", "soFileId"],
  ["InvoiceIn", "fileId"],
  ["InvoiceIn", "transferFileId"],
  ["InvoiceOut", "fileId"],
  ["InvoiceOut", "paidFileId"],
  ["Payment", "fileId"],
  ["ClientPO", "fileId"],
  ["ClientPO", "soFileId"],
  ["ClientPO", "paymentProofFileId"],
  ["Expense", "receiptFileId"],
  ["Expense", "paidFileId"],
  ["Receiving", "receiptFileId"],
  ["Receiving", "photoFileId"],
  ["Project", "bastFileId"],
  ["Project", "bahpFileId"],
  ["Project", "doFileId"],
];

const checks: Check[] = [
  // ───────────── Duplikat master data ─────────────
  {
    group: "Duplikat",
    name: "Supplier dengan nama sama",
    sql: `SELECT LOWER(TRIM(name)) AS nama, COUNT(*) AS jumlah, GROUP_CONCAT(id ORDER BY id) AS ids
          FROM Supplier GROUP BY LOWER(TRIM(name)) HAVING COUNT(*) > 1`,
    hint: "Gabungkan (pindahkan PO/tagihan ke satu ID), lalu nonaktifkan sisanya.",
  },
  {
    group: "Duplikat",
    name: "Customer dengan nama sama",
    sql: `SELECT LOWER(TRIM(name)) AS nama, COUNT(*) AS jumlah, GROUP_CONCAT(id ORDER BY id) AS ids
          FROM Customer GROUP BY LOWER(TRIM(name)) HAVING COUNT(*) > 1`,
  },
  {
    group: "Duplikat",
    name: "Produk dengan nama sama (SKU beda)",
    sql: `SELECT LOWER(TRIM(name)) AS nama, COUNT(*) AS jumlah, GROUP_CONCAT(CONCAT(id,':',sku) ORDER BY id SEPARATOR ', ') AS produk
          FROM Product GROUP BY LOWER(TRIM(name)) HAVING COUNT(*) > 1`,
    hint: "Biasanya dari barang baru yang otomatis didaftarkan saat buat PO / request (SKU-xxxx).",
  },
  {
    group: "Duplikat",
    name: "Produk SKU otomatis (SKU-<angka>)",
    sql: `SELECT COUNT(*) AS jumlah FROM Product WHERE sku REGEXP '^SKU-[0-9]' HAVING COUNT(*) > 0`,
    hint: "Barang yang dibuat otomatis dari nama bebas; rawan dobel dengan master yang sudah ada.",
  },
  {
    group: "Duplikat",
    name: "Nomor tagihan supplier sama untuk supplier yang sama",
    sql: `SELECT supplierId, number, COUNT(*) AS jumlah, GROUP_CONCAT(id ORDER BY id) AS ids
          FROM InvoiceIn WHERE number IS NOT NULL AND status <> 'BATAL'
          GROUP BY supplierId, number HAVING COUNT(*) > 1`,
  },
  {
    group: "Duplikat",
    name: "Tagihan supplier aktif lebih dari total PO",
    sql: `SELECT po.id AS poId, po.number AS po, po.total AS totalPO, SUM(ii.total) AS totalTagihan, COUNT(ii.id) AS jumlahTagihan
          FROM SupplierPO po JOIN InvoiceIn ii ON ii.supplierPoId = po.id AND ii.status <> 'BATAL'
          GROUP BY po.id HAVING SUM(ii.total) > po.total * 1.12 + 1`,
    hint: "Kemungkinan faktur yang sama dicatat dua kali.",
  },
  {
    group: "Duplikat",
    name: "Pembayaran kembar (invoice, nominal & tanggal sama)",
    sql: `SELECT COALESCE(CONCAT('out#',invoiceOutId), CONCAT('in#',invoiceInId)) AS tagihan, amount, date, COUNT(*) AS jumlah,
                 GROUP_CONCAT(id ORDER BY id) AS paymentIds
          FROM Payment GROUP BY invoiceOutId, invoiceInId, amount, date HAVING COUNT(*) > 1`,
  },
  {
    group: "Duplikat",
    name: "Jurnal aktif dobel untuk dokumen & kejadian yang sama",
    sql: `SELECT sourceType, sourceId, event, COUNT(*) AS jumlah, GROUP_CONCAT(number ORDER BY id) AS jurnal
          FROM JournalEntry WHERE status = 'POSTED' AND sourceType IS NOT NULL AND sourceType <> 'MANUAL'
          GROUP BY sourceType, sourceId, event HAVING COUNT(*) > 1`,
  },
  {
    group: "Duplikat",
    name: "Request barang dengan lebih dari satu PO aktif",
    sql: `SELECT requestId, COUNT(*) AS jumlah, GROUP_CONCAT(number ORDER BY id) AS po
          FROM SupplierPO WHERE requestId IS NOT NULL AND status NOT IN ('DITOLAK','DIBATALKAN')
          GROUP BY requestId HAVING COUNT(*) > 1`,
    hint: "Bisa sah (dipecah ke beberapa supplier), cek manual.",
  },
  {
    group: "Duplikat",
    name: "Penerimaan melebihi qty PO",
    sql: `SELECT po.number AS po, poi.id AS poItemId, poi.qty AS dipesan, poi.receivedQty AS diterima
          FROM SupplierPOItem poi JOIN SupplierPO po ON po.id = poi.poId WHERE poi.receivedQty > poi.qty`,
  },

  // ───────────── Akuntansi tidak konsisten ─────────────
  {
    group: "Akuntansi",
    name: "Jurnal tidak seimbang (debit ≠ kredit)",
    sql: `SELECT je.number, je.sourceType, je.sourceId, SUM(jl.debit) AS debit, SUM(jl.credit) AS kredit
          FROM JournalEntry je JOIN JournalLine jl ON jl.entryId = je.id
          GROUP BY je.id HAVING ABS(SUM(jl.debit) - SUM(jl.credit)) > 0.01`,
  },
  {
    group: "Akuntansi",
    name: "Invoice keluar: paidAmount ≠ jumlah pembayaran",
    sql: `SELECT io.number, io.paidAmount, COALESCE(SUM(p.amount),0) AS totalPayment
          FROM InvoiceOut io LEFT JOIN Payment p ON p.invoiceOutId = io.id
          GROUP BY io.id HAVING ABS(io.paidAmount - COALESCE(SUM(p.amount),0)) > 1`,
    hint: "Jalankan db:repair-payments (temuan B).",
  },
  {
    group: "Akuntansi",
    name: "Tagihan supplier: paidAmount ≠ jumlah pembayaran",
    sql: `SELECT ii.id, ii.number, ii.paidAmount, COALESCE(SUM(p.amount),0) AS totalPayment
          FROM InvoiceIn ii LEFT JOIN Payment p ON p.invoiceInId = ii.id
          GROUP BY ii.id HAVING ABS(ii.paidAmount - COALESCE(SUM(p.amount),0)) > 1`,
  },
  {
    group: "Akuntansi",
    name: "Dibayar melebihi total tagihan",
    sql: `SELECT 'keluar' AS jenis, number, total, paidAmount FROM InvoiceOut WHERE paidAmount > total + 1
          UNION ALL
          SELECT 'supplier', number, total, paidAmount FROM InvoiceIn WHERE paidAmount > total + 1`,
  },
  {
    group: "Akuntansi",
    name: "Pembayaran tanpa tagihan (yatim)",
    sql: `SELECT id, amount, date, reference FROM Payment WHERE invoiceOutId IS NULL AND invoiceInId IS NULL`,
  },
  {
    group: "Akuntansi",
    name: "Pembelian dibayar dua jalur (Request/PO + kas tagihan supplier)",
    sql: `SELECT po.number AS po, pr.number AS request
          FROM SupplierPO po
          LEFT JOIN PurchaseRequest pr ON pr.id = po.requestId
          WHERE EXISTS (SELECT 1 FROM Payment p JOIN InvoiceIn ii ON ii.id = p.invoiceInId
                        WHERE ii.supplierPoId = po.id AND (p.reference IS NULL OR p.reference NOT LIKE 'OFFSET-PREPAID%'))
            AND EXISTS (SELECT 1 FROM JournalEntry je WHERE je.status='POSTED' AND je.event='paid'
                        AND ((je.sourceType='PurchaseRequest' AND je.sourceId = po.requestId)
                          OR (je.sourceType='SupplierPO' AND je.sourceId = po.id)))`,
    hint: "Jalankan db:repair-payments (temuan C).",
  },
  {
    group: "Akuntansi",
    name: "Jurnal aktif yang dokumennya sudah dihapus",
    sql: `SELECT je.number, je.sourceType, je.sourceId, je.event FROM JournalEntry je
          WHERE je.status = 'POSTED' AND (
            (je.sourceType='InvoiceOut' AND NOT EXISTS (SELECT 1 FROM InvoiceOut x WHERE x.id=je.sourceId)) OR
            (je.sourceType='InvoiceIn' AND NOT EXISTS (SELECT 1 FROM InvoiceIn x WHERE x.id=je.sourceId)) OR
            (je.sourceType='Payment' AND NOT EXISTS (SELECT 1 FROM Payment x WHERE x.id=je.sourceId)) OR
            (je.sourceType='PurchaseRequest' AND NOT EXISTS (SELECT 1 FROM PurchaseRequest x WHERE x.id=je.sourceId)) OR
            (je.sourceType='SupplierPO' AND NOT EXISTS (SELECT 1 FROM SupplierPO x WHERE x.id=je.sourceId)) OR
            (je.sourceType='Expense' AND NOT EXISTS (SELECT 1 FROM Expense x WHERE x.id=je.sourceId)) OR
            (je.sourceType='Receiving' AND NOT EXISTS (SELECT 1 FROM Receiving x WHERE x.id=je.sourceId)) OR
            (je.sourceType='PayrollSlip' AND NOT EXISTS (SELECT 1 FROM PayrollSlip x WHERE x.id=je.sourceId)) OR
            (je.sourceType='DeliveryNote' AND NOT EXISTS (SELECT 1 FROM DeliveryNote x WHERE x.id=je.sourceId)) OR
            (je.sourceType='StockOpname' AND NOT EXISTS (SELECT 1 FROM StockOpname x WHERE x.id=je.sourceId)) OR
            (je.sourceType='DamageReport' AND NOT EXISTS (SELECT 1 FROM DamageReport x WHERE x.id=je.sourceId))
          )`,
    hint: "Saldo laporan keuangan ikut menghitung dokumen yang sudah tidak ada.",
  },

  // ───────────── Relasi tidak konsisten antar tabel ─────────────
  {
    group: "Relasi",
    name: "Penerimaan menunjuk Request berbeda dari PO-nya",
    sql: `SELECT r.number AS penerimaan, r.requestId AS requestPenerimaan, po.number AS po, po.requestId AS requestPO
          FROM Receiving r JOIN SupplierPO po ON po.id = r.supplierPoId
          WHERE r.requestId IS NOT NULL AND po.requestId IS NOT NULL AND r.requestId <> po.requestId`,
  },
  {
    group: "Relasi",
    name: "PO beda proyek dengan Request-nya",
    sql: `SELECT po.number AS po, po.projectId AS proyekPO, pr.number AS request, pr.projectId AS proyekRequest
          FROM SupplierPO po JOIN PurchaseRequest pr ON pr.id = po.requestId
          WHERE po.projectId IS NOT NULL AND pr.projectId IS NOT NULL AND po.projectId <> pr.projectId`,
  },
  {
    group: "Relasi",
    name: "Tagihan supplier beda supplier dengan PO-nya",
    sql: `SELECT ii.id, ii.number, ii.supplierId AS supplierTagihan, po.number AS po, po.supplierId AS supplierPO
          FROM InvoiceIn ii JOIN SupplierPO po ON po.id = ii.supplierPoId WHERE ii.supplierId <> po.supplierId`,
  },
  {
    group: "Relasi",
    name: "Request status DIBAYAR tapi paymentStatus belum",
    sql: `SELECT number, status, paymentStatus FROM PurchaseRequest
          WHERE status = 'DIBAYAR' AND (paymentStatus IS NULL OR paymentStatus <> 'DIBAYAR')`,
  },
  {
    group: "Relasi",
    name: "Stok minus",
    sql: `SELECT p.name AS produk, w.name AS gudang, sb.qty FROM StockBalance sb
          JOIN Product p ON p.id = sb.productId JOIN Warehouse w ON w.id = sb.warehouseId WHERE sb.qty < 0`,
  },
  {
    group: "Relasi",
    name: "Saldo stok ≠ total mutasi stok",
    sql: `SELECT p.name AS produk, w.name AS gudang, sb.qty AS saldo, COALESCE(m.net,0) AS totalMutasi
          FROM StockBalance sb JOIN Product p ON p.id = sb.productId JOIN Warehouse w ON w.id = sb.warehouseId
          LEFT JOIN (
            SELECT productId, wh, SUM(q) AS net FROM (
              SELECT productId, toWarehouseId AS wh, qty AS q FROM StockMovement WHERE toWarehouseId IS NOT NULL
              UNION ALL
              SELECT productId, fromWarehouseId AS wh, -qty AS q FROM StockMovement WHERE fromWarehouseId IS NOT NULL
            ) t GROUP BY productId, wh
          ) m ON m.productId = sb.productId AND m.wh = sb.warehouseId
          WHERE sb.qty <> COALESCE(m.net,0)`,
    hint: "Saldo diubah tanpa mutasi (atau mutasi tanpa saldo). Kartu stok & HPP jadi tidak bisa ditelusuri.",
  },
  {
    group: "Relasi",
    name: "SN berstatus di gudang tapi tanpa gudang",
    sql: `SELECT sn, status FROM SerialUnit WHERE status = 'DI_GUDANG' AND warehouseId IS NULL`,
  },

  // ───────────── Relasi yatim (kolom ID tanpa foreign key) ─────────────
  {
    group: "Yatim",
    name: "Absensi / slip gaji / konfigurasi gaji untuk user yang tidak ada",
    sql: `SELECT 'Attendance' AS tabel, COUNT(*) AS jumlah FROM Attendance a WHERE NOT EXISTS (SELECT 1 FROM User u WHERE u.id=a.userId)
          UNION ALL SELECT 'PayrollSlip', COUNT(*) FROM PayrollSlip a WHERE NOT EXISTS (SELECT 1 FROM User u WHERE u.id=a.userId)
          UNION ALL SELECT 'SalaryConfig', COUNT(*) FROM SalaryConfig a WHERE NOT EXISTS (SELECT 1 FROM User u WHERE u.id=a.userId)`,
  },
  {
    group: "Yatim",
    name: "Event kalender menunjuk data yang tidak ada",
    sql: `SELECT number, customerId, projectId, leadId, invoiceId, supplierId FROM CalendarEvent e WHERE
            (customerId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Customer x WHERE x.id=e.customerId)) OR
            (projectId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Project x WHERE x.id=e.projectId)) OR
            (leadId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM \`Lead\` x WHERE x.id=e.leadId)) OR
            (invoiceId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM InvoiceOut x WHERE x.id=e.invoiceId)) OR
            (supplierId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Supplier x WHERE x.id=e.supplierId))`,
  },
  {
    group: "Yatim",
    name: "Mutasi stok menunjuk penerimaan yang tidak ada",
    sql: `SELECT id, receivingId FROM StockMovement m
          WHERE receivingId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Receiving r WHERE r.id = m.receivingId)`,
  },
  {
    group: "Yatim",
    name: "Invoice lanjutan menunjuk invoice induk yang tidak ada",
    sql: `SELECT number, parentInvoiceId FROM InvoiceOut i
          WHERE parentInvoiceId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM InvoiceOut x WHERE x.id = i.parentInvoiceId)`,
  },
  {
    group: "Yatim",
    name: "Akun di jurnal / mapping yang tidak ada di COA",
    sql: `SELECT DISTINCT accountCode FROM JournalLine jl WHERE NOT EXISTS (SELECT 1 FROM CoaAccount c WHERE c.code = jl.accountCode)`,
  },
  {
    group: "Yatim",
    name: "Referensi file yang filenya sudah tidak ada",
    sql: FILE_COLS.map(
      ([t, c]) =>
        `SELECT '${t}.${c}' AS kolom, COUNT(*) AS jumlah FROM \`${t}\` x WHERE x.\`${c}\` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM File f WHERE f.id = x.\`${c}\`)`,
    ).join("\nUNION ALL "),
  },
  {
    group: "Lama",
    name: "Sisa tag teks lama (seharusnya sudah jadi kolom)",
    sql: `SELECT 'PurchaseRequest.otherNote' AS kolom, COUNT(*) AS jumlah FROM PurchaseRequest WHERE otherNote REGEXP '\\\\[(PPN:|ALL_CONSUMABLES)'
          UNION ALL SELECT 'PurchaseRequestItem.customName', COUNT(*) FROM PurchaseRequestItem WHERE customName REGEXP '\\\\[(PAKAI_HABIS|CONSUMABLE)\\\\]'
          UNION ALL SELECT 'DamageReport.description', COUNT(*) FROM DamageReport WHERE description REGEXP '\\\\[(RETUR-|DIGANTI:)'
          UNION ALL SELECT 'DeliveryNoteLocation.reason', COUNT(*) FROM DeliveryNoteLocation WHERE reason REGEXP '\\\\[(so|inv|invNum):'`,
    hint: "Tag yang dokumen tujuannya tidak ditemukan saat migrasi dibiarkan apa adanya; cek manual.",
  },
  {
    group: "Lama",
    name: "Tabel backup ManualJournal (berisi data lama, di luar buku besar)",
    sql: `SELECT COUNT(*) AS jumlah FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '_backup_ManualJournal' HAVING COUNT(*) > 0`,
    hint: "Isinya perlu dicatat ulang sebagai jurnal manual resmi, lalu tabelnya dihapus.",
  },
  {
    group: "Lama",
    name: "Data metadata lama yang masih tersimpan di SystemSetting",
    sql: `SELECT SUBSTRING_INDEX(\`key\`, ':', 2) AS prefix, COUNT(*) AS jumlah FROM SystemSetting
          WHERE \`key\` REGEXP '(meta|:meta:|\\\\.meta\\\\.)' GROUP BY prefix`,
    hint: "Sudah dipindah ke kolom tabel; sisa JSON lama bisa jadi sumber data ganda.",
  },
];

function toPlain(v: unknown): unknown {
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v && typeof v === "object" && "toNumber" in (v as any)) return (v as any).toNumber();
  return v;
}

async function main() {
  const db = await prisma.$queryRawUnsafe<Array<{ db: string }>>("SELECT DATABASE() AS db");
  console.log(`\nAudit data (read-only) — database: ${db[0]?.db}\n`);
  let problems = 0;
  let lastGroup = "";
  for (const c of checks) {
    if (c.group !== lastGroup) {
      console.log(`\n=== ${c.group} ===`);
      lastGroup = c.group;
    }
    try {
      let rows = (await prisma.$queryRawUnsafe<any[]>(c.sql)).map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, toPlain(v)])),
      );
      // Cek agregat "jumlah" bernilai 0 dianggap bersih.
      rows = rows.filter((r) => !("jumlah" in r) || Number(r.jumlah) > 0);
      if (!rows.length) {
        console.log(`  ✔ ${c.name}`);
        continue;
      }
      problems++;
      console.log(`  ✘ ${c.name} — ${rows.length} temuan`);
      for (const r of rows.slice(0, 10)) console.log(`      ${JSON.stringify(r)}`);
      if (rows.length > 10) console.log(`      ... +${rows.length - 10} lagi`);
      if (c.hint) console.log(`      → ${c.hint}`);
    } catch (e) {
      console.log(`  ? ${c.name} — gagal dicek: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  console.log(`\nSelesai: ${problems} jenis masalah dari ${checks.length} pengecekan. Tidak ada data yang diubah.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
