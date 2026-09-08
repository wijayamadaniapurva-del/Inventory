"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Maklon, MasterItem } from "@/lib/types";

export function NewJobOrderForm({
  fgItems,
  maklonList,
}: {
  fgItems: Pick<MasterItem, "id" | "name">[];
  maklonList: Pick<Maklon, "id" | "name">[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [skuId, setSkuId] = useState(fgItems[0]?.id ?? "");
  const [maklonId, setMaklonId] = useState(maklonList[0]?.id ?? "");
  const [target, setTarget] = useState("");
  const [fee, setFee] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("job_orders").insert({
      sku_item_id: skuId,
      maklon_id: maklonId,
      target_output: Number(target),
      service_fee: Number(fee || 0),
    });

    setSaving(false);
    if (!error) {
      setOpen(false);
      setTarget("");
      setFee("");
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Job order baru
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-md space-y-3">
      <div>
        <label className="mb-1 block text-sm text-stone-600">SKU</label>
        <select className="w-full" value={skuId} onChange={(e) => setSkuId(e.target.value)}>
          {fgItems.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm text-stone-600">Maklon</label>
        <select className="w-full" value={maklonId} onChange={(e) => setMaklonId(e.target.value)}>
          {maklonList.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm text-stone-600">Target output (pcs)</label>
          <input type="number" min="1" required value={target} onChange={(e) => setTarget(e.target.value)} className="w-full" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm text-stone-600">Biaya jasa maklon</label>
          <input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} className="w-full" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? "Menyimpan..." : "Buka job order"}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Batal
        </button>
      </div>
    </form>
  );
}
