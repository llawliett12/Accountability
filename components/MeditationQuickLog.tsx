"use client";

import { useState, useTransition } from "react";
import { logMeditation } from "@/lib/health/actions";

export default function MeditationQuickLog({
  date,
  initialDuration,
  initialHappened,
  streak,
}: {
  date: string;
  initialDuration: number | null;
  initialHappened: boolean | null;
  streak: number;
}) {
  const [happened, setHappened] = useState<boolean | null>(initialHappened);
  const [duration, setDuration] = useState<number | null>(initialDuration);
  const [customMin, setCustomMin] = useState<string>("");
  const [showCustom, setShowCustom] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLog = (mins: number) => {
    setError(null);
    setSaved(false);
    setHappened(true);
    setDuration(mins);

    startTransition(async () => {
      try {
        await logMeditation({
          date,
          happened: true,
          duration_min: mins,
        });
        setSaved(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to save meditation log");
      }
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customMin, 10);
    if (isNaN(val) || val <= 0) return;
    handleLog(val);
    setShowCustom(false);
  };

  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Meditation Tracker</h3>
          <p className="text-sm text-neutral-400 font-mono">
            Streak: <span className="text-amber-400 font-semibold">{streak} days</span>
          </p>
        </div>
        {duration || happened ? (
          <span className="rounded-full bg-emerald-950/80 border border-emerald-800/60 px-3 py-1 font-mono text-sm font-semibold text-emerald-300">
            {duration ? `${duration} min logged` : "Logged ✓"}
          </span>
        ) : (
          <span className="rounded-full bg-neutral-900 border border-neutral-800 px-3 py-1 font-mono text-sm text-neutral-500">
            Not logged yet
          </span>
        )}

      </div>

      <div className="space-y-2">
        <label className="text-sm font-mono text-neutral-400 block">Quick Log:</label>
        <div className="grid grid-cols-4 gap-2">
          {[10, 15, 20].map((mins) => (
            <button
              key={mins}
              type="button"
              disabled={pending}
              onClick={() => handleLog(mins)}
              className={`py-2 rounded-lg text-sm font-semibold font-mono border transition-all ${
                duration === mins
                  ? "bg-amber-400 text-neutral-950 border-amber-300 font-bold"
                  : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:text-white"
              }`}
            >
              {mins} min
            </button>
          ))}
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowCustom(!showCustom)}
            className={`py-2 rounded-lg text-sm font-semibold font-mono border transition-all ${
              showCustom || (duration && ![10, 15, 20].includes(duration))
                ? "bg-amber-400/20 text-amber-300 border-amber-500/50"
                : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:text-white"
            }`}
          >
            Custom
          </button>
        </div>

        {showCustom && (
          <form onSubmit={handleCustomSubmit} className="flex gap-2 pt-2">
            <input
              type="number"
              min="1"
              max="240"
              placeholder="Minutes"
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              className="flex-1 rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-sm text-white font-mono focus:border-amber-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending || !customMin}
              className="rounded-lg bg-amber-400 px-4 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-amber-300 transition-colors disabled:opacity-50"
            >
              Log
            </button>
          </form>
        )}
      </div>

      {saved && <p className="text-sm text-emerald-400 font-mono">Meditation saved successfully ✓</p>}
      {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
    </div>
  );
}
