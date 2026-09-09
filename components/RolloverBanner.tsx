"use client";

import { useState, useTransition } from "react";
import { rolloverUnfinishedTasks } from "@/lib/actions";

export interface RolloverBannerProps {
  yesterdayDate: string;
  todayDate: string;
  unfinishedCount: number;
  onRolloverComplete?: () => void;
}

export default function RolloverBanner({
  yesterdayDate,
  todayDate,
  unfinishedCount: initialCount,
  onRolloverComplete,
}: RolloverBannerProps) {
  const [count, setCount] = useState(initialCount);
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (count <= 0 || dismissed) return null;

  const handleRollover = () => {
    if (pending) return;
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }

    startTransition(async () => {
      try {
        await rolloverUnfinishedTasks(yesterdayDate, todayDate);
        setCount(0);
        onRolloverComplete?.();
      } catch (err) {
        console.error("Rollover failed", err);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-y border-amber-800/60 bg-amber-950/20 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 text-amber-200">
        <span>⚠️</span>
        <span>
          <strong>{count}</strong> unfinished {count === 1 ? "task" : "tasks"} from yesterday ({yesterdayDate}).
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleRollover}
          className="rounded bg-amber-400 hover:bg-amber-300 text-neutral-950 px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {pending ? "Moving..." : "⚡ Rollover to Today"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[11px] text-neutral-400 hover:text-neutral-200 px-1"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
