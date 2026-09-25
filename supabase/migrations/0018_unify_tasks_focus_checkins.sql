-- 0018: one model per concept (Goals = why, Tasks = what today,
-- Focus Sessions = what I'm doing right now, Check-ins = passive log).
-- Safe to re-run. Nothing here deletes user data.

-- 1) Focus Sessions can exist without a planned Task: optional free-text label.
alter table public.focus_sessions
  add column if not exists label text;

-- Fast lookup of the one running session (Home banner, /focus hydration).
create index if not exists idx_focus_sessions_user_open
  on public.focus_sessions (user_id, started_at desc)
  where ended_at is null;

-- 2) Tasks use the P1-P5 priority only. The old is_top3 star is retired:
--    anything that was starred becomes P1 so it keeps its place at the top.
--    (The column itself is left in place, unused, so this migration stays
--    reversible; it can be dropped in a later cleanup.)
update public.tasks
set priority = 1
where is_top3 = true and (priority is null or priority > 1);

-- 3) Check-ins are a passive log, not a live state machine. Close out any
--    legacy "ongoing"/"paused" rows so they stop looking like live work.
--    Live work now lives only in focus_sessions.
update public.check_ins
set status = 'completed',
    completed_at = coalesce(completed_at, timestamp)
where status in ('ongoing', 'paused');
