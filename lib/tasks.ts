// Pure helpers for "Tasks" — the *what, today* concept.
// Priority is P1 (most important) .. P5. There is no separate "star":
// "Top Priorities" on Home simply means the top open tasks by priority.

export const TASK_PRIORITIES = [1, 2, 3, 4, 5] as const;
export const DEFAULT_TASK_PRIORITY = 3;
export const TOP_TASKS_COUNT = 3;

const CLOSED_STATUSES = new Set(["completed", "skipped", "rescheduled"]);

/** A task still needs doing (not finished, skipped or moved to another day). */
export function isOpenTask(task: { status: string }): boolean {
  return !CLOSED_STATUSES.has(task.status);
}

export function clampPriority(value: number | null | undefined): number {
  const n = Math.round(Number(value ?? DEFAULT_TASK_PRIORITY));
  if (!Number.isFinite(n)) return DEFAULT_TASK_PRIORITY;
  return Math.min(5, Math.max(1, n));
}

/**
 * Ledger order: open tasks first (P1 → P5), finished ones at the bottom.
 * Stable for equal priority so rows don't jump around while editing.
 */
export function sortTasks<T extends { status: string; priority: number }>(tasks: T[]): T[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const aOpen = isOpenTask(a.task) ? 0 : 1;
      const bOpen = isOpenTask(b.task) ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      const byPriority = clampPriority(a.task.priority) - clampPriority(b.task.priority);
      if (byPriority !== 0) return byPriority;
      return a.index - b.index;
    })
    .map((entry) => entry.task);
}

/** Today's top open tasks by priority. This is what "Top Priorities" means. */
export function pickTopTasks<T extends { status: string; priority: number }>(
  tasks: T[],
  count: number = TOP_TASKS_COUNT
): T[] {
  return sortTasks(tasks.filter(isOpenTask)).slice(0, count);
}
