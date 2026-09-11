import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ScalevLogPage() {
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("scalev_sync_log")
    .select("id, direction, payload, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

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
              <span>{log.direction}</span>
              <span
                className={
                  "badge " +
                  (log.status === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : log.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700")
                }
              >
                {log.status}
              </span>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-stone-50 p-2 text-xs text-stone-700">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          </div>
        ))}
        {(!logs || logs.length === 0) && <p className="text-sm text-stone-400">Belum ada event yang tercatat.</p>}
      </div>
    </div>
  );
}
