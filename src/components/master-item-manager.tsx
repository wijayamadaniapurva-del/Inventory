"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BpomStatus, ItemCategory, ItemUnit, MasterItem } from "@/lib/types";
import { CATEGORY_LABEL, formatCurrency } from "@/lib/utils";
import { CurrencyInput } from "@/components/currency-input";

const CATEGORIES: ItemCategory[] = ["bahan_baku", "packaging", "fg"];
const UNITS: ItemUnit[] = ["liter", "pcs", "meter"];

export function MasterItemManager({ initialItems }: { initialItems: MasterItem[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [category, setCategory] = useState<ItemCategory>("bahan_baku");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<ItemCategory>("bahan_baku");
  const [newUnit, setNewUnit] = useState<ItemUnit>("liter");
  const [newBpom, setNewBpom] = useState<BpomStatus>("bpom");
  const [newPrice, setNewPrice] = useState(0);
  const [saving, setSaving] = useState(false);

  const items = initialItems.filter((i) => i.category === category && i.is_active);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    if (!window.confirm(`Tambah item "${newName.trim()}" ke kategori ${CATEGORY_LABEL[newCategory]}?`)) return;
    setSaving(true);

    await supabase.from("master_items").insert({
      name: newName.trim(),
      category: newCategory,
      unit: newUnit,
      bpom_tag: newCategory === "fg" ? newBpom : null,
      default_price: newPrice,
    });

    setSaving(false);
    setShowAddForm(false);
    setNewName("");
    setNewPrice(0);
    router.refresh();
  }

  async function handleUpdate(item: MasterItem, patch: Partial<MasterItem>) {
    await supabase.from("master_items").update(patch).eq("id", item.id);
    setEditingId(null);
    router.refresh();
  }

  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function handleDelete(item: MasterItem) {
    // Try a real delete first — foreign keys will reject it if this item
    // is referenced by any stock movement, shipment, job order, or BOM.
    // Only when that happens do we fall back to archiving, so items that
    // were never actually used can be removed for good.
    const { error } = await supabase.from("master_items").delete().eq("id", item.id);

    if (error) {
      await supabase.from("master_items").update({ is_active: false }).eq("id", item.id);
      setStatusMsg(`"${item.name}" sudah pernah dipakai di transaksi, jadi diarsipkan (bukan dihapus permanen).`);
    } else {
      setStatusMsg(`"${item.name}" dihapus permanen.`);
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={category === c ? "!border-accent-600 !bg-accent-50 !text-accent-700" : ""}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {statusMsg && <p className="mb-3 text-sm text-stone-500">{statusMsg}</p>}

      <div className="card !p-0 mb-3 overflow-hidden">
        <div
          className="grid gap-2 border-b border-stone-200 px-4 py-2 text-xs text-stone-500"
          style={{ gridTemplateColumns: category === "fg" ? "1fr 60px 90px 110px 32px 32px" : "1fr 70px 110px 32px 32px" }}
        >
          <span>Nama item</span>
          <span>Satuan</span>
          {category === "fg" && <span>Tag BPOM</span>}
          <span>Harga</span>
          <span></span>
          <span></span>
        </div>

        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            isFg={category === "fg"}
            editing={editingId === item.id}
            onEdit={() => setEditingId(item.id)}
            onCancel={() => setEditingId(null)}
            onSave={(patch) => handleUpdate(item, patch)}
            onDelete={() => {
              if (!window.confirm(`Hapus item "${item.name}"? Kalau item ini belum pernah dipakai di transaksi apa pun, akan dihapus permanen. Kalau sudah pernah dipakai, akan diarsipkan (tetap tersimpan untuk data lama, hilang dari pilihan baru).`)) return;
              handleDelete(item);
            }}
          />
        ))}

        {items.length === 0 && (
          <p className="px-4 py-6 text-sm text-stone-400">Belum ada item di kategori ini.</p>
        )}
      </div>

      {showAddForm ? (
        <form onSubmit={handleAdd} className="card max-w-md space-y-3">
          <div>
            <label className="mb-1 block text-sm text-stone-600">Nama item</label>
            <input
              type="text"
              required
              placeholder="misal: bibit parfum ariana"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-600">Kategori</label>
            <select
              className="w-full"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ItemCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-stone-600">Satuan</label>
              <select className="w-full" value={newUnit} onChange={(e) => setNewUnit(e.target.value as ItemUnit)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-stone-600">Harga default</label>
              <CurrencyInput value={newPrice} onChange={setNewPrice} />
            </div>
          </div>
          {newCategory === "fg" && (
            <div>
              <label className="mb-1 block text-sm text-stone-600">Tag BPOM</label>
              <select className="w-full" value={newBpom} onChange={(e) => setNewBpom(e.target.value as BpomStatus)}>
                <option value="bpom">BPOM</option>
                <option value="non_bpom">Non-BPOM</option>
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Menyimpan..." : "Simpan item"}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)}>
              Batal
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowAddForm(true)} className="btn-primary">
          + Tambah item
        </button>
      )}
    </div>
  );
}

function ItemRow({
  item,
  isFg,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  item: MasterItem;
  isFg: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<MasterItem>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState<ItemUnit>(item.unit);
  const [bpom, setBpom] = useState<BpomStatus>(item.bpom_tag ?? "bpom");
  const [price, setPrice] = useState(item.default_price);

  const cols = isFg ? "1fr 60px 90px 110px 32px 32px" : "1fr 70px 110px 32px 32px";

  if (editing) {
    return (
      <div className="grid items-center gap-2 border-b border-stone-100 px-4 py-2" style={{ gridTemplateColumns: cols }}>
        <input value={name} onChange={(e) => setName(e.target.value)} className="!h-8" />
        <select value={unit} onChange={(e) => setUnit(e.target.value as ItemUnit)} className="!h-8">
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        {isFg && (
          <select value={bpom} onChange={(e) => setBpom(e.target.value as BpomStatus)} className="!h-8 text-xs">
            <option value="bpom">BPOM</option>
            <option value="non_bpom">Non-BPOM</option>
          </select>
        )}
        <CurrencyInput value={price} onChange={setPrice} className="!h-8 text-xs" />
        <button
          onClick={() => {
            if (!window.confirm(`Simpan perubahan item "${name}"?`)) return;
            onSave({ name, unit, bpom_tag: isFg ? bpom : null, default_price: price });
          }}
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
    <div className="grid items-center gap-2 border-b border-stone-100 px-4 py-2 text-sm" style={{ gridTemplateColumns: cols }}>
      <span>{item.name}</span>
      <span className="text-stone-500">{item.unit}</span>
      {isFg && (
        <span className={"badge " + (item.bpom_tag === "bpom" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
          {item.bpom_tag === "bpom" ? "BPOM" : "Non-BPOM"}
        </span>
      )}
      <span className="figure">{formatCurrency(item.default_price)}</span>
      <button onClick={onEdit} className="!h-8 !w-8 !border-0 !p-0 text-stone-500" title="Edit">
        ✎
      </button>
      <button onClick={onDelete} className="!h-8 !w-8 !border-0 !p-0 text-red-500" title="Hapus">
        🗑
      </button>
    </div>
  );
}
