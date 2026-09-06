"use client";

import { useState, useTransition } from "react";
import { createAssessment } from "@/lib/academics/actions";
import type { AssessmentType } from "@/lib/academics/types";

export default function AssessmentQuickAdd({
  classes,
}: {
  classes: { id: string; name: string }[];
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AssessmentType>("quiz");
  const [date, setDate] = useState("");
  const [classId, setClassId] = useState("");
  const [targetScore, setTargetScore] = useState("");
  const [prepHours, setPrepHours] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!title.trim() || !date) return;
    setError(null);
    startTransition(async () => {
      try {
        await createAssessment({
          title: title.trim(),
          type,
          date,
          class_id: classId || undefined,
          target_score: targetScore ? Number(targetScore) : undefined,
          prep_hours: prepHours ? Number(prepHours) : undefined,
        });
        setTitle("");
        setDate("");
        setTargetScore("");
        setPrepHours("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create assessment");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-2xl bg-neutral-900 p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Quiz/exam title"
        className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("quiz")}
          className={`flex-1 rounded-lg py-1.5 text-xs ${
            type === "quiz" ? "bg-white text-neutral-950" : "bg-neutral-800 text-neutral-400"
          }`}
        >
          Quiz
        </button>
        <button
          type="button"
          onClick={() => setType("exam")}
          className={`flex-1 rounded-lg py-1.5 text-xs ${
            type === "exam" ? "bg-white text-neutral-950" : "bg-neutral-800 text-neutral-400"
          }`}
        >
          Exam
        </button>
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
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
      <div className="flex gap-2">
        <input
          type="number"
          value={targetScore}
          onChange={(e) => setTargetScore(e.target.value)}
          placeholder="Target score"
          className="flex-1 rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
        />
        <input
          type="number"
          value={prepHours}
          onChange={(e) => setPrepHours(e.target.value)}
          placeholder="Prep hours planned"
          className="flex-1 rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending || !title.trim() || !date}
        className="w-full rounded-lg bg-white py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}
