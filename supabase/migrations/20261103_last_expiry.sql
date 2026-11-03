-- ---------------------------------------------------------------------
-- Last expiry date used per item.
--
-- Expiry lives on each 'masuk' movement, not on the item — that's what
-- keeps the per-batch split on the Stok page honest. But re-typing the
-- same date for every small top-up is what made people skip the field
-- altogether, which is where the "—" stock came from.
--
-- This view feeds the Input Stok form so the field arrives pre-filled
-- with the date last used for that item. Still editable: a genuinely
-- new batch gets its own date.
-- ---------------------------------------------------------------------

create or replace view v_last_expiry as
select distinct on (item_id)
  item_id,
  expiry_date,
  created_at
from stock_movements
where movement_type = 'masuk'
  and expiry_date is not null
order by item_id, created_at desc;

-- Views run as their owner by default; security_invoker makes this one
-- respect the caller's RLS, same as reading stock_movements directly.
alter view v_last_expiry set (security_invoker = on);
