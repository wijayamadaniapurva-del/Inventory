import { createClient } from "@/lib/supabase/server";
import { formatWib, formatQty, LOCATION_LABEL, CATEGORY_LABEL } from "@/lib/utils";
import type { StockMovement } from "@/lib/types";

export const dynamic = "force-dynamic";

const MOVEMENT_COLOR: Record<string, string> = {
  masuk: "text-emerald-600",
  keluar: "text-red-600",
  transfer: "text-accent-600",
};

export default async function RiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; lokasi?: string; tanggal?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("stock_movements")
    .select("id, movement_type, qty, from_location, to_location, created_at, master_items(name, unit, category)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.kategori) {
    query = query.eq("master_items.category", params.kategori);
  }
  if (params.lokasi) {
    query = query.or(`from_location.eq.${params.lokasi},to_location.eq.${params.lokasi}`);
  }
  if (params.tanggal) {
    const start = `${params.tanggal}T00:00:00Z`;
    const end = `${params.tanggal}T23:59:59Z`;
    query = query.gte("created_at", start).lte("created_at", end);
  }

  const { data: movements } = await query.returns<StockMovement[]>();

  const filtered = params.q
    ? (movements ?? []).filter((m) =>
        m.master_items?.name.toLowerCase().includes(params.q!.toLowerCase())
      )
    : movements ?? [];

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" method="get">
        <select name="kategori" defaultValue={params.kategori ?? ""} className="w-40">
          <option value="">Semua kategori</option>
          {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select name="lokasi" defaultValue={params.lokasi ?? ""} className="w-44">
          <option value="">Semua lokasi</option>
          {Object.entries(LOCATION_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input type="date" name="tanggal" defaultValue={params.tanggal ?? ""} className="w-40" />
        <input
          type="text"
          name="q"
          placeholder="Cari SKU atau item"
          defaultValue={params.q ?? ""}
          className="flex-1 min-w-[160px]"
        />
        <button type="submit" className="btn-primary">
          Filter
        </button>
      </form>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Tanggal</th>
              <th className="px-4 py-2">Tipe</th>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Lokasi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-slate-100">
                <td className="px-4 py-2 whitespace-nowrap">{formatWib(m.created_at)}</td>
                <td className={"px-4 py-2 " + (MOVEMENT_COLOR[m.movement_type] ?? "")}>{m.movement_type}</td>
                <td className="px-4 py-2">{m.master_items?.name}</td>
                <td className="figure px-4 py-2">
                  {m.master_items ? formatQty(m.qty, m.master_items.unit) : m.qty}
                </td>
                <td className="px-4 py-2">
                  {m.movement_type === "transfer"
                    ? `${LOCATION_LABEL[m.from_location ?? ""] ?? "-"} → ${LOCATION_LABEL[m.to_location ?? ""] ?? "-"}`
                    : LOCATION_LABEL[(m.from_location || m.to_location) ?? ""] ?? "-"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Tidak ada data untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
