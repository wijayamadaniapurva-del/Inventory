"use client";

import { useRef } from "react";
import { CATEGORY_LABEL, LOCATION_LABEL } from "@/lib/utils";

/**
 * Filter bar for Riwayat.
 *
 * Still a plain GET form, so the filters stay in the URL and the back
 * button keeps working. The dropdowns and the date just submit it
 * themselves on change — only the free-text search still needs the
 * button (or Enter), since submitting on every keystroke would reload
 * the page mid-word.
 */
export function RiwayatFilters({
  kategori = "",
  lokasi = "",
  tanggal = "",
  q = "",
}: {
  kategori?: string;
  lokasi?: string;
  tanggal?: string;
  q?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  function submitNow() {
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} className="flex flex-wrap gap-2" method="get">
      {/* Any page number in the URL belongs to the previous filter, so
          changing a filter starts again at page 1 (no hidden page field). */}
      <select name="kategori" defaultValue={kategori} onChange={submitNow} className="w-40">
        <option value="">Semua kategori</option>
        {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <select name="lokasi" defaultValue={lokasi} onChange={submitNow} className="w-44">
        <option value="">Semua lokasi</option>
        {Object.entries(LOCATION_LABEL).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <input type="date" name="tanggal" defaultValue={tanggal} onChange={submitNow} className="w-40" />
      <input
        type="text"
        name="q"
        placeholder="Cari SKU atau item"
        defaultValue={q}
        className="flex-1 min-w-[160px]"
      />
      <button type="submit" className="btn-primary">
        Cari
      </button>
    </form>
  );
}
