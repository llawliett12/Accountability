import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { fetchGoalsWithProgress, goalsAtLevel } from "@/lib/goals/queries";
import { todayISO } from "@/lib/date";
import GoalsTable from "@/components/GoalsTable";
import GoalQuickAdd from "@/components/GoalQuickAdd";
import SectionBlock from "@/components/SectionBlock";

function isActive(status: string) {
  return status !== "completed" && status !== "abandoned";
}

type GoalsSection = "active" | "today" | "upcoming" | "completed" | "overdue";

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

  const parentOptions = goals.map((g) => ({ id: g.id, title: g.title, level: g.level }));

  return (
    <div className="space-y-6 pb-6">
      <header className="border-b border-neutral-800/80 pb-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Goals Ledger</h1>
        <p className="font-mono text-xs text-neutral-400">Strategic hierarchy &amp; progress tracker</p>
      </header>

      {!section && <section aria-label="Goal sections">
        <SectionBlock href="/goals?section=active" title="Active Goals" summary={`${active.length} goals in progress`} tone="active" />
        <SectionBlock href="/goals?section=today" title="Today&apos;s Priorities" summary={todayGoals.length ? `${todayGoals.length} goals linked to today` : "No goals linked to today"} />
        <SectionBlock href="/goals?section=upcoming" title="Upcoming Deadlines" summary={upcoming.length ? `${upcoming.length} goals with upcoming dates` : "No upcoming goal deadlines"} tone={overdue.length ? "warn" : "neutral"} />
        <SectionBlock href="/goals?section=completed" title="Completed Goals" summary={`${recentlyCompleted.length} recently completed`} tone="good" />
      </section>}

      {section === "active" && <section className="space-y-4"><Link href="/goals" className="section-detail-back">← Back to Goals</Link><GoalQuickAdd goals={parentOptions} />{overdue.length > 0 && <GoalsTable goals={overdue} title="Overdue Goals" />}{(["year", "quarter", "month", "week"] as const).map((level) => { const levelGoals = goalsAtLevel(active, level); return levelGoals.length ? <GoalsTable key={level} goals={levelGoals} title={`${level} Goals`} /> : null; })}</section>}
      {section === "today" && <section className="space-y-4"><Link href="/goals" className="section-detail-back">← Back to Goals</Link><GoalsTable goals={todayGoals} title="Today&apos;s Linked Goals" />{todayGoals.length === 0 && <p className="text-xs text-neutral-500">No goals are linked to today&apos;s tasks.</p>}</section>}
      {section === "upcoming" && <section className="space-y-4"><Link href="/goals" className="section-detail-back">← Back to Goals</Link><GoalsTable goals={upcoming} title="Upcoming Goals" />{upcoming.length === 0 && <p className="text-xs text-neutral-500">No upcoming goal deadlines.</p>}</section>}
      {section === "completed" && <section className="space-y-4"><Link href="/goals" className="section-detail-back">← Back to Goals</Link><GoalsTable goals={recentlyCompleted} title="Recently Completed" />{recentlyCompleted.length === 0 && <p className="text-xs text-neutral-500">No completed goals yet.</p>}</section>}

      {goals.length === 0 && (
        <div className="border border-neutral-800 bg-neutral-950/40 p-6 text-center rounded-lg font-mono text-xs text-neutral-500">
          No goals recorded yet. Add a Year or Quarter goal above to establish your hierarchy.
        </div>
      )}

      <div className="pt-2 text-center">
        <Link href="/plan" className="text-xs font-mono text-amber-400 hover:text-amber-300">
          ← Back to today&apos;s plan
        </Link>
      </div>
    </div>
  );
}
