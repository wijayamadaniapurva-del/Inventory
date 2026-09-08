import { createClient } from "@/lib/supabase/server";
import type { Maklon } from "@/lib/types";
import { MaklonManager } from "@/components/maklon-manager";
import { SettingsTabs } from "@/components/settings-tabs";

export const dynamic = "force-dynamic";

export default async function MaklonSettingsPage() {
  const supabase = await createClient();

  const { data: maklonList } = await supabase
    .from("maklon")
    .select("id, name, needs_ethanol, needs_bibit, is_active")
    .order("name")
    .returns<Maklon[]>();

  return (
    <div>
      <h1 className="page-title">Master Data</h1>
      <p className="mb-4 mt-1 text-sm text-stone-500">Maklon</p>
      <SettingsTabs />
      <MaklonManager initialMaklon={maklonList ?? []} />
    </div>
  );
}
