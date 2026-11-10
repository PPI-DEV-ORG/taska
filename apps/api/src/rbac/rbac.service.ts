import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { RequestUser } from "../common/decorators/current-user.decorator.js";
import type { Role } from "../generated/prisma/client.js";
import { MODULE_KEYS, PERMISSIONS, actionsOf, setRuntimePermissions, type ModuleKey } from "./permissions.js";
import { ACTION_LABEL, MODULE_META, ROLE_LABEL, normalizeActions } from "./rbac-meta.js";

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "BOS", "SALES", "PM", "TEKNISI", "PROCUREMENT", "FINANCE", "GUDANG", "SE", "HR"];
const META_BY_KEY = new Map(MODULE_META.map((m) => [m.key, m]));

/** Matriks bawaan untuk satu peran, semua modul (kosong bila tidak punya). */
function defaultsFor(role: string): Record<string, string> {
  const table = PERMISSIONS[role] ?? {};
  return Object.fromEntries(MODULE_KEYS.map((m) => [m, normalizeDefault(table[m] ?? "")]));
}
function normalizeDefault(s: string) {
  // bawaan boleh berisi huruf yang tidak dipakai (mis. A pada modul biasa); simpan apa adanya agar perilaku lama tidak berubah
  return [...new Set(s.split(""))].join("");
}

@Injectable()
export class RbacService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RbacService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedMissing();
      await this.reload();
    } catch (e) {
      // Tanpa tabel (belum migrasi) sistem tetap jalan dengan matriks bawaan.
      this.logger.warn(`RBAC memakai matriks bawaan: ${(e as Error).message}`);
    }
    // Instance lain bisa mengubah hak akses; muat ulang berkala.
    this.timer = setInterval(() => void this.reload().catch(() => undefined), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Isi baris yang belum ada dari matriks bawaan. Tidak pernah menimpa pengaturan yang sudah diubah. */
  private async seedMissing() {
    const existing = await this.prisma.main.rolePermission.findMany({ select: { role: true, module: true } });
    const have = new Set(existing.map((r) => `${r.role}:${r.module}`));
    const rows: { role: Role; module: string; actions: string }[] = [];
    for (const role of ROLES) {
      const d = defaultsFor(role);
      for (const m of MODULE_KEYS) if (!have.has(`${role}:${m}`)) rows.push({ role, module: m, actions: d[m] ?? "" });
    }
    if (rows.length) await this.prisma.main.rolePermission.createMany({ data: rows, skipDuplicates: true });
  }

  /** Muat dari database ke cache yang dipakai guard. */
  async reload() {
    const rows = await this.prisma.main.rolePermission.findMany();
    const map: Record<string, Partial<Record<ModuleKey, string>>> = {};
    for (const r of rows) {
      if (!META_BY_KEY.has(r.module as ModuleKey) && !MODULE_KEYS.includes(r.module as ModuleKey)) continue;
      (map[r.role] ??= {})[r.module as ModuleKey] = r.actions;
    }
    setRuntimePermissions(map);
  }

  private assertRole(role: string): Role {
    const up = String(role ?? "").toUpperCase() as Role;
    if (!ROLES.includes(up)) throw new NotFoundException(`Peran ${role} tidak dikenal`);
    return up;
  }

  /** Hak akses efektif milik user yang sedang login (dipakai mobile untuk menu & tombol). */
  forUser(user: RequestUser) {
    const role = String(user.role ?? "").toUpperCase();
    const permissions: Record<string, string> = {};
    for (const m of MODULE_KEYS) permissions[m] = role === "SUPER_ADMIN" ? "LCUA" : actionsOf(role, m);
    return { role, permissions };
  }

  /** Matriks lengkap untuk layar pengaturan. */
  async matrix() {
    const roles = ROLES.map((r) => ({
      role: r,
      label: ROLE_LABEL[r] ?? r,
      locked: r === "SUPER_ADMIN",
      permissions: Object.fromEntries(MODULE_KEYS.map((m) => [m, r === "SUPER_ADMIN" ? "LCUA" : actionsOf(r, m)])),
      defaults: r === "SUPER_ADMIN" ? Object.fromEntries(MODULE_KEYS.map((m) => [m, "LCUA"])) : defaultsFor(r),
    }));
    return { actions: ACTION_LABEL, modules: MODULE_META, roles };
  }

  async updateRole(role: string, input: Record<string, string>, actor: RequestUser) {
    this.assertSuperAdmin(actor);
    const r = this.assertRole(role);
    if (r === "SUPER_ADMIN") throw new BadRequestException("Hak akses Super Admin selalu penuh dan tidak bisa diubah");
    if (!input || typeof input !== "object") throw new BadRequestException("Data hak akses tidak valid");

    const changes: { module: ModuleKey; before: string; after: string }[] = [];
    for (const [key, value] of Object.entries(input)) {
      const meta = META_BY_KEY.get(key as ModuleKey);
      if (!meta) throw new BadRequestException(`Modul "${key}" tidak dikenal`);
      const before = actionsOf(r, meta.key);
      // Huruf aksi yang tidak dipakai modul ini dibuang, tetapi aksi bawaan yang tidak ditampilkan dipertahankan
      // agar perilaku yang sudah ada tidak berubah diam-diam.
      const hidden = before.split("").filter((c) => !meta.actions.includes(c as never)).join("");
      const after = normalizeActions(String(value ?? ""), meta.actions) + hidden;
      if (after !== before) changes.push({ module: meta.key, before, after });
    }
    if (!changes.length) return this.matrix();

    await this.prisma.main.$transaction(
      changes.map((c) =>
        this.prisma.main.rolePermission.upsert({
          where: { role_module: { role: r, module: c.module } },
          update: { actions: c.after, updatedById: actor.id },
          create: { role: r, module: c.module, actions: c.after, updatedById: actor.id },
        }),
      ),
    );
    await this.reload();
    await this.audit.log({
      actor,
      action: "UBAH_HAK_AKSES",
      entityType: "rbac",
      entityId: 0,
      detail: `${ROLE_LABEL[r] ?? r}: ${changes.map((c) => `${META_BY_KEY.get(c.module)?.label ?? c.module} ${c.before || "-"}→${c.after || "-"}`).join("; ")}`.slice(0, 1800),
    });
    return this.matrix();
  }

  async resetRole(role: string, actor: RequestUser) {
    this.assertSuperAdmin(actor);
    const r = this.assertRole(role);
    if (r === "SUPER_ADMIN") throw new BadRequestException("Hak akses Super Admin selalu penuh dan tidak bisa diubah");
    const d = defaultsFor(r);
    await this.prisma.main.$transaction(
      MODULE_KEYS.map((m) =>
        this.prisma.main.rolePermission.upsert({
          where: { role_module: { role: r, module: m } },
          update: { actions: d[m] ?? "", updatedById: actor.id },
          create: { role: r, module: m, actions: d[m] ?? "", updatedById: actor.id },
        }),
      ),
    );
    await this.reload();
    await this.audit.log({
      actor,
      action: "RESET_HAK_AKSES",
      entityType: "rbac",
      entityId: 0,
      detail: `${ROLE_LABEL[r] ?? r} dikembalikan ke pengaturan bawaan`,
    });
    return this.matrix();
  }

  assertSuperAdmin(user: RequestUser) {
    if (String(user?.role ?? "").toUpperCase() !== "SUPER_ADMIN") {
      throw new ForbiddenException("Hanya Super Admin yang dapat mengatur hak akses");
    }
  }
}
