// Accountability PWA service worker.
//
// Caching policy (deliberately conservative — see PROGRESS.md "Phase 6" for
// the reasoning): this app's entire value is personal, per-user data
// (tasks, scores, health logs, academics, goals). Caching any of that
// automatically risks serving one day's numbers as if they were today's, or
// worse, leaking cached data across accounts on a shared device. So:
//
//   - Static, non-personal assets (JS/CSS bundles, icons, manifest) are
//     cached aggressively (stale-while-revalidate) — safe, because they're
//     the same for every user and every load.
//   - Navigations (HTML pages) are network-first with a genuine offline
//     fallback page — never served from a stale cache, since a page like
//     /plan or /discipline/[date] renders private data.
//   - Everything under /api/, and anything going to the Supabase host, is
//     network-only and NEVER touches the cache, in either direction.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `accountability-static-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("accountability-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isApiOrDataRequest(url) {
  if (url.pathname.startsWith("/api/")) return true;
  // Supabase REST/auth/storage calls: never cache authenticated/private data.
  if (url.hostname.endsWith(".supabase.co")) return true;
  return false;
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/manifest.json" ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never intercept mutating requests

  const url = new URL(request.url);

  if (isApiOrDataRequest(url)) {
    // Network-only, pass through untouched. If it fails, the app's own
    // offline-queue logic (lib/offline) is responsible for handling that —
    // the service worker does not silently retry or fake a response here.
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(STATIC_CACHE).then((cache) => cache.match(OFFLINE_URL))
      )
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
  }
});

// ---------- Web Push ----------

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Accountability", body: event.data.text() };
  }

  const title = payload.title || "Accountability";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.category ? `${payload.category}:${payload.slot ?? ""}` : undefined,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// Allows the app to force an updated SW to take over immediately after a
// deploy, instead of waiting for every tab to close.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
