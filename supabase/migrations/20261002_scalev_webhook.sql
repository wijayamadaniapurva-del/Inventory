-- ---------------------------------------------------------------------
-- Scalev webhook: make the sync log able to record real order events,
-- and make processing idempotent.
--
-- Webhooks get retried. Without a key to deduplicate on, one order
-- could be deducted from stock two or three times. event_key is that
-- key: "<order id>:keluar" / "<order id>:masuk", unique, so a replay
-- of the same event hits the unique index and is skipped instead of
-- moving stock again.
-- ---------------------------------------------------------------------

alter table scalev_sync_log add column if not exists event_key text;
alter table scalev_sync_log add column if not exists note text;

-- 'receive_order' = a normal sale/shipment event (stock goes out).
-- 'receive_rts'   = return to sender / cancellation (stock comes back).
alter table scalev_sync_log drop constraint if exists scalev_sync_log_direction_check;
alter table scalev_sync_log add constraint scalev_sync_log_direction_check
  check (direction in ('push_stock', 'receive_rts', 'receive_order'));

-- 'skipped' = received and understood, but deliberately not acted on
-- (duplicate retry, status we don't deduct for, unknown product).
alter table scalev_sync_log drop constraint if exists scalev_sync_log_status_check;
alter table scalev_sync_log add constraint scalev_sync_log_status_check
  check (status in ('pending', 'success', 'failed', 'skipped'));

create unique index if not exists scalev_sync_log_event_key_idx
  on scalev_sync_log (event_key)
  where event_key is not null;

create index if not exists scalev_sync_log_created_at_idx
  on scalev_sync_log (created_at desc);
