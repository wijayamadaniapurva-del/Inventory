"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DatePicker } from "@/components/date-picker";
import { ItemPicker } from "@/components/item-picker";
import type { ItemCategory, LocationType, MasterItem, MovementType } from "@/lib/types";
import { CATEGORY_LABEL, formatQty } from "@/lib/utils";

// Which categories make sense for each movement type in this business:
// - Transfer only ever happens for Packaging (botol <-> Vendor Cat) or
//   Finish Good (Gudang L2 -> L1). Bahan baku never "transfers" between
//   locations here — it goes straight to a maklon via Job Order & Shipment.
// - Masuk includes Finish Good again for one legitimate case: recording
//   opening stock that already existed physically before this app was
//   used (no Job Order to tie it to). Regular new production should
//   still go through the QC feature so it stays traceable — the UI
//   below nudges toward that without blocking this path entirely.
// - Keluar stays open to all 3 categories (KOL/karyawan pickup, write-off).
function categoriesForType(t: MovementType): ItemCategory[] {
  if (t === "transfer") return ["packaging", "fg"];
  return ["bahan_baku", "packaging", "fg"];
}

type KeluarDestination = "" | "customer" | "kol_karyawan";

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
  const [packagingRoute, setPackagingRoute] = useState<"to_vendor_cat" | "from_vendor_cat" | "to_gudang_l1">("to_vendor_cat");
  const [keluarFromLocation, setKeluarFromLocation] = useState<"gudang_l2" | "gudang_l1">("gudang_l2");
  const [keluarDestination, setKeluarDestination] = useState<KeluarDestination>("");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const categoryOptions = categoriesForType(type);

  type PackagingRoute = "to_vendor_cat" | "from_vendor_cat" | "to_gudang_l1";

  function computeFromLocation(cat: ItemCategory, route: PackagingRoute): LocationType {
    if (cat === "fg") return "gudang_l2";
    if (route === "from_vendor_cat") return "vendor_cat";
    return "gudang_l2"; // to_vendor_cat or to_gudang_l1 both start from Gudang L2
  }

  function computeToLocation(cat: ItemCategory, route: PackagingRoute): LocationType {
    if (cat === "fg") return "gudang_l1";
    if (route === "to_vendor_cat") return "vendor_cat";
    if (route === "to_gudang_l1") return "gudang_l1";
    return "gudang_l2"; // from_vendor_cat
  }

  // For Transfer: derive from/to locations from category (+ direction for
  // Packaging) instead of two free-standing dropdowns, so an invalid
  // combination can't be picked in the first place.
  const transferToLocation: LocationType = computeToLocation(category, packagingRoute);
  const transferFromLocation: LocationType = computeFromLocation(category, packagingRoute);

  function stockAt(item: MasterItem, loc: "gudang_l2" | "gudang_l1"): number {
    return loc === "gudang_l2" ? (stockByItem[item.id]?.l2 ?? 0) : (stockByItem[item.id]?.l1 ?? 0);
  }

  function itemsAvailable(cat: ItemCategory, nextType: MovementType, route: PackagingRoute, keluarFrom: "gudang_l2" | "gudang_l1") {
    const inCat = items.filter((i) => i.category === cat);
    if (nextType === "transfer") {
      const from = computeFromLocation(cat, route);
      if (from === "gudang_l2" || from === "gudang_l1") {
        return inCat.filter((i) => stockAt(i, from) > 0);
      }
      return inCat; // Vendor Cat source: stock not tracked yet, don't filter
    }
    if (nextType === "keluar") {
      return inCat.filter((i) => stockAt(i, keluarFrom) > 0);
    }
    return inCat;
  }

  const itemsInCategory = useMemo(
    () => itemsAvailable(category, type, packagingRoute, keluarFromLocation),
    [items, category, type, packagingRoute, keluarFromLocation, stockByItem]
  );

  const selectedItem = itemsInCategory.find((i) => i.id === itemId) ?? itemsInCategory[0];

  function resetItemFor(
    nextCategory: ItemCategory,
    nextType: MovementType,
    route: PackagingRoute = packagingRoute,
    keluarFrom: "gudang_l2" | "gudang_l1" = keluarFromLocation
  ) {
    const usable = itemsAvailable(nextCategory, nextType, route, keluarFrom);
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
    if (next === "packaging") setPackagingRoute("to_vendor_cat");
    if (next !== "fg" && location === "gudang_l1") setLocation("gudang_l2");
    resetItemFor(next, type);
  }

  // Item picker options with a right-aligned stock figure — Masuk keeps
  // the plain dropdown (no stock shown), Transfer/Keluar get this.
  const pickerOptions = itemsInCategory.map((i) => {
    let subtitle: string | undefined;
    if (type === "transfer" && (transferFromLocation === "gudang_l2" || transferFromLocation === "gudang_l1")) {
      subtitle = formatQty(stockAt(i, transferFromLocation), i.unit);
    } else if (type === "keluar") {
      subtitle = formatQty(stockAt(i, keluarFromLocation), i.unit);
    }
    return { id: i.id, name: i.name, subtitle };
  });

  const showBpomWarning =
    type === "transfer" &&
    transferToLocation === "gudang_l1" &&
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
      from_location:
        type === "transfer" ? transferFromLocation : type === "keluar" ? keluarFromLocation : null,
      to_location:
        type === "transfer" ? transferToLocation : type === "masuk" ? location : type === "keluar" && keluarDestination ? keluarDestination : null,
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
        {type === "masuk" && category === "fg" && (
          <p className="mt-1 text-xs text-amber-600">
            Khusus untuk stok awal yang sudah ada sebelum pakai webapp ini (atau kondisi khusus lain). Untuk hasil produksi rutin dari maklon, gunakan fitur QC di halaman Job Order supaya tetap tertaut & tertelusuri.
          </p>
        )}
      </div>

      {/* Keluar: pick source floor first — item list + stock shown depend on it */}
      {type === "keluar" && (
        <div>
          <label className="mb-1 block text-sm text-stone-600">Lokasi asal</label>
          <select
            className="w-full"
            value={keluarFromLocation}
            onChange={(e) => {
              const next = e.target.value as "gudang_l2" | "gudang_l1";
              setKeluarFromLocation(next);
              resetItemFor(category, type, packagingRoute, next);
            }}
          >
            <option value="gudang_l2">Gudang lantai 2</option>
            <option value="gudang_l1">Gudang lantai 1</option>
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm text-stone-600">Item</label>
        {type === "masuk" ? (
          <select className="w-full" value={selectedItem?.id ?? ""} onChange={(e) => setItemId(e.target.value)}>
            {itemsInCategory.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        ) : (
          <ItemPicker options={pickerOptions} value={selectedItem?.id ?? ""} onChange={setItemId} />
        )}
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

      {type === "transfer" &&
        (category === "fg" ? (
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
              value={packagingRoute}
              onChange={(e) => {
                const next = e.target.value as "to_vendor_cat" | "from_vendor_cat" | "to_gudang_l1";
                setPackagingRoute(next);
                resetItemFor(category, type, next);
              }}
            >
              <option value="to_vendor_cat">Gudang lantai 2 → Vendor cat</option>
              <option value="from_vendor_cat">Vendor cat → Gudang lantai 2</option>
              <option value="to_gudang_l1">Gudang lantai 2 → Gudang lantai 1 (mis. kardus)</option>
            </select>
          </div>
        ))}

      {type === "masuk" && (
        <div>
          <label className="mb-1 block text-sm text-stone-600">Lokasi</label>
          <select className="w-full" value={location} onChange={(e) => setLocation(e.target.value as LocationType)}>
            <option value="gudang_l2">Gudang lantai 2</option>
            {category === "fg" && <option value="gudang_l1">Gudang lantai 1</option>}
          </select>
        </div>
      )}

      {type === "keluar" && (
        <div>
          <label className="mb-1 block text-sm text-stone-600">Tujuan (opsional)</label>
          <select
            className="w-full"
            value={keluarDestination}
            onChange={(e) => setKeluarDestination(e.target.value as KeluarDestination)}
          >
            <option value="">Lainnya / write-off</option>
            <option value="kol_karyawan">KOL / Karyawan</option>
            <option value="customer">Customer</option>
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
