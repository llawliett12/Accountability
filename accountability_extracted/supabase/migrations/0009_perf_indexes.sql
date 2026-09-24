-- Migration 0009: Performance indexes for high-frequency queries
-- Eliminates sequential table scans on core dashboard and planning queries.

-- 1. tasks: heavily filtered by daily_plan_id on /plan and / (Home)
create index if not exists idx_tasks_daily_plan_id on tasks (daily_plan_id);

-- 2. tasks: filtered by user_id across action validation and user ownership checks
create index if not exists idx_tasks_user_id on tasks (user_id);

-- 3. tasks: composite index for Home page Top 3 query
create index if not exists idx_tasks_plan_top3 on tasks (daily_plan_id, is_top3);

-- 4. task_logs: filtered by task_id in actions.ts firstStartByTask lookup
create index if not exists idx_task_logs_task_id on task_logs (task_id);

-- 5. focus_sessions: queried by user_id and ordered/filtered by started_at
create index if not exists idx_focus_sessions_user_started on focus_sessions (user_id, started_at);

-- 6. focus_pauses: queried by focus_session_id in reports and session aggregations
create index if not exists idx_focus_pauses_session_id on focus_pauses (focus_session_id);

-- 7. discipline_verdicts: Home page queries latest verdict ordered by date desc limit 1
create index if not exists idx_discipline_verdicts_user_date_desc on discipline_verdicts (user_id, date desc);
