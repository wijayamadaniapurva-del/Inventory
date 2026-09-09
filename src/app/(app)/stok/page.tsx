import { createClient } from "@/lib/supabase/server";
import type { CurrentStockRow } from "@/lib/types";
import { StockTable } from "@/components/stock-table";

export const dynamic = "force-dynamic";

export default async function StokPage() {
  const supabase = await createClient();

  const [{ data: rows }, { data: bufferSetting }] = await Promise.all([
    supabase.from("v_current_stock").select("*").eq("is_active", true).order("name").returns<CurrentStockRow[]>(),
    supabase.from("app_settings").select("value").eq("key", "safety_stock_buffer_percent").single(),
  ]);

  const bufferPercent = (bufferSetting?.value as { percent?: number } | null)?.percent ?? 20;

  return (
    <div>
      <h1 className="page-title mb-4">Stok</h1>
      <StockTable rows={rows ?? []} bufferPercent={bufferPercent} />
    </div>
  );
}
