"use client";

import { useEffect, useState } from "react";
import { PAGE_SIZE, pageCountOf, slicePage } from "@/lib/pagination";

/**
 * Client-side paging for lists that are already fully loaded in the
 * browser (Stok, Master Data, Safety Stock, ...).
 *
 * `resetKey` is whatever the active filter is — tab, category, month.
 * When it changes the list jumps back to page 1, so you never land on
 * an empty page 4 after switching to a category that has 12 items.
 */
export function usePaged<T>(rows: T[], resetKey: string, pageSize: number = PAGE_SIZE) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const pageCount = pageCountOf(rows.length, pageSize);
  // Guard against the list shrinking under us (item archived on the
  // last page) before the state update lands.
  const safePage = Math.min(page, pageCount);

  return {
    page: safePage,
    setPage,
    pageCount,
    pageRows: slicePage(rows, safePage, pageSize),
    total: rows.length,
    pageSize,
  };
}
