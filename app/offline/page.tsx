"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-3 text-center">
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        This page needs a connection to load. Quick actions you take while
        offline (task status, check-ins, mood logs, pause reasons) are saved
        on this device and will sync automatically once you&apos;re back
        online.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200"
      >
        Try reloading
      </button>
    </div>
  );
}
