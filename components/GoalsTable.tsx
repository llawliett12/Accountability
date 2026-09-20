"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleGoalTop3, updateGoal, deleteGoal } from "@/lib/goals/actions";
import type { GoalStatus } from "@/lib/goals/types";
import TrashIcon from "@/components/icons/TrashIcon";

export interface GoalRowItem {
  id: string;
  title: string;
  priority: number;
  status: string;
  progress?: number;
  computedProgress?: number;
  due_date?: string | null;
  course_id?: string | null;
  is_top3?: boolean;
  overdue?: boolean;
}


const PRIORITY_BADGES: Record<number, { label: string; class: string }> = {
  1: { label: "P1 · High", class: "bg-rose-950/70 text-rose-300 border-rose-800/60" },
  2: { label: "P2 · Med", class: "bg-amber-950/70 text-amber-300 border-amber-800/60" },
  3: { label: "P3 · Normal", class: "bg-blue-950/70 text-blue-300 border-blue-800/60" },
  4: { label: "P4 · Low", class: "bg-neutral-800 text-neutral-400 border-neutral-700" },
  5: { label: "P5 · Low", class: "bg-neutral-800 text-neutral-500 border-neutral-700" },
};

export interface GoalsTableProps {
  initialGoals?: GoalRowItem[];
  goals?: GoalRowItem[];
  courseCodeMap?: Record<string, string>;
  onToggleTop3?: (goalId: string, current: boolean) => void;
  onStatusChange?: (goalId: string, newStatus: GoalStatus) => void;
  onDeleteGoal?: (goalId: string, title: string) => void;
}

export default function GoalsTable({
  initialGoals = [],
  goals: controlledGoals,
  courseCodeMap = {},
  onToggleTop3,
  onStatusChange,
  onDeleteGoal,
}: GoalsTableProps) {
  const [localGoals, setLocalGoals] = useState<GoalRowItem[]>(initialGoals);

  // Synchronize initialGoals safely if uncontrolled
  const isControlled = controlledGoals !== undefined;
  const goals = isControlled ? controlledGoals : localGoals;

  const [pending, startTransition] = useTransition();

  const handleToggleTop3 = (goalId: string, current: boolean) => {
    if (onToggleTop3) {
      onToggleTop3(goalId, current);
      return;
    }

    setLocalGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, is_top3: !current } : g))
    );

    startTransition(async () => {
      try {
        await toggleGoalTop3(goalId, !current);
      } catch (err) {
        console.error("Failed to toggle top 3", err);
      }
    });
  };

  const handleStatusChange = (goalId: string, newStatus: GoalStatus) => {
    if (onStatusChange) {
      onStatusChange(goalId, newStatus);
      return;
    }

    setLocalGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? {
              ...g,
              status: newStatus,
              computedProgress: newStatus === "completed" ? 100 : g.computedProgress,
            }
          : g
      )
    );

    startTransition(async () => {
      try {
        await updateGoal(goalId, { status: newStatus });
      } catch (err) {
        console.error("Failed to update status", err);
      }
    });
  };

  const handleDelete = (goalId: string, title: string) => {
    if (onDeleteGoal) {
      onDeleteGoal(goalId, title);
      return;
    }

    if (!confirm(`Are you sure you want to delete goal: "${title}"?\nThis action cannot be undone.`)) {
      return;
    }

    const prevGoals = localGoals;
    setLocalGoals((prev) => prev.filter((g) => g.id !== goalId));

    startTransition(async () => {
      try {
        await deleteGoal(goalId);
      } catch (err) {
        console.error("Failed to delete goal", err);
        setLocalGoals(prevGoals);
        alert("Failed to delete goal: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  if (goals.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/40 p-8 text-center font-mono text-xs text-neutral-500">
        No goals match the selected filter.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
      <table className="w-full text-left text-xs border-collapse min-w-[560px]">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
            <th className="py-2.5 px-3">Goal</th>
            <th className="py-2.5 px-2 w-28 text-center">Priority</th>
            <th className="py-2.5 px-3 w-32">Progress</th>
            <th className="py-2.5 px-2 w-28 text-center">State</th>
            <th className="py-2.5 px-2 w-24 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
          {goals.map((goal) => {
            const courseCode = goal.course_id ? courseCodeMap[goal.course_id] : null;
            const progress = goal.computedProgress ?? goal.progress ?? 0;
            const priorityBadge = PRIORITY_BADGES[goal.priority] ?? PRIORITY_BADGES[3];

            return (
              <tr key={goal.id} className="hover:bg-neutral-900/50 transition-colors">
                {/* 1. GOAL TITLE & OPTIONAL COURSE BADGE */}
                <td className="py-3 px-3 font-sans">
                  <div className="flex items-center gap-2">
                    {courseCode && (
                      <span className="rounded bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 text-[10px] text-amber-300 font-mono font-bold">
                        {courseCode}
                      </span>
                    )}
                    <Link
                      href={`/goals/${goal.id}`}
                      className="font-medium text-neutral-100 hover:text-amber-300 transition-colors truncate max-w-[260px] sm:max-w-none"
                    >
                      {goal.title}
                    </Link>
                  </div>

                  {goal.due_date && (
                    <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                      Due {goal.due_date}
                      {goal.overdue && <span className="text-rose-400 font-semibold ml-1.5">Overdue</span>}
                    </div>
                  )}
                </td>

                {/* 2. PRIORITY */}
                <td className="py-3 px-2 text-center whitespace-nowrap">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border ${priorityBadge.class}`}
                  >
                    {priorityBadge.label}
                  </span>
                </td>

                {/* 3. PROGRESS BAR & PERCENTAGE */}
                <td className="py-3 px-3 whitespace-nowrap font-mono">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-neutral-800 rounded-full overflow-hidden min-w-[50px]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          goal.status === "completed" ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-neutral-300 w-8 text-right">
                      {progress}%
                    </span>
                  </div>
                </td>

                {/* 4. STATE (DROP-DOWN SELECTOR) */}
                <td className="py-3 px-2 text-center whitespace-nowrap">
                  <select
                    value={goal.status}
                    onChange={(e) => handleStatusChange(goal.id, e.target.value as GoalStatus)}
                    disabled={pending}
                    className={`rounded border px-2 py-1 text-[11px] font-mono font-semibold outline-none transition-colors ${
                      goal.status === "completed"
                        ? "bg-emerald-950/70 border-emerald-800 text-emerald-400"
                        : goal.status === "in_progress"
                        ? "bg-blue-950/70 border-blue-800 text-blue-300"
                        : goal.status === "abandoned"
                        ? "bg-neutral-800 border-neutral-700 text-neutral-500"
                        : "bg-neutral-900 border-neutral-700 text-neutral-300"
                    }`}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="abandoned">Dropped</option>
                  </select>
                </td>

                {/* 5. ACTIONS: TOP 3 TOGGLE, EDIT, DELETE */}
                <td className="py-3 px-2 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    {/* Top 3 Star */}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleToggleTop3(goal.id, Boolean(goal.is_top3))}
                      aria-label="Toggle Top 3"
                      title={goal.is_top3 ? "Starred in Top 3" : "Add to Top 3"}
                      className={`text-base transition-transform hover:scale-110 p-1 ${
                        goal.is_top3 ? "text-amber-400" : "text-neutral-700 hover:text-neutral-400"
                      }`}
                    >
                      ★
                    </button>

                    {/* Edit */}
                    <Link
                      href={`/goals/${goal.id}`}
                      className="rounded p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                      title="Edit Goal"
                    >
                      ✎
                    </Link>

                    {/* Delete with confirmation */}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(goal.id, goal.title)}
                      className="rounded p-1 text-neutral-600 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                      title="Delete Goal"
                      aria-label={`Delete goal ${goal.title}`}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
