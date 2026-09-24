-- Migration 0017: Canonical Notes System
-- Single persistent notes table for general, contextual, and course-specific notes.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  course_id uuid references public.courses(id) on delete set null,
  category text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notes_user_category on public.notes (user_id, category, created_at desc);
create index if not exists idx_notes_course_id on public.notes (course_id, created_at desc);

alter table public.notes enable row level security;

drop policy if exists "Users can manage their own notes" on public.notes;
create policy "Users can manage their own notes" on public.notes
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
