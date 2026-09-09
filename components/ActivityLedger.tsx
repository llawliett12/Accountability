"use client";

import { useState, useTransition } from "react";
import { createCheckIn, updateCheckInStatus } from "@/lib/actions";
import { newClientId, runOrQueue } from "@/lib/offline/client";

export type ActivityEntry = {
  id: string;
  actual_activity: string;
  timestamp: string;
  status: "ongoing" | "paused" | "completed";
  completed_at: string | null;
};

export default function ActivityLedger({ initialEntries }: { initialEntries: ActivityEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [activity, setActivity] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function addActivity() {
    const title = activity.trim();
    if (!title || pending) return;
    const optimistic: ActivityEntry = {
      id: `local-${Date.now()}`,
      actual_activity: title,
      timestamp: new Date().toISOString(),
      status: "ongoing",
      completed_at: null,
    };
    setEntries((current) => [optimistic, ...current].slice(0, 5));
    setActivity("");
    const clientId = newClientId();
    startTransition(async () => {
      const result = await runOrQueue(
        "check_in",
        { actual_activity: title, drift_state: "unknown", startedAt: optimistic.timestamp },
        () => createCheckIn({ actual_activity: title, drift_state: "unknown", clientId, startedAt: optimistic.timestamp }),
        clientId
      );
      if (result.status === "ran") {
        setEntries((current) => current.map((item) => item.id === optimistic.id ? result.value as ActivityEntry : item));
      } else if (result.status === "queued") {
        setEntries((current) => current.filter((item) => item.id !== optimistic.id));
        setError("You are offline. This activity is queued and will appear after it syncs.");
      } else if (result.status === "error") {
        setEntries((current) => current.filter((item) => item.id !== optimistic.id));
        setError("Could not save this activity. Please try again.");
      }
    });
  }

  function changeStatus(entry: ActivityEntry, status: ActivityEntry["status"]) {
    const prior = entries;
    setEntries((current) => status === "completed"
      ? current.filter((item) => item.id !== entry.id)
      : current.map((item) => item.id === entry.id ? { ...item, status } : item));
    setError(null);
    startTransition(async () => {
      try {
        await updateCheckInStatus(entry.id, status);
      } catch {
        setEntries(prior);
        setError("Could not update this activity status. Please try again.");
      }
    });
  }

  return (
    <section className="current-work space-y-3">
      <div className="ledger-heading">
        <div>
          <h2>What I&apos;m doing right now</h2>
          <p>What did you start doing? Start time is captured automatically. Newest first.</p>
        </div>
        <span className="ledger-count">{entries.length} active</span>
      </div>
      <div className="ledger-scroll current-work-scroll">
        <table className="ledger-table current-work-table min-w-[380px]">
          <thead>
            <tr><th className="w-12">#</th><th>Work</th><th className="w-20">Start</th><th className="w-28">Status</th><th className="w-20"></th></tr>
          </thead>
          <tbody>
            <tr className="ledger-add-row">
              <td className="text-center"><span className="current-work-dot current-work-dot--new" aria-hidden="true" /></td>
              <td><input value={activity} onChange={(event) => setActivity(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addActivity(); }} placeholder="What did you start doing? Press Enter to log" aria-label="Current activity" /></td>
              <td className="text-neutral-600">now</td><td></td><td></td>
            </tr>
            {entries.map((entry, index) => (
              <tr key={entry.id}>
                <td className="text-center text-neutral-500">{index + 1}</td>
                <td className="current-work-name">{entry.actual_activity}</td>
                <td className="current-work-time">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                <td><label className="current-work-status"><span className={`current-work-dot current-work-dot--${entry.status}`} aria-hidden="true" /><select aria-label={`Status for ${entry.actual_activity}`} value={entry.status} disabled={pending} onChange={(event) => changeStatus(entry, event.target.value as ActivityEntry["status"])}><option value="ongoing">Ongoing</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label></td>
                <td className="pr-2 text-right whitespace-nowrap"><button type="button" disabled={pending} onClick={() => changeStatus(entry, "completed")} className="current-work-complete">Complete</button></td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={5} className="ledger-empty current-work-empty">No current work yet. Add the first activity above.</td></tr>}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
