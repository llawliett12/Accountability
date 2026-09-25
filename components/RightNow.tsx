"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { startFocusSession, stopFocusSession } from "@/lib/actions";
import { newClientId, runOrQueue } from "@/lib/offline/client";
import { DEFAULT_TIMEZONE } from "@/lib/date";
import { formatTimeHM } from "@/lib/timeline";
import { elapsedMinutes, formatElapsed, type ActiveFocusSession } from "@/lib/focus";

/**
 * "What am I doing right now?" — the one control for it on Home.
 * Idle: type it and hit Start (starts a label-only Focus Session).
 * Running: shows the live Focus Session with Stop and a link to the full timer.
 */
export default function RightNow({ active }: { active: ActiveFocusSession | null }) {
  const [session, setSession] = useState<ActiveFocusSession | null>(active);
  const [prevActiveId, setPrevActiveId] = useState<string | null>(active?.id ?? null);
  if ((active?.id ?? null) !== prevActiveId) {
    setPrevActiveId(active?.id ?? null);
    setSession(active);
  }

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);

  // Client-only clock so server and browser markup never disagree.
  useEffect(() => {
    if (!session) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [session]);

  function start(e: React.FormEvent) {
    e.preventDefault();
    const label = text.trim();
    if (!label || pending) return;
    setError(null);
    setNote(null);

    const id = newClientId();
    const startedAt = new Date().toISOString();
    const optimistic: ActiveFocusSession = { id, title: label, label, started_at: startedAt };
    setSession(optimistic);
    setText("");

    startTransition(async () => {
      const res = await runOrQueue(
        "focus_session_start",
        { label },
        () => startFocusSession(undefined, undefined, id, label),
        id
      );
      if (res.status === "error") {
        setSession(null);
        setText(label);
        setError("Couldn't start. Please try again.");
      } else if (res.status === "queued") {
        setNote("Offline — will sync when you're back online.");
      }
    });
  }

  function stop() {
    if (!session || pending) return;
    setError(null);
    setNote(null);
    const current = session;
    startTransition(async () => {
      try {
        await stopFocusSession(current.id);
        setSession(null);
      } catch {
        // Stopping needs the server (it totals the session's time), so it
        // isn't queued: the session keeps running and can be stopped later.
        setError("Couldn't stop while offline — it's still running. Try again once you're online.");
      }
    });
  }

  if (session) {
    return (
      <section
        aria-label="Right now"
        className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-2.5 text-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-mono text-emerald-300 font-medium truncate">{session.title}</span>
            <span className="font-mono text-xs text-emerald-500/80 whitespace-nowrap">
              since {formatTimeHM(session.started_at, DEFAULT_TIMEZONE)}
              {now !== null && ` · ${formatElapsed(elapsedMinutes(session.started_at, now))}`}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/focus"
              className="font-mono text-xs text-emerald-400 hover:text-emerald-200 underline whitespace-nowrap"
            >
              Timer
            </Link>
            <button
              type="button"
              onClick={stop}
              disabled={pending}
              className="rounded bg-emerald-900/70 border border-emerald-700/60 px-2 py-1 font-mono text-xs font-semibold text-emerald-100 hover:bg-emerald-800/70 disabled:opacity-50"
            >
              Stop
            </button>
          </div>
        </div>
        {(error || note) && (
          <p className={`mt-1.5 font-mono text-xs ${error ? "text-red-400" : "text-amber-400"}`}>
            {error ?? note}
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Right now" className="space-y-1">
      <form onSubmit={start} className="flex gap-2">
        <input
          id="what-am-i-doing"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
          placeholder="What am I doing right now?"
          aria-label="What am I doing right now?"
          className="flex-1 min-w-0 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="rounded-lg bg-neutral-100 px-3 py-2 font-mono text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-200 disabled:opacity-40"
        >
          Start
        </button>
      </form>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
    </section>
  );
}
