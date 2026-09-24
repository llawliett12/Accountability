-- Phase 1 follow-up: move the last two hardcoded scoring constants
-- (expected daily check-ins, on-time-start tolerance) into scoring_config
-- so the whole formula is editable from one place, per the "transparent and
-- configurable" requirement.

alter table scoring_config
  add column expected_check_ins integer not null default 4,
  add column on_time_tolerance_min integer not null default 15;
