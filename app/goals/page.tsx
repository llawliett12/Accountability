import { createClient } from "@/lib/supabase/server";
import { fetchGoalsWithProgress } from "@/lib/goals/queries";
import { todayISO } from "@/lib/date";
import GoalsSectionManager, { type GoalsSection } from "@/components/GoalsSectionManager";

function isActive(status: string) {
  return status !== "completed" && status !== "abandoned";
}

export default async function GoalsPage(props: { searchParams?: Promise<{ section?: string }> }) {
  const searchParams = await props.searchParams;
  const section = searchParams?.section as GoalsSection | undefined;
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

  // Today's linked goals
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

  const { data: coursesData } = await supabase.from("courses").select("id, code");
  const courseCodeMap: Record<string, string> = {};
  for (const c of coursesData ?? []) {
    courseCodeMap[c.id] = c.code;
  }

  const top3Goals = active.filter((g) => g.is_top3);

  const parentOptions = goals.map((g) => ({ id: g.id, title: g.title, level: g.level }));

  return (
    <div className="space-y-6 pb-6">
      <header className="border-b border-neutral-800/80 pb-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Goals</h1>
      </header>

      <GoalsSectionManager
        initialSection={section}
        active={active}
        overdue={overdue}
        top3Goals={top3Goals}
        todayGoals={todayGoals}
        upcoming={upcoming}
        recentlyCompleted={recentlyCompleted}
        parentOptions={parentOptions}
        goalsCount={goals.length}
        courseCodeMap={courseCodeMap}
      />
    </div>
  );
}

