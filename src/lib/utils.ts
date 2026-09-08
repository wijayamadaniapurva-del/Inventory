import type { ItemUnit } from "@/lib/types";

// All timestamps are stored in UTC in the database.
// Always render them in WIB (Asia/Jakarta) in the UI.
export function formatWib(isoUtc: string, withTime = true): string {
  const date = new Date(isoUtc);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

const UNIT_LABEL: Record<ItemUnit, string> = {
  liter: "Liter",
  pcs: "Pcs",
  meter: "Meter",
};

export function formatQty(qty: number, unit: ItemUnit): string {
  return `${new Intl.NumberFormat("id-ID").format(qty)} ${UNIT_LABEL[unit]}`;
}

export const LOCATION_LABEL: Record<string, string> = {
  gudang_l1: "Gudang lantai 1",
  gudang_l2: "Gudang lantai 2",
  vendor_cat: "Vendor cat",
  maklon: "Maklon",
  customer: "Customer",
  kol_karyawan: "KOL / Karyawan",
};

export const CATEGORY_LABEL: Record<string, string> = {
  bahan_baku: "Bahan baku",
  packaging: "Packaging",
  fg: "Finish Good",
};
