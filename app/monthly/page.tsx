import { createClient } from "@/lib/supabase/server";
import { fetchDailyMetrics, addDays } from "@/lib/analytics/queries";
import { sum, average, compare, strongestDay, weakestDay, consistencyScore } from "@/lib/analytics/engine";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function MonthlyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const end = todayISO();
  const start = addDays(end, -29);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -29);

  const [current, previous] = await Promise.all([
    fetchDailyMetrics(user!.id, start, end),
    fetchDailyMetrics(user!.id, prevStart, prevEnd),
  ]);

  const scoreDays = current
    .filter((r) => r.disciplineScore !== null)
    .map((r) => ({ date: r.date, value: r.disciplineScore as number }));

  const currentScores = scoreDays.map((d) => d.value);
  const previousScores = previous
    .map((r) => r.disciplineScore)
    .filter((s): s is number => s !== null);

  const best = strongestDay(scoreDays);
  const worst = weakestDay(scoreDays);

  const totalFocus = sum(current.map((r) => r.focusMinutes));
  const prevTotalFocus = sum(previous.map((r) => r.focusMinutes));

  const totalCompleted = sum(current.map((r) => r.tasksCompleted));
  const totalPlanned = sum(current.map((r) => r.tasksPlanned));
  const prevCompleted = sum(previous.map((r) => r.tasksCompleted));
  const prevPlanned = sum(previous.map((r) => r.tasksPlanned));

  const rows = [
    {
      label: "Completion rate",
      cmp: compare(
        totalPlanned ? (totalCompleted / totalPlanned) * 100 : 0,
        prevPlanned ? (prevCompleted / prevPlanned) * 100 : 0
      ),
      unit: "%",
    },
    { label: "Total focus time", cmp: compare(totalFocus, prevTotalFocus), unit: "min" },
    {
      label: "Avg discipline score",
      cmp: compare(average(currentScores), average(previousScores)),
    },
    {
      label: "Consistency (score stability)",
      cmp: compare(consistencyScore(currentScores), consistencyScore(previousScores)),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">This month</h1>
      <p className="text-xs text-neutral-500">
        {start} → {end}, compared with the 30 days before that.
      </p>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between">
              <span className="text-neutral-400">{r.label}</span>
              <span className="flex items-center gap-2">
                <span>
                  {r.cmp.current}
                  {r.unit ?? ""}
                </span>
                <span
                  className={
                    r.cmp.direction === "up"
                      ? "text-emerald-400"
                      : r.cmp.direction === "down"
                        ? "text-red-400"
                        : "text-neutral-500"
                  }
                >
                  {r.cmp.direction === "up" ? "▲" : r.cmp.direction === "down" ? "▼" : "–"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Strongest / weakest day</h2>
        {best && worst ? (
          <div className="space-y-1 text-sm">
            <p>
              Strongest: <span className="text-emerald-400">{best.date}</span> (score{" "}
              {best.value})
            </p>
            <p>
              Weakest: <span className="text-red-400">{worst.date}</span> (score {worst.value})
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            No scored days yet this period — run Night Review to build history.
          </p>
        )}
      </section>
    </div>
  );
}
