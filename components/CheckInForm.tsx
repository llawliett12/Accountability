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
    const startedAt = new Date().toISOString();
    const clientId = newClientId();
    setError(null);
    startTransition(async () => {
      const result = await runOrQueue("check_in", { actual_activity, drift_state: drift, startedAt }, () =>
        createCheckIn({ actual_activity, drift_state: drift, clientId, startedAt }),
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
    <section className="space-y-2">
      <div className="ledger-heading"><div><h2>What I&apos;m doing right now</h2><p>Record a quick check-in without leaving the flow.</p></div></div>
      <div className="ledger-scroll"><table className="ledger-table min-w-[440px]"><thead><tr><th className="w-12">S.No</th><th>Activity</th><th className="w-48">State</th></tr></thead><tbody><tr className="ledger-add-row"><td className="text-center text-amber-400">+</td><td><input
        value={activity}
        onChange={(e) => setActivity(e.target.value)}
        placeholder="e.g. reading DBMS notes"
        onKeyDown={(event) => { if (event.key === "Enter") log("on_track"); }}
      /></td><td className="whitespace-nowrap">
        <button
          disabled={pending}
          onClick={() => log("on_track")}
          className="state-action state-good"
        >
          On track
        </button>
        <button
          disabled={pending}
          onClick={() => log("drifting")}
          className="state-action state-warn"
        >
          Drifting
        </button>
      </td></tr></tbody></table></div>
      {lastLogged && (
        <p className="mt-2 text-xs text-neutral-500">Logged: {lastLogged}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
