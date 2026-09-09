"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABEL, formatCurrency, formatQty } from "@/lib/utils";
import { ExportExcelButton } from "@/components/export-excel-button";
import type { ItemCategory, ItemUnit } from "@/lib/types";

export interface SnapshotRow {
  item_id: string;
  item_name: string;
  category: ItemCategory;
  unit: ItemUnit;
  qty_on_hand: number;
  default_price: number;
  value: number;
}

function formatMonthLabel(isoDate: string) {
  const [y, m] = isoDate.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function MonthlyRecapTable({
  months,
  rowsByMonth,
}: {
  months: string[];
  rowsByMonth: Record<string, SnapshotRow[]>;
}) {
  const [selectedMonth, setSelectedMonth] = useState(months[0] ?? "");
  const rows = rowsByMonth[selectedMonth] ?? [];
  const total = useMemo(() => rows.reduce((sum, r) => sum + r.value, 0), [rows]);

  const exportRows = rows.map((r) => ({
    Kategori: CATEGORY_LABEL[r.category],
    "Nama item": r.item_name,
    Stok: r.qty_on_hand,
    Satuan: r.unit,
    Harga: r.default_price,
    Nilai: r.value,
  }));

  if (months.length === 0) {
    return (
      <p className="text-sm text-stone-400">
        Belum ada rekap bulanan. Rekap otomatis tercatat setiap tanggal 1 untuk bulan sebelumnya.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-52">
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <p className="text-sm text-stone-500">
            Total nilai: <span className="figure font-medium text-stone-800">{formatCurrency(total)}</span>
          </p>
          <ExportExcelButton
            rows={exportRows}
            filename={`rekap-stok-${selectedMonth}.xlsx`}
            sheetName={formatMonthLabel(selectedMonth)}
          />
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="grid grid-cols-[100px_1fr_110px_110px_130px] gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
          <span>Kategori</span>
          <span>Nama item</span>
          <span>Stok</span>
          <span>Harga</span>
          <span>Nilai</span>
        </div>
        {rows.map((r) => (
          <div key={r.item_id} className="grid grid-cols-[100px_1fr_110px_110px_130px] items-center gap-2 border-b border-stone-100 px-4 py-2.5 text-sm last:border-0">
            <span className="text-stone-500">{CATEGORY_LABEL[r.category]}</span>
            <span>{r.item_name}</span>
            <span className="figure">{formatQty(r.qty_on_hand, r.unit)}</span>
            <span className="figure text-stone-500">{formatCurrency(r.default_price)}</span>
            <span className="figure">{formatCurrency(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
