import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { fetchGoalsWithProgress, goalsAtLevel } from "@/lib/goals/queries";
import GoalCard from "@/components/GoalCard";
import GoalQuickAdd from "@/components/GoalQuickAdd";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isActive(status: string) {
  return status !== "completed" && status !== "abandoned";
}

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const goals = await fetchGoalsWithProgress(user.id);
  const today = todayISO();

  const active = goals.filter((g) => isActive(g.status));
  const overdue = active.filter((g) => g.overdue);
  const upcoming = active
    .filter((g) => !g.overdue && g.due_date && g.due_date >= today)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 5);
  const recentlyCompleted = goals
    .filter((g) => g.status === "completed")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);

  // Today's linked goals: goals whose linked tasks include a task in today's plan.
  const { data: todayPlan } = await supabase
    .from("daily_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  const { data: todayTasks } = todayPlan
    ? await supabase
        .from("tasks")
        .select("goal_id")
        .eq("daily_plan_id", todayPlan.id)
        .not("goal_id", "is", null)
    : { data: [] };

  const todayGoalIds = new Set((todayTasks ?? []).map((t) => t.goal_id as string));
  const todayGoals = goals.filter((g) => todayGoalIds.has(g.id));

  const parentOptions = goals.map((g) => ({ id: g.id, title: g.title, level: g.level }));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Goals</h1>

      <GoalQuickAdd goals={parentOptions} />

      {overdue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-red-400">Overdue ({overdue.length})</h2>
          <div className="space-y-2">
            {overdue.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        </section>
      )}

      {todayGoals.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-400">Today&apos;s linked goals</h2>
          <div className="space-y-2">
            {todayGoals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        </section>
      )}

      {(["year", "quarter", "month", "week"] as const).map((level) => {
        const levelGoals = goalsAtLevel(active, level);
        if (levelGoals.length === 0) return null;
        return (
          <section key={level} className="space-y-2">
            <h2 className="text-sm font-medium text-neutral-400 capitalize">
              {level} goals
            </h2>
            <div className="space-y-2">
              {levelGoals.map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </div>
          </section>
        );
      })}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-400">Upcoming</h2>
          <div className="space-y-2">
            {upcoming.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        </section>
      )}

      {recentlyCompleted.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-400">Recently completed</h2>
          <div className="space-y-2">
            {recentlyCompleted.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        </section>
      )}

      {goals.length === 0 && (
        <p className="text-sm text-neutral-500">
          No goals yet — add a Year goal above to start the hierarchy, then
          break it down into quarters, months, weeks, and days.
        </p>
      )}

      <Link href="/plan" className="block text-center text-xs text-neutral-500 underline">
        Back to today&apos;s plan
      </Link>
    </div>
  );
}
