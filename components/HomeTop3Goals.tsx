import Link from "next/link";
import type { Goal } from "@/lib/goals/types";

export default function HomeTop3Goals({
  goals,
  courseCodeMap,
}: {
  goals: Goal[];
  courseCodeMap?: Record<string, string>;
}) {
  return (
    <section aria-label="Things To Be Done" className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
          Things To Be Done · Top Priorities
        </h2>
        <Link
          href="/goals?section=today"
          className="font-mono text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Manage &rarr;
        </Link>
      </div>

      {goals.length === 0 ? (
        <p className="font-mono text-xs text-neutral-500 py-1">
          No top 3 priority goals selected. Star a goal in Goals &rarr;
        </p>
      ) : (
        <div className="divide-y divide-neutral-800/60 font-mono text-xs">
          {goals.map((goal, idx) => {
            const courseCode = goal.course_id && courseCodeMap ? courseCodeMap[goal.course_id] : null;
            return (
              <Link
                key={goal.id}
                href={`/goals/${goal.id}`}
                className="py-2.5 flex items-center justify-between gap-3 group hover:bg-neutral-800/20 px-1 rounded transition-colors"
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-bold text-amber-400/80 text-[11px]">#{idx + 1}</span>
                  {courseCode && (
                    <span className="rounded bg-neutral-800 px-1 py-0.2 text-[10px] text-neutral-300">
                      {courseCode}
                    </span>
                  )}
                  <span className="text-neutral-200 group-hover:text-white transition-colors truncate">
                    {goal.title}
                  </span>
                </div>

                <div className="flex items-center gap-2 whitespace-nowrap text-right">
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {goal.progress}%
                  </span>
                  {goal.due_date && (
                    <span className="text-[10px] text-neutral-400">
                      Due {goal.due_date.slice(5)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
