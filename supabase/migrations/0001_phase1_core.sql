-- Phase 1: core loop tables (planning, tasks, check-ins, focus timer, reconciliation,
-- discipline scoring, streaks). No academics/goals/AI tables yet — those come in later phases.

create extension if not exists "pgcrypto";

-- ---------- daily_plans ----------
create table daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------- tasks ----------
create type task_status as enum (
  'not_started', 'in_progress', 'completed', 'partial',
  'skipped', 'rescheduled', 'unreconciled'
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  daily_plan_id uuid not null references daily_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text,
  priority smallint default 3, -- 1 (highest) .. 5 (lowest)
  planned_duration_min integer,
  planned_start timestamptz,
  planned_end timestamptz,
  deadline timestamptz,
  notes text,
  status task_status not null default 'not_started',
  is_top3 boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, -- 'status_change' | 'reconciliation_answer'
  value text,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- check_ins ("what am I doing right now?") ----------
create type drift_state as enum ('on_track', 'drifting', 'unknown');

create table check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  "timestamp" timestamptz not null default now(),
  actual_activity text not null,
  intended_task_id uuid references tasks(id) on delete set null,
  drift_state drift_state not null default 'unknown'
);

-- ---------- focus timer ----------
create table focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  focused_duration_sec integer -- computed on stop, from timestamps minus paused time
);

create type pause_reason as enum (
  'bathroom', 'food', 'phone', 'tired', 'family',
  'break', 'distraction', 'important_work', 'other'
);

create table focus_pauses (
  id uuid primary key default gen_random_uuid(),
  focus_session_id uuid not null references focus_sessions(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  reason pause_reason
);

-- ---------- discipline scoring ----------
create table discipline_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  score numeric not null,
  negative_score numeric not null,
  components jsonb not null, -- transparent breakdown, e.g. {"taskCompletionRate":0.8,...}
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table discipline_verdicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  label text not null, -- EXCELLENT | GOOD | AVERAGE | WEAK | POOR | LOSER
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------- reports (precomputed snapshots) ----------
create table daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------- streaks ----------
create table streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  streak_type text not null, -- planning | study | daily_review | tracking | goal_completion
  current_count integer not null default 0,
  last_date date,
  unique (user_id, streak_type)
);

-- ---------- scoring config (transparent + configurable weights) ----------
create table scoring_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weights jsonb not null default '{
    "taskCompletionRate": 30,
    "onTimeStartRate": 15,
    "focusTimeRatio": 20,
    "trackingConsistency": 15,
    "driftPenalty": 10,
    "missedCommitmentPenalty": 5,
    "reschedulePenalty": 5
  }'::jsonb,
  verdict_bands jsonb not null default '{
    "EXCELLENT": 90, "GOOD": 75, "AVERAGE": 60, "WEAK": 45, "POOR": 25, "LOSER": 0
  }'::jsonb
);

-- ============ Row Level Security ============
alter table daily_plans enable row level security;
alter table tasks enable row level security;
alter table task_logs enable row level security;
alter table check_ins enable row level security;
alter table focus_sessions enable row level security;
alter table focus_pauses enable row level security;
alter table discipline_scores enable row level security;
alter table discipline_verdicts enable row level security;
alter table daily_reports enable row level security;
alter table streaks enable row level security;
alter table scoring_config enable row level security;

-- one policy per table: user can only touch their own rows.
-- focus_pauses is scoped via its parent focus_session's user_id.
create policy "own rows" on daily_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on task_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on check_ins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on focus_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on focus_pauses for all using (
  auth.uid() = (select user_id from focus_sessions where focus_sessions.id = focus_pauses.focus_session_id)
);
create policy "own rows" on discipline_scores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on discipline_verdicts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on daily_reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on streaks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on scoring_config for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
