"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import GoalsTable, { type GoalRowItem } from "@/components/GoalsTable";
import { createGoal, toggleGoalTop3, updateGoal, deleteGoal } from "@/lib/goals/actions";
import type { GoalStatus } from "@/lib/goals/types";
import type { GoalWithMeta } from "@/lib/goals/queries";
import NotesSection from "@/components/NotesSection";
import type { Note } from "@/lib/notes/types";

export type GoalFilter = "all" | "active" | "top3" | "completed";
export type GoalsSection = GoalFilter | string;

interface GoalsSectionManagerProps {
  allGoals: GoalWithMeta[];
  initialSection?: string | null;
  active: GoalWithMeta[];
  overdue: GoalWithMeta[];
  top3Goals: GoalWithMeta[];
  todayGoals: GoalWithMeta[];
  upcoming: GoalWithMeta[];
  recentlyCompleted: GoalWithMeta[];
  goalsCount: number;
  courseCodeMap?: Record<string, string>;
  courses?: { id: string; code: string; name: string }[];
  goalNotes?: Note[];
}

export default function GoalsSectionManager({
  allGoals,
  courseCodeMap = {},
  courses = [],
  goalNotes = [],
}: GoalsSectionManagerProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<GoalFilter>("active");
  const [goalsList, setGoalsList] = useState<GoalRowItem[]>(allGoals);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoalsList((curr) => {
      const serverIds = new Set(allGoals.map((g) => g.id));
      const localOnly = curr.filter((g) => !serverIds.has(g.id));
      return [...localOnly, ...allGoals];
    });
  }, [allGoals]);

  // Quick Add state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState(3);
  const [newCourseId, setNewCourseId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setAddError(null);
    startTransition(async () => {
      try {
        const id = await createGoal({
          title: newTitle.trim(),
          priority: newPriority,
          course_id: newCourseId || undefined,
          due_date: newDueDate || undefined,
          level: "week", // default level for single flat list
          is_top3: false,
        });

        const newGoal: GoalRowItem = {
          id,
          title: newTitle.trim(),
          priority: newPriority,
          course_id: newCourseId || null,
          due_date: newDueDate || null,
          status: "not_started",
          progress: 0,
          computedProgress: 0,
          is_top3: false,
        };

        setGoalsList((prev) => [newGoal, ...prev]);
        setNewTitle("");
        setNewCourseId("");
        setNewDueDate("");
        setNewPriority(3);
        setShowQuickAdd(false);
        router.refresh();
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Failed to create goal");
      }
    });
  };

  const handleToggleTop3 = (goalId: string, current: boolean) => {
    setGoalsList((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, is_top3: !current } : g))
    );
    startTransition(async () => {
      try {
        await toggleGoalTop3(goalId, !current);
        router.refresh();
      } catch (err) {
        console.error("Failed to toggle top 3", err);
      }
    });
  };

  const handleStatusChange = (goalId: string, newStatus: GoalStatus) => {
    setGoalsList((prev) =>
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
        router.refresh();
      } catch (err) {
        console.error("Failed to update status", err);
      }
    });
  };

  const handleDeleteGoal = (goalId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete goal: "${title}"?\nThis action cannot be undone.`)) {
      return;
    }
    const prevList = goalsList;
    setGoalsList((prev) => prev.filter((g) => g.id !== goalId));
    startTransition(async () => {
      try {
        await deleteGoal(goalId);
        router.refresh();
      } catch (err) {
        console.error("Failed to delete goal", err);
        setGoalsList(prevList);
        alert("Failed to delete goal: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const activeCount = goalsList.filter((g) => g.status !== "completed" && g.status !== "abandoned").length;
  const top3Count = goalsList.filter((g) => g.is_top3 && g.status !== "completed" && g.status !== "abandoned").length;
  const completedCount = goalsList.filter((g) => g.status === "completed").length;

  const filteredGoals = goalsList.filter((g) => {
    if (filter === "active") return g.status !== "completed" && g.status !== "abandoned";
    if (filter === "top3") return g.is_top3 && g.status !== "completed" && g.status !== "abandoned";
    if (filter === "completed") return g.status === "completed";
    return true; // all
  });

  return (
    <div className="space-y-4">
      {/* 1. TOP SUMMARY & QUICK ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-sm">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === "all"
                ? "bg-white text-neutral-950 font-bold"
                : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800/80"
            }`}
          >
            All ({goalsList.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === "active"
                ? "bg-amber-400 text-neutral-950 font-bold"
                : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800/80"
            }`}
          >
            Active ({activeCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter("top3")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === "top3"
                ? "bg-amber-400 text-neutral-950 font-bold"
                : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800/80"
            }`}
          >
            ★ Top 3 ({top3Count})
          </button>

          <button
            type="button"
            onClick={() => setFilter("completed")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === "completed"
                ? "bg-emerald-400 text-neutral-950 font-bold"
                : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800/80"
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>

        {/* Quick Add Toggle Button */}
        <button
          type="button"
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          className="rounded-lg bg-neutral-100 px-3.5 py-1.5 font-mono text-sm font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors ml-auto"
        >
          {showQuickAdd ? "✕ Close" : "+ New Goal"}
        </button>
      </div>

      {/* 2. QUICK ADD GOAL FORM */}
      {showQuickAdd && (
        <form
          onSubmit={handleCreateGoal}
          className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 space-y-3 font-mono text-sm"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-200">Create New Goal</span>
            <span className="text-xs text-neutral-500">Optional course link &amp; deadline</span>
          </div>

          {addError && (
            <div className="rounded-lg bg-rose-950/60 border border-rose-800/60 p-2 text-rose-300">
              {addError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              required
              placeholder="Goal title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="sm:col-span-6 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-400"
            />

            <select
              value={newCourseId}
              onChange={(e) => setNewCourseId(e.target.value)}
              className="sm:col-span-3 rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-2 text-neutral-200 focus:outline-none focus:border-amber-400"
            >
              <option value="">No Course (Global)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>

            <select
              value={newPriority}
              onChange={(e) => setNewPriority(parseInt(e.target.value, 10))}
              className="sm:col-span-3 rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-2 text-neutral-200 focus:outline-none focus:border-amber-400"
            >
              <option value={1}>P1 · High</option>
              <option value={2}>P2 · Medium</option>
              <option value={3}>P3 · Normal</option>
              <option value={4}>P4 · Low</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-400 uppercase">Due Date:</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-neutral-300 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={pending || !newTitle.trim()}
              className="rounded-lg bg-amber-400 px-4 py-1.5 font-bold text-neutral-950 hover:bg-amber-300 disabled:opacity-40 transition-colors"
            >
              {pending ? "Adding..." : "Add Goal"}
            </button>
          </div>
        </form>
      )}

      {/* 3. THE ONE ULTIMATE GLOBAL GOALS TABLE */}
      <GoalsTable
        goals={filteredGoals}
        courseCodeMap={courseCodeMap}
        onToggleTop3={handleToggleTop3}
        onStatusChange={handleStatusChange}
        onDeleteGoal={handleDeleteGoal}
      />

      {/* 4. GOAL NOTES */}
      <NotesSection title="Goal Notes" notes={goalNotes} category="goals" />
    </div>
  );
}
