-- Phase 3: academics (classes, attendance, listening/engagement, prep/review,
-- quizzes/exams, deadlines). Idempotent: safe to re-run. Additive only —
-- does not touch goals, scoring, or health tables.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'occurrence_status') then
    create type occurrence_status as enum ('scheduled', 'held', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    -- Null attendance_status on a class_occurrence means "not marked yet" —
    -- same "untracked is not a failure" rule as tasks. It is never defaulted
    -- to absent; attendance % calculations only divide over marked rows.
    create type attendance_status as enum ('present', 'absent', 'late', 'excused');
  end if;
  if not exists (select 1 from pg_type where typname = 'assessment_type') then
    create type assessment_type as enum ('quiz', 'exam');
  end if;
  if not exists (select 1 from pg_type where typname = 'assessment_status') then
    create type assessment_status as enum ('upcoming', 'completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'deadline_status') then
    create type deadline_status as enum ('pending', 'completed');
  end if;
end $$;

-- ---------- classes (recurring definitions) ----------
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text,
  -- 0 = Sunday .. 6 = Saturday, one row per weekly recurrence. A class that
  -- meets multiple days gets multiple `classes` rows (kept simple, matches
  -- "do not overengineer" — each row is one weekly slot).
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  location text,
  instructor text,
  -- Attendance danger-zone threshold, e.g. 75 = most institutions' cutoff.
  -- Configurable per class rather than hardcoded (same spirit as scoring_config).
  attendance_target smallint not null default 75 check (attendance_target between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_classes_user_id on classes (user_id);

alter table classes enable row level security;
drop policy if exists "own rows" on classes;
create policy "own rows" on classes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- class_occurrences (one row per actual date a class meets) ----------
-- Generated deterministically from `classes.day_of_week` for a date range
-- (see lib/academics/actions.ts generateOccurrences) — never fabricated,
-- always tied back to a real recurring class definition.
create table if not exists class_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  status occurrence_status not null default 'scheduled',
  attendance_status attendance_status,
  -- 1-5, null = not rated. Kept as a single scalar rather than a separate
  -- table — this is a personal app, not a multi-rater system.
  listening_rating smallint check (listening_rating is null or listening_rating between 1 and 5),
  prepared boolean not null default false,
  reviewed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (class_id, date)
);

create index if not exists idx_class_occ_user_id on class_occurrences (user_id);
create index if not exists idx_class_occ_class_id on class_occurrences (class_id);
create index if not exists idx_class_occ_user_date on class_occurrences (user_id, date);

alter table class_occurrences enable row level security;
drop policy if exists "own rows" on class_occurrences;
create policy "own rows" on class_occurrences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- assessments (quizzes + exams) ----------
create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  title text not null,
  type assessment_type not null,
  date date not null,
  score numeric,
  max_score numeric,
  status assessment_status not null default 'upcoming',
  notes text,
  created_at timestamptz not null default now(),
  constraint assessments_score_needs_max check (
    score is null or max_score is not null
  )
);

create index if not exists idx_assessments_user_id on assessments (user_id);
create index if not exists idx_assessments_user_date on assessments (user_id, date);
create index if not exists idx_assessments_class_id on assessments (class_id);

alter table assessments enable row level security;
drop policy if exists "own rows" on assessments;
create policy "own rows" on assessments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- deadlines (assignments/submissions, distinct from quizzes/exams) ----------
create table if not exists deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  title text not null,
  due_date date not null,
  -- Free-text category (assignment/project/reading/other) — not an enum,
  -- since this list is open-ended and per-user, unlike attendance/type.
  category text,
  status deadline_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_deadlines_user_id on deadlines (user_id);
create index if not exists idx_deadlines_user_due on deadlines (user_id, due_date);
create index if not exists idx_deadlines_class_id on deadlines (class_id);

alter table deadlines enable row level security;
drop policy if exists "own rows" on deadlines;
create policy "own rows" on deadlines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- link the existing focus timer to quizzes/exams ----------
-- Nullable and additive, same pattern as tasks.goal_id in migration 0004 —
-- existing focus_sessions rows and queries are unaffected.
alter table focus_sessions add column if not exists assessment_id uuid references assessments(id) on delete set null;
create index if not exists idx_focus_sessions_assessment_id on focus_sessions (assessment_id);
