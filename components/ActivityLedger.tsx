"use client";

import { useState, useTransition } from "react";
import { completeCheckIn, createCheckIn, deleteCheckIn, updateCheckIn } from "@/lib/actions";
import { newClientId, runOrQueue } from "@/lib/offline/client";

export type ActivityEntry = {
  id: string;
  actual_activity: string;
  timestamp: string;
  status: "ongoing" | "completed";
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
      } else if (result.status === "error") {
        setEntries((current) => current.filter((item) => item.id !== optimistic.id));
        setError("Could not save this activity. Please try again.");
      }
    });
  }

  function completeActivity(entry: ActivityEntry) {
    const prior = entries;
    setEntries((current) => current.filter((item) => item.id !== entry.id));
    setError(null);
    startTransition(async () => {
      try {
        await completeCheckIn(entry.id, new Date().toISOString());
      } catch {
        setEntries(prior);
        setError("Could not complete this activity. Please try again.");
      }
    });
  }

  return (
    <section className="space-y-2">
      <div className="ledger-heading">
        <div>
          <h2>What I&apos;m doing right now</h2>
          <p>What did you start doing? Start time is captured automatically. Newest first.</p>
        </div>
        <span className="ledger-count">{entries.length} logged</span>
      </div>
      <div className="ledger-scroll">
        <table className="ledger-table min-w-[360px]">
          <thead>
            <tr><th className="w-12">S.No</th><th>Work</th><th className="w-20">Start</th><th className="w-20">Status</th><th className="w-28"></th></tr>
          </thead>
          <tbody>
            <tr className="ledger-add-row">
              <td className="text-center text-amber-400">+</td>
              <td><input value={activity} onChange={(event) => setActivity(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addActivity(); }} placeholder="What did you start doing? Press Enter to log" aria-label="Current activity" /></td>
              <td className="text-neutral-600">now</td><td></td><td></td>
            </tr>
            {entries.map((entry, index) => (
              <tr key={entry.id}>
                <td className="text-center text-neutral-500">{index + 1}</td>
                <td className="font-medium text-neutral-200">{entry.actual_activity}</td>
                <td className="font-mono text-[11px] text-neutral-500">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                <td className="text-[10px] text-amber-300">Ongoing</td>
                <td className="pr-2 text-right whitespace-nowrap"><button type="button" disabled={pending} onClick={() => completeActivity(entry)} className="min-h-9 px-1 text-[10px] text-emerald-400 disabled:opacity-50">Complete</button><button type="button" onClick={() => { const value = prompt("Edit activity", entry.actual_activity); if (value === null || !value.trim()) return; const prior = entries; setEntries((rows) => rows.map((row) => row.id === entry.id ? { ...row, actual_activity: value.trim() } : row)); startTransition(async () => { try { await updateCheckIn(entry.id, value); } catch { setEntries(prior); } }); }} className="min-h-9 px-1 text-[10px] text-amber-400">Edit</button><button type="button" onClick={() => { if (!confirm("Delete this activity?")) return; const prior = entries; setEntries((rows) => rows.filter((row) => row.id !== entry.id)); startTransition(async () => { try { await deleteCheckIn(entry.id); } catch { setEntries(prior); } }); }} className="min-h-9 px-1 text-[10px] text-red-400">Delete</button></td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={5} className="ledger-empty">Nothing ongoing — add the first row above.</td></tr>}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
