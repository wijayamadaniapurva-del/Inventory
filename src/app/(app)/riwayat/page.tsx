import { createClient } from "@/lib/supabase/server";
import { formatWib, formatQty, LOCATION_LABEL, CATEGORY_LABEL } from "@/lib/utils";
import type { StockMovement } from "@/lib/types";
import { ExportExcelButton } from "@/components/export-excel-button";
import { PaginationLinks } from "@/components/pagination";
import { PAGE_SIZE, pageCountOf, parsePage } from "@/lib/pagination";

export const dynamic = "force-dynamic";

// Ceiling for the Excel export (the on-screen table is paged at PAGE_SIZE).
const EXPORT_LIMIT = 5000;

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
  searchParams: Promise<{ kategori?: string; lokasi?: string; tanggal?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Every filter now runs in the query itself (it used to be part in SQL,
  // part in JS after a 200-row fetch) — that's what makes it safe to ask
  // the database for one page at a time and for an exact total.
  function buildQuery(head: boolean) {
    let q = supabase
      .from("stock_movements")
      .select(
        "id, movement_type, qty, from_location, to_location, created_at, master_items!inner(name, unit, category), maklon(name)",
        head ? { count: "exact", head: true } : {},
      )
      .order("created_at", { ascending: false })
      // Outbound-to-customer isn't tracked manually here (regular sales
      // sync from Scalev separately) — always excluded from this log.
      // The is.null half matters: a plain "neq" would also drop rows
      // where the column is empty, since NULL <> 'customer' isn't true.
      .or("from_location.is.null,from_location.neq.customer")
      .or("to_location.is.null,to_location.neq.customer");

    if (params.kategori) {
      q = q.eq("master_items.category", params.kategori);
    }
    if (params.lokasi) {
      q = q.or(`from_location.eq.${params.lokasi},to_location.eq.${params.lokasi}`);
    }
    if (params.tanggal) {
      q = q.gte("created_at", `${params.tanggal}T00:00:00Z`).lte("created_at", `${params.tanggal}T23:59:59Z`);
    }
    if (params.q) {
      q = q.ilike("master_items.name", `%${params.q}%`);
    }
    return q;
  }

  const { count } = await buildQuery(true);
  const total = count ?? 0;
  const pageCount = pageCountOf(total);
  const page = parsePage(params.page, pageCount);
  const from = (page - 1) * PAGE_SIZE;

  const { data: movements } = await buildQuery(false)
    .range(from, from + PAGE_SIZE - 1)
    .returns<StockMovement[]>();

  const rows = movements ?? [];

  // Export keeps covering the whole filtered result, not just the page
  // on screen — capped so a huge filter can't blow up the response.
  const { data: exportData } = await buildQuery(false)
    .range(0, EXPORT_LIMIT - 1)
    .returns<StockMovement[]>();

  const exportRows = (exportData ?? []).map((m) => ({
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
            {rows.map((m) => (
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-stone-400">
                  Tidak ada data untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <PaginationLinks
          page={page}
          pageCount={pageCount}
          total={total}
          basePath="/riwayat"
          params={{ kategori: params.kategori, lokasi: params.lokasi, tanggal: params.tanggal, q: params.q }}
        />
      </div>
    </div>
  );
}
