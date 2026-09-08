"use client";

import { useState, useTransition } from "react";
import { logSleep } from "@/lib/health/actions";

const POOR_REASONS = ["stress", "noise", "screen_time", "caffeine", "illness", "other"];

export default function SleepLogForm() {
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [quality, setQuality] = useState<number | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const isWakeBeforeBed = Boolean(
    bedtime && wakeTime && new Date(wakeTime).getTime() <= new Date(bedtime).getTime()
  );

  function submit() {
    if (!bedtime || !wakeTime || !quality) return;
    if (isWakeBeforeBed) {
      setError("Wake time must be after bedtime.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await logSleep({
          bedtime: new Date(bedtime).toISOString(),
          wake_time: new Date(wakeTime).toISOString(),
          quality,
          poor_sleep_reason: quality <= 2 ? reason ?? undefined : undefined,
        });
        setSaved(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to save sleep log. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-neutral-900 p-3">
      <h2 className="mb-2 text-sm font-medium text-neutral-400">Sleep</h2>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-neutral-500">
          Bedtime
          <input
            type="datetime-local"
            value={bedtime}
            onChange={(e) => setBedtime(e.target.value)}
            className="mt-1 w-full rounded-lg bg-neutral-800 px-2 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Wake time
          <input
            type="datetime-local"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
            className="mt-1 w-full rounded-lg bg-neutral-800 px-2 py-2 text-sm"
          />
        </label>
      </div>
      {isWakeBeforeBed && (
        <p className="mt-1.5 text-xs text-red-400">Wake time must be after bedtime.</p>
      )}
      {error && (
        <p className="mt-2 rounded-lg border border-red-800/50 bg-red-950/70 p-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <p className="mb-1 mt-3 text-xs text-neutral-500">Quality</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setQuality(n)}
            className={`h-9 flex-1 rounded-lg text-sm ${
              quality === n ? "bg-white text-neutral-950" : "bg-neutral-800"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {quality !== null && quality <= 2 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-neutral-500">What affected it?</p>
          <div className="flex flex-wrap gap-2">
            {POOR_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`rounded-lg px-2 py-1 text-xs capitalize ${
                  reason === r ? "bg-white text-neutral-950" : "bg-neutral-800"
                }`}
              >
                {r.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        disabled={!bedtime || !wakeTime || !quality || isWakeBeforeBed || pending}
        onClick={submit}
        className="mt-3 w-full rounded-lg bg-white py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
      >
        {pending ? "Saving..." : saved ? "Saved ✓" : "Save sleep"}
      </button>
    </div>
  );
}
