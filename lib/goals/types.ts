export type GoalLevel = "year" | "quarter" | "month" | "week" | "day";

export type GoalStatus = "not_started" | "in_progress" | "completed" | "abandoned";

export interface Goal {
  id: string;
  user_id: string;
  parent_id: string | null;
  level: GoalLevel;
  title: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  priority: number;
  status: GoalStatus;
  progress: number;
  target_value: number | null;
  current_value: number | null;
  manual_progress: number | null;
  created_at: string;
  updated_at: string;
}
