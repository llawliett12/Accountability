import Link from "next/link";
import type { GoalCardData } from "./GoalCard";

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
}: {
  goals: GoalCardData[];
  title?: string;
}) {
  if (goals.length === 0) return null;

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
        <table className="w-full text-left text-xs border-collapse min-w-[480px]">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              <th className="py-2 px-2.5 w-20 text-center">Level</th>
              <th className="py-2 px-3">Goal</th>
              <th className="py-2 px-2 w-16 text-center">Priority</th>
              <th className="py-2 px-3 w-36">Progress</th>
              <th className="py-2 px-2 w-24 text-center">Due Date</th>
              <th className="py-2 px-2 w-20 text-center">Status</th>
              <th className="py-2 px-2 w-12 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
            {goals.map((goal) => {
              const levelStyle =
                LEVEL_COLORS[goal.level] ??
                "bg-neutral-900 text-neutral-400 border-neutral-800";
              const isOverdue = goal.overdue;

              return (
                <tr
                  key={goal.id}
                  className="hover:bg-neutral-900/50 transition-colors"
                >
                  {/* Level Pill */}
                  <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase border ${levelStyle}`}
                    >
                      {goal.level}
                    </span>
                  </td>

                  <td className="py-2.5 px-2 text-center text-amber-300">P{goal.priority}</td>

                  {/* Title */}
                  <td className="py-2.5 px-3 font-sans">
                    <Link
                      href={`/goals/${goal.id}`}
                      className="font-medium text-neutral-200 hover:text-amber-300 transition-colors block truncate max-w-[240px]"
                    >
                      {goal.title}
                    </Link>
                  </td>

                  {/* Progress Bar & % */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
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
                  <td className="py-2.5 px-2 text-center text-[11px] whitespace-nowrap">
                    {isOverdue ? (
                      <span className="text-red-400 font-semibold">Overdue</span>
                    ) : goal.due_date ? (
                      <span className="text-neutral-400">{goal.due_date}</span>
                    ) : (
                      <span className="text-neutral-700">--</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-2 text-center whitespace-nowrap">
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

                  {/* Action Link */}
                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    <Link
                      href={`/goals/${goal.id}`}
                      className="text-amber-400 hover:text-amber-300 text-xs px-1"
                    >
                      →
                    </Link>
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
