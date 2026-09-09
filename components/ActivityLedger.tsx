"use client";

import { useState, useTransition } from "react";
import { createCheckIn } from "@/lib/actions";
import { newClientId, runOrQueue } from "@/lib/offline/client";

export type ActivityEntry = {
  id: string;
  actual_activity: string;
  timestamp: string;
};

export default function ActivityLedger({ initialEntries }: { initialEntries: ActivityEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [activity, setActivity] = useState("");
  const [pending, startTransition] = useTransition();

  function addActivity() {
    const title = activity.trim();
    if (!title || pending) return;
    const optimistic: ActivityEntry = {
      id: `local-${Date.now()}`,
      actual_activity: title,
      timestamp: new Date().toISOString(),
    };
    setEntries((current) => [optimistic, ...current].slice(0, 5));
    setActivity("");
    const clientId = newClientId();
    startTransition(async () => {
      const result = await runOrQueue(
        "check_in",
        { actual_activity: title, drift_state: "unknown" },
        () => createCheckIn({ actual_activity: title, drift_state: "unknown", clientId }),
        clientId
      );
      if (result.status === "error") setEntries((current) => current.filter((item) => item.id !== optimistic.id));
    });
  }

  return (
    <section className="space-y-2">
      <div className="ledger-heading">
        <div>
          <h2>What I&apos;m doing right now</h2>
          <p>What did you start doing? Time is captured automatically. Newest first.</p>
        </div>
        <span className="ledger-count">{entries.length} logged</span>
      </div>
      <div className="ledger-scroll">
        <table className="ledger-table min-w-[360px]">
          <thead>
            <tr><th className="w-12">S.No</th><th>Work</th><th className="w-20">Time</th></tr>
          </thead>
          <tbody>
            <tr className="ledger-add-row">
              <td className="text-center text-amber-400">+</td>
              <td><input value={activity} onChange={(event) => setActivity(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addActivity(); }} placeholder="What did you start doing? Press Enter to log" aria-label="Current activity" /></td>
              <td className="text-neutral-600">now</td>
            </tr>
            {entries.map((entry, index) => (
              <tr key={entry.id}>
                <td className="text-center text-neutral-500">{index + 1}</td>
                <td className="font-medium text-neutral-200">{entry.actual_activity}</td>
                <td className="font-mono text-[11px] text-neutral-500">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={3} className="ledger-empty">Nothing logged yet — add the first row above.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
