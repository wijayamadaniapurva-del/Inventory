import { createClient } from "@/lib/supabase/server";
import { formatWib, formatQty, LOCATION_LABEL, CATEGORY_LABEL } from "@/lib/utils";
import type { StockMovement } from "@/lib/types";
import { ExportExcelButton } from "@/components/export-excel-button";

export const dynamic = "force-dynamic";

const MOVEMENT_COLOR: Record<string, string> = {
  masuk: "text-emerald-600",
  keluar: "text-red-600",
  transfer: "text-accent-600",
};

function locationLabel(loc: string | null, maklonName?: string | null) {
  if (!loc) return "-";
  if (loc === "maklon" && maklonName) return maklonName;
  return LOCATION_LABEL[loc] ?? loc;
}

export default async function RiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; lokasi?: string; tanggal?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("stock_movements")
    .select("id, movement_type, qty, from_location, to_location, created_at, master_items(name, unit, category), maklon(name)")
    .order("created_at", { ascending: false })
    .limit(200);

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

  // Outbound-to-customer isn't tracked manually here (regular sales sync
  // from Scalev separately) — always excluded from this internal log.
  const withoutCustomer = (movements ?? []).filter(
    (m) => m.from_location !== "customer" && m.to_location !== "customer"
  );

  const filtered = params.q
    ? withoutCustomer.filter((m) => m.master_items?.name.toLowerCase().includes(params.q!.toLowerCase()))
    : withoutCustomer;

  const exportRows = filtered.map((m) => ({
    Tanggal: formatWib(m.created_at),
    Tipe: m.movement_type,
    Item: m.master_items?.name ?? "-",
    Qty: m.qty,
    Satuan: m.master_items?.unit ?? "-",
    Lokasi:
      m.movement_type === "transfer"
        ? `${locationLabel(m.from_location, m.maklon?.name)} -> ${locationLabel(m.to_location, m.maklon?.name)}`
        : locationLabel(m.from_location || m.to_location, m.maklon?.name),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Riwayat</h1>
        <ExportExcelButton rows={exportRows} filename="riwayat-stok.xlsx" sheetName="Riwayat" />
      </div>

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
          {Object.entries(LOCATION_LABEL)
            .filter(([k]) => k !== "customer")
            .map(([k, label]) => (
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
            <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
              <th className="px-4 py-2">Tanggal</th>
              <th className="px-4 py-2">Tipe</th>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Lokasi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-stone-100">
                <td className="px-4 py-2 whitespace-nowrap">{formatWib(m.created_at)}</td>
                <td className={"px-4 py-2 " + (MOVEMENT_COLOR[m.movement_type] ?? "")}>{m.movement_type}</td>
                <td className="px-4 py-2">{m.master_items?.name}</td>
                <td className="figure px-4 py-2">
                  {m.master_items ? formatQty(m.qty, m.master_items.unit) : m.qty}
                </td>
                <td className="px-4 py-2">
                  {m.movement_type === "transfer"
                    ? `${locationLabel(m.from_location, m.maklon?.name)} → ${locationLabel(m.to_location, m.maklon?.name)}`
                    : locationLabel(m.from_location || m.to_location, m.maklon?.name)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-stone-400">
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
