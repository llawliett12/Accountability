-- Add paused to the existing check-in lifecycle without changing data or RLS.
alter table check_ins
  drop constraint if exists check_ins_status_check;

alter table check_ins
  add constraint check_ins_status_check
    check (status in ('ongoing', 'paused', 'completed'));
