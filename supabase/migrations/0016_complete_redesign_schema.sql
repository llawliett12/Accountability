-- 0016_complete_redesign_schema.sql
-- The migration preserves existing records and does not intentionally delete user data.
-- New schema elements are introduced compatibly and existing relationships are retained.

BEGIN;

-- 1. CANONICAL COURSES TABLE
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  instructor text,
  location text,
  attendance_target smallint not null default 75 check (attendance_target between 0 and 100),
  syllabus_notes text,
  next_assessment_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique index prevents duplicate course codes per user (case-insensitive and trimmed)
create unique index if not exists idx_courses_user_code_lower 
  on public.courses (user_id, lower(trim(code)));

create index if not exists idx_courses_user_active 
  on public.courses (user_id, active);

alter table public.courses enable row level security;
drop policy if exists "own rows" on public.courses;
create policy "own rows" on public.courses for all 
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);

-- 2. EXTEND CLASSES (reused as recurring timetable slots for courses)
-- ON DELETE RESTRICT: Courses cannot be deleted if timetable slots exist
alter table public.classes
  add column if not exists course_id uuid references public.courses(id) on delete restrict,
  add column if not exists slot_type text not null default 'lecture'
    check (slot_type in ('lecture', 'lab', 'tutorial', 'seminar', 'other'));

create index if not exists idx_classes_course_id on public.classes (course_id);

-- 3. BACKFILL CANONICAL COURSES FROM EXISTING CLASSES
with parsed_classes as (
  select 
    c.id,
    c.user_id,
    c.name as orig_name,
    c.subject as orig_subject,
    c.instructor,
    c.location,
    c.attendance_target,
    c.active,
    -- Canonical code determination:
    case 
      when trim(c.subject) ~* '^[A-Z]{2,5}\s*[0-9]{2,4}[A-Z]?$' then trim(c.subject)
      when regexp_replace(trim(c.name), '(?i)\s+(lab|lecture|tutorial|seminar)$', '') ~* '^[A-Z]{2,5}\s*[0-9]{2,4}[A-Z]?$' 
        then regexp_replace(trim(c.name), '(?i)\s+(lab|lecture|tutorial|seminar)$', '')
      when nullif(trim(c.subject), '') is not null and length(trim(c.subject)) < length(trim(c.name))
        then trim(c.subject)
      else regexp_replace(trim(c.name), '(?i)\s+(lab|lecture|tutorial|seminar)$', '')
    end as canonical_code,
    -- Canonical title determination:
    case 
      when trim(c.subject) ~* '^[A-Z]{2,5}\s*[0-9]{2,4}[A-Z]?$' then trim(c.name)
      when regexp_replace(trim(c.name), '(?i)\s+(lab|lecture|tutorial|seminar)$', '') ~* '^[A-Z]{2,5}\s*[0-9]{2,4}[A-Z]?$' 
        then coalesce(nullif(trim(c.subject), ''), regexp_replace(trim(c.name), '(?i)\s+(lab|lecture|tutorial|seminar)$', ''))
      when nullif(trim(c.subject), '') is not null and length(trim(c.subject)) >= length(trim(c.name))
        then trim(c.subject)
      else regexp_replace(trim(c.name), '(?i)\s+(lab|lecture|tutorial|seminar)$', '')
    end as canonical_name
  from public.classes c
)
insert into public.courses (user_id, code, name, instructor, location, attendance_target, active)
select 
  p.user_id,
  p.canonical_code,
  p.canonical_name,
  max(p.instructor) as instructor,
  max(p.location) as location,
  max(p.attendance_target) as attendance_target,
  bool_or(p.active) as active
from parsed_classes p
group by p.user_id, p.canonical_code, p.canonical_name
on conflict (user_id, lower(trim(code))) do update
set 
  instructor = coalesce(courses.instructor, excluded.instructor),
  location = coalesce(courses.location, excluded.location);

-- Link existing classes to their canonical course and set slot_type
update public.classes c
set 
  course_id = crs.id,
  slot_type = case 
    when trim(c.name) ~* '(?i)\slab$' then 'lab'
    when trim(c.name) ~* '(?i)\stutorial$' then 'tutorial'
    when trim(c.name) ~* '(?i)\sseminar$' then 'seminar'
    else 'lecture'
  end
from public.courses crs
where c.user_id = crs.user_id
  and lower(trim(crs.code)) = lower(trim(
    case 
      when trim(c.subject) ~* '^[A-Z]{2,5}\s*[0-9]{2,4}[A-Z]?$' then trim(c.subject)
      when regexp_replace(trim(c.name), '(?i)\s+(lab|lecture|tutorial|seminar)$', '') ~* '^[A-Z]{2,5}\s*[0-9]{2,4}[A-Z]?$' 
        then regexp_replace(trim(c.name), '(?i)\s+(lab|lecture|tutorial|seminar)$', '')
      when nullif(trim(c.subject), '') is not null and length(trim(c.subject)) < length(trim(c.name))
        then trim(c.subject)
      else regexp_replace(trim(c.name), '(?i)\s+(lab|lecture|tutorial|seminar)$', '')
    end
  ))
  and c.course_id is null;

-- Fallback link for any classes that might have unmatched code
update public.classes c
set course_id = crs.id
from public.courses crs
where c.user_id = crs.user_id
  and c.course_id is null
  and (
    lower(trim(crs.code)) = lower(trim(c.name))
    or lower(trim(crs.name)) = lower(trim(c.name))
    or lower(trim(crs.code)) = lower(trim(c.subject))
    or lower(trim(crs.name)) = lower(trim(c.subject))
  );

-- 4. EXTEND ASSESSMENTS & DEADLINES (link to course)
alter table public.assessments
  add column if not exists course_id uuid references public.courses(id) on delete set null;

create index if not exists idx_assessments_course_id on public.assessments (course_id);

update public.assessments a
set course_id = c.course_id
from public.classes c
where a.class_id = c.id
  and a.course_id is null
  and c.course_id is not null;

alter table public.deadlines
  add column if not exists course_id uuid references public.courses(id) on delete set null;

create index if not exists idx_deadlines_course_id on public.deadlines (course_id);

update public.deadlines d
set course_id = c.course_id
from public.classes c
where d.class_id = c.id
  and d.course_id is null
  and c.course_id is not null;

-- 5. EXTEND GOALS & TASKS (course linking & Top 3 goals)
alter table public.goals
  add column if not exists course_id uuid references public.courses(id) on delete set null,
  add column if not exists is_top3 boolean not null default false;

create index if not exists idx_goals_course_id on public.goals (course_id);
create index if not exists idx_goals_user_top3 on public.goals (user_id, is_top3);

alter table public.tasks
  add column if not exists course_id uuid references public.courses(id) on delete set null;

create index if not exists idx_tasks_course_id on public.tasks (course_id);

-- 6. EXTEND CLASS_OCCURRENCES (course link, extra classes, and occurrence invariant)
-- ON DELETE RESTRICT: Courses cannot be deleted if occurrences exist
alter table public.class_occurrences
  add column if not exists course_id uuid references public.courses(id) on delete restrict,
  add column if not exists is_extra boolean not null default false;

-- Allow class_id to be nullable for extra classes
alter table public.class_occurrences
  alter column class_id drop not null;

-- STEP 1: BACKFILL class_occurrences.course_id BEFORE applying the invariant constraint!
update public.class_occurrences co
set course_id = c.course_id
from public.classes c
where co.class_id = c.id
  and co.course_id is null
  and c.course_id is not null;

-- Fallback: if any class was somehow unlinked, link occurrence to any matching course for user
update public.class_occurrences co
set course_id = crs.id
from public.classes c, public.courses crs
where co.class_id = c.id
  and co.course_id is null
  and c.user_id = crs.user_id
  and crs.active = true;

create index if not exists idx_class_occ_course_id on public.class_occurrences (course_id);

-- STEP 2: Enforce Extra Class Invariant AFTER all rows have course_id populated
-- Recurring occurrence: class_id is not null, course_id is not null, is_extra is false.
-- Extra class: is_extra is true, course_id is not null.
alter table public.class_occurrences
  drop constraint if exists class_occurrences_valid_extra;

alter table public.class_occurrences
  add constraint class_occurrences_valid_extra check (
    (is_extra = false and class_id is not null and course_id is not null) or
    (is_extra = true and course_id is not null)
  );


-- 7. EXTEND CHECK_INS (isolate quick activity journal from work lifecycle)
alter table public.check_ins
  drop constraint if exists check_ins_status_check;

alter table public.check_ins
  add constraint check_ins_status_check
    check (status in ('ongoing', 'paused', 'completed', 'logged'));

alter table public.check_ins
  add column if not exists entry_type text not null default 'work'
    check (entry_type in ('work', 'journal'));

-- Enforce Journal Invariant:
-- Journal entries MUST be status 'logged' and cannot have completed_at.
-- Work sessions MUST be 'ongoing', 'paused', or 'completed'.
alter table public.check_ins
  drop constraint if exists check_ins_journal_invariant;

alter table public.check_ins
  add constraint check_ins_journal_invariant check (
    (entry_type = 'journal' and status = 'logged' and completed_at is null) or
    (entry_type = 'work' and status in ('ongoing', 'paused', 'completed'))
  );

create index if not exists idx_check_ins_user_entry_type 
  on public.check_ins (user_id, entry_type, timestamp desc);

-- 8. EXTEND FOOD_HABITS (Time | What I ate | Notes via JSONB entries)
alter table public.food_habits
  add column if not exists entries jsonb not null default '[]'::jsonb;

COMMIT;

