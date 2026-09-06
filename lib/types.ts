export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "partial"
  | "skipped"
  | "rescheduled"
  | "unreconciled";

export interface Task {
  id: string;
  daily_plan_id: string;
  user_id: string;
  title: string;
  category: string | null;
  priority: number;
  planned_duration_min: number | null;
  planned_start: string | null;
  planned_end: string | null;
  deadline: string | null;
  notes: string | null;
  status: TaskStatus;
  is_top3: boolean;
  goal_id: string | null;
}

export type PauseReason =
  | "bathroom"
  | "food"
  | "phone"
  | "tired"
  | "family"
  | "break"
  | "distraction"
  | "important_work"
  | "other";

export interface FocusSession {
  id: string;
  user_id: string;
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
  focused_duration_sec: number | null;
}

export interface FocusPause {
  id: string;
  focus_session_id: string;
  started_at: string;
  ended_at: string | null;
  reason: PauseReason | null;
}
