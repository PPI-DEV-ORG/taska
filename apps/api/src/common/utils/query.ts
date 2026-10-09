import type { PageQuery } from "../dto/page-query.js";

type Where = Record<string, unknown>;

/** WHERE pencarian teks bebas pada beberapa kolom + filter tambahan. */
export function searchWhere(
  q: PageQuery,
  fields: Array<[string, "contains" | "equals"]>,
  extra: Where = {},
): Where {
  const where: Where = { ...extra };
  if (q.q) {
    where.OR = fields.map(([field, mode]) => ({ [field]: { [mode]: q.q } }));
  }
  return where;
}

/** ORDER BY aman: hanya kolom yang diizinkan. */
export function orderBy(sort: string | undefined, dir: "asc" | "desc", allowed: string[], fallback: string) {
  const key = sort && allowed.includes(sort) ? sort : fallback;
  return { [key]: dir } as Record<string, "asc" | "desc">;
}

export function pageSkip(q: PageQuery) {
  return { skip: (q.page - 1) * q.limit, take: q.limit };
}
