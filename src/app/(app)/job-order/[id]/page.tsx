import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { formatCurrency, formatWib } from "@/lib/utils";
import type { FgBatch, JobOrder, MasterItem, Shipment } from "@/lib/types";
import { AddShipmentForm } from "@/components/add-shipment-form";
import { CloseJobOrderForm } from "@/components/close-job-order-form";
import { EditServiceFee } from "@/components/edit-service-fee";
import { QcForm } from "@/components/qc-form";

export const dynamic = "force-dynamic";

export default async function JobOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const canInput = profile?.role === "spv" || profile?.role === "warehouse_staff";

  const { data: jobOrder } = await supabase
    .from("job_orders")
    .select(
      "id, target_output, actual_output, service_fee, status, opened_at, sku_item_id, maklon_id, master_items(name, unit), maklon(name)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single<JobOrder>();

  if (!jobOrder) notFound();

  const [{ data: shipments }, { data: materials }, { data: fgBatches }] = await Promise.all([
    supabase
      .from("shipments")
      .select("id, shipped_at, surat_jalan_no, shipment_items(id, qty, unit_price, material_item_id, master_items(name, unit))")
      .eq("job_order_id", id)
      .order("shipped_at", { ascending: true })
      .returns<Shipment[]>(),
    supabase
      .from("master_items")
      .select("id, name, unit, default_price")
      .in("category", ["bahan_baku", "packaging"])
      .eq("is_active", true)
      .returns<Pick<MasterItem, "id" | "name" | "unit" | "default_price">[]>(),
    supabase
      .from("fg_batches")
      .select("id, qty, qc_status, expiry_date, received_at")
      .eq("job_order_id", id)
      .order("received_at", { ascending: false })
      .returns<FgBatch[]>(),
  ]);

  const skuName = jobOrder.master_items?.name ?? "-";
  const skuUnit = jobOrder.master_items?.unit ?? "pcs";
  const maklonName = jobOrder.maklon?.name ?? "-";

  const qtyLolos = (fgBatches ?? []).filter((b) => b.qc_status === "lolos").reduce((sum, b) => sum + b.qty, 0);
  const qtyReject = (fgBatches ?? []).filter((b) => b.qc_status === "reject").reduce((sum, b) => sum + b.qty, 0);
  const qtyDiterima = qtyLolos + qtyReject;
  const displayActualOutput = jobOrder.status === "selesai" ? jobOrder.actual_output : qtyLolos;

  const totalMaterialCost = (shipments ?? []).reduce(
    (sum, s) => sum + (s.shipment_items ?? []).reduce((s2, li) => s2 + li.qty * li.unit_price, 0),
    0
  );
  const totalCost = totalMaterialCost + jobOrder.service_fee;
  // Two separate causes, kept visually apart so one doesn't hide the other:
  // shortfall in what the maklon delivered at all, vs. shortfall from QC
  // rejecting part of what was delivered.
  const varianceProduksi = qtyDiterima > 0 || (fgBatches ?? []).length > 0 ? jobOrder.target_output - qtyDiterima : null;
  const hppRiil = displayActualOutput && displayActualOutput > 0 ? totalCost / displayActualOutput : null;

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
              {skuName} — {maklonName}
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
            <p className="figure font-medium">{jobOrder.target_output} {skuUnit}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Diterima dari maklon</p>
            <p className="figure font-medium">{varianceProduksi != null ? qtyDiterima : "-"} {skuUnit}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Selisih produksi maklon</p>
            <p className={"figure font-medium " + (varianceProduksi && varianceProduksi > 0 ? "text-red-600" : "")}>
              {varianceProduksi != null ? (varianceProduksi > 0 ? `-${varianceProduksi}` : varianceProduksi < 0 ? `+${-varianceProduksi}` : "0") + ` ${skuUnit}` : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Reject QC</p>
            <p className="figure font-medium text-red-600">{qtyReject} {skuUnit}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Lolos QC (jadi stok)</p>
            <p className="figure font-medium text-emerald-600">{qtyLolos} {skuUnit}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Total selisih dari target</p>
            <p className={"figure font-medium " + (jobOrder.target_output - qtyLolos > 0 ? "text-red-600" : "")}>
              {jobOrder.target_output - qtyLolos > 0 ? `-${jobOrder.target_output - qtyLolos}` : `+${qtyLolos - jobOrder.target_output}`} {skuUnit}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Biaya jasa maklon</p>
            {canInput ? (
              <EditServiceFee jobOrderId={jobOrder.id} value={jobOrder.service_fee} />
            ) : (
              <p className="figure font-medium">{formatCurrency(jobOrder.service_fee)}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-stone-500">HPP riil / {skuUnit}</p>
            <p className="figure font-medium">{hppRiil != null ? formatCurrency(hppRiil) : "-"}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Hasil QC</p>
        {(fgBatches ?? []).length === 0 ? (
          <p className="text-sm text-stone-400">Belum ada FG yang diterima/di-QC dari job order ini.</p>
        ) : (
          <div className="card !p-0 overflow-hidden">
            {(fgBatches ?? []).map((b) => (
              <div key={b.id} className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5 text-sm last:border-0">
                <span className="text-stone-500">{formatWib(b.received_at)}</span>
                <span className="figure">{b.qty} {skuUnit}</span>
                <span className={"badge " + (b.qc_status === "lolos" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                  {b.qc_status === "lolos" ? "Lolos QC" : "Reject"}
                </span>
                <span className="text-stone-400">{b.expiry_date ?? "-"}</span>
              </div>
            ))}
          </div>
        )}
        {jobOrder.status === "berjalan" && canInput && <QcForm jobOrderId={jobOrder.id} skuUnit={skuUnit} />}
      </div>

      {jobOrder.status === "berjalan" && canInput && (
        <CloseJobOrderForm jobOrderId={jobOrder.id} computedActualOutput={qtyLolos} unit={skuUnit} />
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium">Shipment</p>
        {(shipments ?? []).map((s) => (
          <div key={s.id} className="card">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-stone-500">{formatWib(s.shipped_at, false)}</p>
              <Link href={`/surat-jalan/${s.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-600">
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

        {jobOrder.status === "berjalan" && canInput && (
          <AddShipmentForm jobOrderId={jobOrder.id} maklonName={maklonName} materials={materials ?? []} />
        )}
      </div>
    </div>
  );
}
