import { createClient } from "@/lib/supabase/server";
import { formatWib, formatQty, LOCATION_LABEL } from "@/lib/utils";
import type { CurrentStockRow, MasterItem, StockMovement } from "@/lib/types";
import { InputStokForm } from "@/components/input-stok-form";

export const dynamic = "force-dynamic";

const MOVEMENT_COLOR: Record<string, string> = {
  masuk: "text-emerald-600",
  keluar: "text-red-600",
  transfer: "text-accent-600",
};

function locationLabel(loc: string | null, maklonName?: string | null) {
  if (!loc) return "-";
  if (loc === "maklon" && maklonName) return maklonName;
  return LOCATION_LABEL[loc] ?? loc;
}

export default async function InputStokPage() {
  const supabase = await createClient();

  const [{ data: items }, { data: recent }, { data: stockRows }] = await Promise.all([
    supabase
      .from("master_items")
      .select("id, name, category, unit, bpom_tag, default_price, safety_stock_qty, scalev_product_id, is_active")
      .eq("is_active", true)
      .order("name")
      .returns<MasterItem[]>(),
    supabase
      .from("stock_movements")
      .select("id, movement_type, qty, from_location, to_location, created_at, master_items(name, unit, category), maklon(name)")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<StockMovement[]>(),
    supabase.from("v_current_stock").select("item_id, qty_gudang_l2, qty_gudang_l1").returns<CurrentStockRow[]>(),
  ]);

  const stockByItem: Record<string, { l2: number; l1: number }> = {};
  for (const r of stockRows ?? []) {
    stockByItem[r.item_id] = { l2: r.qty_gudang_l2, l1: r.qty_gudang_l1 };
  }

  return (
    <div>
      <h1 className="page-title mb-4">Input Stok</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <InputStokForm items={items ?? []} stockByItem={stockByItem} />

        <div className="card">
          <p className="mb-3 text-sm font-medium text-stone-700">Input terakhir</p>
          {!recent || recent.length === 0 ? (
            <p className="text-sm text-stone-400">Belum ada input.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {recent.map((m) => (
                <li key={m.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-800">{m.master_items?.name}</span>
                    <span className={MOVEMENT_COLOR[m.movement_type] ?? ""}>{m.movement_type}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-xs text-stone-400">
                    <span>
                      {m.movement_type === "transfer"
                        ? `${locationLabel(m.from_location, m.maklon?.name)} → ${locationLabel(m.to_location, m.maklon?.name)}`
                        : locationLabel(m.from_location || m.to_location, m.maklon?.name)}
                    </span>
                    <span className="figure">{m.master_items ? formatQty(m.qty, m.master_items.unit) : m.qty}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-300">{formatWib(m.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
