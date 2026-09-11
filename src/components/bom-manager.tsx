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
  const router = useRouter();
  const supabase = createClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newFgId, setNewFgId] = useState(fgItems[0]?.id ?? "");
  const [newMaterialId, setNewMaterialId] = useState(materials[0]?.id ?? "");
  const [newRatio, setNewRatio] = useState("");
  const [saving, setSaving] = useState(false);

  const fgById = new Map(fgItems.map((i) => [i.id, i]));
  const materialById = new Map(materials.map((i) => [i.id, i]));

  const sortedRows = [...bomRows].sort((a, b) => {
    const fgA = fgById.get(a.fg_item_id)?.name ?? "";
    const fgB = fgById.get(b.fg_item_id)?.name ?? "";
    if (fgA !== fgB) return fgA.localeCompare(fgB);
    return (materialById.get(a.material_item_id)?.name ?? "").localeCompare(materialById.get(b.material_item_id)?.name ?? "");
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newFgId || !newMaterialId || !newRatio || Number(newRatio) <= 0) return;

    const fgUnit = fgById.get(newFgId)?.unit ?? "pcs";
    const material = materialById.get(newMaterialId);
    if (!window.confirm(`Simpan resep: 1 ${fgUnit} ${fgById.get(newFgId)?.name} butuh ${newRatio} ${material?.unit} ${material?.name}?`)) return;

    setSaving(true);
    await supabase.from("item_bom").insert({
      fg_item_id: newFgId,
      material_item_id: newMaterialId,
      ratio_per_unit: Number(newRatio),
    });
    setSaving(false);
    setShowAddForm(false);
    setNewRatio("");
    router.refresh();
  }

  async function handleDelete(row: ItemBom) {
    if (!window.confirm(`Hapus baris resep "${fgById.get(row.fg_item_id)?.name} — ${materialById.get(row.material_item_id)?.name}"?`)) return;
    await supabase.from("item_bom").delete().eq("id", row.id);
    router.refresh();
  }

  async function handleSaveRatio(row: ItemBom, newValue: number) {
    if (!window.confirm(`Simpan rasio baru: ${newValue} ${materialById.get(row.material_item_id)?.unit}?`)) return;
    await supabase.from("item_bom").update({ ratio_per_unit: newValue }).eq("id", row.id);
    setEditingId(null);
    router.refresh();
  }

  return (
    <div>
      <div className="card !p-0 mb-3 overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_140px_32px_32px] gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
          <span>SKU Finish Good</span>
          <span>Bahan baku</span>
          <span>Rasio per 1 pcs</span>
          <span></span>
          <span></span>
        </div>
        {sortedRows.map((row) => (
          <BomRow
            key={row.id}
            row={row}
            fgName={fgById.get(row.fg_item_id)?.name ?? "-"}
            materialName={materialById.get(row.material_item_id)?.name ?? "-"}
            materialUnit={materialById.get(row.material_item_id)?.unit ?? ""}
            editing={editingId === row.id}
            onEdit={() => setEditingId(row.id)}
            onCancel={() => setEditingId(null)}
            onSave={(v) => handleSaveRatio(row, v)}
            onDelete={() => handleDelete(row)}
          />
        ))}
        {sortedRows.length === 0 && <p className="px-4 py-6 text-sm text-stone-400">Belum ada resep.</p>}
      </div>

      {showAddForm ? (
        <form onSubmit={handleAdd} className="card max-w-md space-y-3">
          <div>
            <label className="mb-1 block text-sm text-stone-600">SKU Finish Good</label>
            <select className="w-full" value={newFgId} onChange={(e) => setNewFgId(e.target.value)}>
              {fgItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-600">Bahan baku</label>
            <select className="w-full" value={newMaterialId} onChange={(e) => setNewMaterialId(e.target.value)}>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-600">
              Rasio per 1 {fgById.get(newFgId)?.unit ?? "pcs"}
            </label>
            <input type="number" min="0" step="0.0001" value={newRatio} onChange={(e) => setNewRatio(e.target.value)} className="w-full" />
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
        <button onClick={() => setShowAddForm(true)} className="btn-primary">
          + Tambah resep
        </button>
      )}
    </div>
  );
}

function BomRow({
  row,
  fgName,
  materialName,
  materialUnit,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  row: ItemBom;
  fgName: string;
  materialName: string;
  materialUnit: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (value: number) => void;
  onDelete: () => void;
}) {
  const [ratio, setRatio] = useState(String(row.ratio_per_unit));

  if (editing) {
    return (
      <div className="grid grid-cols-[1fr_1fr_140px_32px_32px] items-center gap-2 border-b border-stone-100 px-4 py-2">
        <span className="text-sm">{fgName}</span>
        <span className="text-sm">{materialName}</span>
        <input type="number" min="0" step="0.0001" value={ratio} onChange={(e) => setRatio(e.target.value)} className="!h-8" />
        <button onClick={() => onSave(Number(ratio))} className="!h-8 !w-8 !border-0 !p-0 text-accent-600" title="Simpan">
          ✓
        </button>
        <button onClick={onCancel} className="!h-8 !w-8 !border-0 !p-0 text-stone-400" title="Batal">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_140px_32px_32px] items-center gap-2 border-b border-stone-100 px-4 py-2 text-sm">
      <span>{fgName}</span>
      <span>{materialName}</span>
      <span className="figure">
        {row.ratio_per_unit} {materialUnit}
      </span>
      <button onClick={onEdit} className="!h-8 !w-8 !border-0 !p-0 text-stone-500" title="Edit">
        ✎
      </button>
      <button onClick={onDelete} className="!h-8 !w-8 !border-0 !p-0 text-red-500" title="Hapus">
        🗑
      </button>
    </div>
  );
}
