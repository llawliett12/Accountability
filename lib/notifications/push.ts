import "server-only";
import webPush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    throw new Error(
      "Push not configured: NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set."
    );
  }
  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export interface PushPayload {
  title: string;
  body: string;
  category: string;
  slot: string;
  url?: string;
}

export type PushSendResult =
  | { ok: true }
  | { ok: false; expired: boolean; error: string };

/**
 * Sends one push message. Never throws — a failed send (network blip,
 * malformed payload, provider outage) must not take down the whole dispatch
 * run, so every failure is returned as data instead.
 */
export async function sendPush(
  sub: PushSubscriptionRecord,
  payload: PushPayload
): Promise<PushSendResult> {
  try {
    ensureConfigured();
    await webPush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
    // 404/410 mean the push service has permanently invalidated this
    // subscription (uninstalled PWA, cleared site data, etc.) — the caller
    // should delete the row rather than retry it forever.
    const expired = statusCode === 404 || statusCode === 410;
    return { ok: false, expired, error: err instanceof Error ? err.message : String(err) };
  }
}
