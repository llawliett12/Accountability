import { createClient } from "@/lib/supabase/server";
import { fetchDailyMetrics, addDays } from "@/lib/analytics/queries";
import { sum, average, compare } from "@/lib/analytics/engine";
import { todayISO } from "@/lib/date";

function summarize(rows: Awaited<ReturnType<typeof fetchDailyMetrics>>) {
  const scores = rows.map((r) => r.disciplineScore).filter((s): s is number => s !== null);
  const sleepValues = rows.map((r) => r.sleepMinutes).filter((s): s is number => s !== null);
  const moodValues = rows.map((r) => r.moodAvg).filter((s): s is number => s !== null);
  const energyValues = rows.map((r) => r.energyAvg).filter((s): s is number => s !== null);
  const pauseReasonTotals: Record<string, number> = {};
  for (const r of rows) {
    for (const [reason, count] of Object.entries(r.pauseReasons)) {
      pauseReasonTotals[reason] = (pauseReasonTotals[reason] ?? 0) + count;
    }
  }

  return {
    tasksPlanned: sum(rows.map((r) => r.tasksPlanned)),
    tasksCompleted: sum(rows.map((r) => r.tasksCompleted)),
    focusMinutes: sum(rows.map((r) => r.focusMinutes)),
    pauseCount: sum(rows.map((r) => r.pauseCount)),
    pauseReasonTotals,
    driftCount: sum(rows.map((r) => r.driftCount)),
    avgDisciplineScore: average(scores),
    avgNegativeScore: average(rows.map((r) => r.negativeScore).filter((s): s is number => s !== null)),
    avgSleepMinutes: average(sleepValues),
    meditationDays: rows.filter((r) => r.meditationMinutes > 0).length,
    avgMood: average(moodValues),
    avgEnergy: average(energyValues),
  };
}

export default async function WeeklyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const end = todayISO();
  const start = addDays(end, -6);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -6);

  const [current, previous] = await Promise.all([
    fetchDailyMetrics(user!.id, start, end),
    fetchDailyMetrics(user!.id, prevStart, prevEnd),
  ]);

  const c = summarize(current);
  const p = summarize(previous);

  const completionRate = (s: ReturnType<typeof summarize>) =>
    s.tasksPlanned > 0 ? (s.tasksCompleted / s.tasksPlanned) * 100 : 0;

  const topPauseReason =
    Object.entries(c.pauseReasonTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none";

  const rows: { label: string; cmp: ReturnType<typeof compare>; unit?: string }[] = [
    { label: "Completion rate", cmp: compare(completionRate(c), completionRate(p)), unit: "%" },
    { label: "Focus minutes", cmp: compare(c.focusMinutes, p.focusMinutes), unit: "min" },
    { label: "Pauses", cmp: compare(c.pauseCount, p.pauseCount) },
    { label: "Drift check-ins", cmp: compare(c.driftCount, p.driftCount) },
    { label: "Discipline score (avg)", cmp: compare(c.avgDisciplineScore, p.avgDisciplineScore) },
    { label: "Negative score (avg)", cmp: compare(c.avgNegativeScore, p.avgNegativeScore) },
    { label: "Sleep (avg min/night)", cmp: compare(c.avgSleepMinutes, p.avgSleepMinutes) },
    { label: "Meditation days", cmp: compare(c.meditationDays, p.meditationDays) },
    { label: "Mood (avg)", cmp: compare(c.avgMood, p.avgMood) },
    { label: "Energy (avg)", cmp: compare(c.avgEnergy, p.avgEnergy) },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">This week</h1>
      <p className="text-xs text-neutral-500">
        {start} → {end}, compared with the 7 days before that.
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
                  {r.cmp.percentChange !== null ? ` ${Math.abs(r.cmp.percentChange)}%` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Most common pause reason</h2>
        <p className="text-sm capitalize">{topPauseReason.replace("_", " ")}</p>
      </section>
    </div>
  );
}
