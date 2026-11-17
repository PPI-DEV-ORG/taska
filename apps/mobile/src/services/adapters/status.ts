import { toEnum } from "./status-maps";

const STATUS_REASON_MODULES = new Set([
  "expenses",
  "purchase-requests",
  "delivery-notes",
  "opname",
  "damage-reports",
]);

/** Mutasi status: UI label → body untuk endpoint status. */
export function buildStatusBody(
  module: string,
  uiStatus: string,
  note?: string,
  extra?: Record<string, any>,
): Record<string, any> {
  const enumVal = toEnum(module, uiStatus);
  const field = STATUS_REASON_MODULES.has(module) ? "reason" : "note";
  const base =
    note !== undefined
      ? { status: enumVal, [field]: note }
      : { status: enumVal };
  return extra ? { ...base, ...extra } : base;
}

export function statusEnumFor(module: string, uiStatus: string): string {
  return toEnum(module, uiStatus);
}
