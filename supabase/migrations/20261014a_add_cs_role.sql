-- Step 1 of 2. Run this file ALONE, then run 20261014b in a second run.
--
-- Postgres won't let a newly added enum value be used by other
-- statements in the same transaction, and the Supabase SQL editor wraps
-- whatever you paste into one transaction. Splitting the files is what
-- keeps step 2 from failing with "unsafe use of new value of enum type".

alter type user_role add value if not exists 'cs';
