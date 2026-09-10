import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWib } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface VarianceRow {
  id: string;
  target_output: number;
  actual_output: number | null;
  status: "berjalan" | "selesai";
  opened_at: string;
  sku_name: string;
  sku_unit: string;
  maklon_name: string;
  qty_lolos: number;
  qty_reject: number;
}

export default async function AuditTrailPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("v_job_order_variance")
    .select("*")
    .order("opened_at", { ascending: false })
    .returns<VarianceRow[]>();

  return (
    <div>
      <h1 className="page-title mb-1">Audit Trail</h1>
      <p className="mb-4 text-sm text-stone-500">
        Ringkasan selisih tiap Job Order — target vs hasil QC. Klik baris untuk lihat detail lengkap.
      </p>

      <div className="card !p-0 overflow-hidden">
        <div className="grid grid-cols-[1fr_90px_90px_90px_100px_90px] gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
          <span>Job Order</span>
          <span>Target</span>
          <span>Lolos QC</span>
          <span>Reject</span>
          <span>Selisih</span>
          <span>Status</span>
        </div>

        {(rows ?? []).map((r) => {
          const variance = r.target_output - r.qty_lolos;
          const hasVariance = variance > 0;
          return (
            <Link
              key={r.id}
              href={`/job-order/${r.id}`}
              className={
                "grid grid-cols-[1fr_90px_90px_90px_100px_90px] items-center gap-2 border-b border-stone-100 px-4 py-2.5 text-sm last:border-0 hover:bg-stone-50 " +
                (hasVariance ? "bg-red-50/40" : "")
              }
            >
              <div>
                <p className="font-medium text-stone-800">
                  {r.sku_name} — {r.maklon_name}
                </p>
                <p className="text-xs text-stone-400">{formatWib(r.opened_at, false)}</p>
              </div>
              <span className="figure">{r.target_output} {r.sku_unit}</span>
              <span className="figure text-emerald-600">{r.qty_lolos} {r.sku_unit}</span>
              <span className="figure text-red-600">{r.qty_reject} {r.sku_unit}</span>
              <span className={"figure font-medium " + (hasVariance ? "text-red-600" : "text-stone-500")}>
                {variance > 0 ? `-${variance}` : variance < 0 ? `+${-variance}` : "0"} {r.sku_unit}
              </span>
              <span
                className={
                  "badge w-fit " +
                  (r.status === "berjalan" ? "bg-accent-50 text-accent-700" : "bg-emerald-50 text-emerald-700")
                }
              >
                {r.status}
              </span>
            </Link>
          );
        })}

        {(!rows || rows.length === 0) && (
          <p className="px-4 py-6 text-sm text-stone-400">Belum ada job order.</p>
        )}
      </div>
    </div>
  );
}
