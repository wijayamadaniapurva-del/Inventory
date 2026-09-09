"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ItemCategory, MasterItem } from "@/lib/types";
import { CATEGORY_LABEL, formatQty } from "@/lib/utils";
import { computeSafetyStock } from "@/lib/safety-stock";

const CATEGORIES: ItemCategory[] = ["bahan_baku", "packaging", "fg"];

export function SafetyStockManager({
  initialItems,
  initialBufferPercent,
}: {
  initialItems: MasterItem[];
  initialBufferPercent: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [category, setCategory] = useState<ItemCategory>("bahan_baku");
  const [bufferPercent, setBufferPercent] = useState(String(initialBufferPercent));
  const [savingBuffer, setSavingBuffer] = useState(false);

  const items = initialItems.filter((i) => i.category === category && i.is_active);

  async function handleSaveBuffer() {
    if (!window.confirm(`Simpan faktor buffer ${bufferPercent}% untuk semua item?`)) return;
    setSavingBuffer(true);
    await supabase
      .from("app_settings")
      .update({ value: { percent: Number(bufferPercent || 0) } })
      .eq("key", "safety_stock_buffer_percent");
    setSavingBuffer(false);
    router.refresh();
  }

  return (
    <div>
      <div className="card mb-4 max-w-md">
        <label className="mb-1 block text-sm text-stone-600">
          Faktor buffer (%) — satu angka global untuk semua item
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            value={bufferPercent}
            onChange={(e) => setBufferPercent(e.target.value)}
            className="flex-1"
          />
          <button onClick={handleSaveBuffer} disabled={savingBuffer} className="btn-primary">
            {savingBuffer ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>

      <div className="mb-3 flex gap-2">
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

      <div className="card !p-0 overflow-hidden">
        <div className="grid grid-cols-[1fr_150px_120px_140px] gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
          <span>Nama item</span>
          <span>Rata-rata pakai/hari</span>
          <span>Lead time (hari)</span>
          <span>Safety stock</span>
        </div>
        {items.map((item) => (
          <SafetyStockRow key={item.id} item={item} bufferPercent={Number(bufferPercent || 0)} />
        ))}
        {items.length === 0 && <p className="px-4 py-6 text-sm text-stone-400">Belum ada item di kategori ini.</p>}
      </div>
    </div>
  );
}

function SafetyStockRow({ item, bufferPercent }: { item: MasterItem; bufferPercent: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [avgUsage, setAvgUsage] = useState(item.avg_daily_usage != null ? String(item.avg_daily_usage) : "");
  const [leadTime, setLeadTime] = useState(item.lead_time_days != null ? String(item.lead_time_days) : "");
  const [saving, setSaving] = useState(false);

  const computed = computeSafetyStock(
    avgUsage ? Number(avgUsage) : null,
    leadTime ? Number(leadTime) : null,
    bufferPercent
  );

  async function handleBlurSave() {
    setSaving(true);
    await supabase
      .from("master_items")
      .update({
        avg_daily_usage: avgUsage ? Number(avgUsage) : null,
        lead_time_days: leadTime ? Number(leadTime) : null,
      })
      .eq("id", item.id);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-[1fr_150px_120px_140px] items-center gap-2 border-b border-stone-100 px-4 py-2 text-sm">
      <span>{item.name}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={avgUsage}
        onChange={(e) => setAvgUsage(e.target.value)}
        onBlur={handleBlurSave}
        className="!h-8"
        placeholder="-"
      />
      <input
        type="number"
        min="0"
        value={leadTime}
        onChange={(e) => setLeadTime(e.target.value)}
        onBlur={handleBlurSave}
        className="!h-8"
        placeholder="-"
      />
      <span className="figure text-stone-600">
        {saving ? "..." : computed != null ? formatQty(Math.ceil(computed), item.unit) : "-"}
      </span>
    </div>
  );
}
