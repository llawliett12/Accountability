"use client";

import { enqueueAction, OfflineActionKind } from "./db";

export function newClientId(): string {
  // crypto.randomUUID is available in all browsers this PWA targets
  // (Chrome/Android WebView); no polyfill needed.
  return crypto.randomUUID();
}

/** True network-error heuristic — distinct from a server-side error (4xx/5xx
 * thrown by the action itself, which should surface normally, not be queued
 * silently as if it "succeeded"). */
function looksLikeNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true; // fetch()'s failure mode for "no network"
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("load failed")
  );
}

export type RunOrQueueResult<T> =
  | { status: "ran"; value: T }
  | { status: "queued"; clientId: string }
  | { status: "error"; error: unknown };

/**
 * Runs `run()` (the real server action call). If it fails for what looks
 * like a connectivity reason, the action is queued for replay instead of
 * being thrown away or shown as an error — this is the "user should not
 * lose a quick action merely because the request failed" requirement.
 * Real application errors (validation, auth expiry, etc.) are NOT queued —
 * they're returned as `{status: "error"}` so the UI can show them normally.
 */
export async function runOrQueue<T>(
  kind: OfflineActionKind,
  payload: Record<string, unknown>,
  run: () => Promise<T>,
  clientId: string = newClientId()
): Promise<RunOrQueueResult<T>> {
  try {
    const value = await run();
    return { status: "ran", value };
  } catch (err) {
    if (!looksLikeNetworkFailure(err)) {
      return { status: "error", error: err };
    }
    await enqueueAction({
      id: clientId,
      kind,
      payload,
      createdAt: Date.now(),
      attempts: 0,
    });
    return { status: "queued", clientId };
  }
}
