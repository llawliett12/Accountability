"use client";

import { useState, useTransition } from "react";
import { logSleep } from "@/lib/health/actions";

const POOR_REASONS = ["stress", "noise", "screen_time", "caffeine", "illness", "other"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function todayLocalDateInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function nowLocalTimeInput(): string {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// Builds an ISO timestamp for a "HH:MM" time on wakeDate, rolling the date
// back a day whenever the time-of-day is later than the wake time — i.e.
// bedtime at 23:00 waking at 07:00 is "yesterday 23:00", but bedtime at
// 00:30 waking at 07:00 is "today 00:30" (already past midnight). This is
// what lets the form take two plain times instead of two full date+time
// pickers.
function resolveTimestamp(wakeDate: string, timeStr: string, isBedtime: boolean, wakeTimeStr: string): string {
  const [y, m, d] = wakeDate.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const date = new Date(y, m - 1, d, h, min, 0, 0);

  if (isBedtime) {
    const [wh, wmin] = wakeTimeStr.split(":").map(Number);
    const bedMinutes = h * 60 + min;
    const wakeMinutes = wh * 60 + wmin;
    if (bedMinutes > wakeMinutes) {
      date.setDate(date.getDate() - 1);
    }
  }

  return date.toISOString();
}

export default function SleepLogForm() {
  const [wakeDate, setWakeDate] = useState(todayLocalDateInput());
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState(nowLocalTimeInput());
  const [quality, setQuality] = useState<number | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<"night" | "daytime">("night");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const canSubmit = Boolean(bedtime && wakeTime && quality);

  function submit() {
    if (!bedtime || !wakeTime || !quality) return;
    setError(null);
    startTransition(async () => {
      try {
        const wakeISO = resolveTimestamp(wakeDate, wakeTime, false, wakeTime);
        const bedISO = resolveTimestamp(wakeDate, bedtime, true, wakeTime);
        await logSleep({
          bedtime: bedISO,
          wake_time: wakeISO,
          quality,
          poor_sleep_reason: quality <= 2 ? reason ?? undefined : undefined,
          period_type: periodType,
        });
        setSaved(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to save sleep log. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-neutral-900 p-3">
      <h2 className="mb-2 text-sm font-medium text-neutral-400">Sleep period</h2>
      <div className="mb-3 flex gap-2">
        {(["night", "daytime"] as const).map((type) => <button key={type} type="button" onClick={() => setPeriodType(type)} className={`min-h-9 flex-1 rounded border text-sm ${periodType === type ? "border-amber-700 bg-amber-500/10 text-amber-300" : "border-neutral-800 bg-neutral-950 text-neutral-500"}`}>{type === "night" ? "Night sleep" : "Daytime nap"}</button>)}
      </div>

      <label className="mb-3 block text-sm text-neutral-500">
        Woke up on
        <input
          type="date"
          value={wakeDate}
          onChange={(e) => setWakeDate(e.target.value)}
          className="mt-1 w-full rounded-lg bg-neutral-800 px-2 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm text-neutral-500">
          Bedtime
          <input
            type="time"
            value={bedtime}
            onChange={(e) => setBedtime(e.target.value)}
            className="mt-1 w-full rounded-lg bg-neutral-800 px-2 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-neutral-500">
          Wake time
          <input
            type="time"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
            className="mt-1 w-full rounded-lg bg-neutral-800 px-2 py-2 text-sm"
          />
        </label>
      </div>
      <p className="mt-1.5 text-xs text-neutral-600">
        Just enter the two times — if bedtime is later in the clock than wake time, we assume it was the night before.
      </p>
      {error && (
        <p className="mt-2 rounded-lg border border-red-800/50 bg-red-950/70 p-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <p className="mb-1 mt-3 text-sm text-neutral-500">Quality</p>
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
          <p className="mb-1 text-sm text-neutral-500">What affected it?</p>
          <div className="flex flex-wrap gap-2">
            {POOR_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`rounded-lg px-2 py-1 text-sm capitalize ${
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
        disabled={!canSubmit || pending}
        onClick={submit}
        className="mt-3 w-full rounded-lg bg-white py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
      >
        {pending ? "Saving..." : saved ? "Saved ✓" : "Save sleep period"}
      </button>
    </div>
  );
}
