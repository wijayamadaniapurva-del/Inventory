"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteJobOrderButton({ jobOrderId, label }: { jobOrderId: string; label: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(`Hapus job order "${label}"? Semua shipment di dalamnya ikut terhapus. Tindakan ini tidak bisa dibatalkan.`);
    if (!confirmed) return;

    setDeleting(true);
    await supabase.from("job_orders").delete().eq("id", jobOrderId);
    setDeleting(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="Hapus job order"
      className="!h-8 !w-8 !border-0 !p-0 text-red-500 hover:text-red-700"
    >
      🗑
    </button>
  );
}
