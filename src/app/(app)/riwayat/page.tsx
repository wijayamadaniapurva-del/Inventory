import { createClient } from "@/lib/supabase/server";
import { formatWib, formatQty, LOCATION_LABEL, CATEGORY_LABEL } from "@/lib/utils";
import type { StockMovement } from "@/lib/types";
import { ExportExcelButton } from "@/components/export-excel-button";
import { RiwayatFilters } from "@/components/riwayat-filters";
import { PaginationLinks } from "@/components/pagination";
import { PAGE_SIZE, pageCountOf, parsePage } from "@/lib/pagination";
import { requireAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Ceiling for the Excel export (the on-screen table is paged at PAGE_SIZE).
const EXPORT_LIMIT = 5000;

const MOVEMENT_COLOR: Record<string, string> = {
  masuk: "text-emerald-600",
  keluar: "text-red-600",
  transfer: "text-accent-600",
};

// Movements written by the Scalev webhook carry "Scalev order <id>" in
// their note; nothing typed by hand does. That's what separates an
// automatic sale from a manual entry in the list below.
function isFromScalev(note: string | null | undefined): boolean {
  return Boolean(note?.toLowerCase().includes("scalev"));
}

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
  await requireAccess("/riwayat");
  const params = await searchParams;
  const supabase = await createClient();

  // Every filter now runs in the query itself (it used to be part in SQL,
  // part in JS after a 200-row fetch) — that's what makes it safe to ask
  // the database for one page at a time and for an exact total.
  function buildQuery(head: boolean) {
    let q = supabase
      .from("stock_movements")
      .select(
        "id, movement_type, qty, from_location, to_location, note, created_at, master_items!inner(name, unit, category), maklon(name)",
        head ? { count: "exact", head: true } : {},
      )
      .order("created_at", { ascending: false });

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
    Sumber: isFromScalev(m.note) ? "Scalev" : "Input manual",
    Catatan: m.note ?? "",
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Riwayat</h1>
        <ExportExcelButton rows={exportRows} filename="riwayat-stok.xlsx" sheetName="Riwayat" />
      </div>

      <RiwayatFilters
        kategori={params.kategori}
        lokasi={params.lokasi}
        tanggal={params.tanggal}
        q={params.q}
      />

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
                <td className="px-4 py-2">
                  <span>{m.master_items?.name}</span>
                  {isFromScalev(m.note) && (
                    <span
                      className="badge ml-2 bg-accent-50 text-accent-700"
                      title={m.note ?? undefined}
                    >
                      Scalev
                    </span>
                  )}
                </td>
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
