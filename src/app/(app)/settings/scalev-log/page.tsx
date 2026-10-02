import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PaginationLinks } from "@/components/pagination";
import { PAGE_SIZE, pageCountOf, parsePage } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function ScalevLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { count } = await supabase.from("scalev_sync_log").select("id", { count: "exact", head: true });

  const total = count ?? 0;
  const pageCount = pageCountOf(total);
  const page = parsePage(params.page, pageCount);
  const from = (page - 1) * PAGE_SIZE;

  const { data: logs } = await supabase
    .from("scalev_sync_log")
    .select("id, direction, payload, status, note, event_key, created_at")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  return (
    <div>
      <h1 className="page-title">Master Data</h1>
      <p className="mb-4 mt-1 text-sm text-stone-500">Scalev — Log Mentah</p>
      <Link href="/settings/master-item" className="mb-4 inline-block text-sm text-accent-600">
        ← Balik ke Master Data
      </Link>
      <p className="mb-4 text-sm text-stone-500">
        Halaman debug — menampilkan isi mentah tiap event yang masuk dari Scalev (atau yang coba dikirim ke
        Scalev), supaya bisa dicek formatnya begitu webhook mulai aktif.
      </p>
      <div className="space-y-2">
        {(logs ?? []).map((log) => (
          <div key={log.id} className="card">
            <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
              <span>
                {log.direction}
                {log.event_key ? ` · ${log.event_key}` : ""}
              </span>
              <span
                className={
                  "badge " +
                  (log.status === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : log.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : log.status === "skipped"
                      ? "bg-stone-100 text-stone-600"
                      : "bg-amber-50 text-amber-700")
                }
              >
                {log.status}
              </span>
            </div>
            {log.note && <p className="mb-2 text-sm text-stone-700">{log.note}</p>}
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-stone-50 p-2 text-xs text-stone-700">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          </div>
        ))}
        {(!logs || logs.length === 0) && <p className="text-sm text-stone-400">Belum ada event yang tercatat.</p>}

        {total > 0 && (
          <div className="card !p-0">
            <PaginationLinks page={page} pageCount={pageCount} total={total} basePath="/settings/scalev-log" />
          </div>
        )}
      </div>
    </div>
  );
}
