export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T, S = Record<string, unknown>> {
  items: T[];
  meta: PaginationMeta;
  summary?: S;
}

export interface ParsedPaginatedResult<T, S = Record<string, unknown>> {
  items: T[];
  meta: PaginationMeta;
  summary?: S;
  isServerPaginated: boolean;
}

export function createEmptyMeta(limit = 10): PaginationMeta {
  return {
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };
}

/**
 * Normalizes paginated API envelopes (`{ items, meta, summary }`) while staying
 * compatible with plain unpaginated array payloads returned by legacy mocks.
 */
export function parsePaginatedResponse<T, S = Record<string, unknown>>(
  data: unknown,
  fallbackLimit = 10
): ParsedPaginatedResult<T, S> {
  if (Array.isArray(data)) {
    const total = data.length;
    const safeLimit = Math.max(1, fallbackLimit);
    return {
      items: data as T[],
      meta: {
        page: 1,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        hasNextPage: false,
        hasPrevPage: false,
      },
      isServerPaginated: false,
    };
  }

  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    const obj = data as PaginatedResponse<T, S>;
    const limit = Math.max(1, Number(obj.meta?.limit ?? fallbackLimit) || fallbackLimit);
    const total = Math.max(0, Number(obj.meta?.total ?? obj.items.length) || 0);
    const totalPages = Math.max(1, Number(obj.meta?.totalPages ?? Math.ceil(total / limit)) || 1);
    const page = Math.min(Math.max(1, Number(obj.meta?.page ?? 1) || 1), totalPages);
    return {
      items: obj.items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: obj.meta?.hasNextPage ?? page < totalPages,
        hasPrevPage: obj.meta?.hasPrevPage ?? page > 1,
      },
      summary: obj.summary,
      isServerPaginated: true,
    };
  }

  return {
    items: [],
    meta: createEmptyMeta(fallbackLimit),
    isServerPaginated: false,
  };
}
