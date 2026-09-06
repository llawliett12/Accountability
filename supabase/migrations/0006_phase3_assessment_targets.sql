-- Phase 3 follow-up: the original spec (9.7 quizzes / 9.8 exams) asks for
-- target score, preparation hours, and practice scores, in addition to the
-- actual score that 0005 already added. Additive only, idempotent.

alter table assessments add column if not exists target_score numeric;
alter table assessments add column if not exists prep_hours numeric;
alter table assessments add column if not exists practice_scores numeric[] not null default '{}';
