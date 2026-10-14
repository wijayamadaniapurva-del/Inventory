-- Step 2 of 2. Run after 20261014a has finished.
--
-- Hiding menus keeps CS out of the UI, but RLS is what actually stops a
-- write: without this, a CS login still holds a valid token and the
-- existing "authenticated can write" policies would accept it.

-- current_user_role() already exists in schema.sql (it's what guards
-- create_stock_movement), so nothing to create here — the policies below
-- just reuse it.

-- Reading stays open to every logged-in role (that's the whole point of
-- a CS account); only the write side is narrowed.
drop policy if exists "authenticated can write" on maklon;
create policy "non cs can write" on maklon for all
  using (current_user_role() <> 'cs')
  with check (current_user_role() <> 'cs');

drop policy if exists "authenticated can write" on master_items;
create policy "non cs can write" on master_items for all
  using (current_user_role() <> 'cs')
  with check (current_user_role() <> 'cs');

drop policy if exists "authenticated can write" on item_bom;
create policy "non cs can write" on item_bom for all
  using (current_user_role() <> 'cs')
  with check (current_user_role() <> 'cs');

drop policy if exists "authenticated can write" on fg_batches;
create policy "non cs can write" on fg_batches for all
  using (current_user_role() <> 'cs')
  with check (current_user_role() <> 'cs');

drop policy if exists "authenticated can write" on app_settings;
create policy "non cs can write" on app_settings for all
  using (current_user_role() <> 'cs')
  with check (current_user_role() <> 'cs');

drop policy if exists "authenticated can write" on scalev_sync_log;
create policy "non cs can write" on scalev_sync_log for all
  using (current_user_role() <> 'cs')
  with check (current_user_role() <> 'cs');
