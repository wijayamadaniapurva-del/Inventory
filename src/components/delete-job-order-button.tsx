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

    const confirmed = window.confirm(`Hapus job order "${label}"? Job order ini akan hilang dari daftar (datanya tetap tersimpan, bisa dipulihkan lewat Supabase kalau perlu).`);
    if (!confirmed) return;

    setDeleting(true);
    const { error } = await supabase.rpc("soft_delete_job_order", { p_job_order_id: jobOrderId });
    setDeleting(false);

    if (error) {
      alert("Gagal menghapus: " + error.message);
      return;
    }

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
