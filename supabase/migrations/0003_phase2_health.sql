-- Phase 2: health + analytics inputs (sleep, meditation, mood/energy).
-- Weekly/monthly dashboards are computed on the fly from these + Phase 1
-- tables, so no new snapshot tables are needed yet.

create table if not exists sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  bedtime timestamptz not null,
  wake_time timestamptz not null,
  total_minutes integer generated always as (
    greatest(0, round(extract(epoch from (wake_time - bedtime)) / 60))
  ) stored,
  quality smallint check (quality between 1 and 5),
  poor_sleep_reason text,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, date),
  constraint sleep_wake_after_bedtime check (wake_time > bedtime)
);

create table if not exists meditation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  happened boolean not null default false,
  duration_min integer,
  type text,
  mood_before smallint check (mood_before between 1 and 5),
  mood_after smallint check (mood_after between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  "timestamp" timestamptz not null default now(),
  date date not null default current_date,
  mood smallint not null check (mood between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  notes text
);

create index if not exists idx_sleep_logs_user_date on sleep_logs (user_id, date);
create index if not exists idx_meditation_logs_user_date on meditation_logs (user_id, date);
create index if not exists idx_mood_logs_user_date on mood_logs (user_id, date);

alter table sleep_logs enable row level security;
alter table meditation_logs enable row level security;
alter table mood_logs enable row level security;

drop policy if exists "own rows" on sleep_logs;
create policy "own rows" on sleep_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on meditation_logs;
create policy "own rows" on meditation_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on mood_logs;
create policy "own rows" on mood_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
