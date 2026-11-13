/**
 * Backup database ke satu file .sql (struktur + isi), tanpa perlu mysqldump.
 *
 *   pnpm --filter api db:backup                  -> backups/taska-YYYYMMDD-HHMMSS.sql
 *
 * Pulihkan dengan klien MySQL apa pun:  mysql -u <user> -p <db> < backups/taska-....sql
 * (file ini men-DROP lalu membuat ulang setiap tabel).
 */
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url) });
dotenv.config();
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL tidak di-set");
const u = new URL(url);
if (!u.searchParams.has("allowPublicKeyRetrieval")) u.searchParams.set("allowPublicKeyRetrieval", "true");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(u.toString()) });

const pad = (n: number) => String(n).padStart(2, "0");

function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "NULL";
    const s = `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}.${String(v.getUTCMilliseconds()).padStart(3, "0")}`;
    return `'${s}'`;
  }
  if (v instanceof Uint8Array) return `0x${Buffer.from(v).toString("hex") || "00"}`;
  if (typeof v === "object" && v && "toFixed" in (v as any) && "toNumber" in (v as any)) return String(v);
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\0/g, "\\0")}'`;
}

async function main() {
  const [{ db }] = await prisma.$queryRawUnsafe<Array<{ db: string }>>("SELECT DATABASE() AS db");
  const tables = (await prisma.$queryRawUnsafe<Array<Record<string, string>>>("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")).map(
    (r) => Object.values(r)[0]!,
  );
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${db}-${stamp}.sql`);
  const out = fs.createWriteStream(file, "utf8");
  out.write(`-- Backup ${db} ${now.toISOString()}\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET time_zone='+00:00';\n\n`);
  // Ambil tanggal sebagai UTC agar sama persis saat dipulihkan
  await prisma.$executeRawUnsafe("SET time_zone = '+00:00'");

  let totalRows = 0;
  for (const t of tables) {
    const [create] = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(`SHOW CREATE TABLE \`${t}\``);
    out.write(`DROP TABLE IF EXISTS \`${t}\`;\n${create!["Create Table"]};\n`);
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM \`${t}\``);
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const cols = Object.keys(chunk[0]!).map((c) => `\`${c}\``).join(", ");
      const values = chunk.map((r) => `(${Object.values(r).map(sqlValue).join(", ")})`).join(",\n");
      out.write(`INSERT INTO \`${t}\` (${cols}) VALUES\n${values};\n`);
    }
    out.write("\n");
    totalRows += rows.length;
    console.log(`  ${t}: ${rows.length} baris`);
  }
  out.write("SET FOREIGN_KEY_CHECKS=1;\n");
  await new Promise<void>((res) => out.end(res));
  console.log(`\nBackup selesai: ${file}\n${tables.length} tabel, ${totalRows} baris.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
