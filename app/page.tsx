import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { todayISO } from "@/lib/date";

export default async function MorningDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const date = todayISO();
  const userId = user?.id ?? "";

  // Single-roundtrip parallelized fetching for Home page:
  // 1. Collapsed daily_plans + tasks join query (eliminates sequential waterfall)
  // 2. Targeted goals query for active goals & progress (replaces full tree calculation)
  // 3. Latest discipline verdict
  // 4. Streaks
  const [planRes, verdictRes, streaksRes, goalsRes] = await Promise.all([
    supabase
      .from("daily_plans")
      .select("id, tasks(id, title, status, is_top3, priority)")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("discipline_verdicts")
      .select("label, explanation")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("streaks")
      .select("streak_type, current_count")
      .eq("user_id", userId),
    supabase
      .from("goals")
      .select("id, title, due_date, status, progress")
      .eq("user_id", userId)
      .not("status", "in", "(completed,abandoned)"),
  ]);

  const verdict = verdictRes.data;
  const streaks = streaksRes.data;

  // Extract tasks from joined query and sort by priority in memory
  const rawTasks =
    (planRes.data?.tasks as
      | { id: string; title: string; status: string; is_top3: boolean; priority: number }[]
      | undefined) ?? [];
  const tasks = [...rawTasks].sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3));
  const top3 = tasks.filter((t) => t.is_top3);

  // Compute goals summary directly from targeted query
  const activeGoals = goalsRes.data ?? [];
  const overdueGoals = activeGoals.filter((g) => g.due_date && g.due_date < date);
  const nearestGoal = activeGoals
    .filter((g) => !g.due_date || g.due_date >= date)
    .sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99"))[0];

  return (
    <div className="space-y-4">
      {/* Mobile-first Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-neutral-400">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
          <h1 className="text-2xl font-semibold text-white">Good morning</h1>
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition"
          aria-label="Settings"
        >
          <span>⚙</span>
          <span>Settings</span>
        </Link>
      </header>

      {/* Quick Navigation Pills */}
      <nav className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <Link
          href="/weekly"
          className="whitespace-nowrap rounded-xl bg-neutral-900 px-3 py-2 text-neutral-300 hover:bg-neutral-800 transition"
        >
          Weekly
        </Link>
        <Link
          href="/monthly"
          className="whitespace-nowrap rounded-xl bg-neutral-900 px-3 py-2 text-neutral-300 hover:bg-neutral-800 transition"
        >
          Monthly
        </Link>
        <Link
          href="/screen-time"
          className="whitespace-nowrap rounded-xl bg-neutral-900 px-3 py-2 text-neutral-300 hover:bg-neutral-800 transition"
        >
          Screen time
        </Link>
        <Link
          href="/insights"
          className="whitespace-nowrap rounded-xl bg-neutral-900 px-3 py-2 text-neutral-300 hover:bg-neutral-800 transition"
        >
          Insights
        </Link>
      </nav>

      {/* Top 3 Card */}
      <section className="rounded-2xl bg-neutral-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400">Top 3 today</h2>
          {top3.length > 0 && (
            <Link href="/plan" className="text-xs text-neutral-500 underline">
              Edit
            </Link>
          )}
        </div>
        {top3.length === 0 ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-neutral-500">No Top 3 set yet.</span>
            <Link
              href="/plan"
              className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 transition"
            >
              Plan today →
            </Link>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {top3.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span className="min-w-0 truncate pr-2">★ {t.title}</span>
                <span className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                  {t.status.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Latest Discipline Verdict Card */}
      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">
          Latest discipline verdict
        </h2>
        {verdict ? (
          <div>
            <p className="text-lg font-semibold">{verdict.label}</p>
            <p className="text-sm text-neutral-400">{verdict.explanation}</p>
          </div>
        ) : (
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-neutral-500">No score computed yet.</span>
            <Link
              href="/night"
              className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 transition"
            >
              Review tonight →
            </Link>
          </div>
        )}
      </section>

      {/* Goals Card */}
      <section className="rounded-2xl bg-neutral-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400">Goals</h2>
          <Link href="/goals" className="text-xs text-neutral-500 underline">
            View all
          </Link>
        </div>
        {activeGoals.length === 0 ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-neutral-500">No active goals.</span>
            <Link
              href="/goals"
              className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 transition"
            >
              Create goal →
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5 text-sm">
            {overdueGoals.length > 0 && (
              <p className="text-xs text-red-400">
                {overdueGoals.length} goal{overdueGoals.length === 1 ? "" : "s"} overdue
              </p>
            )}
            {nearestGoal && (
              <div className="flex items-center justify-between">
                <span className="min-w-0 truncate text-neutral-400 pr-2">
                  Next up: {nearestGoal.title}
                </span>
                <span className="shrink-0 font-medium">{nearestGoal.progress}%</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Streaks Card */}
      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Streaks</h2>
        {(streaks ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">No streaks tracked yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {streaks!.map((s) => (
              <li key={s.streak_type} className="flex justify-between rounded-xl bg-neutral-800/60 px-3 py-2">
                <span className="capitalize text-neutral-400">
                  {s.streak_type.replace("_", " ")}
                </span>
                <span className="font-semibold text-white">{s.current_count}d</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Primary CTA */}
      <Link
        href="/now"
        className="block rounded-2xl bg-white py-3.5 text-center font-medium text-neutral-950 shadow-sm active:scale-[0.99] transition"
      >
        What am I doing right now?
      </Link>
    </div>
  );
}
