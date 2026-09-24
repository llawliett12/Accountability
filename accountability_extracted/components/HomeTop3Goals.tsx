"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createGoal, updateGoal } from "@/lib/goals/actions";
import type { Goal } from "@/lib/goals/types";

const PRIORITY_LEVELS = [1, 2, 3, 4, 5];

export default function HomeTop3Goals({
  goals,
  courseCodeMap,
}: {
  goals: Goal[];
  courseCodeMap?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openPriorityFor, setOpenPriorityFor] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function changePriority(goalId: string, priority: number) {
    setOpenPriorityFor(null);
    startTransition(async () => {
      try {
        await updateGoal(goalId, { priority });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update priority");
      }
    });
  }

  function submitNew() {
    const title = newTitle.trim();
    if (!title) return;
    setError(null);
    startTransition(async () => {
      try {
        await createGoal({
          title,
          level: "day",
          priority: newPriority,
          is_top3: true,
        });
        setNewTitle("");
        setNewPriority(1);
        setIsAdding(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add priority");
      }
    });
  }

  return (
    <section aria-label="Things To Be Done" className="space-y-2 pt-1">
      <div className="flex items-center justify-between border-b border-neutral-800/70 pb-2">
        <h2 className="font-mono text-xs uppercase tracking-wider text-neutral-400 font-semibold">
          Things To Be Done · Top Priorities
        </h2>
        <div className="flex items-center gap-3">
          {!isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="font-mono text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              + Add
            </button>
          )}
          <Link
            href="/goals?section=today"
            className="font-mono text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Manage &rarr;
          </Link>
        </div>
      </div>

      {/* INLINE QUICK-ADD — create a new top priority directly on Home */}
      {isAdding && (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-700 bg-neutral-950 p-2.5 font-mono text-sm">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
              if (e.key === "Escape") setIsAdding(false);
            }}
            placeholder="New priority..."
            className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-neutral-100 placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-500">Priority:</span>
              {PRIORITY_LEVELS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewPriority(p)}
                  className={`h-6 w-6 rounded text-xs ${
                    newPriority === p ? "bg-amber-400 text-neutral-950" : "bg-neutral-800 text-neutral-400"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle("");
                }}
                className="px-2 py-1 text-neutral-500 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNew}
                disabled={pending || !newTitle.trim()}
                className="rounded bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="font-mono text-xs text-red-400">{error}</p>}

      {goals.length === 0 && !isAdding ? (
        <p className="font-mono text-sm text-neutral-500 py-1">
          No top 3 priority goals selected. Star a goal in Goals, or add one directly above.
        </p>
      ) : (
        <div className="divide-y divide-neutral-800/60 font-mono text-sm">
          {goals.map((goal, idx) => {
            const courseCode = goal.course_id && courseCodeMap ? courseCodeMap[goal.course_id] : null;
            return (
              <div
                key={goal.id}
                className="py-2.5 flex items-center justify-between gap-3 group hover:bg-neutral-800/20 px-1 rounded transition-colors"
              >
                <Link href={`/goals/${goal.id}`} className="flex items-baseline gap-2 min-w-0 flex-1">
                  <span className="font-bold text-amber-400/80 text-xs">#{idx + 1}</span>
                  {courseCode && (
                    <span className="rounded bg-neutral-800 px-1 py-0.2 text-xs text-neutral-300">
                      {courseCode}
                    </span>
                  )}
                  <span className="text-neutral-200 group-hover:text-white transition-colors truncate">
                    {goal.title}
                  </span>
                </Link>

                <div className="flex items-center gap-2 whitespace-nowrap text-right shrink-0">
                  <span className="text-xs text-neutral-500 font-mono">
                    {goal.progress}%
                  </span>
                  {goal.due_date && (
                    <span className="text-xs text-neutral-400">
                      Due {goal.due_date.slice(5)}
                    </span>
                  )}

                  {/* PRIORITY LEVEL CONTROL */}
                  <div className="relative">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setOpenPriorityFor(openPriorityFor === goal.id ? null : goal.id)}
                      title="Change priority level"
                      className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-400 hover:text-amber-300 hover:border-neutral-700 transition-colors"
                    >
                      P{goal.priority}
                    </button>
                    {openPriorityFor === goal.id && (
                      <div className="absolute right-0 top-full mt-1 z-10 flex gap-1 rounded-lg border border-neutral-700 bg-neutral-900 p-1.5 shadow-lg">
                        {PRIORITY_LEVELS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => changePriority(goal.id, p)}
                            className={`h-6 w-6 rounded text-xs ${
                              goal.priority === p
                                ? "bg-amber-400 text-neutral-950"
                                : "bg-neutral-800 text-neutral-400 hover:text-amber-300"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
