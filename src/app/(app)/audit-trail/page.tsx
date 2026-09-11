import { createClient } from "@/lib/supabase/server";
import { computeSisaBahan, type SisaRow } from "@/lib/sisa-bahan";
import { AuditTrailTable, type AuditRow } from "@/components/audit-trail-table";

export const dynamic = "force-dynamic";

interface VarianceRow {
  id: string;
  sku_item_id: string;
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

  const { data: variance } = await supabase
    .from("v_job_order_variance")
    .select("*")
    .order("opened_at", { ascending: false })
    .returns<VarianceRow[]>();

  const jobOrderIds = (variance ?? []).map((v) => v.id);
  const skuIds = [...new Set((variance ?? []).map((v) => v.sku_item_id))];

  const [{ data: allShipments }, { data: allBom }] = await Promise.all([
    jobOrderIds.length > 0
      ? supabase
          .from("shipments")
          .select("job_order_id, shipment_items(material_item_id, qty, master_items(name, unit))")
          .in("job_order_id", jobOrderIds)
      : Promise.resolve({ data: [] as any[] }),
    skuIds.length > 0
      ? supabase.from("item_bom").select("fg_item_id, material_item_id, ratio_per_unit").in("fg_item_id", skuIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const rows: AuditRow[] = (variance ?? []).map((v) => {
    const shippedByMaterial = new Map<string, { name: string; unit: string; qty: number }>();
    for (const s of allShipments ?? []) {
      if (s.job_order_id !== v.id) continue;
      for (const li of s.shipment_items ?? []) {
        const prev = shippedByMaterial.get(li.material_item_id);
        shippedByMaterial.set(li.material_item_id, {
          name: li.master_items?.name ?? "-",
          unit: li.master_items?.unit ?? "",
          qty: (prev?.qty ?? 0) + li.qty,
        });
      }
    }
    const bomForSku = (allBom ?? []).filter((b) => b.fg_item_id === v.sku_item_id);
    const qtyDiterima = v.qty_lolos + v.qty_reject;
    const sisaRows: SisaRow[] = computeSisaBahan(shippedByMaterial, bomForSku, qtyDiterima);

    return {
      id: v.id,
      skuName: v.sku_name,
      skuUnit: v.sku_unit,
      maklonName: v.maklon_name,
      status: v.status,
      openedAt: v.opened_at,
      targetOutput: v.target_output,
      qtyLolos: v.qty_lolos,
      qtyReject: v.qty_reject,
      sisaRows,
    };
  });

  return (
    <div>
      <h1 className="page-title mb-1">Audit Trail</h1>
      <p className="mb-4 text-sm text-stone-500">
        Ringkasan selisih tiap Job Order — target vs hasil QC vs sisa bahan baku di maklon. Klik baris untuk buka detailnya di sini.
      </p>
      <AuditTrailTable rows={rows} />
    </div>
  );
}
