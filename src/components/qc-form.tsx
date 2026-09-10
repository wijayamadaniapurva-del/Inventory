"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DatePicker } from "@/components/date-picker";
import type { QcStatus } from "@/lib/types";

export function QcForm({ jobOrderId, skuUnit }: { jobOrderId: string; skuUnit: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [status, setStatus] = useState<QcStatus>("lolos");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!qty || Number(qty) <= 0) {
      setError("Isi qty lebih dari 0.");
      return;
    }

    const label = status === "lolos" ? "lolos QC" : "reject";
    if (!window.confirm(`Catat ${qty} ${skuUnit} ${label}?`)) return;

    setSaving(true);
    const { error: rpcError } = await supabase.rpc("submit_qc_batch", {
      p_job_order_id: jobOrderId,
      p_qty: Number(qty),
      p_qc_status: status,
      p_expiry_date: status === "lolos" && expiryDate ? expiryDate : null,
    });
    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setOpen(false);
    setQty("");
    setExpiryDate("");
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Catat hasil QC
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-md space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStatus("lolos")}
          className={"flex-1 " + (status === "lolos" ? "!border-emerald-600 !bg-emerald-50 !text-emerald-700" : "")}
        >
          Lolos QC
        </button>
        <button
          type="button"
          onClick={() => setStatus("reject")}
          className={"flex-1 " + (status === "reject" ? "!border-red-600 !bg-red-50 !text-red-700" : "")}
        >
          Reject
        </button>
      </div>

      <div>
        <label className="mb-1 block text-sm text-stone-600">Qty ({skuUnit})</label>
        <input type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full" />
      </div>

      {status === "lolos" && (
        <div>
          <label className="mb-1 block text-sm text-stone-600">Tanggal kadaluarsa (opsional)</label>
          <DatePicker value={expiryDate} onChange={setExpiryDate} />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Batal
        </button>
      </div>
    </form>
  );
}
