import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { fetchGoalsWithProgress } from "@/lib/goals/queries";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function MorningDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const date = todayISO();

  const { data: plan } = await supabase
    .from("daily_plans")
    .select("id")
    .eq("user_id", user?.id ?? "")
    .eq("date", date)
    .maybeSingle();

  const { data: tasks } = plan
    ? await supabase
        .from("tasks")
        .select("id, title, status, is_top3")
        .eq("daily_plan_id", plan.id)
        .order("priority", { ascending: true })
    : { data: [] };

  const { data: verdict } = await supabase
    .from("discipline_verdicts")
    .select("label, explanation")
    .eq("user_id", user?.id ?? "")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: streaks } = await supabase
    .from("streaks")
    .select("streak_type, current_count")
    .eq("user_id", user?.id ?? "");

  const top3 = (tasks ?? []).filter((t) => t.is_top3);

  const goals = user ? await fetchGoalsWithProgress(user.id) : [];
  const activeGoals = goals.filter((g) => g.status !== "completed" && g.status !== "abandoned");
  const overdueGoals = activeGoals.filter((g) => g.overdue);
  const nearestGoal = activeGoals
    .filter((g) => !g.overdue)
    .sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99"))[0];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-neutral-400">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="text-2xl font-semibold">Good morning</h1>
        </div>
        <div className="flex flex-col items-end gap-1 pt-1 text-xs text-neutral-500">
          <Link href="/settings" className="underline">
            Settings
          </Link>
          <div className="flex gap-2">
            <Link href="/weekly" className="underline">
              Weekly
            </Link>
            <Link href="/monthly" className="underline">
              Monthly
            </Link>
          </div>
          <div className="flex gap-2">
            <Link href="/screen-time" className="underline">
              Screen time
            </Link>
            <Link href="/insights" className="underline">
              Insights
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Top 3 today</h2>
        {top3.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No Top 3 set yet.{" "}
            <Link href="/plan" className="underline">
              Plan your day
            </Link>
          </p>
        ) : (
          <ul className="space-y-1">
            {top3.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.title}</span>
                <span className="text-neutral-500">{t.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
          <p className="text-sm text-neutral-500">
            No score yet — run reconciliation from Review tonight.
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400">Goals</h2>
          <Link href="/goals" className="text-xs text-neutral-500 underline">
            View all
          </Link>
        </div>
        {activeGoals.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No goals yet.{" "}
            <Link href="/goals" className="underline">
              Start a Year goal
            </Link>
          </p>
        ) : (
          <div className="space-y-1 text-sm">
            {overdueGoals.length > 0 && (
              <p className="text-red-400">
                {overdueGoals.length} goal{overdueGoals.length === 1 ? "" : "s"} overdue
              </p>
            )}
            {nearestGoal && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Next up: {nearestGoal.title}</span>
                <span>{nearestGoal.computedProgress}%</span>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Streaks</h2>
        {(streaks ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">No streaks tracked yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {streaks!.map((s) => (
              <li key={s.streak_type} className="flex justify-between">
                <span className="text-neutral-400">{s.streak_type}</span>
                <span>{s.current_count}d</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/now"
        className="block rounded-2xl bg-white py-3 text-center font-medium text-neutral-950"
      >
        What am I doing right now?
      </Link>
    </div>
  );
}
