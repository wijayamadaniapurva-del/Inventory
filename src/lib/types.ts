// Hand-written types matching supabase/schema.sql.
// Once the real Supabase project exists, prefer generating this with:
//   npx supabase gen types typescript --project-id <id> > src/lib/types.ts
// and re-adding the domain types below.

export type UserRole = "owner" | "spv" | "warehouse_staff" | "finance";

export type ItemCategory = "bahan_baku" | "packaging" | "fg";
export type ItemUnit = "liter" | "pcs" | "meter";
export type BpomStatus = "bpom" | "non_bpom";

export type MovementType = "masuk" | "transfer" | "keluar";
export type LocationType =
  | "gudang_l1"
  | "gudang_l2"
  | "vendor_cat"
  | "maklon"
  | "customer"
  | "kol_karyawan";

export type JobOrderStatus = "berjalan" | "selesai";
export type QcStatus = "pending" | "lolos" | "reject";

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  role: UserRole;
  created_at: string;
}

export interface Maklon {
  id: string;
  name: string;
  needs_ethanol: boolean;
  needs_bibit: boolean;
  is_active: boolean;
}

export interface MasterItem {
  id: string;
  name: string;
  category: ItemCategory;
  unit: ItemUnit;
  bpom_tag: BpomStatus | null; // only meaningful when category === "fg"
  default_price: number;
  safety_stock_qty: number | null;
  scalev_product_id: string | null;
  is_active: boolean;
}

export interface CurrentStockRow {
  item_id: string;
  name: string;
  category: ItemCategory;
  unit: ItemUnit;
  bpom_tag: BpomStatus | null;
  default_price: number;
  safety_stock_qty: number | null;
  qty_on_hand: number;
}

export interface StockMovement {
  id: string;
  item_id: string;
  movement_type: MovementType;
  qty: number;
  from_location: LocationType | null;
  to_location: LocationType | null;
  maklon_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string; // stored UTC — format with formatWib() before display
  // joined for display
  master_items?: Pick<MasterItem, "name" | "unit" | "category">;
}

export interface JobOrder {
  id: string;
  sku_item_id: string;
  maklon_id: string;
  target_output: number;
  actual_output: number | null;
  service_fee: number;
  status: JobOrderStatus;
  opened_at: string;
  closed_at: string | null;
  master_items?: Pick<MasterItem, "name">;
  maklon?: Pick<Maklon, "name">;
  shipments?: Shipment[];
}

export interface Shipment {
  id: string;
  job_order_id: string;
  shipped_at: string;
  surat_jalan_no: string | null;
  created_at: string;
  shipment_items?: ShipmentItem[];
}

export interface ShipmentItem {
  id: string;
  shipment_id: string;
  material_item_id: string;
  qty: number;
  unit_price: number;
  master_items?: Pick<MasterItem, "name" | "unit">;
}

export interface AppSetting {
  key: string;
  value: Record<string, unknown>;
}

// Minimal Database generic so `createBrowserClient<Database>()` / server client type-check.
// Replace with a generated type once the Supabase project is live.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
