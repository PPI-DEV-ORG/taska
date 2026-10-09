import { ForbiddenException } from "@nestjs/common";
import type { RequestUser } from "../decorators/current-user.decorator.js";

/**
 * Cek kepemilikan (PRD #17): hanya Admin, atau pemilik record, yang boleh
 * mengubah data ber-scoping "miliknya sendiri".
 */
export function assertOwner(user: RequestUser, record: Record<string, unknown>, fields: string[]): void {
  if (user.role === "ADMIN") return;
  const owned = fields.some((f) => Number(record[f]) === user.id);
  if (!owned) throw new ForbiddenException("Hanya pemilik data yang boleh mengubahnya");
}

/** Daftar id milik user untuk filter "milik sendiri" pada list. */
export function ownerFilter(user: RequestUser, fields: string[]): Record<string, number> {
  if (user.role === "ADMIN" || user.role === "BOS") return {};
  const f = fields[0];
  return { [f]: user.id };
}
