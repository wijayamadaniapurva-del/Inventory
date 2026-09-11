"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ItemBom, MasterItem } from "@/lib/types";

export function BomManager({
  fgItems,
  materials,
  bomRows,
}: {
  fgItems: Pick<MasterItem, "id" | "name" | "unit">[];
  materials: Pick<MasterItem, "id" | "name" | "unit">[];
  bomRows: ItemBom[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [fgItemId, setFgItemId] = useState(fgItems[0]?.id ?? "");
  const [showAddForm, setShowAddForm] = useState(false);
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [ratio, setRatio] = useState("");
  const [saving, setSaving] = useState(false);

  const fgUnit = fgItems.find((i) => i.id === fgItemId)?.unit ?? "pcs";
  const rowsForFg = useMemo(() => bomRows.filter((b) => b.fg_item_id === fgItemId), [bomRows, fgItemId]);
  const usedMaterialIds = new Set(rowsForFg.map((r) => r.material_item_id));
  const availableMaterials = materials.filter((m) => !usedMaterialIds.has(m.id));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!materialId || !ratio || Number(ratio) <= 0) return;
    const materialName = materials.find((m) => m.id === materialId)?.name;
    if (!window.confirm(`Simpan resep: 1 ${fgUnit} butuh ${ratio} ${materials.find((m) => m.id === materialId)?.unit} ${materialName}?`)) return;

    setSaving(true);
    await supabase.from("item_bom").insert({
      fg_item_id: fgItemId,
      material_item_id: materialId,
      ratio_per_unit: Number(ratio),
    });
    setSaving(false);
    setShowAddForm(false);
    setRatio("");
    router.refresh();
  }

  async function handleDelete(bomId: string) {
    if (!window.confirm("Hapus baris resep ini?")) return;
    await supabase.from("item_bom").delete().eq("id", bomId);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 max-w-xs">
        <label className="mb-1 block text-sm text-stone-600">SKU Finish Good</label>
        <select
          className="w-full"
          value={fgItemId}
          onChange={(e) => {
            setFgItemId(e.target.value);
            setShowAddForm(false);
          }}
        >
          {fgItems.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card !p-0 mb-3 overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_60px] gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
          <span>Bahan baku</span>
          <span>Rasio per 1 {fgUnit}</span>
          <span></span>
        </div>
        {rowsForFg.map((r) => {
          const m = materials.find((mm) => mm.id === r.material_item_id);
          return (
            <div key={r.id} className="grid grid-cols-[1fr_140px_60px] items-center gap-2 border-b border-stone-100 px-4 py-2 text-sm last:border-0">
              <span>{m?.name}</span>
              <span className="figure">
                {r.ratio_per_unit} {m?.unit}
              </span>
              <button onClick={() => handleDelete(r.id)} className="!h-8 !w-8 !border-0 !p-0 text-red-500" title="Hapus">
                🗑
              </button>
            </div>
          );
        })}
        {rowsForFg.length === 0 && (
          <p className="px-4 py-6 text-sm text-stone-400">Belum ada resep untuk SKU ini.</p>
        )}
      </div>

      {showAddForm ? (
        <form onSubmit={handleAdd} className="card max-w-md space-y-3">
          <div>
            <label className="mb-1 block text-sm text-stone-600">Bahan baku</label>
            <select className="w-full" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              {availableMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-600">Rasio per 1 {fgUnit}</label>
            <input type="number" min="0" step="0.0001" value={ratio} onChange={(e) => setRatio(e.target.value)} className="w-full" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Menyimpan..." : "Simpan resep"}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)}>
              Batal
            </button>
          </div>
        </form>
      ) : (
        availableMaterials.length > 0 && (
          <button onClick={() => setShowAddForm(true)} className="btn-primary">
            + Tambah bahan ke resep
          </button>
        )
      )}
    </div>
  );
}
