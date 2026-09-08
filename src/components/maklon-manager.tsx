"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Maklon } from "@/lib/types";

export function MaklonManager({ initialMaklon }: { initialMaklon: Maklon[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEthanol, setNewEthanol] = useState(true);
  const [newBibit, setNewBibit] = useState(true);
  const [saving, setSaving] = useState(false);

  const active = initialMaklon.filter((m) => m.is_active);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);

    await supabase.from("maklon").insert({
      name: newName.trim(),
      needs_ethanol: newEthanol,
      needs_bibit: newBibit,
    });

    setSaving(false);
    setShowAddForm(false);
    setNewName("");
    router.refresh();
  }

  async function handleUpdate(m: Maklon, patch: Partial<Maklon>) {
    await supabase.from("maklon").update(patch).eq("id", m.id);
    setEditingId(null);
    router.refresh();
  }

  async function handleDeactivate(m: Maklon) {
    await supabase.from("maklon").update({ is_active: false }).eq("id", m.id);
    router.refresh();
  }

  return (
    <div>
      <div className="card !p-0 mb-3 overflow-hidden">
        <div className="grid grid-cols-[1fr_90px_90px_32px_32px] gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
          <span>Nama maklon</span>
          <span>Ethanol</span>
          <span>Bibit</span>
          <span></span>
          <span></span>
        </div>

        {active.map((m) => (
          <MaklonRow
            key={m.id}
            maklon={m}
            editing={editingId === m.id}
            onEdit={() => setEditingId(m.id)}
            onCancel={() => setEditingId(null)}
            onSave={(patch) => handleUpdate(m, patch)}
            onDelete={() => handleDeactivate(m)}
          />
        ))}

        {active.length === 0 && <p className="px-4 py-6 text-sm text-stone-400">Belum ada maklon.</p>}
      </div>

      {showAddForm ? (
        <form onSubmit={handleAdd} className="card max-w-md space-y-3">
          <div>
            <label className="mb-1 block text-sm text-stone-600">Nama maklon</label>
            <input
              type="text"
              required
              placeholder="misal: Maklon D"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={newEthanol} onChange={(e) => setNewEthanol(e.target.checked)} className="!h-4 !w-4" />
              Perlu dikirim ethanol
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={newBibit} onChange={(e) => setNewBibit(e.target.checked)} className="!h-4 !w-4" />
              Perlu dikirim bibit
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Menyimpan..." : "Simpan maklon"}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)}>
              Batal
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowAddForm(true)} className="btn-primary">
          + Tambah maklon
        </button>
      )}
    </div>
  );
}

function MaklonRow({
  maklon,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  maklon: Maklon;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<Maklon>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(maklon.name);
  const [ethanol, setEthanol] = useState(maklon.needs_ethanol);
  const [bibit, setBibit] = useState(maklon.needs_bibit);

  if (editing) {
    return (
      <div className="grid grid-cols-[1fr_90px_90px_32px_32px] items-center gap-2 border-b border-stone-100 px-4 py-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="!h-8" />
        <input type="checkbox" checked={ethanol} onChange={(e) => setEthanol(e.target.checked)} className="!h-4 !w-4 justify-self-start" />
        <input type="checkbox" checked={bibit} onChange={(e) => setBibit(e.target.checked)} className="!h-4 !w-4 justify-self-start" />
        <button
          onClick={() => onSave({ name, needs_ethanol: ethanol, needs_bibit: bibit })}
          className="!h-8 !w-8 !border-0 !p-0 text-accent-600"
          title="Simpan"
        >
          ✓
        </button>
        <button onClick={onCancel} className="!h-8 !w-8 !border-0 !p-0 text-stone-400" title="Batal">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_90px_90px_32px_32px] items-center gap-2 border-b border-stone-100 px-4 py-2 text-sm">
      <span>{maklon.name}</span>
      <span className={maklon.needs_ethanol ? "text-emerald-600" : "text-stone-300"}>{maklon.needs_ethanol ? "Ya" : "Tidak"}</span>
      <span className={maklon.needs_bibit ? "text-emerald-600" : "text-stone-300"}>{maklon.needs_bibit ? "Ya" : "Tidak"}</span>
      <button onClick={onEdit} className="!h-8 !w-8 !border-0 !p-0 text-stone-500" title="Edit">
        ✎
      </button>
      <button onClick={onDelete} className="!h-8 !w-8 !border-0 !p-0 text-red-500" title="Hapus">
        🗑
      </button>
    </div>
  );
}
