import Link from "next/link";
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-title">Stok</h1>
        <Link href="/stok/rekap-bulanan" className="text-sm text-accent-600">
          Rekap Bulanan →
        </Link>
      </div>
      <StockTable rows={rows ?? []} bufferPercent={bufferPercent} />
    </div>
  );
}
