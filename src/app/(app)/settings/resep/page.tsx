import { createClient } from "@/lib/supabase/server";
import type { ItemBom, MasterItem } from "@/lib/types";
import { BomManager } from "@/components/bom-manager";
import { SettingsTabs } from "@/components/settings-tabs";

export const dynamic = "force-dynamic";

export default async function ResepPage() {
  const supabase = await createClient();

  const [{ data: fgItems }, { data: materials }, { data: bomRows }] = await Promise.all([
    supabase.from("master_items").select("id, name, unit").eq("category", "fg").eq("is_active", true).order("name").returns<Pick<MasterItem, "id" | "name" | "unit">[]>(),
    supabase
      .from("master_items")
      .select("id, name, unit")
      .in("category", ["bahan_baku", "packaging"])
      .eq("is_active", true)
      .order("name")
      .returns<Pick<MasterItem, "id" | "name" | "unit">[]>(),
    supabase.from("item_bom").select("id, fg_item_id, material_item_id, ratio_per_unit").returns<ItemBom[]>(),
  ]);

  return (
    <div>
      <h1 className="page-title">Master Data</h1>
      <p className="mb-4 mt-1 text-sm text-stone-500">Resep (BOM)</p>
      <SettingsTabs />
      <BomManager fgItems={fgItems ?? []} materials={materials ?? []} bomRows={bomRows ?? []} />
    </div>
  );
}
