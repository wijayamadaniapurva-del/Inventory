"use client";

import { useState } from "react";
import type { CurrentStockRow, ItemCategory } from "@/lib/types";
import { CATEGORY_LABEL, formatCurrency, formatQty } from "@/lib/utils";

const CATEGORIES: ItemCategory[] = ["bahan_baku", "packaging", "fg"];

export function StockTable({ rows }: { rows: CurrentStockRow[] }) {
  const [category, setCategory] = useState<ItemCategory>("bahan_baku");
  const isFg = category === "fg";

  const filtered = rows.filter((r) => r.category === category);
  const totalValue = filtered.reduce((sum, r) => sum + r.qty_on_hand * r.default_price, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={category === c ? "!border-accent-600 !bg-accent-50 !text-accent-700" : ""}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <p className="text-sm text-stone-500">
          Total nilai: <span className="figure font-medium text-stone-800">{formatCurrency(totalValue)}</span>
        </p>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div
          className="grid gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500"
          style={{ gridTemplateColumns: isFg ? "1fr 90px 110px 110px 130px" : "1fr 110px 110px 130px" }}
        >
          <span>Nama item</span>
          <span>Stok</span>
          {isFg && <span>Tag BPOM</span>}
          <span>Harga</span>
          <span>Nilai</span>
        </div>

        {filtered.map((r) => (
          <div
            key={r.item_id}
            className="grid items-center gap-2 border-b border-stone-100 px-4 py-2.5 text-sm last:border-0"
            style={{ gridTemplateColumns: isFg ? "1fr 90px 110px 110px 130px" : "1fr 110px 110px 130px" }}
          >
            <span>{r.name}</span>
            <span className={"figure " + (r.safety_stock_qty !== null && r.qty_on_hand < r.safety_stock_qty ? "text-red-600 font-medium" : "")}>
              {formatQty(r.qty_on_hand, r.unit)}
            </span>
            {isFg && (
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
