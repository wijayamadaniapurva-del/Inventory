-- =========================================================================
-- PURVU Inventory & Production — schema
-- Run this once against a fresh Supabase project (SQL Editor, or `supabase db push`).
-- =========================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type user_role as enum ('owner', 'spv', 'warehouse_staff', 'finance');
create type item_category as enum ('bahan_baku', 'packaging', 'fg');
create type item_unit as enum ('liter', 'pcs', 'meter');
create type bpom_status as enum ('bpom', 'non_bpom');
create type movement_type as enum ('masuk', 'transfer', 'keluar');
create type location_type as enum ('gudang_l1', 'gudang_l2', 'vendor_cat', 'maklon', 'customer', 'kol_karyawan');
create type job_order_status as enum ('berjalan', 'selesai');
create type qc_status as enum ('pending', 'lolos', 'reject');

-- ---------------------------------------------------------------------
-- Profiles (extends auth.users). One row per login, created via trigger
-- below whenever a new Supabase Auth user is created — default role is
-- warehouse_staff; an owner/SPV should update it from the Supabase
-- dashboard (Table editor) after inviting someone.
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  role user_role not null default 'warehouse_staff',
  created_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, username)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Login is by username only (email stays an internal Supabase Auth
-- implementation detail, never shown or typed by the user). The login
-- page looks up the matching email via this function, then signs in
-- with it normally.
create or replace function get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select au.email
  from profiles p
  join auth.users au on au.id = p.id
  where lower(p.username) = lower(p_username)
  limit 1;
$$;

revoke all on function get_email_by_username(text) from public;
grant execute on function get_email_by_username(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Maklon master data — supports N maklon natively (currently 3).
-- ---------------------------------------------------------------------
create table maklon (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  needs_ethanol boolean not null default true,
  needs_bibit boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Master items: bahan baku, packaging, FG. Category-specific meaning:
--   - unit varies (Liter / Pcs / Meter), added freely via Settings.
--   - bpom_tag only applies to category = 'fg' (per-SKU, confirmed —
--     not per-batch).
--   - default_price is the *current* default; every Shipment/movement
--     that needs a price snapshots it at creation time so historical
--     HPP never changes retroactively.
-- ---------------------------------------------------------------------
create table master_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category item_category not null,
  unit item_unit not null,
  bpom_tag bpom_status,
  default_price numeric(14, 2) not null default 0,
  safety_stock_qty numeric(14, 3), -- threshold below which Dashboard flags this item; null = no alert
  scalev_product_id text, -- filled in once Scalev integration is wired up
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bpom_tag_only_for_fg check (
    (category = 'fg') or (bpom_tag is null)
  )
);

-- BOM: ratio of raw material per 1 unit of FG output, per SKU
-- (every FG SKU has its own ratios — no global ratio).
create table item_bom (
  id uuid primary key default gen_random_uuid(),
  fg_item_id uuid not null references master_items(id) on delete cascade,
  material_item_id uuid not null references master_items(id) on delete restrict,
  ratio_per_unit numeric(14, 4) not null,
  created_at timestamptz not null default now(),
  unique (fg_item_id, material_item_id)
);

-- ---------------------------------------------------------------------
-- Stock movements — the Riwayat log. movement_type = 'transfer' uses
-- both from_location and to_location (e.g. Gudang L2 -> Gudang L1);
-- 'masuk' / 'keluar' typically use only one of the two.
-- created_at is UTC; format with formatWib() in the UI, never store WIB.
-- ---------------------------------------------------------------------
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references master_items(id),
  movement_type movement_type not null,
  qty numeric(14, 3) not null check (qty > 0),
  from_location location_type,
  to_location location_type,
  maklon_id uuid references maklon(id),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint transfer_needs_both_locations check (
    movement_type <> 'transfer' or (from_location is not null and to_location is not null)
  )
);

create index idx_stock_movements_item on stock_movements(item_id);
create index idx_stock_movements_created_at on stock_movements(created_at desc);

-- ---------------------------------------------------------------------
-- Job Order (parent) -> Shipment (child), the core audit-trail module.
-- actual_output is entered manually by the owner (never trusted from
-- the maklon's own claim). service_fee lives here, not on Shipment,
-- because it's charged per production job, not per delivery.
-- ---------------------------------------------------------------------
create table job_orders (
  id uuid primary key default gen_random_uuid(),
  sku_item_id uuid not null references master_items(id),
  maklon_id uuid not null references maklon(id),
  target_output integer not null check (target_output > 0),
  actual_output integer check (actual_output >= 0),
  service_fee numeric(14, 2) not null default 0,
  status job_order_status not null default 'berjalan',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid references profiles(id)
);

-- A Shipment can only be edited for typo-level corrections in the app
-- layer — a new wave of delivery must always be a new row here, never
-- an edit, to keep surat jalan documents and the audit trail intact.
create table shipments (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid not null references job_orders(id) on delete cascade,
  shipped_at date not null default current_date,
  surat_jalan_no text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  material_item_id uuid not null references master_items(id),
  qty numeric(14, 3) not null check (qty > 0),
  unit_price numeric(14, 2) not null, -- snapshot of master_items.default_price at creation time
  created_at timestamptz not null default now()
);

-- FG batches received back from a maklon, pending/after QC.
-- Reject and "belum BPOM" are tracked as two independent flags
-- (qc_status + the SKU's own bpom_tag), never a single combined status.
create table fg_batches (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid references job_orders(id),
  fg_item_id uuid not null references master_items(id),
  qty numeric(14, 3) not null check (qty > 0),
  qc_status qc_status not null default 'pending',
  expiry_date date,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- App-wide settings, e.g. the safety-stock formula — user-configurable
-- from the Settings page, never hardcoded.
-- Example row: ('safety_stock_formula', '{"type": "days_of_use", "days": 14}')
-- ---------------------------------------------------------------------
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value) values
  ('safety_stock_formula', '{"type": "days_of_use", "days": 14}'),
  ('output_variance_tolerance', '{"enabled": false}');
  -- tolerance intentionally disabled: owner confirmed there is no
  -- acceptable variance — every shortfall is shown as-is, unflagged
  -- by a threshold.

-- ---------------------------------------------------------------------
-- Scalev integration — structure only for now (per brief: wire the
-- real endpoints later, this just keeps the schema integration-ready).
-- ---------------------------------------------------------------------
create table scalev_sync_log (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('push_stock', 'receive_rts')),
  payload jsonb,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Current stock on hand per item = masuk - keluar. Transfers move
-- material between locations but don't change total company-wide
-- qty on hand, so they're excluded from this running total (Riwayat
-- still logs them individually, filterable by location).
-- NOTE: this does not yet model bahan-baku consumption into FG output
-- (that's tracked via Job Order HPP instead) — refine if you need a
-- live WIP/BOM-driven stock count later.
-- ---------------------------------------------------------------------
create view v_current_stock as
select
  mi.id as item_id,
  mi.name,
  mi.category,
  mi.unit,
  mi.bpom_tag,
  mi.default_price,
  mi.safety_stock_qty,
  coalesce(sum(case
    when sm.movement_type = 'masuk' then sm.qty
    when sm.movement_type = 'keluar' then -sm.qty
    else 0
  end), 0) as qty_on_hand
from master_items mi
left join stock_movements sm on sm.item_id = mi.id
group by mi.id, mi.name, mi.category, mi.unit, mi.bpom_tag, mi.default_price, mi.safety_stock_qty;

-- =========================================================================
-- Row Level Security — starting point only.
-- All authenticated users can read; only owner/SPV can write to master
-- data. Refine per table once real usage patterns are clearer (e.g.
-- restrict Finance to read-only everywhere, restrict warehouse_staff to
-- stock_movements writes only).
-- =========================================================================
alter table profiles enable row level security;
alter table maklon enable row level security;
alter table master_items enable row level security;
alter table item_bom enable row level security;
alter table stock_movements enable row level security;
alter table job_orders enable row level security;
alter table shipments enable row level security;
alter table shipment_items enable row level security;
alter table fg_batches enable row level security;
alter table app_settings enable row level security;
alter table scalev_sync_log enable row level security;

create policy "authenticated can read profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "user can update own profile" on profiles for update using (auth.uid() = id);

create policy "authenticated can read" on maklon for select using (auth.role() = 'authenticated');
create policy "authenticated can read" on master_items for select using (auth.role() = 'authenticated');
create policy "authenticated can read" on item_bom for select using (auth.role() = 'authenticated');
create policy "authenticated can read" on stock_movements for select using (auth.role() = 'authenticated');
create policy "authenticated can read" on job_orders for select using (auth.role() = 'authenticated');
create policy "authenticated can read" on shipments for select using (auth.role() = 'authenticated');
create policy "authenticated can read" on shipment_items for select using (auth.role() = 'authenticated');
create policy "authenticated can read" on fg_batches for select using (auth.role() = 'authenticated');
create policy "authenticated can read" on app_settings for select using (auth.role() = 'authenticated');

-- Writes: allow any authenticated user for now so the app is usable
-- immediately; tighten to specific roles via profiles.role before
-- going live with Finance/read-only users.
create policy "authenticated can write" on maklon for all using (auth.role() = 'authenticated');
create policy "authenticated can write" on master_items for all using (auth.role() = 'authenticated');
create policy "authenticated can write" on item_bom for all using (auth.role() = 'authenticated');
create policy "authenticated can write" on stock_movements for all using (auth.role() = 'authenticated');
create policy "authenticated can write" on job_orders for all using (auth.role() = 'authenticated');
create policy "authenticated can write" on shipments for all using (auth.role() = 'authenticated');
create policy "authenticated can write" on shipment_items for all using (auth.role() = 'authenticated');
create policy "authenticated can write" on fg_batches for all using (auth.role() = 'authenticated');
create policy "authenticated can write" on app_settings for all using (auth.role() = 'authenticated');
create policy "authenticated can write" on scalev_sync_log for all using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- Seed: master items confirmed in the wireframe review.
-- ---------------------------------------------------------------------
insert into master_items (name, category, unit, bpom_tag, default_price) values
  ('Ethanol', 'bahan_baku', 'liter', null, 45000),
  ('Bibit parfum arum', 'bahan_baku', 'liter', null, 850000),
  ('Bibit parfum aisha', 'bahan_baku', 'liter', null, 850000),
  ('Bibit parfum ariana', 'bahan_baku', 'liter', null, 850000),
  ('Bibit parfum adèle', 'bahan_baku', 'liter', null, 850000),
  ('Botol', 'packaging', 'pcs', null, 3500),
  ('Stiker', 'packaging', 'pcs', null, 500),
  ('Bubble wrap', 'packaging', 'meter', null, 4000),
  ('Hardbox', 'packaging', 'pcs', null, 2500),
  ('Arum 50ml', 'fg', 'pcs', 'bpom', 0),
  ('Aisha 50ml', 'fg', 'pcs', 'bpom', 0),
  ('Ariana 30ml', 'fg', 'pcs', 'non_bpom', 0),
  ('Adèle 3ml', 'fg', 'pcs', 'bpom', 0);

insert into maklon (name, needs_ethanol, needs_bibit) values
  ('Maklon A', true, true),
  ('Maklon B', true, true),
  ('Maklon C', false, true);
