"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MasterItem } from "@/lib/types";

type Line = { materialId: string; qty: string };

export function AddShipmentForm({
  jobOrderId,
  maklonName,
  materials,
}: {
  jobOrderId: string;
  maklonName: string;
  materials: Pick<MasterItem, "id" | "name" | "unit" | "default_price">[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ materialId: materials[0]?.id ?? "", qty: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validLines = useMemo(
    () => lines.filter((l) => l.materialId && Number(l.qty) > 0),
    [lines]
  );
  const hasValidLines = validLines.length > 0;

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { materialId: materials[0]?.id ?? "", qty: "" }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasValidLines) {
      setError("Tambahkan minimal 1 material dengan qty lebih dari 0 sebelum menyimpan.");
      return;
    }

    const summary = validLines
      .map((l) => {
        const m = materials.find((mm) => mm.id === l.materialId);
        return `${m?.name} — ${l.qty} ${m?.unit}`;
      })
      .join(", ");
    if (!window.confirm(`Kirim shipment ke ${maklonName}?\n${summary}`)) return;

    setSaving(true);

    const { error: rpcError } = await supabase.rpc("create_shipment", {
      p_job_order_id: jobOrderId,
      p_lines: validLines.map((l) => ({ material_item_id: l.materialId, qty: Number(l.qty) })),
    });

    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setOpen(false);
    setLines([{ materialId: materials[0]?.id ?? "", qty: "" }]);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Tambah shipment
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      {lines.map((line, idx) => (
        <div key={idx} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-stone-600">Material</label>
            <select
              className="w-full"
              value={line.materialId}
              onChange={(e) => updateLine(idx, { materialId: e.target.value })}
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1 block text-sm text-stone-600">Qty</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.qty}
              onChange={(e) => updateLine(idx, { qty: e.target.value })}
              className="w-full"
            />
          </div>
          {lines.length > 1 && (
            <button type="button" onClick={() => removeLine(idx)} className="!px-2">
              ✕
            </button>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <button type="button" onClick={addLine}>
          + Baris material
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving || !hasValidLines} className="btn-primary flex-1">
          {saving ? "Menyimpan..." : "Simpan shipment"}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Batal
        </button>
      </div>
    </form>
  );
}
