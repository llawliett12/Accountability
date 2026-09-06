"use client";

import { useState, useTransition } from "react";
import { computeAndStoreDailyScore } from "@/lib/actions";
import Link from "next/link";

export default function RunScoringButton({ date }: { date: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await computeAndStoreDailyScore(date);
            setDone(true);
          })
        }
        className="w-full rounded-lg bg-white py-3 font-medium text-neutral-950"
      >
        {pending ? "Computing..." : "Compute today's score"}
      </button>
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
