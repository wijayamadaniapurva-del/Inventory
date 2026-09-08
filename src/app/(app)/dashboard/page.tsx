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

  const [{ data: stockRows }, { data: runningOrders }, { data: fgBatches }] = await Promise.all([
    supabase.from("v_current_stock").select("*").returns<CurrentStockRow[]>(),
    supabase
      .from("job_orders")
      .select("id, target_output, actual_output, status, master_items(name), maklon(name)")
      .eq("status", "berjalan")
      .returns<JobOrder[]>(),
    supabase
      .from("fg_batches")
      .select("id, qty, expiry_date, master_items(name)")
      .not("expiry_date", "is", null)
      .lte("expiry_date", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
      .order("expiry_date", { ascending: true }),
  ]);

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="figure mt-1 text-xl font-semibold">{formatCurrency(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card">
          <p className="mb-2 text-sm font-medium">Mendekati kadaluarsa (30 hari)</p>
          {!fgBatches || fgBatches.length === 0 ? (
            <p className="text-sm text-slate-400">Tidak ada batch yang mendekati kadaluarsa.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {fgBatches.map((b) => (
                <li key={b.id} className="flex justify-between py-1.5">
                  {/* @ts-expect-error joined relation shape from Supabase */}
                  <span>{b.master_items?.name}</span>
                  <span className="text-amber-600">{b.expiry_date}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <p className="mb-2 text-sm font-medium">Job order berjalan</p>
          {!runningOrders || runningOrders.length === 0 ? (
            <p className="text-sm text-slate-400">Tidak ada job order yang sedang berjalan.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {runningOrders.map((jo) => (
                <li key={jo.id} className="flex justify-between py-1.5">
                  <span>
                    {jo.master_items?.name} — {jo.maklon?.name}
                  </span>
                  <span className="text-accent-600">berjalan</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {belowSafetyStock.length > 0 && (
        <div className="rounded-lg bg-red-50 p-4">
          <p className="mb-1 text-sm font-medium text-red-700">Di bawah safety stock</p>
          <p className="text-sm text-red-700">
            {belowSafetyStock
              .map((r) => `${r.name} (sisa ${formatQty(r.qty_on_hand, r.unit)})`)
              .join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
