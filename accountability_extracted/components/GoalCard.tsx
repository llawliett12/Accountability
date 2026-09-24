import Link from "next/link";
import GoalProgressBar from "@/components/GoalProgressBar";

const LEVEL_LABELS: Record<string, string> = {
  year: "Year",
  quarter: "Quarter",
  month: "Month",
  week: "Week",
  day: "Day",
};

export interface GoalCardData {
  id: string;
  title: string;
  level: string;
  status: string;
  priority: number;
  computedProgress: number;
  due_date: string | null;
  overdue: boolean;
}

export default function GoalCard({ goal }: { goal: GoalCardData }) {
  return (
    <Link
      href={`/goals/${goal.id}`}
      className="block py-3 border-b border-neutral-800/60 last:border-b-0 hover:bg-neutral-900/40 -mx-2 px-2 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-xs uppercase text-neutral-400">
            {LEVEL_LABELS[goal.level] ?? goal.level}
          </span>
          <span className="truncate text-sm font-medium">{goal.title}</span>
        </div>
        <span className="shrink-0 text-sm text-neutral-500">
          {goal.computedProgress}%
        </span>
      </div>
      <div className="mt-2">
        <GoalProgressBar progress={goal.computedProgress} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-sm">
        <span className="capitalize text-neutral-500">
          {goal.status.replace("_", " ")}
        </span>
        {goal.overdue ? (
          <span className="text-red-400">Overdue</span>
        ) : goal.due_date ? (
          <span className="text-neutral-500">Due {goal.due_date}</span>
        ) : null}
      </div>
    </Link>
  );
}
