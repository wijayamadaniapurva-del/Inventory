"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ReopenJobOrderButton({ jobOrderId }: { jobOrderId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  async function handleReopen() {
    if (
      !window.confirm(
        "Buka lagi job order ini? Statusnya kembali jadi \"berjalan\" supaya bisa catat QC susulan (misal reject yang direvisi maklon). Stok yang sudah masuk tidak berubah."
      )
    )
      return;

    setSaving(true);
    await supabase.rpc("reopen_job_order", { p_job_order_id: jobOrderId });
    setSaving(false);
    router.refresh();
  }

  return (
    <button onClick={handleReopen} disabled={saving}>
      {saving ? "Membuka..." : "Buka lagi"}
    </button>
  );
}
