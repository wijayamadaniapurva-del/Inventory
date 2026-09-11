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
  safety_stock_qty numeric(14, 3), -- deprecated: superseded by the avg_daily_usage x lead_time_days x buffer formula below; kept for backward compatibility, no longer written to by the app
  avg_daily_usage numeric(14, 3), -- for safety stock formula: average qty used per day
  lead_time_days integer, -- for safety stock formula: days from shipping to maklon until FG is back (or supplier lead time for materials)
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
  expiry_date date, -- optional; set on 'masuk' movements for raw materials that expire
  job_order_id uuid references job_orders(id), -- links this movement to a Job Order for the audit trail (shipments out, QC'd FG in)
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
-- actual_output is entered manually by SPV/Warehouse Staff (never
-- trusted from the maklon's own claim). Owner and Finance can view
-- everything here but never input/edit (enforced below via RLS, not
-- just hidden in the UI). service_fee lives here, not on Shipment,
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
  deleted_at timestamptz, -- soft delete only: "deleting" a job order never
                          -- removes it, just hides it from the app (see
                          -- soft_delete_job_order() below)
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
  ('safety_stock_buffer_percent', '{"percent": 20}'),
  ('output_variance_tolerance', '{"enabled": false}');
  -- Safety stock per item = avg_daily_usage x lead_time_days x (1 + buffer_percent/100).
  -- buffer_percent is global (one setting for all items); avg_daily_usage and
  -- lead_time_days are per-item (columns on master_items), set from
  -- Master Data -> Safety Stock (SPV only).
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
-- Monthly stock value snapshot — captured automatically by a Vercel Cron
-- job on the 1st of each month (see src/app/api/cron/monthly-snapshot),
-- representing closing stock for the month that just ended. Written
-- with the Supabase service role key (cron has no logged-in user), so
-- it bypasses RLS — that's why there's no insert/update policy for it
-- below, only a read policy for browsing in the app.
-- ---------------------------------------------------------------------
create table monthly_stock_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_month date not null, -- first day of the month this snapshot represents
  item_id uuid not null references master_items(id),
  item_name text not null, -- copied at snapshot time so a later item rename/archive doesn't rewrite history
  category item_category not null,
  unit item_unit not null,
  qty_on_hand numeric(14, 3) not null,
  default_price numeric(14, 2) not null,
  value numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  unique (snapshot_month, item_id)
);

alter table monthly_stock_snapshots enable row level security;
create policy "authenticated can read" on monthly_stock_snapshots for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- Current stock on hand per item = masuk - keluar (company-wide total,
-- unchanged — still used for Dashboard totals and the safety stock
-- alert). qty_gudang_l2 / qty_gudang_l1 break the same total down by
-- floor, since FG passing QC lands in L2 first (limited space in L1)
-- and only moves to L1 via a separate Transfer — so "total on hand"
-- alone doesn't say which floor it's actually sitting on.
-- is_active lets callers exclude archived items (fixes the bug where a
-- deactivated item's stock kept showing on the Stok page).
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
  mi.avg_daily_usage,
  mi.lead_time_days,
  mi.is_active,
  coalesce(sum(case
    when sm.movement_type = 'masuk' then sm.qty
    when sm.movement_type = 'keluar' then -sm.qty
    else 0
  end), 0) as qty_on_hand,
  coalesce(sum(case
    when sm.to_location = 'gudang_l2' and sm.movement_type in ('masuk', 'transfer') then sm.qty
    when sm.from_location = 'gudang_l2' and sm.movement_type in ('keluar', 'transfer') then -sm.qty
    else 0
  end), 0) as qty_gudang_l2,
  coalesce(sum(case
    when sm.to_location = 'gudang_l1' and sm.movement_type in ('masuk', 'transfer') then sm.qty
    when sm.from_location = 'gudang_l1' and sm.movement_type in ('keluar', 'transfer') then -sm.qty
    else 0
  end), 0) as qty_gudang_l1
from master_items mi
left join stock_movements sm on sm.item_id = mi.id
group by mi.id, mi.name, mi.category, mi.unit, mi.bpom_tag, mi.default_price, mi.avg_daily_usage, mi.lead_time_days, mi.is_active;

-- ---------------------------------------------------------------------
-- Audit trail summary per Job Order: target vs QC'd lolos/reject, for
-- the Audit Trail list page. A Job Order can have more than one QC
-- entry (partial deliveries) — this aggregates all of them.
-- ---------------------------------------------------------------------
create view v_job_order_variance as
select
  jo.id,
  jo.target_output,
  jo.actual_output,
  jo.status,
  jo.opened_at,
  jo.closed_at,
  jo.sku_item_id,
  jo.maklon_id,
  mi.name as sku_name,
  mi.unit as sku_unit,
  m.name as maklon_name,
  coalesce(sum(fb.qty) filter (where fb.qc_status = 'lolos'), 0) as qty_lolos,
  coalesce(sum(fb.qty) filter (where fb.qc_status = 'reject'), 0) as qty_reject
from job_orders jo
join master_items mi on mi.id = jo.sku_item_id
join maklon m on m.id = jo.maklon_id
left join fg_batches fb on fb.job_order_id = jo.id
where jo.deleted_at is null
group by jo.id, mi.name, mi.unit, m.name;

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

-- Job Order / Shipment: real role enforcement, not just hidden UI.
-- Owner and Finance are view-only here; SPV and Warehouse Staff can
-- create/edit; only SPV can delete a job order (cascades to its
-- shipments automatically via the foreign key).
create or replace function current_user_role()
returns user_role
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid()
$$;

create policy "spv and warehouse_staff can insert job_orders" on job_orders
  for insert with check (current_user_role() in ('spv', 'warehouse_staff'));
create policy "spv and warehouse_staff can update job_orders" on job_orders
  for update using (current_user_role() in ('spv', 'warehouse_staff'));
-- No delete policy on job_orders on purpose: hard deletes are blocked
-- entirely. The only way to remove one from view is soft_delete_job_order()
-- below, which just sets deleted_at — data is never actually lost.
create or replace function soft_delete_job_order(p_job_order_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if current_user_role() <> 'spv' then
    raise exception 'Hanya SPV yang bisa menghapus job order.';
  end if;

  update job_orders set deleted_at = now() where id = p_job_order_id;
end;
$$;

revoke all on function soft_delete_job_order(uuid) from public;
grant execute on function soft_delete_job_order(uuid) to authenticated;

-- Creates a Shipment + its line items + the matching Riwayat entries in
-- one atomic transaction. Validates server-side that at least one
-- material line was provided — the UI also disables the submit button
-- for this, but this is the real enforcement (can't be bypassed by
-- calling the API directly).
create or replace function create_shipment(p_job_order_id uuid, p_lines jsonb)
returns uuid
language plpgsql
security definer
as $$
declare
  v_shipment_id uuid;
  v_line jsonb;
  v_material_id uuid;
  v_qty numeric;
  v_price numeric;
  v_maklon_id uuid;
  v_sku_name text;
  v_maklon_name text;
  v_material_name text;
  v_available numeric;
begin
  if current_user_role() not in ('spv', 'warehouse_staff') then
    raise exception 'Tidak punya akses untuk menambah shipment.';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Tambahkan minimal 1 material sebelum menyimpan.';
  end if;

  select jo.maklon_id, mi.name, m.name
    into v_maklon_id, v_sku_name, v_maklon_name
  from job_orders jo
  join master_items mi on mi.id = jo.sku_item_id
  join maklon m on m.id = jo.maklon_id
  where jo.id = p_job_order_id;

  if v_maklon_id is null then
    raise exception 'Job order tidak ditemukan.';
  end if;

  -- Validate stock BEFORE writing anything, so a shortage on line 3
  -- doesn't leave lines 1-2 already committed.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_material_id := (v_line->>'material_item_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;

    if v_material_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Setiap baris material harus punya qty lebih dari 0.';
    end if;

    select name into v_material_name from master_items where id = v_material_id;
    select qty_gudang_l2 into v_available from v_current_stock where item_id = v_material_id;

    if coalesce(v_available, 0) < v_qty then
      raise exception 'Stok % di Gudang L2 cuma % , tidak cukup untuk kirim %.', v_material_name, coalesce(v_available, 0), v_qty;
    end if;
  end loop;

  insert into shipments (job_order_id) values (p_job_order_id) returning id into v_shipment_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_material_id := (v_line->>'material_item_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;

    select default_price into v_price from master_items where id = v_material_id;

    insert into shipment_items (shipment_id, material_item_id, qty, unit_price)
    values (v_shipment_id, v_material_id, v_qty, coalesce(v_price, 0));

    insert into stock_movements (item_id, movement_type, qty, from_location, to_location, maklon_id, note, job_order_id)
    values (
      v_material_id, 'transfer', v_qty, 'gudang_l2', 'maklon', v_maklon_id,
      'Shipment untuk job order ' || v_sku_name || ' — ' || v_maklon_name,
      p_job_order_id
    );
  end loop;

  return v_shipment_id;
end;
$$;

revoke all on function create_shipment(uuid, jsonb) from public;
grant execute on function create_shipment(uuid, jsonb) to authenticated;

-- Records one QC decision for FG that came back from a maklon (a single
-- delivery can call this more than once — e.g. 1700 lolos + 40 reject
-- as two separate calls). Only a 'lolos' entry adds real stock, tagged
-- with job_order_id so it can be traced back later.
create or replace function submit_qc_batch(
  p_job_order_id uuid,
  p_qty numeric,
  p_qc_status qc_status,
  p_expiry_date date default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_batch_id uuid;
  v_fg_item_id uuid;
begin
  if current_user_role() not in ('spv', 'warehouse_staff') then
    raise exception 'Tidak punya akses untuk mencatat QC.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Qty harus lebih dari 0.';
  end if;

  select sku_item_id into v_fg_item_id from job_orders where id = p_job_order_id and deleted_at is null;
  if v_fg_item_id is null then
    raise exception 'Job order tidak ditemukan.';
  end if;

  insert into fg_batches (job_order_id, fg_item_id, qty, qc_status, expiry_date)
  values (p_job_order_id, v_fg_item_id, p_qty, p_qc_status, p_expiry_date)
  returning id into v_batch_id;

  if p_qc_status = 'lolos' then
    insert into stock_movements (item_id, movement_type, qty, to_location, expiry_date, job_order_id, note)
    values (v_fg_item_id, 'masuk', p_qty, 'gudang_l2', p_expiry_date, p_job_order_id, 'FG lolos QC dari job order');
  end if;

  return v_batch_id;
end;
$$;

revoke all on function submit_qc_batch(uuid, numeric, qc_status, date) from public;
grant execute on function submit_qc_batch(uuid, numeric, qc_status, date) to authenticated;

-- Closes a Job Order. actual_output is computed here (sum of QC'd
-- 'lolos' qty for this job order) — never typed in manually anymore,
-- so it always matches what actually went through QC.
create or replace function close_job_order(p_job_order_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_lolos numeric;
begin
  if current_user_role() not in ('spv', 'warehouse_staff') then
    raise exception 'Tidak punya akses untuk menutup job order.';
  end if;

  select coalesce(sum(qty), 0) into v_lolos
  from fg_batches
  where job_order_id = p_job_order_id and qc_status = 'lolos';

  update job_orders
  set actual_output = v_lolos, status = 'selesai', closed_at = now()
  where id = p_job_order_id;
end;
$$;

revoke all on function close_job_order(uuid) from public;
grant execute on function close_job_order(uuid) to authenticated;

-- Reopens a closed Job Order so more QC batches can be recorded (e.g.
-- a reject batch that the maklon later sends back revised). Doesn't
-- touch stock at all — stock was already added when each QC batch was
-- submitted, not when the job order was closed, so nothing to undo or
-- redo here. Closing again just recomputes actual_output from the
-- (now larger) total of 'lolos' batches.
create or replace function reopen_job_order(p_job_order_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if current_user_role() not in ('spv', 'warehouse_staff') then
    raise exception 'Tidak punya akses untuk membuka kembali job order.';
  end if;

  update job_orders set status = 'berjalan', closed_at = null where id = p_job_order_id;
end;
$$;

revoke all on function reopen_job_order(uuid) from public;
grant execute on function reopen_job_order(uuid) to authenticated;

create policy "spv and warehouse_staff can insert shipments" on shipments
  for insert with check (current_user_role() in ('spv', 'warehouse_staff'));
create policy "spv and warehouse_staff can update shipments" on shipments
  for update using (current_user_role() in ('spv', 'warehouse_staff'));
create policy "spv and warehouse_staff can delete shipments" on shipments
  for delete using (current_user_role() in ('spv', 'warehouse_staff'));

create policy "spv and warehouse_staff can insert shipment_items" on shipment_items
  for insert with check (current_user_role() in ('spv', 'warehouse_staff'));
create policy "spv and warehouse_staff can update shipment_items" on shipment_items
  for update using (current_user_role() in ('spv', 'warehouse_staff'));
create policy "spv and warehouse_staff can delete shipment_items" on shipment_items
  for delete using (current_user_role() in ('spv', 'warehouse_staff'));

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
