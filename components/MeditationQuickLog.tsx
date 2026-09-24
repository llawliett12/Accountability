"use client";

import { useState, useTransition } from "react";
import { logMeditation } from "@/lib/health/actions";

export default function MeditationQuickLog({
  date,
  initialHappened,
  streak,
}: {
  date: string;
  initialDuration: number | null;
  initialHappened: boolean | null;
  streak: number;
}) {
  const [happened, setHappened] = useState<boolean | null>(initialHappened);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(value: boolean) {
    const previous = happened;
    setError(null);
    setHappened(value);
    startTransition(async () => {
      try {
        await logMeditation({ date, happened: value });
      } catch (err: unknown) {
        setHappened(previous);
        setError(err instanceof Error ? err.message : "Failed to save meditation log");
      }
    });
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Meditation</h3>
          <p className="text-sm text-neutral-400 font-mono">
            Streak: <span className="text-amber-400 font-semibold">{streak} days</span>
          </p>
        </div>
        {happened === true ? (
          <span className="rounded-full bg-emerald-950/80 border border-emerald-800/60 px-3 py-1 font-mono text-sm font-semibold text-emerald-300">
            Done ✓
          </span>
        ) : happened === false ? (
          <span className="rounded-full bg-neutral-900 border border-neutral-800 px-3 py-1 font-mono text-sm text-neutral-500">
            Skipped
          </span>
        ) : (
          <span className="rounded-full bg-neutral-900 border border-neutral-800 px-3 py-1 font-mono text-sm text-neutral-500">
            Not logged yet
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => set(true)}
          aria-pressed={happened === true}
          className={`min-h-11 rounded-lg border text-sm font-semibold font-mono transition-all ${
            happened === true
              ? "border-emerald-800 bg-emerald-950/70 text-emerald-300"
              : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-white"
          }`}
        >
          ✓ Meditated
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => set(false)}
          aria-pressed={happened === false}
          className={`min-h-11 rounded-lg border text-sm font-semibold font-mono transition-all ${
            happened === false
              ? "border-neutral-700 bg-neutral-900 text-neutral-300"
              : "border-neutral-800 bg-neutral-950 text-neutral-500 hover:border-neutral-700 hover:text-white"
          }`}
        >
          ✕ Skipped
        </button>
      </div>

      {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
    </div>
  );
}
