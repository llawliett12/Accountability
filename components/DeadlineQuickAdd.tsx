"use client";

import { useState, useTransition } from "react";
import { createDeadline } from "@/lib/academics/actions";

export default function DeadlineQuickAdd({
  classes,
}: {
  classes: { id: string; name: string }[];
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [classId, setClassId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!title.trim() || !dueDate) return;
    setError(null);
    startTransition(async () => {
      try {
        await createDeadline({
          title: title.trim(),
          due_date: dueDate,
          class_id: classId || undefined,
        });
        setTitle("");
        setDueDate("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create deadline");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-2xl bg-neutral-900 p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Deadline (e.g. Essay draft due)"
        className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-full rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
      />
      {classes.length > 0 && (
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="w-full rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
        >
          <option value="">No linked class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending || !title.trim() || !dueDate}
        className="w-full rounded-lg bg-white py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
      >
        Add deadline
      </button>
    </div>
  );
}
