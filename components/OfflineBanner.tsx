"use client";

import { useOfflineStatus } from "./OfflineSyncProvider";

export default function OfflineBanner() {
  const { isOnline, pendingCount } = useOfflineStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`mx-auto max-w-md px-4 pt-2 text-center text-xs ${
        isOnline ? "text-amber-400" : "text-neutral-400"
      }`}
    >
      {!isOnline && "Offline — quick actions are being saved on this device. "}
      {pendingCount > 0 && `${pendingCount} action${pendingCount === 1 ? "" : "s"} waiting to sync.`}
    </div>
  );
}
