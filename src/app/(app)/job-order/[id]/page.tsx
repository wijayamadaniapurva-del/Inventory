import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatWib } from "@/lib/utils";
import type { JobOrder, MasterItem, Shipment } from "@/lib/types";
import { AddShipmentForm } from "@/components/add-shipment-form";
import { CloseJobOrderForm } from "@/components/close-job-order-form";

export const dynamic = "force-dynamic";

export default async function JobOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: jobOrder } = await supabase
    .from("job_orders")
    .select(
      "id, target_output, actual_output, service_fee, status, opened_at, sku_item_id, master_items(name), maklon(name)"
    )
    .eq("id", id)
    .single<JobOrder>();

  if (!jobOrder) notFound();

  const { data: shipments } = await supabase
    .from("shipments")
    .select("id, shipped_at, surat_jalan_no, shipment_items(id, qty, unit_price, material_item_id, master_items(name, unit))")
    .eq("job_order_id", id)
    .order("shipped_at", { ascending: true })
    .returns<Shipment[]>();

  const { data: materials } = await supabase
    .from("master_items")
    .select("id, name, unit, default_price")
    .in("category", ["bahan_baku", "packaging"])
    .eq("is_active", true)
    .returns<Pick<MasterItem, "id" | "name" | "unit" | "default_price">[]>();

  const totalMaterialCost = (shipments ?? []).reduce(
    (sum, s) => sum + (s.shipment_items ?? []).reduce((s2, li) => s2 + li.qty * li.unit_price, 0),
    0
  );
  const totalCost = totalMaterialCost + jobOrder.service_fee;
  const variance = jobOrder.actual_output != null ? jobOrder.target_output - jobOrder.actual_output : null;
  const hppRiil =
    jobOrder.actual_output && jobOrder.actual_output > 0 ? totalCost / jobOrder.actual_output : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Job Order &amp; Shipment</h1>
        <Link href="/job-order" className="text-sm text-accent-600">
          ← Semua job order
        </Link>
      </div>

      <div className="card">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold">
              {jobOrder.master_items?.name} — {jobOrder.maklon?.name}
            </p>
            <p className="text-sm text-stone-500">Dibuka {formatWib(jobOrder.opened_at, false)}</p>
          </div>
          <span
            className={
              "badge " +
              (jobOrder.status === "berjalan" ? "bg-accent-50 text-accent-700" : "bg-emerald-50 text-emerald-700")
            }
          >
            {jobOrder.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-stone-500">Target output</p>
            <p className="figure font-medium">{jobOrder.target_output} pcs</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Actual output</p>
            <p className="figure font-medium">{jobOrder.actual_output ?? "-"} pcs</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Selisih</p>
            <p className={"figure font-medium " + (variance && variance > 0 ? "text-red-600" : "")}>
              {variance != null ? (variance > 0 ? `-${variance}` : `+${-variance}`) + " pcs" : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">HPP riil / pcs</p>
            <p className="figure font-medium">{hppRiil != null ? formatCurrency(hppRiil) : "-"}</p>
          </div>
        </div>
      </div>

      {jobOrder.status === "berjalan" && <CloseJobOrderForm jobOrderId={jobOrder.id} />}

      <div className="space-y-3">
        <p className="text-sm font-medium">Shipment</p>
        {(shipments ?? []).map((s) => (
          <div key={s.id} className="card">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-stone-500">{formatWib(s.shipped_at, false)}</p>
              <Link href={`/surat-jalan/${s.id}`} className="text-sm text-accent-600">
                Cetak surat jalan
              </Link>
            </div>
            <ul className="divide-y divide-stone-100 text-sm">
              {(s.shipment_items ?? []).map((li) => (
                <li key={li.id} className="flex justify-between py-1">
                  <span>
                    {li.master_items?.name} — {li.qty} {li.master_items?.unit}
                  </span>
                  <span className="figure">{formatCurrency(li.qty * li.unit_price)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {(!shipments || shipments.length === 0) && (
          <p className="text-sm text-stone-400">Belum ada shipment.</p>
        )}

        {jobOrder.status === "berjalan" && (
          <AddShipmentForm jobOrderId={jobOrder.id} materials={materials ?? []} />
        )}
      </div>
    </div>
  );
}
