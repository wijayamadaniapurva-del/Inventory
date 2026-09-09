"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DatePicker } from "@/components/date-picker";
import type { ItemCategory, LocationType, MasterItem, MovementType } from "@/lib/types";
import { CATEGORY_LABEL, LOCATION_LABEL } from "@/lib/utils";

const CATEGORIES: ItemCategory[] = ["bahan_baku", "packaging", "fg"];
const ALL_LOCATIONS: LocationType[] = ["gudang_l2", "gudang_l1", "vendor_cat", "maklon", "customer", "kol_karyawan"];

export function InputStokForm({ items }: { items: MasterItem[] }) {
  const supabase = createClient();

  const [type, setType] = useState<MovementType>("masuk");
  const [category, setCategory] = useState<ItemCategory>("bahan_baku");
  const [itemId, setItemId] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [location, setLocation] = useState<LocationType>("gudang_l2");
  const [fromLocation, setFromLocation] = useState<LocationType>("gudang_l2");
  const [toLocation, setToLocation] = useState<LocationType>("gudang_l1");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const itemsInCategory = useMemo(
    () => items.filter((i) => i.category === category),
    [items, category]
  );

  const selectedItem = itemsInCategory.find((i) => i.id === itemId) ?? itemsInCategory[0];

  function handleCategoryChange(next: ItemCategory) {
    setCategory(next);
    const first = items.find((i) => i.category === next);
    setItemId(first?.id ?? "");
  }

  const showBpomWarning =
    type === "transfer" &&
    toLocation === "gudang_l1" &&
    selectedItem?.category === "fg" &&
    selectedItem?.bpom_tag === "non_bpom";

  const showExpiryField = type === "masuk" && (category === "bahan_baku" || category === "fg");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem || !qty) return;

    if (!window.confirm(`Simpan ${type} ${qty} ${selectedItem.unit} ${selectedItem.name}?`)) return;

    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from("stock_movements").insert({
      item_id: selectedItem.id,
      movement_type: type,
      qty: Number(qty),
      from_location: type === "transfer" ? fromLocation : type === "keluar" ? location : null,
      to_location: type === "transfer" ? toLocation : type === "masuk" ? location : null,
      expiry_date: showExpiryField && expiryDate ? expiryDate : null,
    });

    setSaving(false);

    if (error) {
      setMessage({ kind: "error", text: "Gagal menyimpan: " + error.message });
      return;
    }

    setMessage({ kind: "success", text: "Tersimpan." });
    setQty("");
    setExpiryDate("");
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="flex gap-2">
        {(["masuk", "transfer", "keluar"] as MovementType[]).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={
              "flex-1 capitalize " +
              (type === t ? "!border-accent-600 !bg-accent-50 !text-accent-700" : "")
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-sm text-stone-600">Kategori</label>
        <select
          className="w-full"
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value as ItemCategory)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm text-stone-600">Item</label>
        <select className="w-full" value={selectedItem?.id ?? ""} onChange={(e) => setItemId(e.target.value)}>
          {itemsInCategory.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        {selectedItem?.category === "fg" && selectedItem.bpom_tag && (
          <span
            className={
              "badge mt-2 " +
              (selectedItem.bpom_tag === "bpom"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700")
            }
          >
            {selectedItem.bpom_tag === "bpom" ? "BPOM" : "Non-BPOM"}
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm text-stone-600">Jumlah</label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="w-24">
          <label className="mb-1 block text-sm text-stone-600">Satuan</label>
          <div className="flex h-[38px] items-center text-sm text-stone-500">
            {selectedItem ? selectedItem.unit : "-"}
          </div>
        </div>
      </div>

      {showExpiryField && (
        <div>
          <label className="mb-1 block text-sm text-stone-600">Tanggal kadaluarsa (opsional)</label>
          <DatePicker value={expiryDate} onChange={setExpiryDate} />
        </div>
      )}

      {type === "transfer" ? (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-stone-600">Dari lokasi</label>
            <select className="w-full" value={fromLocation} onChange={(e) => setFromLocation(e.target.value as LocationType)}>
              {ALL_LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {LOCATION_LABEL[l]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm text-stone-600">Ke lokasi</label>
            <select className="w-full" value={toLocation} onChange={(e) => setToLocation(e.target.value as LocationType)}>
              {ALL_LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {LOCATION_LABEL[l]}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm text-stone-600">Lokasi</label>
          <select className="w-full" value={location} onChange={(e) => setLocation(e.target.value as LocationType)}>
            {ALL_LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {LOCATION_LABEL[l]}
              </option>
            ))}
          </select>
        </div>
      )}

      {showBpomWarning && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Item non-BPOM tidak bisa ditransfer ke Gudang lantai 1.
        </p>
      )}

      {message && (
        <p className={message.kind === "success" ? "text-sm text-emerald-600" : "text-sm text-red-600"}>
          {message.text}
        </p>
      )}

      <button type="submit" disabled={saving || showBpomWarning} className="btn-primary w-full">
        {saving ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
