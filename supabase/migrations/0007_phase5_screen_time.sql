-- Phase 5: screen-time tracking. One record per user per day; app usage is
-- a normalized child table (not a JSON blob) so per-app analytics/history
-- don't require unpacking JSON on every query. Screenshots are stored in a
-- private bucket, never public — the row only stores a path, and RLS on
-- both the table and the bucket restrict access to the owning user.

create table if not exists screen_time_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  total_minutes integer not null default 0 check (total_minutes >= 0),
  source text not null check (source in ('gemini', 'manual')),
  extraction_status text not null default 'confirmed'
    check (extraction_status in ('pending', 'confirmed', 'failed', 'manual')),
  screenshot_path text, -- private storage path, never a public URL
  raw_extraction jsonb, -- Gemini's raw parsed response, for audit/debugging only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists screen_time_apps (
  id uuid primary key default gen_random_uuid(),
  screen_time_record_id uuid not null references screen_time_records(id) on delete cascade,
  app_name text not null,
  duration_minutes integer not null check (duration_minutes >= 0),
  category text,
  created_at timestamptz not null default now()
);

create index if not exists idx_screen_time_records_user_date on screen_time_records (user_id, date);
create index if not exists idx_screen_time_apps_record on screen_time_apps (screen_time_record_id);

alter table screen_time_records enable row level security;
alter table screen_time_apps enable row level security;

drop policy if exists "own rows" on screen_time_records;
create policy "own rows" on screen_time_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- screen_time_apps has no user_id column of its own (it's a pure line-item
-- child table) — scoped via its parent record's user_id, same pattern this
-- repo already uses for focus_pauses -> focus_sessions.
drop policy if exists "own rows" on screen_time_apps;
create policy "own rows" on screen_time_apps
  for all using (
    auth.uid() = (
      select user_id from screen_time_records
      where screen_time_records.id = screen_time_apps.screen_time_record_id
    )
  );

-- Private storage bucket for screenshots. `public = false` means files are
-- never served by public URL — only via short-lived signed URLs the app
-- generates server-side for the owning user.
insert into storage.buckets (id, name, public)
values ('screen-time-screenshots', 'screen-time-screenshots', false)
on conflict (id) do nothing;

-- Storage RLS: a user may only read/write objects under a path prefixed
-- with their own user id, e.g. "{user_id}/{uuid}.jpg".
drop policy if exists "screen-time screenshots own folder" on storage.objects;
create policy "screen-time screenshots own folder" on storage.objects
  for all using (
    bucket_id = 'screen-time-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'screen-time-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
