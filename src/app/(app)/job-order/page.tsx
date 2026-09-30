import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { JobOrder, Maklon, MasterItem } from "@/lib/types";
import { NewJobOrderForm } from "@/components/new-job-order-form";
import { DeleteJobOrderButton } from "@/components/delete-job-order-button";
import { PaginationLinks } from "@/components/pagination";
import { PAGE_SIZE, pageCountOf, parsePage } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function JobOrderListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "warehouse_staff";
  const canInput = role === "spv" || role === "warehouse_staff";
  const canDelete = role === "spv";

  const { count } = await supabase
    .from("job_orders")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  const total = count ?? 0;
  const pageCount = pageCountOf(total);
  const page = parsePage(params.page, pageCount);
  const from = (page - 1) * PAGE_SIZE;

  const [{ data: jobOrders }, { data: fgItems }, { data: maklonList }] = await Promise.all([
    supabase
      .from("job_orders")
      .select("id, target_output, actual_output, status, opened_at, master_items(name), maklon(name)")
      .is("deleted_at", null)
      .order("opened_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
      .returns<JobOrder[]>(),
    supabase.from("master_items").select("id, name").eq("category", "fg").eq("is_active", true).returns<Pick<MasterItem, "id" | "name">[]>(),
    supabase.from("maklon").select("id, name").eq("is_active", true).returns<Pick<Maklon, "id" | "name">[]>(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Job Order &amp; Shipment</h1>
      {canInput && <NewJobOrderForm fgItems={fgItems ?? []} maklonList={maklonList ?? []} />}

      <div className="space-y-2">
        {(jobOrders ?? []).map((jo) => {
          const label = `${jo.master_items?.name ?? ""} — ${jo.maklon?.name ?? ""}`;
          return (
            <Link
              key={jo.id}
              href={`/job-order/${jo.id}`}
              className="card flex items-center justify-between hover:border-accent-300"
            >
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-stone-500">
                  Target {jo.target_output} pcs
                  {jo.status === "selesai" && jo.actual_output != null ? ` · Actual ${jo.actual_output} pcs` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    "badge " +
                    (jo.status === "berjalan" ? "bg-accent-50 text-accent-700" : "bg-emerald-50 text-emerald-700")
                  }
                >
                  {jo.status}
                </span>
                {canDelete && <DeleteJobOrderButton jobOrderId={jo.id} label={label} />}
              </div>
            </Link>
          );
        })}
        {(!jobOrders || jobOrders.length === 0) && (
          <p className="text-sm text-stone-400">Belum ada job order.</p>
        )}

        {total > 0 && (
          <div className="card !p-0">
            <PaginationLinks page={page} pageCount={pageCount} total={total} basePath="/job-order" />
          </div>
        )}
      </div>
    </div>
  );
}
