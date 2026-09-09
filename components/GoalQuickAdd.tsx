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
    <section className="space-y-2">
      <div className="ledger-heading">
        <div><h2>Add goal</h2><p>Create a row directly in the hierarchy.</p></div>
        <span className="ledger-count">Enter to save</span>
      </div>
      <form className="ledger-scroll" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <table className="ledger-table min-w-[600px]">
          <thead><tr><th className="w-10">+</th><th>Goal</th><th className="w-24">Level</th><th className="w-36">Parent</th><th className="w-32">Target</th><th className="w-36">Importance</th><th className="w-20"></th></tr></thead>
          <tbody><tr className="ledger-add-row"><td className="text-center text-amber-400">+</td><td><input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New goal title..."
      /></td><td><select value={level} onChange={(e) => { setLevel(e.target.value as GoalLevel); setParentId(""); }} className="w-full bg-transparent text-xs text-neutral-200 outline-none">
        {LEVELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select></td><td>{expectedParentLevel ? <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="w-full bg-transparent text-xs text-neutral-200 outline-none"
        >
          <option value="">No parent {expectedParentLevel} goal</option>
          {parentOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select> : <span className="text-neutral-600">—</span>}</td><td><input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full bg-transparent text-xs text-neutral-300 outline-none"
        /></td><td><div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`h-7 w-6 text-xs ${
                priority === p ? "bg-amber-400 text-neutral-950" : "text-neutral-500 hover:text-amber-300"
              }`}
              title={`Priority ${p}`}
            >
              {p}
            </button>
          ))}
        </div></td><td><button
        type="button"
        onClick={() => submit()}
        disabled={pending || !title.trim()}
        className="state-action state-good whitespace-nowrap"
      >
        {pending ? "Saving" : "Add"}
      </button></td></tr></tbody>
        </table>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
