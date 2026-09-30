"use client";

import { useState } from "react";
import type { CurrentStockRow, ItemCategory } from "@/lib/types";
import type { ExpiryBatch } from "@/lib/fefo";
import { CATEGORY_LABEL, formatCurrency, formatQty } from "@/lib/utils";
import { computeSafetyStock } from "@/lib/safety-stock";
import { ExportExcelButton } from "@/components/export-excel-button";
import { Pagination } from "@/components/pagination";
import { usePaged } from "@/lib/use-paged";

const CATEGORIES: ItemCategory[] = ["bahan_baku", "packaging", "fg"];
type TabValue = ItemCategory | "all";
type LokasiValue = "all" | "gudang_l2" | "gudang_l1";

const LOKASI_OPTIONS: { value: LokasiValue; label: string }[] = [
  { value: "all", label: "Semua Lokasi" },
  { value: "gudang_l2", label: "Gudang L2" },
  { value: "gudang_l1", label: "Gudang L1" },
];

// One visual line in the table. In "Semua Lokasi" an item can produce
// several lines (one per expiry date, FEFO estimate); in L2/L1 it's
// always exactly one line.
interface DisplayLine {
  qty: number;
  expiry_date: string | null;
}

// expiry_date is a plain date ("YYYY-MM-DD"), not a timestamp — format it
// as-is in UTC so it never shifts a day because of the browser timezone.
function formatExpiry(d: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d + "T00:00:00Z"));
}

export function StockTable({
  rows,
  expiryBatches,
  bufferPercent,
}: {
  rows: CurrentStockRow[];
  expiryBatches: Record<string, ExpiryBatch[]>;
  bufferPercent: number;
}) {
  const [tab, setTab] = useState<TabValue>("all");
  const [lokasi, setLokasi] = useState<LokasiValue>("all");
  const isFg = tab === "fg";
  const isAll = tab === "all";
  const allLokasi = lokasi === "all";

  function linesFor(r: CurrentStockRow): DisplayLine[] {
    if (lokasi === "gudang_l2") return [{ qty: r.qty_gudang_l2, expiry_date: null }];
    if (lokasi === "gudang_l1") return [{ qty: r.qty_gudang_l1, expiry_date: null }];
    const batches = expiryBatches[r.item_id] ?? [];
    // No batches (stock 0, or nothing reconstructable) → still show the
    // item once, with the view's total so the row never disappears.
    return batches.length > 0 ? batches : [{ qty: r.qty_on_hand, expiry_date: null }];
  }

  function lokasiQty(r: CurrentStockRow): number {
    if (lokasi === "gudang_l2") return r.qty_gudang_l2;
    if (lokasi === "gudang_l1") return r.qty_gudang_l1;
    return r.qty_on_hand;
  }

  const filtered = isAll ? rows : rows.filter((r) => r.category === tab);
  // Paged by item, not by line: in "Semua Lokasi" one item can occupy
  // several lines, but a page always holds 20 items.
  const { page, setPage, pageCount, pageRows, total } = usePaged(filtered, `${tab}|${lokasi}`);
  const totalValue = filtered.reduce((sum, r) => sum + lokasiQty(r) * r.default_price, 0);
  const grandTotal = rows.reduce((sum, r) => sum + lokasiQty(r) * r.default_price, 0);
  const lokasiLabel = LOKASI_OPTIONS.find((o) => o.value === lokasi)!.label;

  // Export follows the active Lokasi filter (all categories, like before).
  // Every Excel row is complete — no blanked cells — so it can still be
  // sorted/filtered in Excel.
  const exportRows = rows.flatMap((r) =>
    linesFor(r).map((line) => ({
      Kategori: CATEGORY_LABEL[r.category],
      "Nama item": r.name,
      ...(allLokasi ? { Kadaluarsa: line.expiry_date ?? "" } : {}),
      [`Stok (${lokasiLabel})`]: line.qty,
      Satuan: r.unit,
      "Tag BPOM": r.category === "fg" ? (r.bpom_tag === "bpom" ? "BPOM" : "Non-BPOM") : "",
      Harga: r.default_price,
      Nilai: line.qty * r.default_price,
    })),
  );

  const cols = [
    isAll ? "90px" : null,
    "1fr",
    allLokasi ? "110px" : null,
    "110px",
    isFg ? "90px" : null,
    "110px",
    "130px",
  ]
    .filter(Boolean)
    .join(" ");

  function belowSafety(r: CurrentStockRow) {
    const threshold = computeSafetyStock(r.avg_daily_usage, r.lead_time_days, bufferPercent);
    return threshold !== null && r.qty_on_hand < threshold;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setTab("all")} className={isAll ? "!border-accent-600 !bg-accent-50 !text-accent-700" : ""}>
            Semua
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={tab === c ? "!border-accent-600 !bg-accent-50 !text-accent-700" : ""}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
          <select
            aria-label="Lokasi"
            value={lokasi}
            onChange={(e) => setLokasi(e.target.value as LokasiValue)}
            className="!w-auto"
          >
            {LOKASI_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-stone-500">
            {isAll ? "Total nilai keseluruhan" : "Total nilai"}:{" "}
            <span className="figure font-medium text-stone-800">{formatCurrency(isAll ? grandTotal : totalValue)}</span>
          </p>
          <ExportExcelButton
            rows={exportRows}
            filename={allLokasi ? "stok-purvu.xlsx" : `stok-purvu-${lokasi.replace("gudang_", "")}.xlsx`}
            sheetName="Stok"
          />
        </div>
      </div>
      {allLokasi && (
        <p className="mb-2 text-xs text-stone-400">
          Rincian per tanggal kadaluarsa adalah estimasi FEFO (Gudang L1 + L2 digabung).
        </p>
      )}

      <div className="card !p-0 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500" style={{ gridTemplateColumns: cols }}>
            {isAll && <span>Kategori</span>}
            <span>Nama item</span>
            {allLokasi && <span>Kadaluarsa</span>}
            <span>Stok</span>
            {isFg && <span>Tag BPOM</span>}
            <span>Harga</span>
            <span>Nilai</span>
          </div>

          {pageRows.map((r) => {
            const flag = belowSafety(r);
            const lines = linesFor(r);
            return (
              <div key={r.item_id} className="border-b border-stone-100 last:border-0">
                {lines.map((line, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <div
                      key={idx}
                      className={
                        "grid items-center gap-2 py-2.5 text-sm " +
                        // Continuation lines: repeated cells blanked, marker
                        // line on the left (2px border + 14px padding keeps
                        // text aligned with the first line's 16px padding).
                        (isFirst ? "px-4" : "border-l-2 border-accent-200 pl-[14px] pr-4 !pt-0")
                      }
                      style={{ gridTemplateColumns: cols }}
                    >
                      {isAll && <span className="text-stone-500">{isFirst ? CATEGORY_LABEL[r.category] : ""}</span>}
                      <span>{isFirst ? r.name : ""}</span>
                      {allLokasi && (
                        <span className={"figure " + (line.expiry_date ? "" : "text-stone-400")}>
                          {line.expiry_date ? formatExpiry(line.expiry_date) : "—"}
                        </span>
                      )}
                      <span className={"figure " + (flag ? "text-red-600 font-medium" : "")}>{formatQty(line.qty, r.unit)}</span>
                      {isFg && (
                        <span>
                          {isFirst && r.category === "fg" && (
                            <span className={"badge w-fit " + (r.bpom_tag === "bpom" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                              {r.bpom_tag === "bpom" ? "BPOM" : "Non-BPOM"}
                            </span>
                          )}
                        </span>
                      )}
                      <span className="figure text-stone-500">{isFirst ? formatCurrency(r.default_price) : ""}</span>
                      <span className="figure">{formatCurrency(line.qty * r.default_price)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {filtered.length === 0 && <p className="px-4 py-6 text-sm text-stone-400">Belum ada item di kategori ini.</p>}

          {filtered.length > 0 && (
            <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />
          )}
        </div>
      </div>
    </div>
  );
}
