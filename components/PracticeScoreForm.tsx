"use client";

import { useState, useTransition } from "react";
import { addPracticeScore } from "@/lib/academics/actions";

export default function PracticeScoreForm({ assessmentId }: { assessmentId: string }) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const n = Number(value);
    if (!value || Number.isNaN(n)) return;
    startTransition(async () => {
      await addPracticeScore(assessmentId, n);
      setValue("");
    });
  }

  return (
    <div className="flex gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Practice score"
        className="flex-1 rounded-lg bg-neutral-800 px-2 py-1.5 text-xs outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || !value}
        className="rounded-lg bg-neutral-700 px-3 py-1.5 text-xs disabled:opacity-50"
      >
        Log attempt
      </button>
    </div>
  );
}
