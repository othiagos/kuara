import { Prisma } from "@prisma/client";
import { normalizeText } from "./presenters";

export interface PaginationParams {
  isPaginated: boolean;
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T, S = Record<string, any>> {
  items: T[];
  meta: PaginationMeta;
  summary?: S;
}

export function parsePagination(
  query: Record<string, any>,
  defaultLimit = 10,
  maxLimit = 50
): PaginationParams {
  const isPaginated =
    query.page !== undefined ||
    query.limit !== undefined ||
    query.paginated === "true" ||
    query.scope !== undefined;

  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(maxLimit, Math.floor(rawLimit))
      : defaultLimit;

  return {
    isPaginated,
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

const ACCENT_SOURCE = "áàâãäéèêëíìîïóòôõöúùûüçñ";
const ACCENT_TARGET = "aaaaaeeeeiiiiooooouuuucn";

export function pgUnaccentSql(expr: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`translate(lower(${expr}), ${ACCENT_SOURCE}, ${ACCENT_TARGET})`;
}

export function normalizeSqlLikePattern(value: string): string {
  return `%${normalizeText(value)}%`;
}
