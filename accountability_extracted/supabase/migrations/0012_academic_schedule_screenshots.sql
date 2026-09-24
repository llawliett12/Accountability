-- Original academic schedule images stay separate from structured classes,
-- assessments, and deadlines. One replaceable image per document type.
create table if not exists academic_schedule_screenshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('timetable', 'quiz_schedule', 'exam_schedule', 'other')),
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);
create index if not exists idx_academic_schedule_screenshots_user on academic_schedule_screenshots (user_id);
alter table academic_schedule_screenshots enable row level security;
drop policy if exists "own rows" on academic_schedule_screenshots;
create policy "own rows" on academic_schedule_screenshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('academic-schedule-screenshots', 'academic-schedule-screenshots', false) on conflict (id) do nothing;
drop policy if exists "academic schedule screenshots own folder" on storage.objects;
create policy "academic schedule screenshots own folder" on storage.objects for all using (
  bucket_id = 'academic-schedule-screenshots' and auth.uid()::text = (storage.foldername(name))[1]
) with check (
  bucket_id = 'academic-schedule-screenshots' and auth.uid()::text = (storage.foldername(name))[1]
);
