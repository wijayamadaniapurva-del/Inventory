import { createClient } from "@/lib/supabase/server";
import type { MasterItem } from "@/lib/types";
import { InputStokForm } from "@/components/input-stok-form";

export const dynamic = "force-dynamic";

export default async function InputStokPage() {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("master_items")
    .select("id, name, category, unit, bpom_tag, default_price, safety_stock_qty, scalev_product_id, is_active")
    .eq("is_active", true)
    .order("name")
    .returns<MasterItem[]>();

  return (
    <div className="max-w-md">
      <InputStokForm items={items ?? []} />
    </div>
  );
}
