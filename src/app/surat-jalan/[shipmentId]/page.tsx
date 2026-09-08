import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatWib } from "@/lib/utils";
import type { Shipment, JobOrder } from "@/lib/types";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function SuratJalanPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = await params;
  const supabase = await createClient();

  const { data: shipment } = await supabase
    .from("shipments")
    .select(
      "id, shipped_at, surat_jalan_no, job_order_id, shipment_items(id, qty, material_item_id, master_items(name, unit))"
    )
    .eq("id", shipmentId)
    .single<Shipment>();

  if (!shipment) notFound();

  const { data: jobOrder } = await supabase
    .from("job_orders")
    .select("id, master_items(name), maklon(name)")
    .eq("id", shipment.job_order_id)
    .single<JobOrder>();

  return (
    <div className="mx-auto max-w-lg p-8">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-semibold">Surat Jalan</h1>
        <PrintButton />
      </div>

      <div className="space-y-1 text-sm">
        <p>
          <span className="text-stone-500">No. surat jalan:</span> {shipment.surat_jalan_no ?? shipment.id.slice(0, 8).toUpperCase()}
        </p>
        <p>
          <span className="text-stone-500">Tanggal:</span> {formatWib(shipment.shipped_at, false)}
        </p>
        <p>
          <span className="text-stone-500">SKU:</span> {jobOrder?.master_items?.name}
        </p>
        <p>
          <span className="text-stone-500">Maklon tujuan:</span> {jobOrder?.maklon?.name}
        </p>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-stone-300 text-left">
            <th className="py-1">Material</th>
            <th className="py-1 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {(shipment.shipment_items ?? []).map((li) => (
            <tr key={li.id} className="border-b border-stone-100">
              <td className="py-1">{li.master_items?.name}</td>
              <td className="py-1 text-right">
                {li.qty} {li.master_items?.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-16 grid grid-cols-2 gap-8 text-center text-sm">
        <div>
          <p className="mb-16">Dikirim oleh</p>
          <p className="border-t border-stone-400 pt-1">Warehouse</p>
        </div>
        <div>
          <p className="mb-16">Diterima oleh</p>
          <p className="border-t border-stone-400 pt-1">{jobOrder?.maklon?.name}</p>
        </div>
      </div>
    </div>
  );
}
