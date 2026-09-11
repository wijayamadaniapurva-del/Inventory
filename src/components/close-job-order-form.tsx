"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CloseJobOrderForm({
  jobOrderId,
  computedActualOutput,
  qtyReject,
  unit,
}: {
  jobOrderId: string;
  computedActualOutput: number;
  qtyReject: number;
  unit: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClose() {
    const rejectWarning =
      qtyReject > 0
        ? `\n\nAda ${qtyReject} ${unit} reject. Kalau ini masih akan direvisi/dikirim ulang oleh maklon, sebaiknya JANGAN ditutup dulu — tetap bisa dibuka lagi nanti kalau perlu.`
        : "";
    if (
      !window.confirm(
        `Tutup job order dengan actual output ${computedActualOutput} ${unit} (dihitung dari total QC lolos)?${rejectWarning}\n\nYakin lanjut?`
      )
    )
      return;

    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("close_job_order", { p_job_order_id: jobOrderId });
    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card flex items-center justify-between">
      <div>
        <p className="text-sm text-stone-600">
          Actual output dari QC (total lolos): <span className="figure font-medium text-stone-900">{computedActualOutput} {unit}</span>
        </p>
        {qtyReject > 0 && (
          <p className="mt-1 text-xs text-amber-600">
            Ada {qtyReject} {unit} reject — pastikan sudah final sebelum menutup (job order masih bisa dibuka lagi kalau perlu).
          </p>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      <button onClick={handleClose} disabled={saving} className="btn-primary">
        {saving ? "Menutup..." : "Tutup job order"}
      </button>
    </div>
  );
}
