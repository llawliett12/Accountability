"use client";

import { useState, useTransition } from "react";
import { logMeditation } from "@/lib/health/actions";

export default function MeditationLogForm({
  date,
  initialHappened,
  initialDuration,
}: {
  date: string;
  initialHappened: boolean | null;
  initialDuration: number | null;
}) {
  const [happened, setHappened] = useState<boolean | null>(initialHappened);
  const [duration, setDuration] = useState(initialDuration?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(didIt: boolean) {
    if (pending) return;
    const previousHappened = happened;
    const previousDuration = duration;
    setHappened(didIt);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        const savedLog = await logMeditation({
          date,
          happened: didIt,
          duration_min: didIt && duration ? Number(duration) : undefined,
        });
        setHappened(savedLog.happened);
        setDuration(savedLog.duration_min?.toString() ?? "");
        setSaved(true);
      } catch {
        setHappened(previousHappened);
        setDuration(previousDuration);
        setError("Could not save meditation status. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-neutral-900 p-3">
      <h2 className="mb-2 text-sm font-medium text-neutral-400">Meditation</h2>
      <div className="flex gap-2">
        <button
          onClick={() => submit(true)}
          disabled={pending}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${
            happened === true ? "bg-emerald-600" : "bg-neutral-800"
          }`}
        >
          Did
        </button>
        <button
          onClick={() => submit(false)}
          disabled={pending}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${
            happened === false ? "bg-red-600" : "bg-neutral-800"
          }`}
        >
          Not Did
        </button>
      </div>
      {happened === true && (
        <input
          type="number"
          placeholder="Minutes (optional)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          onBlur={() => submit(true)}
          className="mt-2 w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none"
        />
      )}
      {saved && <p className="mt-2 text-xs text-neutral-500">Saved ✓</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
