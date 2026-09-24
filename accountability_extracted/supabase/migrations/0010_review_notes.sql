-- One end-of-day note per user and local calendar date. This is deliberately
-- separate from task, health, and academic notes so each existing note keeps
-- its original meaning and data.
create table if not exists review_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_review_notes_user_date on review_notes (user_id, date desc);

alter table review_notes enable row level security;

drop policy if exists "own review notes" on review_notes;
create policy "own review notes" on review_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
