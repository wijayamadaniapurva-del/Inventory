import { createClient } from "@/lib/supabase/server";
import type { MasterItem } from "@/lib/types";
import { MasterItemManager } from "@/components/master-item-manager";

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
      <h1 className="mb-4 text-base font-semibold">Master item</h1>
      <MasterItemManager initialItems={items ?? []} />
    </div>
  );
}
