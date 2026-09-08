import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { JobOrder, Maklon, MasterItem } from "@/lib/types";
import { NewJobOrderForm } from "@/components/new-job-order-form";

export const dynamic = "force-dynamic";

export default async function JobOrderListPage() {
  const supabase = await createClient();

  const [{ data: jobOrders }, { data: fgItems }, { data: maklonList }] = await Promise.all([
    supabase
      .from("job_orders")
      .select("id, target_output, actual_output, status, opened_at, master_items(name), maklon(name)")
      .order("opened_at", { ascending: false })
      .returns<JobOrder[]>(),
    supabase.from("master_items").select("id, name").eq("category", "fg").eq("is_active", true).returns<Pick<MasterItem, "id" | "name">[]>(),
    supabase.from("maklon").select("id, name").eq("is_active", true).returns<Pick<Maklon, "id" | "name">[]>(),
  ]);

  return (
    <div className="space-y-6">
      <NewJobOrderForm fgItems={fgItems ?? []} maklonList={maklonList ?? []} />

      <div className="space-y-2">
        {(jobOrders ?? []).map((jo) => (
          <Link
            key={jo.id}
            href={`/job-order/${jo.id}`}
            className="card flex items-center justify-between hover:border-accent-300"
          >
            <div>
              <p className="text-sm font-medium">
                {jo.master_items?.name} — {jo.maklon?.name}
              </p>
              <p className="text-xs text-slate-500">
                Target {jo.target_output} pcs
                {jo.actual_output != null ? ` · Actual ${jo.actual_output} pcs` : ""}
              </p>
            </div>
            <span
              className={
                "badge " +
                (jo.status === "berjalan" ? "bg-accent-50 text-accent-700" : "bg-emerald-50 text-emerald-700")
              }
            >
              {jo.status}
            </span>
          </Link>
        ))}
        {(!jobOrders || jobOrders.length === 0) && (
          <p className="text-sm text-slate-400">Belum ada job order.</p>
        )}
      </div>
    </div>
  );
}
