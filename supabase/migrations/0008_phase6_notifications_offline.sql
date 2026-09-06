-- Phase 6: notification preferences/subscriptions/dispatch log, plus additive
-- idempotency columns so the offline queue can safely replay writes.
-- Additive only, same "own rows" RLS pattern as every earlier migration.

-- ============ Notification preferences ============
-- One row per user. Kept separate from notification_log (events) per the
-- brief: preferences describe what/when the user *wants*; the log records
-- what was actually *sent*, so the two never get conflated.
create table if not exists notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  timezone text not null default 'UTC', -- IANA tz, e.g. 'Asia/Kolkata'; set client-side from Intl.DateTimeFormat, never hardcoded
  class_reminders boolean not null default true,
  class_reminder_lead_min integer not null default 15,
  study_reminders boolean not null default true,
  deadline_reminders boolean not null default true,
  deadline_reminder_lead_hours integer not null default 24,
  exam_reminders boolean not null default true,
  exam_reminder_lead_hours integer not null default 24,
  hydration_reminders boolean not null default false,
  hydration_interval_min integer not null default 120,
  hydration_start_time time not null default '09:00',
  hydration_end_time time not null default '21:00',
  daily_review_reminder boolean not null default true,
  daily_review_time time not null default '21:30',
  accountability_reminders boolean not null default false,
  accountability_interval_min integer not null default 180,
  sleep_reminders boolean not null default false,
  sleep_reminder_time time not null default '22:30',
  updated_at timestamptz not null default now()
);

-- ============ Push subscriptions (Web Push, one browser/device each) ============
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on push_subscriptions (user_id);

-- ============ Notification dispatch log (idempotency for the dispatch job) ============
-- "slot" disambiguates repeatable reminders within the same day/category, e.g.
-- an occurrence id for a class reminder, a hydration tick number, etc.
create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  local_date date not null, -- the date in the *user's* timezone, not server UTC date
  slot text not null default 'default',
  sent_at timestamptz not null default now(),
  unique (user_id, category, local_date, slot)
);

create index if not exists idx_notification_log_user_date on notification_log (user_id, local_date);

-- ============ Offline-sync idempotency columns ============
-- A client_id is a UUID generated on-device when a quick action is taken.
-- If the network write later gets retried (offline queue replay, or a
-- response lost after the write actually succeeded), re-sending the same
-- client_id is a safe no-op instead of a duplicate row.
alter table task_logs add column if not exists client_id text;
alter table check_ins add column if not exists client_id text;
alter table mood_logs add column if not exists client_id text;

-- Plain (non-partial) unique indexes: Postgres treats every NULL as distinct
-- for uniqueness purposes, so server-issued writes with no client_id (NULL)
-- are unaffected, while two rows sharing a real client_id still conflict.
-- Deliberately non-partial so a `.upsert(..., { onConflict: "user_id,client_id" })`
-- call from supabase-js can target it directly (PostgREST can't express a
-- partial-index predicate through that API).
create unique index if not exists idx_task_logs_client_id on task_logs (user_id, client_id);
create unique index if not exists idx_check_ins_client_id on check_ins (user_id, client_id);
create unique index if not exists idx_mood_logs_client_id on mood_logs (user_id, client_id);

-- focus_sessions/focus_pauses need no schema change: their uuid primary keys
-- already accept a client-supplied id instead of the gen_random_uuid()
-- default, which is what the offline queue uses to let a session started
-- offline be referenced by its pause/stop events before it has ever synced.

-- ============ Row Level Security ============
alter table notification_preferences enable row level security;
alter table push_subscriptions enable row level security;
alter table notification_log enable row level security;

drop policy if exists "own rows" on notification_preferences;
create policy "own rows" on notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on push_subscriptions;
create policy "own rows" on push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- notification_log is written only by the server-side dispatch job using the
-- service-role key (which bypasses RLS by design), so users get read-only
-- access to their own rows and no direct write path via the anon key.
drop policy if exists "read own" on notification_log;
create policy "read own" on notification_log for select using (auth.uid() = user_id);
