"use client";

import { useState } from "react";
import Link from "next/link";
import { formatQty, formatWib } from "@/lib/utils";
import type { ItemUnit } from "@/lib/types";
import type { SisaRow } from "@/lib/sisa-bahan";

export interface AuditRow {
  id: string;
  skuName: string;
  skuUnit: string;
  maklonName: string;
  status: "berjalan" | "selesai";
  openedAt: string;
  targetOutput: number;
  qtyLolos: number;
  qtyReject: number;
  sisaRows: SisaRow[];
}

export function AuditTrailTable({ rows }: { rows: AuditRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="grid grid-cols-[1fr_90px_90px_90px_100px_90px] gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
        <span>Job Order</span>
        <span>Target</span>
        <span>Lolos QC</span>
        <span>Reject</span>
        <span>Selisih</span>
        <span>Status</span>
      </div>

      {rows.map((r) => {
        const variance = r.targetOutput - r.qtyLolos;
        const hasVariance = variance > 0;
        const isOpen = expandedId === r.id;
        return (
          <div key={r.id} className="border-b border-stone-100 last:border-0">
            <button
              type="button"
              onClick={() => setExpandedId(isOpen ? null : r.id)}
              className={
                "!h-auto !rounded-none !border-0 grid w-full grid-cols-[1fr_90px_90px_90px_100px_90px] items-center gap-2 px-4 py-2.5 text-left text-sm font-normal !bg-white hover:!bg-stone-50 " +
                (hasVariance ? "!bg-red-50/40" : "")
              }
            >
              <div>
                <p className="font-medium text-stone-800">
                  {r.skuName} — {r.maklonName}
                </p>
                <p className="text-xs text-stone-400">{formatWib(r.openedAt, false)}</p>
              </div>
              <span className="figure">{r.targetOutput} {r.skuUnit}</span>
              <span className="figure text-emerald-600">{r.qtyLolos} {r.skuUnit}</span>
              <span className="figure text-red-600">{r.qtyReject} {r.skuUnit}</span>
              <span className={"figure font-medium " + (hasVariance ? "text-red-600" : "text-stone-500")}>
                {variance > 0 ? `-${variance}` : variance < 0 ? `+${-variance}` : "0"} {r.skuUnit}
              </span>
              <span
                className={
                  "badge w-fit " +
                  (r.status === "berjalan" ? "bg-accent-50 text-accent-700" : "bg-emerald-50 text-emerald-700")
                }
              >
                {r.status}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
                  Perkiraan sisa bahan baku di Maklon
                </p>
                {r.sisaRows.length === 0 ? (
                  <p className="mb-2 text-sm text-stone-400">
                    Belum ada resep (BOM) untuk SKU ini, jadi belum bisa dihitung.
                  </p>
                ) : (
                  <div className="mb-2 overflow-hidden rounded-lg border border-stone-200 bg-white">
                    {r.sisaRows.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between border-b border-stone-100 px-3 py-2 text-sm last:border-0">
                        <span>{s.name}</span>
                        <span className={"figure " + (s.sisa < 0 ? "text-red-600 font-medium" : "text-stone-600")}>
                          {s.sisa < 0 ? "kurang " : ""}{formatQty(Math.abs(s.sisa), s.unit as ItemUnit)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <Link href={`/job-order/${r.id}`} className="text-sm text-accent-600">
                  Buka detail lengkap →
                </Link>
              </div>
            )}
          </div>
        );
      })}

      {rows.length === 0 && <p className="px-4 py-6 text-sm text-stone-400">Belum ada job order.</p>}
    </div>
  );
}
