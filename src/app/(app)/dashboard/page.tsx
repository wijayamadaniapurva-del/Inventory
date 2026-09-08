import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatQty } from "@/lib/utils";
import type { CurrentStockRow, JobOrder } from "@/lib/types";

export const dynamic = "force-dynamic";

function groupValue(rows: CurrentStockRow[], predicate: (r: CurrentStockRow) => boolean) {
  return rows
    .filter(predicate)
    .reduce((sum, r) => sum + r.qty_on_hand * r.default_price, 0);
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: stockRows }, { data: runningOrders }, { data: fgBatches }, { data: expiringMaterials }] = await Promise.all([
    supabase.from("v_current_stock").select("*").returns<CurrentStockRow[]>(),
    supabase
      .from("job_orders")
      .select("id, target_output, actual_output, status, master_items(name), maklon(name)")
      .eq("status", "berjalan")
      .is("deleted_at", null)
      .returns<JobOrder[]>(),
    supabase
      .from("fg_batches")
      .select("id, qty, expiry_date, master_items(name)")
      .not("expiry_date", "is", null)
      .lte("expiry_date", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
      .order("expiry_date", { ascending: true }),
    supabase
      .from("stock_movements")
      .select("id, expiry_date, master_items(name)")
      .eq("movement_type", "masuk")
      .not("expiry_date", "is", null)
      .lte("expiry_date", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
      .order("expiry_date", { ascending: true }),
  ]);

  const expiringItems = [
    ...(fgBatches ?? []).map((b) => ({ id: `fg-${b.id}`, name: (b.master_items as any)?.name ?? "-", expiry_date: b.expiry_date as string })),
    ...(expiringMaterials ?? []).map((m) => ({ id: `mat-${m.id}`, name: (m.master_items as any)?.name ?? "-", expiry_date: m.expiry_date as string })),
  ].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

  const rows = stockRows ?? [];

  const cards = [
    { label: "Nilai stok FG BPOM", value: groupValue(rows, (r) => r.category === "fg" && r.bpom_tag === "bpom") },
    { label: "Nilai stok FG non-BPOM", value: groupValue(rows, (r) => r.category === "fg" && r.bpom_tag === "non_bpom") },
    { label: "Nilai bahan baku", value: groupValue(rows, (r) => r.category === "bahan_baku") },
    { label: "Nilai material lain", value: groupValue(rows, (r) => r.category === "packaging") },
  ];

  const belowSafetyStock = rows.filter(
    (r) => r.safety_stock_qty !== null && r.qty_on_hand < r.safety_stock_qty
  );
  const hasExpiring = expiringItems.length > 0;
  const hasRunningOrders = !!runningOrders && runningOrders.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Dashboard</h1>

      {/* Urgent info first — position + color carry the priority, not a
          different card shape. */}
      {belowSafetyStock.length > 0 && (
        <div className="card-danger">
          <p className="mb-1 text-sm font-medium text-red-700">Di bawah safety stock</p>
          <p className="text-sm text-red-700">
            {belowSafetyStock
              .map((r) => `${r.name} (sisa ${formatQty(r.qty_on_hand, r.unit)})`)
              .join(", ")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="label-muted">{c.label}</p>
            <p className="figure-lg mt-1">{formatCurrency(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={hasExpiring ? "card-warning" : "card"}>
          <p className={"mb-2 text-sm font-medium " + (hasExpiring ? "text-amber-800" : "text-stone-700")}>
            Mendekati kadaluarsa (30 hari)
          </p>
          {!hasExpiring ? (
            <p className="text-sm text-stone-400">Tidak ada batch yang mendekati kadaluarsa.</p>
          ) : (
            <ul className="divide-y divide-amber-100 text-sm">
              {expiringItems.map((b) => (
                <li key={b.id} className="flex justify-between py-1.5 text-amber-900">
                  <span>{b.name}</span>
                  <span className="figure">{b.expiry_date}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={hasRunningOrders ? "card-accent" : "card"}>
          <p className={"mb-2 text-sm font-medium " + (hasRunningOrders ? "text-accent-700" : "text-stone-700")}>
            Job order berjalan
          </p>
          {!hasRunningOrders ? (
            <p className="text-sm text-stone-400">Tidak ada job order yang sedang berjalan.</p>
          ) : (
            <ul className="divide-y divide-accent-100 text-sm">
              {runningOrders!.map((jo) => (
                <li key={jo.id} className="flex justify-between py-1.5 text-accent-900">
                  <span>
                    {jo.master_items?.name} — {jo.maklon?.name}
                  </span>
                  <span className="badge bg-accent-100 text-accent-700">berjalan</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
