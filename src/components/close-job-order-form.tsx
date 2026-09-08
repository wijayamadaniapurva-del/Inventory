"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CloseJobOrderForm({ jobOrderId }: { jobOrderId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [actualOutput, setActualOutput] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // Actual output is entered manually by the owner — never taken from
    // the maklon's own claim (see brief: trust hasn't been established).
    await supabase
      .from("job_orders")
      .update({
        actual_output: Number(actualOutput),
        status: "selesai",
        closed_at: new Date().toISOString(),
      })
      .eq("id", jobOrderId);

    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card flex items-end gap-3">
      <div className="flex-1">
        <label className="mb-1 block text-sm text-stone-600">
          Actual output (dihitung sendiri oleh owner)
        </label>
        <input
          type="number"
          min="0"
          required
          value={actualOutput}
          onChange={(e) => setActualOutput(e.target.value)}
          className="w-full"
        />
      </div>
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Menyimpan..." : "Tutup job order"}
      </button>
    </form>
  );
}
