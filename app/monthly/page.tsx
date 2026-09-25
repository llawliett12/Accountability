import { createClient } from "@/lib/supabase/server";
import { fetchPeriodComparison } from "@/lib/analytics/queries";
import { compare } from "@/lib/analytics/engine";
import { todayISO } from "@/lib/date";

export default async function MonthlyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { start, end, current: c, previous: p } = await fetchPeriodComparison(
    user!.id,
    30,
    todayISO()
  );

  const rows = [
    { label: "Completion rate", cmp: compare(c.completionRate, p.completionRate), unit: "%" },
    { label: "Total focus time", cmp: compare(c.focusMinutes, p.focusMinutes), unit: "min" },
    {
      label: "Avg discipline score",
      cmp: compare(c.avgDisciplineScore ?? 0, p.avgDisciplineScore ?? 0),
    },
    {
      label: "Consistency (score stability)",
      cmp: compare(c.consistency, p.consistency),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">This month</h1>
      <p className="text-sm text-neutral-500">
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
        {c.strongestDay && c.weakestDay ? (
          <div className="space-y-1 text-sm">
            <p>
              Strongest: <span className="text-emerald-400">{c.strongestDay.date}</span> (score{" "}
              {c.strongestDay.value})
            </p>
            <p>
              Weakest: <span className="text-red-400">{c.weakestDay.date}</span> (score{" "}
              {c.weakestDay.value})
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            No scored days yet this period — run Daily Review to build history.
          </p>
        )}
      </section>
    </div>
  );
}
