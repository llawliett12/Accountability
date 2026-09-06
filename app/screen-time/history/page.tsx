import { createClient } from "@/lib/supabase/server";
import { fetchScreenTimeHistory, fetchAppTotals } from "@/lib/screen-time/queries";
import { addDays } from "@/lib/analytics/queries";
import { average, strongestDay, weakestDay } from "@/lib/analytics/engine";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ScreenTimeHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const end = todayISO();
  const weekStart = addDays(end, -6);
  const monthStart = addDays(end, -29);

  const [monthHistory, appTotals] = await Promise.all([
    fetchScreenTimeHistory(user!.id, monthStart, end),
    fetchAppTotals(user!.id, monthStart, end),
  ]);

  const weekHistory = monthHistory.filter((d) => d.date >= weekStart);

  const weeklyAvg = average(weekHistory.map((d) => d.totalMinutes));
  const monthlyAvg = average(monthHistory.map((d) => d.totalMinutes));

  const dayValues = monthHistory.map((d) => ({ date: d.date, value: d.totalMinutes }));
  const highest = strongestDay(dayValues); // highest screen time
  const lowest = weakestDay(dayValues); // lowest screen time

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Screen time history</h1>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-neutral-900 p-3 text-sm">
          <p className="text-neutral-500">Weekly avg</p>
          <p className="text-lg font-semibold">{Math.round(weeklyAvg)} min</p>
        </div>
        <div className="rounded-2xl bg-neutral-900 p-3 text-sm">
          <p className="text-neutral-500">Monthly avg</p>
          <p className="text-lg font-semibold">{Math.round(monthlyAvg)} min</p>
        </div>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Highest / lowest (30d)</h2>
        {highest && lowest ? (
          <div className="space-y-1 text-sm">
            <p>
              Highest: <span className="text-red-400">{highest.date}</span> ({highest.value} min)
            </p>
            <p>
              Lowest: <span className="text-emerald-400">{lowest.date}</span> ({lowest.value} min)
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No screen-time data logged yet.</p>
        )}
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Top apps (30d)</h2>
        {appTotals.length === 0 ? (
          <p className="text-sm text-neutral-500">No app breakdown logged yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {appTotals.slice(0, 8).map((a) => (
              <li key={a.app_name} className="flex justify-between">
                <span>{a.app_name}</span>
                <span className="text-neutral-500">{a.total_minutes} min</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Daily log</h2>
        <ul className="space-y-1">
          {[...monthHistory].reverse().map((d) => (
            <li
              key={d.date}
              className="flex justify-between rounded-2xl bg-neutral-900 p-3 text-sm"
            >
              <span>{d.date}</span>
              <span className="text-neutral-500">
                {d.totalMinutes} min ({d.source})
              </span>
            </li>
          ))}
          {monthHistory.length === 0 && (
            <li className="text-sm text-neutral-500">Nothing logged in the last 30 days.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
