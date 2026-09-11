"use client";

import { useState } from "react";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const materialById = new Map(materials.map((m) => [m.id, m]));

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="grid grid-cols-[1fr_110px] gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
        <span>SKU Finish Good</span>
        <span>Jumlah bahan</span>
      </div>
      {fgItems.map((fg) => {
        const rows = bomRows.filter((b) => b.fg_item_id === fg.id);
        return (
          <FgResepRow
            key={fg.id}
            fg={fg}
            rows={rows}
            materials={materials}
            materialById={materialById}
            expanded={expandedId === fg.id}
            onToggle={() => setExpandedId(expandedId === fg.id ? null : fg.id)}
          />
        );
      })}
      {fgItems.length === 0 && <p className="px-4 py-6 text-sm text-stone-400">Belum ada SKU Finish Good.</p>}
    </div>
  );
}

function FgResepRow({
  fg,
  rows,
  materials,
  materialById,
  expanded,
  onToggle,
}: {
  fg: Pick<MasterItem, "id" | "name" | "unit">;
  rows: ItemBom[];
  materials: Pick<MasterItem, "id" | "name" | "unit">[];
  materialById: Map<string, Pick<MasterItem, "id" | "name" | "unit">>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newMaterialId, setNewMaterialId] = useState(materials[0]?.id ?? "");
  const [newRatio, setNewRatio] = useState("");
  const [saving, setSaving] = useState(false);

  const usedMaterialIds = new Set(rows.map((r) => r.material_item_id));
  const availableMaterials = materials.filter((m) => !usedMaterialIds.has(m.id));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newMaterialId || !newRatio || Number(newRatio) <= 0) return;
    const material = materialById.get(newMaterialId);
    if (!window.confirm(`Simpan resep: 1 ${fg.unit} ${fg.name} butuh ${newRatio} ${material?.unit} ${material?.name}?`)) return;

    setSaving(true);
    await supabase.from("item_bom").insert({
      fg_item_id: fg.id,
      material_item_id: newMaterialId,
      ratio_per_unit: Number(newRatio),
    });
    setSaving(false);
    setShowAddForm(false);
    setNewRatio("");
    router.refresh();
  }

  async function handleDelete(row: ItemBom) {
    if (!window.confirm(`Hapus "${materialById.get(row.material_item_id)?.name}" dari resep ${fg.name}?`)) return;
    await supabase.from("item_bom").delete().eq("id", row.id);
    router.refresh();
  }

  async function handleSaveRatio(row: ItemBom, value: number) {
    if (!window.confirm(`Simpan rasio baru: ${value} ${materialById.get(row.material_item_id)?.unit}?`)) return;
    await supabase.from("item_bom").update({ ratio_per_unit: value }).eq("id", row.id);
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="border-b border-stone-100 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="!h-auto !rounded-none !border-0 grid w-full grid-cols-[1fr_110px] items-center gap-2 px-4 py-2.5 text-left text-sm font-normal !bg-white hover:!bg-stone-50"
      >
        <span className="font-medium text-stone-800">{fg.name}</span>
        <span className="text-stone-400">{rows.length} bahan</span>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
          {rows.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-lg border border-stone-200 bg-white">
              {rows.map((row) => {
                const material = materialById.get(row.material_item_id);
                if (editingId === row.id) {
                  return <EditRatioRow key={row.id} row={row} unit={material?.unit ?? ""} onSave={(v) => handleSaveRatio(row, v)} onCancel={() => setEditingId(null)} />;
                }
                return (
                  <div key={row.id} className="grid grid-cols-[1fr_120px_32px_32px] items-center gap-2 border-b border-stone-100 px-3 py-2 text-sm last:border-0">
                    <span>{material?.name}</span>
                    <span className="figure text-stone-600">
                      {row.ratio_per_unit} {material?.unit}
                    </span>
                    <button onClick={() => setEditingId(row.id)} className="!h-8 !w-8 !border-0 !p-0 text-stone-500" title="Edit">
                      ✎
                    </button>
                    <button onClick={() => handleDelete(row)} className="!h-8 !w-8 !border-0 !p-0 text-red-500" title="Hapus">
                      🗑
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {rows.length === 0 && <p className="mb-3 text-sm text-stone-400">Belum ada resep untuk SKU ini.</p>}

          {showAddForm ? (
            <form onSubmit={handleAdd} className="max-w-sm space-y-2 rounded-lg border border-stone-200 bg-white p-3">
              <select className="w-full" value={newMaterialId} onChange={(e) => setNewMaterialId(e.target.value)}>
                {availableMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.0001"
                placeholder={`Rasio per 1 ${fg.unit}`}
                value={newRatio}
                onChange={(e) => setNewRatio(e.target.value)}
                className="w-full"
              />
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)}>
                  Batal
                </button>
              </div>
            </form>
          ) : (
            availableMaterials.length > 0 && (
              <button onClick={() => setShowAddForm(true)} className="btn-primary">
                + Tambah bahan
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function EditRatioRow({
  row,
  unit,
  onSave,
  onCancel,
}: {
  row: ItemBom;
  unit: string;
  onSave: (value: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(String(row.ratio_per_unit));
  return (
    <div className="grid grid-cols-[1fr_120px_32px_32px] items-center gap-2 border-b border-stone-100 px-3 py-2 last:border-0">
      <span className="text-sm text-stone-400">{unit}</span>
      <input type="number" min="0" step="0.0001" value={value} onChange={(e) => setValue(e.target.value)} className="!h-8" />
      <button onClick={() => onSave(Number(value))} className="!h-8 !w-8 !border-0 !p-0 text-accent-600" title="Simpan">
        ✓
      </button>
      <button onClick={onCancel} className="!h-8 !w-8 !border-0 !p-0 text-stone-400" title="Batal">
        ✕
      </button>
    </div>
  );
}
