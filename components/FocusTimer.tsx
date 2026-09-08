"use client";

import { useEffect, useRef, useState } from "react";
import {
  startFocusSession,
  startPause,
  endPause,
  stopFocusSession,
} from "@/lib/actions";
import { runOrQueue, newClientId } from "@/lib/offline/client";
import type { PauseReason } from "@/lib/types";

const PAUSE_REASONS: PauseReason[] = [
  "bathroom",
  "food",
  "phone",
  "tired",
  "family",
  "break",
  "distraction",
  "important_work",
  "other",
];

type TimerState = "idle" | "running" | "paused" | "stopped";

// Elapsed time is always derived from stored timestamps, never from a naive
// incrementing counter — this is what makes it survive the tab being
// backgrounded/killed on Android.
export default function FocusTimer({
  taskId,
  assessmentId,
  label,
}: {
  taskId?: string;
  assessmentId?: string;
  label?: string;
} = {}) {
  const [state, setState] = useState<TimerState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [pauses, setPauses] = useState<
    { id: string; started_at: Date; ended_at: Date | null }[]
  >([]);
  const [activePauseId, setActivePauseId] = useState<string | null>(null);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [displaySec, setDisplaySec] = useState(0);
  const [lastFocusedSec, setLastFocusedSec] = useState<number | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingRef = useRef(false);

  useEffect(() => {
    if (state !== "running" && state !== "paused") {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      if (!startedAt) return;
      const now = Date.now();
      const totalElapsed = (now - startedAt.getTime()) / 1000;
      const pausedSec = pauses.reduce((sum, p) => {
        const pStart = p.started_at.getTime();
        const pEnd = p.ended_at ? p.ended_at.getTime() : now;
        return sum + Math.max(0, (pEnd - pStart) / 1000);
      }, 0);
      setDisplaySec(Math.max(0, Math.round(totalElapsed - pausedSec)));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state, startedAt, pauses]);

  async function handleStart() {
    if (startingRef.current) return;
    startingRef.current = true;
    setIsStarting(true);
    setStopError(null);
    // Generated up front so the session has a stable id immediately, whether
    // the create call succeeds now or gets queued for offline replay — a
    // pause taken a second later can reference it either way.
    const id = newClientId();
    setSessionId(id);
    setStartedAt(new Date());
    setPauses([]);
    setDisplaySec(0);
    setState("running");
    try {
      const result = await runOrQueue(
        "focus_session_start",
        { taskId, assessmentId },
        () => startFocusSession(taskId, assessmentId, id),
        id
      );
      if (result.status === "error") {
        setSessionId(null);
        setStartedAt(null);
        setState("idle");
        setStopError("Couldn't start the session. Please try again.");
      }
    } catch {
      setSessionId(null);
      setStartedAt(null);
      setState("idle");
      setStopError("Couldn't start the session. Please try again.");
    } finally {
      startingRef.current = false;
      setIsStarting(false);
    }
  }

  function handlePauseClick() {
    setShowReasonPicker(true);
  }

  async function handleReasonPick(reason: PauseReason) {
    if (!sessionId) return;
    setShowReasonPicker(false);
    setState("paused");
    const pauseStartedAt = new Date();
    const id = newClientId();
    setPauses((p) => [...p, { id, started_at: pauseStartedAt, ended_at: null }]);
    setActivePauseId(id);
    await runOrQueue(
      "focus_pause_start",
      { sessionId, reason },
      () => startPause(sessionId, reason, id),
      id
    );
  }

  async function handleResume() {
    if (!activePauseId) return;
    const endedAt = new Date();
    setPauses((p) =>
      p.map((pause) =>
        pause.id === activePauseId ? { ...pause, ended_at: endedAt } : pause
      )
    );
    await runOrQueue("focus_pause_end", { pauseId: activePauseId }, () =>
      endPause(activePauseId)
    );
    setActivePauseId(null);
    setState("running");
  }

  async function handleStop() {
    if (!sessionId) return;
    setStopError(null);
    try {
      const focusedSec = await stopFocusSession(sessionId);
      setLastFocusedSec(focusedSec);
      setState("stopped");
      setSessionId(null);
      setStartedAt(null);
    } catch {
      // Deliberately NOT queued: the server computes focused-time from the
      // full session + pause history, which may itself still be offline-
      // queued and unsynced. Finalizing a session needs to happen online, so
      // the timer stays "running" (nothing is lost — elapsed time keeps
      // ticking from local timestamps) and the user can retry once back on
      // the network instead of the app fabricating a total client-side.
      setStopError("Couldn't finish the session while offline — timer is still running, try Stop again once you're back online.");
    }
  }

  function format(sec: number) {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div className="rounded-2xl bg-neutral-900 p-4">
      <h2 className="mb-3 text-sm font-medium text-neutral-400">{label ?? "Focus timer"}</h2>

      <p className="mb-4 text-center text-4xl font-mono">{format(displaySec)}</p>

      {state === "idle" || state === "stopped" ? (
        <button
          onClick={handleStart}
          disabled={isStarting}
          className="w-full rounded-lg bg-white py-3 font-medium text-neutral-950"
        >
          Start focus session
        </button>
      ) : (
        <div className="flex gap-2">
          {state === "running" ? (
            <button
              onClick={handlePauseClick}
              className="flex-1 rounded-lg bg-amber-500 py-3 font-medium text-black"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={handleResume}
              className="flex-1 rounded-lg bg-emerald-600 py-3 font-medium"
            >
              Resume
            </button>
          )}
          <button
            onClick={handleStop}
            className="flex-1 rounded-lg bg-red-600 py-3 font-medium"
          >
            Stop
          </button>
        </div>
      )}

      {stopError && (
        <p className="mt-3 text-center text-xs text-amber-400">{stopError}</p>
      )}

      {lastFocusedSec !== null && state === "stopped" && (
        <p className="mt-3 text-center text-sm text-neutral-400">
          Focused: {format(lastFocusedSec)}
        </p>
      )}

      {showReasonPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowReasonPicker(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-neutral-800 bg-neutral-900 p-5 pb-[env(safe-area-inset-bottom,1.25rem)] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Why the pause?</h3>
                <p className="text-xs text-neutral-400">Select a reason to record this pause</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReasonPicker(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-sm text-neutral-400 hover:text-white"
                title="Dismiss"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {PAUSE_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => handleReasonPick(r)}
                  className="min-h-[44px] rounded-xl bg-neutral-800 px-2 py-2 text-xs font-medium capitalize text-neutral-200 transition-colors hover:bg-neutral-700 active:bg-neutral-600"
                >
                  {r.replace("_", " ")}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowReasonPicker(false)}
              className="w-full min-h-[44px] rounded-xl border border-neutral-700 bg-neutral-800/80 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-700 active:bg-neutral-600"
            >
              Cancel (Resume immediately)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
