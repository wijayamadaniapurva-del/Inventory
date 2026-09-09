import { createClient } from "@/lib/supabase/server";
import type { MasterItem } from "@/lib/types";
import { SafetyStockManager } from "@/components/safety-stock-manager";
import { SettingsTabs } from "@/components/settings-tabs";

export const dynamic = "force-dynamic";

export default async function SafetyStockPage() {
  const supabase = await createClient();

  const [{ data: items }, { data: bufferSetting }] = await Promise.all([
    supabase
      .from("master_items")
      .select("id, name, category, unit, bpom_tag, default_price, avg_daily_usage, lead_time_days, safety_stock_qty, scalev_product_id, is_active")
      .eq("is_active", true)
      .order("category")
      .order("name")
      .returns<MasterItem[]>(),
    supabase.from("app_settings").select("value").eq("key", "safety_stock_buffer_percent").single(),
  ]);

  const bufferPercent = (bufferSetting?.value as { percent?: number } | null)?.percent ?? 20;

  return (
    <div>
      <h1 className="page-title">Master Data</h1>
      <p className="mb-4 mt-1 text-sm text-stone-500">Safety Stock</p>
      <SettingsTabs />
      <SafetyStockManager initialItems={items ?? []} initialBufferPercent={bufferPercent} />
    </div>
  );
}
