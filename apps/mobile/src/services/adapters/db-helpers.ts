export function parseTagInput(
  tagInput: string,
): { itemName: string; price?: number }[] {
  if (!tagInput || typeof tagInput !== "string") return [];
  return tagInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split(":");
      const itemName = parts[0]?.trim() || "";
      const priceNum = parts[1]
        ? Number(parts[1].replace(/[^\d.-]/g, ""))
        : undefined;
      return {
        itemName,
        price: priceNum && !Number.isNaN(priceNum) ? priceNum : undefined,
      };
    })
    .filter((t) => t.itemName.length > 0);
}

export function findId(list: any[] | undefined, val: any): number | undefined {
  if (val == null || val === "" || val === "-") return undefined;
  const sVal = String(val).trim();
  if (!sVal) return undefined;
  if (Array.isArray(list)) {
    const cleanVal = (sVal.split("(")[0] ?? sVal).trim().toLowerCase();
    const cleanValDash = (sVal.split(" - ")[0] ?? sVal).trim().toLowerCase();
    const cleanValDot = (sVal.split(" · ")[0] ?? sVal).trim().toLowerCase();
    const match = list.find((r) => {
      const candidates = [r.nama, r.name, r.nomor, r.number, r.sku].filter(
        Boolean,
      );
      return candidates.some((c) => {
        const sc = String(c).trim().toLowerCase();
        return (
          sc === sVal.toLowerCase() ||
          sc === cleanVal ||
          sc === cleanValDash ||
          sc === cleanValDot
        );
      });
    });
    if (match?.id != null) return Number(match.id);
  }
  const numVal = Number(sVal);
  if (!Number.isNaN(numVal) && numVal > 0 && /^\d+$/.test(sVal)) return numVal;
  return undefined;
}

export function resolveMemberIds(
  row: Record<string, any>,
  db?: Record<string, any>,
): number[] | undefined {
  if (Array.isArray(row.memberIds))
    return row.memberIds.map(Number).filter((x) => !Number.isNaN(x) && x > 0);
  if (row.tim !== undefined) {
    const timStr = String(row.tim || "").trim();
    if (!timStr || timStr === "-") return [];
    const names = timStr
      .split(",")
      .map((s) => (s.split("(")[0] ?? "").trim().toLowerCase())
      .filter(Boolean);
    const usersList = db?.users && db.users.length > 0 ? db.users : [];
    const ids = usersList
      .filter((u: any) =>
        names.includes(
          String(u.name ?? u.nama ?? "")
            .trim()
            .toLowerCase(),
        ),
      )
      .map((u: any) => Number(u.id))
      .filter((x: number) => !Number.isNaN(x) && x > 0);
    return ids;
  }
  return undefined;
}

// ─── create DTO builders (UI row → backend body) ───
