"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { GoalCardData } from "./GoalCard";
import { toggleGoalTop3 } from "@/lib/goals/actions";

const LEVEL_COLORS: Record<string, string> = {
  year: "bg-purple-950/70 text-purple-300 border-purple-800/60",
  quarter: "bg-blue-950/70 text-blue-300 border-blue-800/60",
  month: "bg-emerald-950/70 text-emerald-300 border-emerald-800/60",
  week: "bg-amber-950/70 text-amber-300 border-amber-800/60",
  day: "bg-neutral-900 text-neutral-400 border-neutral-800",
};

export default function GoalsTable({
  goals,
  title,
  courseCodeMap = {},
}: {
  goals: (GoalCardData & { is_top3?: boolean; course_id?: string | null })[];
  title?: string;
  courseCodeMap?: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();

  if (goals.length === 0) return null;

  const handleToggleTop3 = (goalId: string, current: boolean) => {
    startTransition(async () => {
      try {
        await toggleGoalTop3(goalId, !current);
      } catch (err) {
        console.error("Failed to toggle top 3", err);
      }
    });
  };

  return (
    <div className="space-y-1.5">
      {title && (
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
            {title}
          </span>
          <span className="font-mono text-[11px] text-neutral-500">[{goals.length}]</span>
        </div>
      )}

      <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
        <table className="w-full text-left text-xs border-collapse min-w-[520px]">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              <th className="py-2 px-2.5 w-16 text-center">Level</th>
              <th className="py-2 px-2 w-10 text-center">Top 3</th>
              <th className="py-2 px-3">Goal</th>
              <th className="py-2 px-2 w-14 text-center">Priority</th>
              <th className="py-2 px-3 w-32">Progress</th>
              <th className="py-2 px-2 w-24 text-center">Due Date</th>
              <th className="py-2 px-2 w-20 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
            {goals.map((goal) => {
              const levelStyle =
                LEVEL_COLORS[goal.level] ??
                "bg-neutral-900 text-neutral-400 border-neutral-800";
              const isOverdue = goal.overdue;
              const courseCode = goal.course_id ? courseCodeMap[goal.course_id] : null;

              return (
                <tr
                  key={goal.id}
                  className="hover:bg-neutral-900/50 transition-colors"
                >
                  {/* Level Pill */}
                  <td className="py-2.5 px-2 text-center whitespace-nowrap">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase border ${levelStyle}`}
                    >
                      {goal.level}
                    </span>
                  </td>

                  {/* Top 3 Toggle */}
                  <td className="py-2.5 px-2 text-center">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleToggleTop3(goal.id, Boolean(goal.is_top3))}
                      aria-label="Toggle Top 3"
                      className={`text-sm transition-transform hover:scale-110 ${
                        goal.is_top3 ? "text-amber-400" : "text-neutral-700 hover:text-neutral-400"
                      }`}
                    >
                      ★
                    </button>
                  </td>

                  {/* Title & Course */}
                  <td className="py-2.5 px-3 font-sans">
                    <div className="flex items-center gap-2">
                      {courseCode && (
                        <span className="rounded bg-neutral-800 px-1 py-0.2 text-[10px] text-amber-300 font-mono">
                          {courseCode}
                        </span>
                      )}
                      <Link
                        href={`/goals/${goal.id}`}
                        className="font-medium text-neutral-200 hover:text-amber-300 transition-colors truncate max-w-[220px]"
                      >
                        {goal.title}
                      </Link>
                    </div>
                  </td>

                  {/* Priority */}
                  <td className="py-2.5 px-2 text-center text-amber-300 font-mono">P{goal.priority}</td>

                  {/* Progress Bar & % */}
                  <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-neutral-800 rounded-full overflow-hidden min-w-[50px]">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all"
                          style={{ width: `${goal.computedProgress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-neutral-300 w-8 text-right">
                        {goal.computedProgress}%
                      </span>
                    </div>
                  </td>

                  {/* Due Date */}
                  <td className="py-2.5 px-2 text-center text-[11px] whitespace-nowrap font-mono">
                    {isOverdue ? (
                      <span className="text-red-400 font-semibold">Overdue</span>
                    ) : goal.due_date ? (
                      <span className="text-neutral-400">{goal.due_date}</span>
                    ) : (
                      <span className="text-neutral-700">--</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-2 text-center whitespace-nowrap font-mono">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] uppercase font-semibold ${
                        goal.status === "completed"
                          ? "bg-emerald-950/70 border border-emerald-800/60 text-emerald-300"
                          : isOverdue
                          ? "bg-red-950/70 border border-red-800/60 text-red-300"
                          : "bg-neutral-900 border border-neutral-800 text-neutral-400"
                      }`}
                    >
                      {goal.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
