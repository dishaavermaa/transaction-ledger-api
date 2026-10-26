import { z } from 'zod';

/**
 * Builds the pagination query schema. `limit` is capped at the configured
 * maximum; out-of-range or non-integer values are rejected (422) rather than
 * silently clamped, so clients get clear feedback.
 */
export function paginationQuerySchema(maxPageSize: number) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(maxPageSize).default(20),
  });
}

export interface PaginationMeta {
  current_page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  totalRecords: number,
): PaginationMeta {
  return {
    current_page: page,
    page_size: limit,
    total_records: totalRecords,
    total_pages: totalRecords === 0 ? 0 : Math.ceil(totalRecords / limit),
  };
}
