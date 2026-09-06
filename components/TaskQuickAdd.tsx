"use client";

import { useState, useTransition } from "react";
import { createTask } from "@/lib/actions";

export interface LinkableGoal {
  id: string;
  title: string;
  level: string;
}

export default function TaskQuickAdd({ goals = [] }: { goals?: LinkableGoal[] }) {
  const [title, setTitle] = useState("");
  const [isTop3, setIsTop3] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [goalId, setGoalId] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!title.trim()) return;
    startTransition(async () => {
      await createTask({
        title: title.trim(),
        is_top3: isTop3,
        goal_id: goalId || undefined,
      });
      setTitle("");
      setIsTop3(false);
      setGoalId("");
      setShowGoalPicker(false);
    });
  }

  return (
    <div className="space-y-2 rounded-2xl bg-neutral-900 p-3">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Quick add a task..."
          className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => setIsTop3(!isTop3)}
          className={`rounded-lg px-3 text-sm ${
            isTop3 ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-400"
          }`}
          title="Mark as Top 3"
        >
          ★
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-white px-4 text-sm font-medium text-neutral-950"
        >
          Add
        </button>
      </div>

      {goals.length > 0 &&
        (showGoalPicker ? (
          <div className="flex gap-2">
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="flex-1 rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
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
              className="rounded-lg bg-neutral-800 px-2 text-xs text-neutral-400"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowGoalPicker(true)}
            className="rounded-lg bg-neutral-800 px-2 py-1 text-xs text-neutral-400"
          >
            + Link to goal
          </button>
        ))}
    </div>
  );
}
