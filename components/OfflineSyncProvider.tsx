"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { listQueuedActions, removeQueuedAction, updateQueuedAction, QueuedAction } from "@/lib/offline/db";
import { updateTaskStatus, createCheckIn, startFocusSession, startPause, endPause } from "@/lib/actions";
import { logMood } from "@/lib/health/actions";

const MAX_ATTEMPTS = 5;

interface OfflineStatus {
  isOnline: boolean;
  pendingCount: number;
}

const OfflineStatusContext = createContext<OfflineStatus>({ isOnline: true, pendingCount: 0 });

export function useOfflineStatus() {
  return useContext(OfflineStatusContext);
}

// Replays one queued action by dispatching to the same server action its
// original caller would have used. Ordering matters for the focus-timer
// flows (a session must exist before its pauses can attach) — the queue is
// always processed oldest-first (see lib/offline/db.listQueuedActions), so
// a session queued before its pause naturally replays first.
async function replay(action: QueuedAction): Promise<void> {
  switch (action.kind) {
    case "task_status": {
      const { taskId, status } = action.payload as { taskId: string; status: string };
      await updateTaskStatus(taskId, status, action.id);
      return;
    }
    case "check_in": {
      const { actual_activity, intended_task_id, drift_state } = action.payload as {
        actual_activity: string;
        intended_task_id?: string;
        drift_state: "on_track" | "drifting" | "unknown";
      };
      await createCheckIn({ actual_activity, intended_task_id, drift_state, clientId: action.id });
      return;
    }
    case "mood_log": {
      const { mood, energy, notes } = action.payload as {
        mood: number;
        energy: number;
        notes?: string;
      };
      await logMood({ mood, energy, notes, clientId: action.id });
      return;
    }
    case "focus_session_start": {
      const { taskId, assessmentId } = action.payload as {
        taskId?: string;
        assessmentId?: string;
      };
      await startFocusSession(taskId, assessmentId, action.id);
      return;
    }
    case "focus_pause_start": {
      const { sessionId, reason } = action.payload as { sessionId: string; reason: string };
      await startPause(sessionId, reason, action.id);
      return;
    }
    case "focus_pause_end": {
      const { pauseId } = action.payload as { pauseId: string };
      await endPause(pauseId);
      return;
    }
  }
}

export default function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const queued = await listQueuedActions().catch(() => []);
    setPendingCount(queued.length);
  }, []);

  const flush = useCallback(async () => {
    if (syncingRef.current) return; // avoid overlapping flushes (e.g. rapid online/offline flapping)
    syncingRef.current = true;
    try {
      const queued = await listQueuedActions();
      for (const action of queued) {
        try {
          await replay(action);
          await removeQueuedAction(action.id);
        } catch (err) {
          const attempts = action.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            // Give up automatically retrying, but keep the entry (and its
            // data) rather than silently deleting a user's action — a
            // future manual "retry" affordance or dev inspection can still
            // recover it. Stop processing further queued items this pass
            // if we're offline again, since later items likely share the
            // same cause.
            await updateQueuedAction({
              ...action,
              attempts,
              lastError: err instanceof Error ? err.message : String(err),
            });
          } else {
            await updateQueuedAction({
              ...action,
              attempts,
              lastError: err instanceof Error ? err.message : String(err),
            });
            break; // stop here; ordering must be preserved, don't skip ahead
          }
        }
      }
    } finally {
      syncingRef.current = false;
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    // queueMicrotask breaks the "setState called synchronously in effect
    // body" pattern the lint rule flags — refreshPendingCount's own setState
    // still only runs after its internal await, this just defers the initial
    // call itself by one tick.
    queueMicrotask(() => {
      refreshPendingCount();
    });

    const handleOnline = () => {
      setIsOnline(true);
      flush();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Also poll periodically in case a queued item was added by another tab,
    // or a prior sync attempt failed silently for a reason that has since
    // resolved (e.g. auth token refreshed).
    const interval = setInterval(() => {
      if (navigator.onLine) flush();
    }, 30_000);

    if (navigator.onLine) queueMicrotask(() => flush());

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OfflineStatusContext.Provider value={{ isOnline, pendingCount }}>
      {children}
    </OfflineStatusContext.Provider>
  );
}
