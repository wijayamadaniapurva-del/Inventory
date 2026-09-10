"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DatePicker } from "@/components/date-picker";
import type { ItemCategory, LocationType, MasterItem, MovementType } from "@/lib/types";
import { CATEGORY_LABEL, LOCATION_LABEL } from "@/lib/utils";

const ALL_LOCATIONS: LocationType[] = ["gudang_l2", "gudang_l1", "vendor_cat", "maklon", "customer", "kol_karyawan"];

// Which categories make sense for each movement type in this business:
// - Transfer only ever happens for Packaging (botol <-> Vendor Cat) or
//   Finish Good (Gudang L2 -> L1). Bahan baku never "transfers" between
//   locations here — it goes straight to a maklon via Job Order & Shipment.
// - Masuk excludes Finish Good: FG stock now only enters through the QC
//   feature (tied to a Job Order), never a bare manual entry, so every
//   unit of FG stays traceable to where it came from.
// - Keluar is unchanged for now (KOL/karyawan pickup, write-off) while
//   that feature's future is still being decided.
function categoriesForType(t: MovementType): ItemCategory[] {
  if (t === "transfer") return ["packaging", "fg"];
  if (t === "masuk") return ["bahan_baku", "packaging"];
  return ["bahan_baku", "packaging", "fg"];
}

export function InputStokForm({
  items,
  stockByItem,
}: {
  items: MasterItem[];
  stockByItem: Record<string, { l2: number; l1: number }>;
}) {
  const supabase = createClient();

  const [type, setType] = useState<MovementType>("masuk");
  const [category, setCategory] = useState<ItemCategory>("bahan_baku");
  const [itemId, setItemId] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [location, setLocation] = useState<LocationType>("gudang_l2");
  const [packagingToLocation, setPackagingToLocation] = useState<"vendor_cat" | "gudang_l2">("vendor_cat");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const categoryOptions = categoriesForType(type);

  // For Transfer: derive from/to locations from category (+ direction for
  // Packaging) instead of two free-standing dropdowns, so an invalid
  // combination can't be picked in the first place.
  const transferToLocation: LocationType = category === "fg" ? "gudang_l1" : packagingToLocation;
  const transferFromLocation: LocationType =
    category === "fg" ? "gudang_l2" : packagingToLocation === "vendor_cat" ? "gudang_l2" : "vendor_cat";

  const itemsInCategory = useMemo(
    () => itemsAvailable(category, type, packagingToLocation),
    [items, category, type, packagingToLocation, stockByItem]
  );

  const selectedItem = itemsInCategory.find((i) => i.id === itemId) ?? itemsInCategory[0];

  function computeFromLocation(cat: ItemCategory, pkgToLoc: "vendor_cat" | "gudang_l2"): LocationType {
    if (cat === "fg") return "gudang_l2";
    return pkgToLoc === "vendor_cat" ? "gudang_l2" : "vendor_cat";
  }

  function itemsAvailable(cat: ItemCategory, nextType: MovementType, pkgToLoc: "vendor_cat" | "gudang_l2") {
    const inCat = items.filter((i) => i.category === cat);
    if (nextType === "transfer" && computeFromLocation(cat, pkgToLoc) === "gudang_l2") {
      return inCat.filter((i) => (stockByItem[i.id]?.l2 ?? 0) > 0);
    }
    return inCat;
  }

  function resetItemFor(nextCategory: ItemCategory, nextType: MovementType, pkgToLoc: "vendor_cat" | "gudang_l2" = packagingToLocation) {
    const usable = itemsAvailable(nextCategory, nextType, pkgToLoc);
    setItemId(usable[0]?.id ?? "");
  }

  function handleTypeChange(nextType: MovementType) {
    setType(nextType);
    const allowed = categoriesForType(nextType);
    const nextCategory = allowed.includes(category) ? category : allowed[0];
    setCategory(nextCategory);
    resetItemFor(nextCategory, nextType);
  }

  function handleCategoryChange(next: ItemCategory) {
    setCategory(next);
    if (next === "packaging") setPackagingToLocation("vendor_cat");
    resetItemFor(next, type);
  }

  const showBpomWarning =
    type === "transfer" &&
    transferToLocation === "gudang_l1" &&
    selectedItem?.category === "fg" &&
    selectedItem?.bpom_tag === "non_bpom";

  const showExpiryField = type === "masuk" && category === "bahan_baku";

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
      from_location: type === "transfer" ? transferFromLocation : type === "keluar" ? location : null,
      to_location: type === "transfer" ? transferToLocation : type === "masuk" ? location : null,
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
            onClick={() => handleTypeChange(t)}
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
          {categoryOptions.map((c) => (
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
        {itemsInCategory.length === 0 && (
          <p className="mt-1 text-xs text-stone-400">
            Tidak ada item dengan stok tersedia untuk dipindahkan dari lokasi ini.
          </p>
        )}
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
        category === "fg" ? (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-stone-600">Dari lokasi</label>
              <div className="flex h-[38px] items-center text-sm text-stone-500">Gudang lantai 2</div>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-stone-600">Ke lokasi</label>
              <div className="flex h-[38px] items-center text-sm text-stone-500">Gudang lantai 1</div>
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm text-stone-600">Arah transfer</label>
            <select
              className="w-full"
              value={packagingToLocation}
              onChange={(e) => {
                const next = e.target.value as "vendor_cat" | "gudang_l2";
                setPackagingToLocation(next);
                resetItemFor(category, type, next);
              }}
            >
              <option value="vendor_cat">Gudang lantai 2 → Vendor cat</option>
              <option value="gudang_l2">Vendor cat → Gudang lantai 2</option>
            </select>
          </div>
        )
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

      <button type="submit" disabled={saving || showBpomWarning || !selectedItem} className="btn-primary w-full">
        {saving ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
