import { createClient } from "@/lib/supabase/server";
import { getOrCreateDailyPlan } from "@/lib/actions";
import PlanTaskList from "@/components/PlanTaskList";
import { todayISO } from "@/lib/date";

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const date = todayISO();
  const userId = user?.id ?? "";

  // Parallelize plan resolution and goals fetching, avoiding duplicate getUser() roundtrip
  const [planId, goalsRes] = await Promise.all([
    getOrCreateDailyPlan(date, userId || undefined),
    supabase
      .from("goals")
      .select("id, title, level")
      .eq("user_id", userId)
      .not("status", "in", "(completed,abandoned)")
      .order("level", { ascending: true }),
  ]);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("daily_plan_id", planId)
    .order("priority", { ascending: true });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Plan today</h1>
      <PlanTaskList
        initialTasks={tasks ?? []}
        goals={goalsRes.data ?? []}
      />
    </div>
  );
}
