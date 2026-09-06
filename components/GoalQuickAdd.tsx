"use client";

import { useMemo, useState, useTransition } from "react";
import { createGoal } from "@/lib/goals/actions";
import { parentLevelFor } from "@/lib/goals/engine";
import type { GoalLevel } from "@/lib/goals/types";

export interface ParentOption {
  id: string;
  title: string;
  level: string;
}

const LEVELS: { value: GoalLevel; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "quarter", label: "Quarter" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

export default function GoalQuickAdd({
  goals,
  defaultLevel = "week",
  defaultParentId,
}: {
  goals: ParentOption[];
  defaultLevel?: GoalLevel;
  defaultParentId?: string;
}) {
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<GoalLevel>(defaultLevel);
  const [parentId, setParentId] = useState(defaultParentId ?? "");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState(3);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const expectedParentLevel = parentLevelFor(level);
  const parentOptions = useMemo(
    () => goals.filter((g) => g.level === expectedParentLevel),
    [goals, expectedParentLevel]
  );

  function submit() {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createGoal({
          title: title.trim(),
          level,
          parent_id: parentId || undefined,
          due_date: dueDate || undefined,
          priority,
        });
        setTitle("");
        setParentId("");
        setDueDate("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create goal");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-2xl bg-neutral-900 p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New goal title..."
        className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none"
      />

      <div className="flex flex-wrap gap-1.5">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => {
              setLevel(l.value);
              setParentId("");
            }}
            className={`rounded-lg px-2.5 py-1 text-xs ${
              level === l.value ? "bg-white text-neutral-950" : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {expectedParentLevel && (
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="w-full rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
        >
          <option value="">No parent {expectedParentLevel} goal</option>
          {parentOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      )}

      <div className="flex gap-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="flex-1 rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
        />
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`h-7 w-7 rounded-lg text-xs ${
                priority === p ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-400"
              }`}
              title={`Priority ${p}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !title.trim()}
        className="w-full rounded-lg bg-white py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
      >
        Add goal
      </button>
    </div>
  );
}
