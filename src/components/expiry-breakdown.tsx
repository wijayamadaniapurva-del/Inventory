"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeExpiryBatches, type ExpiryBatch } from "@/lib/fefo";
import { formatQty } from "@/lib/utils";
import type { ItemUnit } from "@/lib/types";

export function ExpiryBreakdown({ itemId, unit }: { itemId: string; unit: ItemUnit }) {
  const supabase = createClient();
  const [batches, setBatches] = useState<ExpiryBatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("movement_type, qty, from_location, to_location, expiry_date, created_at")
        .eq("item_id", itemId)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        setError(error.message);
        return;
      }
      setBatches(computeExpiryBatches(data ?? []));
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  if (error) return <p className="px-4 py-3 text-sm text-red-600">Gagal memuat: {error}</p>;
  if (batches === null) return <p className="px-4 py-3 text-sm text-stone-400">Memuat...</p>;
  if (batches.length === 0) return <p className="px-4 py-3 text-sm text-stone-400">Tidak ada stok saat ini.</p>;

  return (
    <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
        Rincian per tanggal kadaluarsa (Gudang L1 + L2, estimasi FEFO)
      </p>
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        {batches.map((b, idx) => (
          <div key={idx} className="flex items-center justify-between border-b border-stone-100 px-3 py-2 text-sm last:border-0">
            <span className={b.expiry_date === null ? "text-stone-400" : ""}>
              {b.expiry_date ?? "Tidak ada tanggal"}
            </span>
            <span className="figure">{formatQty(b.qty, unit)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
