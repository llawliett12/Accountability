"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordAssessmentScore } from "@/lib/academics/actions";

export default function AssessmentScoreForm({
  assessmentId,
  existingScore,
  existingMax,
}: {
  assessmentId: string;
  existingScore: number | null;
  existingMax: number | null;
}) {
  const router = useRouter();
  const [score, setScore] = useState(existingScore?.toString() ?? "");
  const [maxScore, setMaxScore] = useState(existingMax?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit() {
    const s = Number(score);
    const m = Number(maxScore);
    if (!score || !maxScore || Number.isNaN(s) || Number.isNaN(m) || m <= 0) {
      setError("Enter a valid score and max score");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await recordAssessmentScore(assessmentId, s, m);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save score");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-2xl bg-neutral-900 p-4">
      <h2 className="text-sm font-medium text-neutral-400">Record score</h2>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="Score"
          className="w-20 rounded-lg bg-neutral-800 px-2 py-1.5 text-sm outline-none"
        />
        <span className="text-neutral-500">/</span>
        <input
          type="number"
          value={maxScore}
          onChange={(e) => setMaxScore(e.target.value)}
          placeholder="Max"
          className="w-20 rounded-lg bg-neutral-800 px-2 py-1.5 text-sm outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="ml-auto rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-950 disabled:opacity-50"
        >
          {saved ? "Saved!" : pending ? "Saving..." : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
