import { createClient } from "@/lib/supabase/server";
import { getOrCreateDailyPlan } from "@/lib/actions";
import TaskQuickAdd from "@/components/TaskQuickAdd";
import TaskRow from "@/components/TaskRow";
import { todayISO } from "@/lib/date";

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const planId = await getOrCreateDailyPlan(todayISO());

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("daily_plan_id", planId)
    .order("priority", { ascending: true });

  // Active (not completed/abandoned) goals, for the optional "link to goal"
  // picker in TaskQuickAdd and the badge on each linked TaskRow.
  const { data: goals } = await supabase
    .from("goals")
    .select("id, title, level")
    .eq("user_id", user?.id ?? "")
    .not("status", "in", "(completed,abandoned)")
    .order("level", { ascending: true });

  const goalTitleById = new Map((goals ?? []).map((g) => [g.id, g.title]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Plan today</h1>
      <TaskQuickAdd goals={goals ?? []} />
      <ul className="space-y-2">
        {(tasks ?? []).map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            goalTitle={t.goal_id ? goalTitleById.get(t.goal_id) : undefined}
          />
        ))}
        {(tasks ?? []).length === 0 && (
          <p className="text-sm text-neutral-500">
            No tasks yet — add your first one above.
          </p>
        )}
      </ul>
    </div>
  );
}
