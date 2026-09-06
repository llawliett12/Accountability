"use client";

// urlBase64ToUint8Array: PushManager.subscribe needs the VAPID public key as
// a Uint8Array, but env vars/UI only ever carry it as the base64url string
// the `web-push` CLI/library prints.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
  return view;
}

export type PermissionState = "unsupported" | "default" | "denied" | "granted";

export function getNotificationSupport(): PermissionState {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  return Notification.permission as PermissionState;
}

/**
 * Requests OS/browser notification permission, then subscribes to Web Push
 * and saves the subscription server-side. Returns the resulting permission
 * state so the caller can update its UI without guessing.
 *
 * Known Android/PWA limitation (documented, not hidden): permission and
 * subscription only guarantee the notification is *delivered* while the
 * browser/OS push service can reach the device — some Android battery
 * optimizers can still delay delivery for backgrounded/killed PWAs. This is
 * an OS-level behavior outside what any web app can control.
 */
export async function enableWebPush(): Promise<PermissionState> {
  const support = getNotificationSupport();
  if (support === "unsupported") return support;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission as PermissionState;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set — cannot subscribe to push.");
    return permission as PermissionState;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  return permission as PermissionState;
}

export async function disableWebPush(): Promise<void> {
  if (getNotificationSupport() === "unsupported") return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}
