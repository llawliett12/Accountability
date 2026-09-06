import { createClient } from "@/lib/supabase/server";
import { computeAllProgress } from "./engine";
import type { GoalProgressNode } from "./engine";
import { isOverdue } from "./engine";
import type { Goal, GoalLevel } from "./types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface GoalWithMeta extends Goal {
  computedProgress: number;
  progressSource: string;
  overdue: boolean;
  childIds: string[];
  linkedTaskCount: number;
}

// Fetches every goal for a user plus their linked tasks' statuses (two
// queries total), then computes progress bottom-up in memory via the pure
// engine. Personal-scale data (this is a single-user planning app, not a
// multi-tenant product), so no pagination — matches fetchDailyMetrics in
// lib/analytics/queries.ts.
export async function fetchGoalsWithProgress(userId: string): Promise<GoalWithMeta[]> {
  const supabase = await createClient();

  const { data: goals, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;

  const goalList = (goals ?? []) as Goal[];
  const goalIds = goalList.map((g) => g.id);

  const { data: linkedTasks } = goalIds.length
    ? await supabase.from("tasks").select("goal_id, status").in("goal_id", goalIds)
    : { data: [] };

  const tasksByGoal = new Map<string, { status: string }[]>();
  for (const t of linkedTasks ?? []) {
    if (!t.goal_id) continue;
    const list = tasksByGoal.get(t.goal_id) ?? [];
    list.push({ status: t.status });
    tasksByGoal.set(t.goal_id, list);
  }

  const childIdsByParent = new Map<string, string[]>();
  for (const g of goalList) {
    if (!g.parent_id) continue;
    const list = childIdsByParent.get(g.parent_id) ?? [];
    list.push(g.id);
    childIdsByParent.set(g.parent_id, list);
  }

  const nodes: GoalProgressNode[] = goalList.map((g) => ({
    id: g.id,
    status: g.status,
    target_value: g.target_value,
    current_value: g.current_value,
    manual_progress: g.manual_progress,
    linkedTasks: tasksByGoal.get(g.id) ?? [],
    childIds: childIdsByParent.get(g.id) ?? [],
  }));

  const progressById = computeAllProgress(nodes);
  const today = todayISO();

  return goalList.map((g) => {
    const result = progressById.get(g.id);
    return {
      ...g,
      computedProgress: result ? Math.round(result.progress) : g.progress,
      progressSource: result?.source ?? "manual",
      overdue: isOverdue(g.due_date, g.status, today),
      childIds: childIdsByParent.get(g.id) ?? [],
      linkedTaskCount: (tasksByGoal.get(g.id) ?? []).length,
    };
  });
}

// Ancestor chain from the root goal down to (and including) the given goal.
// Guards against a corrupt/circular parent_id chain the same way the engine does.
export function buildPath(goal: GoalWithMeta, allGoals: GoalWithMeta[]): GoalWithMeta[] {
  const byId = new Map(allGoals.map((g) => [g.id, g]));
  const path: GoalWithMeta[] = [];
  let current: GoalWithMeta | undefined = goal;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path;
}

export function goalsAtLevel(goals: GoalWithMeta[], level: GoalLevel): GoalWithMeta[] {
  return goals.filter((g) => g.level === level);
}
