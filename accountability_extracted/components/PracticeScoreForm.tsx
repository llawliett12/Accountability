"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPracticeScore } from "@/lib/academics/actions";

export default function PracticeScoreForm({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const n = Number(value);
    if (!value || Number.isNaN(n)) return;
    setError(null);
    startTransition(async () => {
      try {
        await addPracticeScore(assessmentId, n);
        setValue("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not log practice score");
      }
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Practice score"
          className="flex-1 rounded-lg bg-neutral-800 px-2 py-1.5 text-sm outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value}
          className="rounded-lg bg-neutral-700 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? "Logging..." : "Log attempt"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
