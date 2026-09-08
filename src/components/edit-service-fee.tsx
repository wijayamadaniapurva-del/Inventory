"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

export function EditServiceFee({ jobOrderId, value }: { jobOrderId: string; value: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [fee, setFee] = useState(String(value));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!window.confirm(`Simpan biaya jasa maklon sebesar ${formatCurrency(Number(fee || 0))}?`)) return;
    setSaving(true);
    await supabase.from("job_orders").update({ service_fee: Number(fee || 0) }).eq("id", jobOrderId);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          className="!h-7 w-28 text-sm"
          autoFocus
        />
        <button onClick={handleSave} disabled={saving} className="!h-7 !w-7 !border-0 !p-0 text-accent-600" title="Simpan">
          ✓
        </button>
        <button onClick={() => setEditing(false)} className="!h-7 !w-7 !border-0 !p-0 text-stone-400" title="Batal">
          ✕
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="!h-auto !border-0 !p-0 text-left font-mono text-sm font-medium text-stone-900 hover:text-accent-600">
      {formatCurrency(value)} <span className="text-xs text-stone-400">(ubah)</span>
    </button>
  );
}
