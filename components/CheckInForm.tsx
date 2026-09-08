"use client";

import { useState, useTransition } from "react";
import { createCheckIn } from "@/lib/actions";
import { newClientId, runOrQueue } from "@/lib/offline/client";

export default function CheckInForm() {
  const [activity, setActivity] = useState("");
  const [pending, startTransition] = useTransition();
  const [lastLogged, setLastLogged] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function log(drift: "on_track" | "drifting") {
    if (!activity.trim()) return;
    const actual_activity = activity.trim();
    const clientId = newClientId();
    setError(null);
    startTransition(async () => {
      const result = await runOrQueue("check_in", { actual_activity, drift_state: drift }, () =>
        createCheckIn({ actual_activity, drift_state: drift, clientId }),
        clientId
      );
      if (result.status === "error") {
        setError("Couldn't save this check-in. Please try again.");
        return;
      }
      const suffix = result.status === "queued" ? " (saved offline — will sync)" : "";
      setLastLogged(
        `${actual_activity} — ${drift === "on_track" ? "on track" : "drifting"}${suffix}`
      );
      setActivity("");
    });
  }

  return (
    <div className="rounded-2xl bg-neutral-900 p-3">
      <h2 className="mb-2 text-sm font-medium text-neutral-400">
        What am I doing right now?
      </h2>
      <input
        value={activity}
        onChange={(e) => setActivity(e.target.value)}
        placeholder="e.g. reading DBMS notes"
        className="mb-2 w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none"
      />
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() => log("on_track")}
          className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium"
        >
          On track
        </button>
        <button
          disabled={pending}
          onClick={() => log("drifting")}
          className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium"
        >
          Drifting
        </button>
      </div>
      {lastLogged && (
        <p className="mt-2 text-xs text-neutral-500">Logged: {lastLogged}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
