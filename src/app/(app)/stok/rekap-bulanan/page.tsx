import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MonthlyRecapTable, type SnapshotRow } from "@/components/monthly-recap-table";

export const dynamic = "force-dynamic";

export default async function RekapBulananPage() {
  const supabase = await createClient();

  const { data: snapshots } = await supabase
    .from("monthly_stock_snapshots")
    .select("snapshot_month, item_id, item_name, category, unit, qty_on_hand, default_price, value")
    .order("snapshot_month", { ascending: false });

  const rowsByMonth: Record<string, SnapshotRow[]> = {};
  for (const s of snapshots ?? []) {
    const key = s.snapshot_month as string;
    if (!rowsByMonth[key]) rowsByMonth[key] = [];
    rowsByMonth[key].push(s as unknown as SnapshotRow);
  }
  const months = Object.keys(rowsByMonth).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-title">Stok</h1>
        <Link href="/stok" className="text-sm text-accent-600">
          ← Stok saat ini
        </Link>
      </div>
      <p className="mb-4 text-sm text-stone-500">Rekap Bulanan</p>
      <MonthlyRecapTable months={months} rowsByMonth={rowsByMonth} />
    </div>
  );
}
