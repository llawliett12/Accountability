"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createTask } from "@/lib/actions";

export interface LinkableGoal {
  id: string;
  title: string;
  level: string;
}

export interface TaskQuickAddProps {
  goals?: LinkableGoal[];
  selectedDate?: string;
  defaultIsTop3?: boolean;
  activeTop3Trigger?: number;
  onOptimisticCreate?: (input: {
    title: string;
    is_top3: boolean;
    goal_id?: string;
    planned_duration_min?: number;
    planned_start?: string;
    date?: string;
  }) => Promise<void>;
}

export default function TaskQuickAdd({
  goals = [],
  selectedDate,
  defaultIsTop3 = false,
  activeTop3Trigger = 0,
  onOptimisticCreate,
}: TaskQuickAddProps) {
  const [title, setTitle] = useState("");
  const [isTop3, setIsTop3] = useState(defaultIsTop3);
  const [durationMin, setDurationMin] = useState<number | undefined>(undefined);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [goalId, setGoalId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const [prevTrigger, setPrevTrigger] = useState(activeTop3Trigger);
  if (activeTop3Trigger !== prevTrigger) {
    setPrevTrigger(activeTop3Trigger);
    if (activeTop3Trigger > 0) {
      setIsTop3(true);
    }
  }

  useEffect(() => {
    if (activeTop3Trigger > 0) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeTop3Trigger]);

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    const savedTitle = trimmed;
    const savedTop3 = isTop3;
    const savedGoalId = goalId;
    const savedDuration = durationMin;

    // Clear input immediately so user can type next task
    setTitle("");
    setIsTop3(defaultIsTop3);
    setGoalId("");
    setShowGoalPicker(false);
    setDurationMin(undefined);

    startTransition(async () => {
      try {
        if (onOptimisticCreate) {
          await onOptimisticCreate({
            title: savedTitle,
            is_top3: savedTop3,
            goal_id: savedGoalId || undefined,
            planned_duration_min: savedDuration,
            date: selectedDate,
          });
        } else {
          await createTask({
            title: savedTitle,
            is_top3: savedTop3,
            goal_id: savedGoalId || undefined,
            planned_duration_min: savedDuration,
            date: selectedDate,
          });
        }
      } catch (err: unknown) {
        console.error("Create task error:", err);
        // Restore input state so user does not lose what they entered
        setTitle(savedTitle);
        setIsTop3(savedTop3);
        setDurationMin(savedDuration);
        if (savedGoalId) {
          setGoalId(savedGoalId);
          setShowGoalPicker(true);
        }
        setError(
          err instanceof Error
            ? err.message
            : "Failed to add task. Please try again."
        );
      }
    });
  }

  return (
    <div className="space-y-2 rounded-xl bg-neutral-900 border border-neutral-800/80 p-3">
      {error && (
        <p className="rounded-lg border border-red-800/50 bg-red-950/70 p-2 text-xs text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add a task..."
          className="flex-1 min-w-0 rounded-lg bg-neutral-800/90 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:ring-1 focus:ring-neutral-600"
        />
        <button
          type="button"
          onClick={() => setIsTop3(!isTop3)}
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-sm transition-colors ${
            isTop3 ? "bg-amber-500 text-black font-bold" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
          }`}
          title={isTop3 ? "Marked as Top 3" : "Mark as Top 3"}
        >
          ★
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !title.trim()}
          className="min-h-[44px] rounded-lg bg-white px-4 text-sm font-medium text-neutral-950 disabled:opacity-50 hover:bg-neutral-200 transition-colors"
        >
          {pending ? "..." : "Add"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* Quick duration chips */}
        <div className="flex items-center gap-1">
          {[15, 30, 45, 60].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setDurationMin(durationMin === mins ? undefined : mins)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-mono transition-colors ${
                durationMin === mins
                  ? "bg-neutral-200 text-neutral-900 font-semibold"
                  : "bg-neutral-800/70 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>

        {/* Goal selector */}
        {goals.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            {showGoalPicker ? (
              <div className="flex gap-1 items-center">
                <select
                  value={goalId}
                  onChange={(e) => setGoalId(e.target.value)}
                  className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 outline-none max-w-[150px]"
                >
                  <option value="">No linked goal</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      [{g.level}] {g.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setGoalId("");
                    setShowGoalPicker(false);
                  }}
                  className="p-1 text-xs text-neutral-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowGoalPicker(true)}
                className="rounded bg-neutral-800/60 px-2 py-0.5 text-[11px] text-neutral-400 hover:text-neutral-200"
              >
                + Goal
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
