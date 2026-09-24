"use client";

import { useState, useTransition } from "react";
import { createQuickActivity } from "@/lib/actions";
import { newClientId, runOrQueue } from "@/lib/offline/client";

export default function WhatAmIDoingInput() {
  const [activity, setActivity] = useState("");
  const [lastLogged, setLastLogged] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = activity.trim();
    if (!text || pending) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    const startedAt = now.toISOString();
    const clientId = newClientId();

    setActivity("");
    setLastLogged(`${text} (${timeStr})`);

    startTransition(async () => {
      try {
        await runOrQueue(
          "check_in",
          { actual_activity: text, startedAt },
          () =>
            createQuickActivity({
              actual_activity: text,
              timestamp: startedAt,
              clientId,
            }),
          clientId
        );
      } catch (err) {
        console.error("Failed to log quick activity", err);
      }
    });
  };


  return (
    <section aria-label="Quick Activity Journal" className="pt-1">
      <div className="flex items-center justify-between mb-2">
        <label htmlFor="what-am-i-doing" className="font-mono text-xs uppercase tracking-wider text-neutral-400 font-semibold">
          What Am I Doing?
        </label>
        {lastLogged && (
          <span className="font-mono text-xs text-emerald-400 truncate max-w-[200px]">
            ✓ {lastLogged}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          id="what-am-i-doing"
          type="text"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          disabled={pending}
          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
        />
        <button
          type="submit"
          disabled={pending || !activity.trim()}
          className="rounded-lg bg-neutral-100 px-3 py-2 font-mono text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-200 disabled:opacity-40"
        >
          {pending ? "..." : "Log"}
        </button>
      </form>
    </section>
  );
}
