import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { CurrentStockRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: rows, error } = await supabase
    .from("v_current_stock")
    .select("*")
    .eq("is_active", true)
    .returns<CurrentStockRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // This runs on the 1st of the month — the snapshot represents the
  // month that just ended.
  const now = new Date();
  const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const snapshotMonth = prevMonth.toISOString().slice(0, 10);

  const snapshotRows = (rows ?? []).map((r) => ({
    snapshot_month: snapshotMonth,
    item_id: r.item_id,
    item_name: r.name,
    category: r.category,
    unit: r.unit,
    qty_on_hand: r.qty_on_hand,
    default_price: r.default_price,
    value: r.qty_on_hand * r.default_price,
  }));

  const { error: upsertError } = await supabase
    .from("monthly_stock_snapshots")
    .upsert(snapshotRows, { onConflict: "snapshot_month,item_id" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, snapshot_month: snapshotMonth, items: snapshotRows.length });
}
