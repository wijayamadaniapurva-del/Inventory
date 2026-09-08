import { createClient } from "@/lib/supabase/server";
import type { CurrentStockRow } from "@/lib/types";
import { StockTable } from "@/components/stock-table";

export const dynamic = "force-dynamic";

export default async function StokPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("v_current_stock")
    .select("*")
    .order("name")
    .returns<CurrentStockRow[]>();

  return (
    <div>
      <h1 className="page-title mb-4">Stok</h1>
      <StockTable rows={rows ?? []} />
    </div>
  );
}
