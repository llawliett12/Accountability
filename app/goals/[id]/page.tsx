import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { fetchGoalsWithProgress, buildPath } from "@/lib/goals/queries";
import GoalProgressBar from "@/components/GoalProgressBar";
import GoalCard from "@/components/GoalCard";
import GoalDetailControls from "@/components/GoalDetailControls";
import GoalQuickAdd from "@/components/GoalQuickAdd";
import { childLevelFor } from "@/lib/goals/engine";

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const goals = await fetchGoalsWithProgress(user.id);
  const goal = goals.find((g) => g.id === id);

  if (!goal) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-neutral-500">
          Goal not found — it may have been deleted.
        </p>
        <Link href="/goals" className="text-xs text-neutral-400 underline">
          Back to Goals
        </Link>
      </div>
    );
  }

  const path = buildPath(goal, goals);
  const children = goals
    .filter((g) => g.parent_id === goal.id)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const { data: linkedTasks } = await supabase
    .from("tasks")
    .select("id, title, status, updated_at")
    .eq("goal_id", goal.id)
    .order("updated_at", { ascending: false });

  const childLevel = childLevelFor(goal.level);
  const parentOptions = goals.map((g) => ({ id: g.id, title: g.title, level: g.level }));

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-neutral-500">
        <Link href="/goals" className="underline shrink-0">
          Goals
        </Link>
        {path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1 min-w-0">
            <span>/</span>
            {i === path.length - 1 ? (
              <span className="text-neutral-300 truncate max-w-[140px] inline-block align-bottom">
                {p.title}
              </span>
            ) : (
              <Link
                href={`/goals/${p.id}`}
                className="underline truncate max-w-[120px] inline-block align-bottom"
              >
                {p.title}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase text-neutral-400">
          {goal.level}
        </span>
        <h1 className="mt-1 text-2xl font-semibold break-words">{goal.title}</h1>
        {goal.description && (
          <p className="mt-1 text-sm text-neutral-400 break-words">{goal.description}</p>
        )}
      </div>

      <section className="space-y-2 rounded-2xl bg-neutral-900 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">Progress</span>
          <span>{goal.computedProgress}%</span>
        </div>
        <GoalProgressBar progress={goal.computedProgress} />
        <p className="text-xs text-neutral-500">
          Derived from{" "}
          {goal.progressSource === "children"
            ? "child goals"
            : goal.progressSource === "target"
              ? "current / target value"
              : goal.progressSource === "tasks"
                ? "linked task completion"
                : "manual entry"}
          .
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-neutral-500">
          <span>Priority: P{goal.priority}</span>
          <span>{goal.due_date ? `Due ${goal.due_date}` : "No due date"}</span>
          <span>{goal.start_date ? `Starts ${goal.start_date}` : ""}</span>
          <span className={goal.overdue ? "text-red-400" : ""}>
            {goal.overdue ? "Overdue" : ""}
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <GoalDetailControls
          goalId={goal.id}
          title={goal.title}
          priority={goal.priority}
          status={goal.status}
          currentValue={goal.current_value}
          targetValue={goal.target_value}
          manualProgress={goal.manual_progress}
          hasChildren={children.length > 0}
          linkedTaskCount={linkedTasks?.length ?? 0}
        />
      </section>

      {children.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-400 capitalize">
            {childLevel ?? "Child"} goals
          </h2>
          <div className="space-y-2">
            {children.map((c) => (
              <GoalCard key={c.id} goal={c} />
            ))}
          </div>
        </section>
      )}

      {children.length === 0 && childLevel && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center">
          <p className="text-sm text-neutral-400">No {childLevel} goals yet.</p>
          <p className="mt-1 text-xs text-neutral-500">
            Break this {goal.level} goal down into smaller milestones below.
          </p>
        </div>
      )}

      {childLevel && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-400">
            Add a {childLevel} goal under this one
          </h2>
          <GoalQuickAdd
            goals={parentOptions}
            defaultLevel={childLevel}
            defaultParentId={goal.id}
          />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-400">
          Linked tasks ({linkedTasks?.length ?? 0})
        </h2>
        {(linkedTasks ?? []).length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center">
            <p className="text-sm text-neutral-400">No daily tasks linked yet.</p>
            <Link
              href="/plan"
              className="mt-2 inline-flex items-center text-xs font-medium text-white underline underline-offset-4"
            >
              Go to Plan to link tasks →
            </Link>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {(linkedTasks ?? []).map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-xl bg-neutral-900 px-3 py-2 text-sm"
              >
                <span className="truncate min-w-0 mr-2">{t.title}</span>
                <span className="shrink-0 text-xs text-neutral-500">{t.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
