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

type TimerPause = { id: string; started_at: Date; ended_at: Date | null };

// A session already running on the server (e.g. started from Home) — the timer
// picks it up instead of pretending nothing is running.
export interface InitialFocusSession {
  id: string;
  label: string | null;
  started_at: string;
  pauses: { id: string; started_at: string; ended_at: string | null }[];
}

function focusedSeconds(startedAt: Date, pauses: TimerPause[], now: number): number {
  const totalElapsed = (now - startedAt.getTime()) / 1000;
  const pausedSec = pauses.reduce((sum, p) => {
    const pEnd = p.ended_at ? p.ended_at.getTime() : now;
    return sum + Math.max(0, (pEnd - p.started_at.getTime()) / 1000);
  }, 0);
  return Math.max(0, Math.round(totalElapsed - pausedSec));
}

// Elapsed time is always derived from stored timestamps, never from a naive
// incrementing counter — this is what makes it survive the tab being
// backgrounded/killed on Android.
export default function FocusTimer({
  taskId,
  assessmentId,
  heading,
  initialSession = null,
}: {
  taskId?: string;
  assessmentId?: string;
  heading?: string;
  initialSession?: InitialFocusSession | null;
} = {}) {
  const [state, setState] = useState<TimerState>(() =>
    !initialSession
      ? "idle"
      : initialSession.pauses.some((p) => !p.ended_at)
        ? "paused"
        : "running"
  );
  const [sessionId, setSessionId] = useState<string | null>(initialSession?.id ?? null);
  const [startedAt, setStartedAt] = useState<Date | null>(() =>
    initialSession ? new Date(initialSession.started_at) : null
  );
  const [pauses, setPauses] = useState<TimerPause[]>(() =>
    (initialSession?.pauses ?? []).map((p) => ({
      id: p.id,
      started_at: new Date(p.started_at),
      ended_at: p.ended_at ? new Date(p.ended_at) : null,
    }))
  );
  const [activePauseId, setActivePauseId] = useState<string | null>(
    () => initialSession?.pauses.find((p) => !p.ended_at)?.id ?? null
  );
  const [activeLabel, setActiveLabel] = useState<string | null>(initialSession?.label ?? null);
  const [labelInput, setLabelInput] = useState("");
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
    const update = () => {
      if (!startedAt) return;
      setDisplaySec(focusedSeconds(startedAt, pauses, Date.now()));
    };
    update(); // show the right time immediately (matters when picking up a running session)
    tickRef.current = setInterval(update, 1000);
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
    const sessionLabel = !taskId && !assessmentId ? labelInput.trim() : "";
    setSessionId(id);
    setStartedAt(new Date());
    setPauses([]);
    setDisplaySec(0);
    setActiveLabel(sessionLabel || null);
    setLabelInput("");
    setState("running");
    try {
      const result = await runOrQueue(
        "focus_session_start",
        { taskId, assessmentId, label: sessionLabel || undefined },
        () => startFocusSession(taskId, assessmentId, id, sessionLabel || undefined),
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
      setActiveLabel(null);
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
      <h2 className="mb-3 text-sm font-medium text-neutral-400">{heading ?? "Focus session"}</h2>

      {activeLabel && (state === "running" || state === "paused") && (
        <p className="mb-2 text-center text-sm text-neutral-300">{activeLabel}</p>
      )}

      <p className="mb-4 text-center text-4xl font-mono">{format(displaySec)}</p>

      {state === "idle" || state === "stopped" ? (
        <div className="space-y-2">
          {!taskId && !assessmentId && (
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleStart();
              }}
              placeholder="What are you working on? (optional)"
              aria-label="What are you working on?"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-neutral-600 focus:outline-none"
            />
          )}
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="w-full rounded-lg bg-white py-3 font-medium text-neutral-950"
          >
            Start focus session
          </button>
        </div>
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
        <p className="mt-3 text-center text-sm text-amber-400">{stopError}</p>
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
                <p className="text-sm text-neutral-400">Select a reason to record this pause</p>
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
                  className="min-h-[44px] rounded-xl bg-neutral-800 px-2 py-2 text-sm font-medium capitalize text-neutral-200 transition-colors hover:bg-neutral-700 active:bg-neutral-600"
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
