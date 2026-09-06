-- Phase 4: long-term goals hierarchy (year -> quarter -> month -> week -> day)
-- and its link into the existing daily planner. Idempotent: safe to re-run.
-- Does not touch Phase 3 academics (no academics tables exist yet).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'goal_level') then
    create type goal_level as enum ('year', 'quarter', 'month', 'week', 'day');
  end if;
  if not exists (select 1 from pg_type where typname = 'goal_status') then
    create type goal_status as enum ('not_started', 'in_progress', 'completed', 'abandoned');
  end if;
end $$;

-- ---------- goals ----------
-- Real parent/child hierarchy via parent_id (self-referencing FK), not five
-- unrelated lists. `progress` is a stored, derived value — recomputed by
-- lib/goals/actions.ts (recomputeAndStoreProgress) from real children,
-- target/current values, or linked tasks; never hand-set to a fake number.
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references goals(id) on delete cascade,
  level goal_level not null,
  title text not null,
  description text,
  start_date date,
  due_date date,
  priority smallint not null default 3 check (priority between 1 and 5),
  status goal_status not null default 'not_started',
  -- smallint (not numeric) for the two bounded 0-100 fields, matching the
  -- existing `priority smallint` convention and avoiding any numeric/string
  -- serialization ambiguity when read back through supabase-js.
  progress smallint not null default 0 check (progress between 0 and 100),
  target_value numeric,
  current_value numeric,
  -- Manual fallback only used when a goal has no children, no target/current
  -- pair, and no linked tasks to derive progress from (see engine.ts).
  manual_progress smallint check (manual_progress is null or manual_progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_no_self_parent check (parent_id is null or parent_id <> id),
  constraint goals_due_after_start check (
    start_date is null or due_date is null or due_date >= start_date
  )
);

create index if not exists idx_goals_user_id on goals (user_id);
create index if not exists idx_goals_parent_id on goals (parent_id);
create index if not exists idx_goals_user_level on goals (user_id, level);
create index if not exists idx_goals_user_due_date on goals (user_id, due_date);
create index if not exists idx_goals_user_status on goals (user_id, status);

alter table goals enable row level security;
drop policy if exists "own rows" on goals;
create policy "own rows" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- link daily tasks to goals ----------
-- Nullable and additive — existing tasks and existing queries are unaffected.
alter table tasks add column if not exists goal_id uuid references goals(id) on delete set null;
create index if not exists idx_tasks_goal_id on tasks (goal_id);
