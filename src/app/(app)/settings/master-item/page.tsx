import { createClient } from "@/lib/supabase/server";
import type { MasterItem } from "@/lib/types";
import { MasterItemManager } from "@/components/master-item-manager";
import { SettingsTabs } from "@/components/settings-tabs";

export const dynamic = "force-dynamic";

export default async function MasterItemPage() {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("master_items")
    .select("id, name, category, unit, bpom_tag, default_price, safety_stock_qty, scalev_product_id, is_active")
    .order("category")
    .order("name")
    .returns<MasterItem[]>();

  return (
    <div>
      <h1 className="page-title">Master Data</h1>
      <p className="mb-4 mt-1 text-sm text-stone-500">Master item</p>
      <SettingsTabs />
      <MasterItemManager initialItems={items ?? []} />
    </div>
  );
}
