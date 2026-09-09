-- Sleep logs were originally one row per calendar date. Preserve every
-- existing row while allowing actual sleep periods (overnight and naps).
alter table sleep_logs drop constraint if exists sleep_logs_user_id_date_key;
alter table sleep_logs add column if not exists period_type text not null default 'night'
  check (period_type in ('night', 'daytime'));
create index if not exists idx_sleep_logs_user_bedtime on sleep_logs (user_id, bedtime desc);

-- One compact daily row for simple meal completion; no nutrition data.
create table if not exists food_habits (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  breakfast boolean not null default false,
  lunch boolean not null default false,
  dinner boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table food_habits enable row level security;
drop policy if exists "own rows" on food_habits;
create policy "own rows" on food_habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
