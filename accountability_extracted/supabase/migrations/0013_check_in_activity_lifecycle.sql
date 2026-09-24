-- A check-in is also the user's ongoing-work record. Keep the original
-- timestamp as its start time and add only the lifecycle data it lacked.
alter table check_ins
  add column if not exists status text not null default 'ongoing'
    check (status in ('ongoing', 'completed')),
  add column if not exists completed_at timestamptz;

-- Existing entries predate lifecycle tracking. Preserve them as historical
-- records instead of surfacing legacy check-ins as current work. New rows
-- created after this migration keep the default ongoing status.
update check_ins
set status = 'completed', completed_at = timestamp
where status = 'ongoing' and completed_at is null;

create index if not exists idx_check_ins_user_status_timestamp
  on check_ins (user_id, status, timestamp desc);
