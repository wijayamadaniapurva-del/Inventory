// Shared paging rules for every list in the app, so "20 per halaman"
// lives in exactly one place.
export const PAGE_SIZE = 20;

export function pageCountOf(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

// Clamps whatever came in from the URL (?page=abc, ?page=0, ?page=999)
// to a page that actually exists.
export function parsePage(raw: string | undefined, pageCount: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), pageCount);
}

export function slicePage<T>(rows: T[], page: number, pageSize: number = PAGE_SIZE): T[] {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}
