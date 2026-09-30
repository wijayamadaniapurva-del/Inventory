"use client";

import Link from "next/link";
import { PAGE_SIZE } from "@/lib/pagination";

/**
 * Builds a compact page list: always the first and last page, plus a
 * window around the current one. "gap" renders as an ellipsis, so 30
 * pages never turn into 30 buttons.
 */
function pageItems(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const items: (number | "gap")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) items.push("gap");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < pageCount - 1) items.push("gap");
  items.push(pageCount);

  return items;
}

function rangeLabel(page: number, pageCount: number, total: number, pageSize: number) {
  if (total === 0) return "Tidak ada data";
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return `${from}–${to} dari ${total}`;
}

const NAV_BTN =
  "!h-8 !min-w-8 !px-2 !text-xs disabled:!opacity-40 disabled:!cursor-not-allowed";
const NUM_BTN = "!h-8 !min-w-8 !px-2 !text-xs";
const NUM_ACTIVE = "!border-accent-600 !bg-accent-50 !text-accent-700 font-medium";

function Shell({
  page,
  pageCount,
  total,
  pageSize,
  children,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  children: React.ReactNode;
}) {
  // A single page of results needs no controls, but the count is still
  // useful, so only the buttons are dropped.
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 px-4 py-2">
      <span className="text-xs text-stone-500">{rangeLabel(page, pageCount, total, pageSize)}</span>
      {pageCount > 1 && <div className="flex flex-wrap items-center gap-1">{children}</div>}
    </div>
  );
}

/** Paging for lists held in client state — Stok, Master Data, and friends. */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize = PAGE_SIZE,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <Shell page={page} pageCount={pageCount} total={total} pageSize={pageSize}>
      <button type="button" className={NAV_BTN} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        ‹
      </button>
      {pageItems(page, pageCount).map((item, idx) =>
        item === "gap" ? (
          <span key={`gap-${idx}`} className="px-1 text-xs text-stone-400">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            className={NUM_BTN + (item === page ? " " + NUM_ACTIVE : "")}
          >
            {item}
          </button>
        ),
      )}
      <button type="button" className={NAV_BTN} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        ›
      </button>
    </Shell>
  );
}

/**
 * Paging for server-rendered lists (Riwayat, Job Order, Scalev Log).
 * The page lives in the URL so filters, refresh, and the back button
 * all keep working. `params` carries the other active query params
 * (filters) so they survive a page change.
 */
export function PaginationLinks({
  page,
  pageCount,
  total,
  pageSize = PAGE_SIZE,
  basePath,
  params = {},
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize?: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  function hrefFor(target: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const disabled = "!h-8 !min-w-8 !px-2 !text-xs !opacity-40 !cursor-not-allowed inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white";
  const navLink = "!h-8 !min-w-8 !px-2 !text-xs inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50";

  return (
    <Shell page={page} pageCount={pageCount} total={total} pageSize={pageSize}>
      {page <= 1 ? (
        <span className={disabled}>‹</span>
      ) : (
        <Link href={hrefFor(page - 1)} className={navLink}>
          ‹
        </Link>
      )}
      {pageItems(page, pageCount).map((item, idx) =>
        item === "gap" ? (
          <span key={`gap-${idx}`} className="px-1 text-xs text-stone-400">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item)}
            className={navLink + (item === page ? " !border-accent-600 !bg-accent-50 !text-accent-700 font-medium" : "")}
          >
            {item}
          </Link>
        ),
      )}
      {page >= pageCount ? (
        <span className={disabled}>›</span>
      ) : (
        <Link href={hrefFor(page + 1)} className={navLink}>
          ›
        </Link>
      )}
    </Shell>
  );
}
