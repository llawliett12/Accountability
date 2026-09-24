"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
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
      const { actual_activity, intended_task_id, drift_state, startedAt } = action.payload as {
        actual_activity: string;
        intended_task_id?: string;
        drift_state: "on_track" | "drifting" | "unknown";
        startedAt?: string;
      };
      await createCheckIn({ actual_activity, intended_task_id, drift_state, clientId: action.id, startedAt });
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

function subscribeToNavigator(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getNavigatorSnapshot(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getServerSnapshot(): boolean {
  return true;
}

export default function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const browserOnline = useSyncExternalStore(
    subscribeToNavigator,
    getNavigatorSnapshot,
    getServerSnapshot
  );
  const [explicitOnline, setExplicitOnline] = useState<boolean | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  // If explicit server connectivity succeeded, honor it; if browser explicitly fired offline, mark offline
  const isOnline =
    explicitOnline !== null
      ? (browserOnline ? explicitOnline : false)
      : browserOnline;

  const refreshPendingCount = useCallback(async () => {
    const queued = await listQueuedActions().catch(() => []);
    setPendingCount(queued.length);
  }, []);

  const flush = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const queued = await listQueuedActions();
      let hadSuccess = false;
      for (const action of queued) {
        try {
          await replay(action);
          await removeQueuedAction(action.id);
          hadSuccess = true;
        } catch (err) {
          const attempts = action.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
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
            break; // Stop processing further queued items this pass to preserve ordering
          }
        }
      }
      if (hadSuccess) {
        setExplicitOnline(true);
      }
    } finally {
      syncingRef.current = false;
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    queueMicrotask(() => {
      refreshPendingCount();
    });

    const handleOnline = () => {
      setExplicitOnline(true);
      flush();
    };

    const handleOffline = () => {
      setExplicitOnline(false);
    };

    const handleConnectivity = (e: Event) => {
      const custom = e as CustomEvent<{ online: boolean }>;
      if (custom.detail?.online) {
        setExplicitOnline(true);
        flush();
      } else {
        setExplicitOnline(false);
      }
    };

    // App resume from background on mobile: check connectivity and flush
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (typeof navigator !== "undefined" && navigator.onLine) {
          setExplicitOnline(true);
          flush();
        }
        refreshPendingCount();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("app:connectivity", handleConnectivity);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    const interval = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        setExplicitOnline(true);
        flush();
      }
    }, 30_000);

    if (typeof navigator !== "undefined" && navigator.onLine) {
      queueMicrotask(() => flush());
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("app:connectivity", handleConnectivity);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [flush, refreshPendingCount]);

  return (
    <OfflineStatusContext.Provider value={{ isOnline, pendingCount }}>
      {children}
    </OfflineStatusContext.Provider>
  );
}
