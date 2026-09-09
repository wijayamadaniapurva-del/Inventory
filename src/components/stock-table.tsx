"use client";

import { useState } from "react";
import type { CurrentStockRow, ItemCategory } from "@/lib/types";
import { CATEGORY_LABEL, formatCurrency, formatQty } from "@/lib/utils";
import { computeSafetyStock } from "@/lib/safety-stock";
import { ExportExcelButton } from "@/components/export-excel-button";

const CATEGORIES: ItemCategory[] = ["bahan_baku", "packaging", "fg"];
type TabValue = ItemCategory | "all";

export function StockTable({ rows, bufferPercent }: { rows: CurrentStockRow[]; bufferPercent: number }) {
  const [tab, setTab] = useState<TabValue>("all");
  const isFg = tab === "fg";
  const isAll = tab === "all";

  const filtered = isAll ? rows : rows.filter((r) => r.category === tab);
  const totalValue = filtered.reduce((sum, r) => sum + r.qty_on_hand * r.default_price, 0);
  const grandTotal = rows.reduce((sum, r) => sum + r.qty_on_hand * r.default_price, 0);

  const exportRows = rows.map((r) => ({
    Kategori: CATEGORY_LABEL[r.category],
    "Nama item": r.name,
    Stok: r.qty_on_hand,
    Satuan: r.unit,
    "Tag BPOM": r.category === "fg" ? (r.bpom_tag === "bpom" ? "BPOM" : "Non-BPOM") : "",
    Harga: r.default_price,
    Nilai: r.qty_on_hand * r.default_price,
  }));

  const cols = isAll
    ? "100px 1fr 110px 110px 130px"
    : isFg
      ? "1fr 90px 110px 110px 130px"
      : "1fr 110px 110px 130px";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
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
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-stone-500">
            {isAll ? "Total nilai keseluruhan" : "Total nilai"}:{" "}
            <span className="figure font-medium text-stone-800">{formatCurrency(isAll ? grandTotal : totalValue)}</span>
          </p>
          <ExportExcelButton rows={exportRows} filename="stok-purvu.xlsx" sheetName="Stok" />
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="grid gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500" style={{ gridTemplateColumns: cols }}>
          {isAll && <span>Kategori</span>}
          <span>Nama item</span>
          <span>Stok</span>
          {isFg && <span>Tag BPOM</span>}
          <span>Harga</span>
          <span>Nilai</span>
        </div>

        {filtered.map((r) => (
          <div key={r.item_id} className="grid items-center gap-2 border-b border-stone-100 px-4 py-2.5 text-sm last:border-0" style={{ gridTemplateColumns: cols }}>
            {isAll && <span className="text-stone-500">{CATEGORY_LABEL[r.category]}</span>}
            <span>{r.name}</span>
            <span className={"figure " + (computeSafetyStock(r.avg_daily_usage, r.lead_time_days, bufferPercent) !== null && r.qty_on_hand < (computeSafetyStock(r.avg_daily_usage, r.lead_time_days, bufferPercent) as number) ? "text-red-600 font-medium" : "")}>
              {formatQty(r.qty_on_hand, r.unit)}
            </span>
            {isFg && r.category === "fg" && (
              <span className={"badge " + (r.bpom_tag === "bpom" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                {r.bpom_tag === "bpom" ? "BPOM" : "Non-BPOM"}
              </span>
            )}
            <span className="figure text-stone-500">{formatCurrency(r.default_price)}</span>
            <span className="figure">{formatCurrency(r.qty_on_hand * r.default_price)}</span>
          </div>
        ))}

        {filtered.length === 0 && <p className="px-4 py-6 text-sm text-stone-400">Belum ada item di kategori ini.</p>}
      </div>
    </div>
  );
}
