import { createClient } from "@/lib/supabase/server";
import { fetchPeriodComparison } from "@/lib/analytics/queries";
import { compare } from "@/lib/analytics/engine";
import { todayISO } from "@/lib/date";

export default async function WeeklyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { start, end, current: c, previous: p } = await fetchPeriodComparison(
    user!.id,
    7,
    todayISO()
  );

  const rows: { label: string; cmp: ReturnType<typeof compare>; unit?: string }[] = [
    { label: "Completion rate", cmp: compare(c.completionRate, p.completionRate), unit: "%" },
    { label: "Focus minutes", cmp: compare(c.focusMinutes, p.focusMinutes), unit: "min" },
    { label: "Pauses", cmp: compare(c.pauseCount, p.pauseCount) },
    { label: "Drift check-ins", cmp: compare(c.driftCount, p.driftCount) },
    { label: "Discipline score (avg)", cmp: compare(c.avgDisciplineScore ?? 0, p.avgDisciplineScore ?? 0) },
    { label: "Negative score (avg)", cmp: compare(c.avgNegativeScore ?? 0, p.avgNegativeScore ?? 0) },
    { label: "Sleep (avg min/night)", cmp: compare(c.avgSleepMinutes ?? 0, p.avgSleepMinutes ?? 0) },
    { label: "Meditation days", cmp: compare(c.meditationDays, p.meditationDays) },
    { label: "Mood (avg)", cmp: compare(c.avgMood ?? 0, p.avgMood ?? 0) },
    { label: "Energy (avg)", cmp: compare(c.avgEnergy ?? 0, p.avgEnergy ?? 0) },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">This week</h1>
      <p className="text-sm text-neutral-500">
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
        <p className="text-sm capitalize">{(c.topPauseReason ?? "none").replace("_", " ")}</p>
      </section>
    </div>
  );
}
