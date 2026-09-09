-- Repair the check_ins portion of the offline idempotency migration for
-- deployments where 0008 was not applied. Existing rows remain untouched:
-- client_id is nullable and NULL values do not conflict in the unique index.
alter table public.check_ins
  add column if not exists client_id text;

create unique index if not exists idx_check_ins_client_id
  on public.check_ins (user_id, client_id);
