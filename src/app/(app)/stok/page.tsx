import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CurrentStockRow } from "@/lib/types";
import { computeExpiryBatches, type ExpiryBatch, type FefoMovement } from "@/lib/fefo";
import { StockTable } from "@/components/stock-table";

export const dynamic = "force-dynamic";

type MovementRow = FefoMovement & { item_id: string };

// Supabase caps a single select at 1000 rows by default, so the full
// movement log is pulled in pages. Ordered by created_at + id so paging
// is stable even when two movements share the same timestamp.
const PAGE_SIZE = 1000;

async function fetchAllMovements(supabase: Awaited<ReturnType<typeof createClient>>) {
  const all: MovementRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("item_id, movement_type, qty, from_location, to_location, expiry_date, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<MovementRow[]>();
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return all;
}

export default async function StokPage() {
  const supabase = await createClient();

  const [{ data: rows }, { data: bufferSetting }, movements] = await Promise.all([
    supabase.from("v_current_stock").select("*").eq("is_active", true).order("name").returns<CurrentStockRow[]>(),
    supabase.from("app_settings").select("value").eq("key", "safety_stock_buffer_percent").single(),
    fetchAllMovements(supabase),
  ]);

  const bufferPercent = (bufferSetting?.value as { percent?: number } | null)?.percent ?? 20;

  // FEFO simulation (L1 + L2 combined) for every item at once, so the
  // "Semua Lokasi" view can show the per-expiry split without any
  // extra request per row.
  const byItem = new Map<string, FefoMovement[]>();
  for (const m of movements) {
    const list = byItem.get(m.item_id);
    if (list) list.push(m);
    else byItem.set(m.item_id, [m]);
  }
  const expiryBatches: Record<string, ExpiryBatch[]> = {};
  for (const r of rows ?? []) {
    expiryBatches[r.item_id] = computeExpiryBatches(byItem.get(r.item_id) ?? []);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-title">Stok</h1>
        <Link href="/stok/rekap-bulanan" className="text-sm text-accent-600">
          Rekap Bulanan →
        </Link>
      </div>
      <StockTable rows={rows ?? []} expiryBatches={expiryBatches} bufferPercent={bufferPercent} />
    </div>
  );
}
