import Link from "next/link";
import type { NextInLineResult } from "@/lib/nextInLine";

function getCountdownLabel(dateISO: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (dateISO === today) return "Today";

  const target = new Date(dateISO + "T00:00:00Z");
  const now = new Date(today + "T00:00:00Z");
  const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday (Overdue)";
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;

  const [, month, day] = dateISO.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mName = months[parseInt(month, 10) - 1] ?? month;
  return `Due ${mName} ${parseInt(day, 10)}`;
}

export default function NextInLineCard({ item }: { item: NextInLineResult | null }) {
  if (!item) {
    return (
      <section
        aria-label="Next in Line"
        className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5 sm:p-6"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm uppercase tracking-wider text-neutral-500 font-semibold">
            Next in Line
          </span>
          <span className="font-mono text-sm text-neutral-500">None scheduled</span>
        </div>
        <p className="mt-2 text-sm text-neutral-400 font-sans">
          No upcoming assessments, deadlines, or high-priority goals on the immediate horizon.
        </p>
      </section>
    );
  }

  if (item.kind === "academic") {
    const countdown = getCountdownLabel(item.date);
    const isUrgent = countdown === "Today" || countdown === "Tomorrow" || countdown.includes("overdue");

    return (
      <section
        aria-label="Next in Line"
        className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-neutral-900/60 to-neutral-950 p-5 sm:p-6 shadow-lg shadow-black/40 hover:border-amber-500/50 transition-all"
      >
        <Link href={item.href} className="block group">
          {/* Header Row: Label + Countdown Pill */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider font-bold text-amber-400">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Next in Line · Academic
              </span>
              <span className="rounded bg-amber-900/50 border border-amber-700/60 px-2 py-0.5 font-mono text-xs text-amber-200 uppercase font-semibold">
                {item.category}
              </span>
            </div>

            <span
              className={`font-mono text-sm font-bold px-2.5 py-1 rounded-md tracking-tight ${
                isUrgent
                  ? "bg-amber-400 text-neutral-950 shadow-sm"
                  : "bg-neutral-800 text-amber-300 border border-neutral-700"
              }`}
            >
              {countdown}
            </span>
          </div>

          {/* Main Title Row */}
          <div className="space-y-1.5">
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-amber-200 transition-colors">
              {item.title}
            </h3>

            {/* Course & Date / Time Context */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-neutral-300">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 font-bold text-amber-300">
                  {item.courseCode}
                </span>
                <span className="text-neutral-400 truncate max-w-[200px] sm:max-w-none">
                  {item.courseName}
                </span>
              </div>

              <span className="text-neutral-600">·</span>

              <span className="text-neutral-300">
                {item.date}
                {item.time ? ` · ${item.time.slice(0, 5)}` : ""}
              </span>
            </div>
          </div>
        </Link>
      </section>
    );
  }

  // Priority Goal
  const countdown = item.dueDate ? getCountdownLabel(item.dueDate) : "Priority Goal";
  const isUrgent = countdown === "Today" || countdown === "Tomorrow" || countdown.includes("overdue");

  return (
    <section
      aria-label="Next in Line"
      className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/40 via-neutral-900/60 to-neutral-950 p-5 sm:p-6 shadow-lg shadow-black/40 hover:border-blue-500/50 transition-all"
    >
      <Link href={item.href} className="block group">
        {/* Header Row: Label + Countdown Pill */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider font-bold text-blue-400">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              Next in Line · Priority Target
            </span>
            <span className="rounded bg-blue-900/50 border border-blue-700/60 px-2 py-0.5 font-mono text-xs text-blue-200 uppercase font-semibold">
              P{item.priority}
            </span>
          </div>

          <span
            className={`font-mono text-sm font-bold px-2.5 py-1 rounded-md tracking-tight ${
              isUrgent
                ? "bg-blue-400 text-neutral-950 shadow-sm"
                : "bg-neutral-800 text-blue-300 border border-neutral-700"
            }`}
          >
            {countdown}
          </span>
        </div>

        {/* Main Title Row */}
        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-blue-200 transition-colors">
            {item.title}
          </h3>

          {/* Context */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-neutral-300">
            {item.courseCode && (
              <span className="rounded bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 font-bold text-blue-300">
                {item.courseCode}
              </span>
            )}
            {item.dueDate ? (
              <span className="text-neutral-400">Due {item.dueDate}</span>
            ) : (
              <span className="text-neutral-500">High priority active goal</span>
            )}
          </div>
        </div>
      </Link>
    </section>
  );
}
