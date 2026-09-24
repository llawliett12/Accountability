// Pure goal-hierarchy logic: no DB, no AI, no framework imports. Same shape
// as lib/scoring/engine.ts — testable in isolation, called by
// lib/goals/actions.ts and lib/goals/queries.ts with real data.

import type { GoalLevel, GoalStatus } from "./types";

export const GOAL_LEVELS: GoalLevel[] = ["year", "quarter", "month", "week", "day"];

export function parentLevelFor(level: GoalLevel): GoalLevel | null {
  const idx = GOAL_LEVELS.indexOf(level);
  return idx > 0 ? GOAL_LEVELS[idx - 1] : null;
}

export function childLevelFor(level: GoalLevel): GoalLevel | null {
  const idx = GOAL_LEVELS.indexOf(level);
  return idx >= 0 && idx < GOAL_LEVELS.length - 1 ? GOAL_LEVELS[idx + 1] : null;
}

export interface TaskProgressInput {
  status: string;
}

// Completed counts fully, partial counts half, everything else (including
// unreconciled) counts as zero rather than being excluded — a linked task
// that hasn't happened yet is not progress, but it isn't penalized either
// since it still counts in the denominator (see the "tasks" branch below).
const TASK_WEIGHTS: Record<string, number> = {
  completed: 1,
  partial: 0.5,
};

export interface GoalProgressNode {
  id: string;
  status: GoalStatus;
  target_value: number | null;
  current_value: number | null;
  manual_progress: number | null;
  linkedTasks: TaskProgressInput[];
  childIds: string[];
}

export type ProgressSource = "children" | "target" | "tasks" | "manual";

export interface ProgressResult {
  progress: number;
  source: ProgressSource;
}

function clamp(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// Computes one goal's progress given its children's already-resolved
// progress values. Priority order: real children > an explicit target/current
// pair > linked-task completion > a manual figure > status-based 0/100.
// Never fabricates a number when a goal has no children, no target, and no
// linked tasks — the manual fallback is deliberate, not silent invention.
export function computeGoalProgress(
  goal: {
    status: GoalStatus;
    target_value: number | null;
    current_value: number | null;
    manual_progress: number | null;
  },
  childProgress: number[],
  linkedTasks: TaskProgressInput[]
): ProgressResult {
  if (childProgress.length > 0) {
    const avg = childProgress.reduce((s, p) => s + p, 0) / childProgress.length;
    return { progress: clamp(avg), source: "children" };
  }

  if (goal.target_value !== null && goal.target_value !== 0) {
    const ratio = ((goal.current_value ?? 0) / goal.target_value) * 100;
    return { progress: clamp(ratio), source: "target" };
  }

  if (linkedTasks.length > 0) {
    const earned = linkedTasks.reduce((s, t) => s + (TASK_WEIGHTS[t.status] ?? 0), 0);
    return { progress: clamp((earned / linkedTasks.length) * 100), source: "tasks" };
  }

  if (goal.manual_progress !== null) {
    return { progress: clamp(goal.manual_progress), source: "manual" };
  }

  return { progress: goal.status === "completed" ? 100 : 0, source: "manual" };
}

// Bottom-up computation across a user's whole goal set in one pass, so a
// parent's progress always derives from its children's real, freshly
// computed progress rather than a stale stored number (avoids
// double-counting: each child is averaged in exactly once, at its parent).
export function computeAllProgress(goals: GoalProgressNode[]): Map<string, ProgressResult> {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const results = new Map<string, ProgressResult>();
  const visiting = new Set<string>();

  function resolve(id: string): number {
    const cached = results.get(id);
    if (cached) return cached.progress;

    const node = byId.get(id);
    if (!node) return 0;

    // Guards a corrupt/circular parent_id chain instead of recursing forever.
    if (visiting.has(id)) return 0;
    visiting.add(id);

    const childProgress = node.childIds.filter((cid) => byId.has(cid)).map((cid) => resolve(cid));

    const result = computeGoalProgress(node, childProgress, node.linkedTasks);
    results.set(id, result);
    visiting.delete(id);
    return result.progress;
  }

  for (const g of goals) resolve(g.id);
  return results;
}

export function isOverdue(dueDate: string | null, status: GoalStatus, today: string): boolean {
  if (!dueDate) return false;
  if (status === "completed" || status === "abandoned") return false;
  return dueDate < today;
}
