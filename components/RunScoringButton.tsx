"use client";

import { useState, useTransition } from "react";
import { computeAndStoreDailyScore } from "@/lib/actions";
import Link from "next/link";

export default function RunScoringButton({ date }: { date: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await computeAndStoreDailyScore(date);
              setDone(true);
            } catch (err: unknown) {
              console.error("Scoring error:", err);
              setError(
                err instanceof Error
                  ? err.message
                  : "Failed to compute score. Please try again."
              );
            }
          });
        }}
        className="w-full rounded-lg bg-white py-3 font-medium text-neutral-950 disabled:opacity-50"
      >
        {pending ? "Computing..." : "Compute today's score"}
      </button>
      {error && (
        <p className="mt-2 rounded-lg border border-red-800/50 bg-red-950/70 p-2 text-center text-xs text-red-300">
          {error}
        </p>
      )}
      {done && (
        <Link
          href={`/discipline/${date}`}
          className="mt-2 block text-center text-sm text-neutral-400 underline"
        >
          View discipline log →
        </Link>
      )}
    </div>
  );
}
