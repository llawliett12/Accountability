"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return; // e.g. some in-app browsers — fail silent, not fatal

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Installation can legitimately fail (e.g. iframe context, older
      // WebView) — this must never block the app from working online.
      console.warn("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
