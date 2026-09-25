import { DEFAULT_TIMEZONE } from "@/lib/date";
import { formatTimeHM } from "@/lib/timeline";

export type FocusLedgerRow = {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  focused_duration_sec: number | null;
  running: boolean;
};

function formatDuration(sec: number | null): string {
  if (sec === null) return "--";
  const minutes = Math.round(sec / 60);
  if (minutes < 1) return "<1m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/** Read-only list of the day's Focus Sessions, newest first. */
export default function FocusSessionLedger({ rows }: { rows: FocusLedgerRow[] }) {
  return (
    <section className="space-y-2" aria-label="Today's focus sessions">
      <div className="ledger-heading">
        <div>
          <h2>Today&apos;s focus sessions</h2>
        </div>
        <span className="ledger-count">{rows.length} today</span>
      </div>
      <div className="ledger-scroll rounded-lg">
        <table className="ledger-table min-w-[340px]">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Session</th>
              <th className="w-20">Start</th>
              <th className="w-24">Focused</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id}>
                <td className="text-center text-neutral-500">{rows.length - i}</td>
                <td className="text-neutral-200">{row.title}</td>
                <td className="font-mono text-neutral-400">
                  {formatTimeHM(row.started_at, DEFAULT_TIMEZONE)}
                </td>
                <td className="font-mono">
                  {row.running ? (
                    <span className="text-emerald-400">Running</span>
                  ) : (
                    <span className="text-neutral-300">{formatDuration(row.focused_duration_sec)}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="ledger-empty">
                  No focus sessions yet today. Start one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
