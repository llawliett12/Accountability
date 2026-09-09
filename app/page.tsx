import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { shiftDateISO, todayISO } from "@/lib/date";
import type { ScheduleItem } from "@/components/ScheduleTable";
import type { ActivityEntry } from "@/components/ActivityLedger";
import type { Task } from "@/lib/types";
import HomeSectionManager, { type HomeSection } from "@/components/HomeSectionManager";

export default async function MorningDashboard(props: { searchParams?: Promise<{ date?: string; section?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = todayISO();
  const date = searchParams?.date || today;
  const section = searchParams?.section as HomeSection | undefined;
  const userId = user?.id ?? "";

  // Parallel fetch: daily plan + tasks, class occurrences, verdict, streaks, goals, check-ins, grid
  const gridStart = shiftDateISO(date, -83);
  const [planRes, classesRes, verdictRes, streaksRes, goalsRes, checkInsRes, gridPlansRes, scoreRes] = await Promise.all([
    supabase
      .from("daily_plans")
      .select("id, tasks(id, daily_plan_id, user_id, title, category, priority, planned_duration_min, planned_start, planned_end, deadline, notes, status, is_top3, goal_id)")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("class_occurrences")
      .select("id, start_time, date, attendance_status, status, classes(name, location)")
      .eq("user_id", userId)
      .eq("date", date)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true }),
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
      .select("id, title, level")
      .eq("user_id", userId)
      .neq("status", "completed"),
    supabase.from("check_ins").select("id, actual_activity, drift_state, timestamp, status, completed_at").eq("user_id", userId).in("status", ["ongoing", "paused"]).order("timestamp", { ascending: false }).limit(5),
    supabase.from("daily_plans").select("date, tasks(status)").eq("user_id", userId).gte("date", gridStart).lte("date", date).order("date", { ascending: true }),
    supabase.from("discipline_scores").select("date, score").eq("user_id", userId).gte("date", gridStart).lte("date", date),
  ]);

  const rawTasks = (planRes.data?.tasks as unknown as Task[]) ?? [];
  const tasks = [...rawTasks].sort((a, b) => {
    if (a.is_top3 && !b.is_top3) return -1;
    if (!a.is_top3 && b.is_top3) return 1;
    return (a.priority ?? 3) - (b.priority ?? 3);
  });

  // Next class occurrence
  const todayClasses = classesRes.data ?? [];
  let nextItem: string | null = null;
  if (todayClasses.length > 0) {
    const first = todayClasses[0];
    const className = (first.classes as unknown as { name?: string })?.name ?? "Class";
    const startTime = first.start_time ? first.start_time.slice(0, 5) : "";
    nextItem = startTime ? `${startTime} ${className}` : className;
  }

  // Schedule items for ScheduleTable
  const scheduleItems: ScheduleItem[] = todayClasses.map((c) => {
    const classInfo = c.classes as unknown as { name?: string; location?: string } | null;
    return {
      id: c.id,
      type: "class",
      title: classInfo?.name ?? "Class",
      subtitle: classInfo?.location ?? undefined,
      start_time: c.start_time,
      end_time: null,
      attendance_status: c.attendance_status as ScheduleItem["attendance_status"],
    };
  });

  // Highest streak
  const maxStreak = (streaksRes.data ?? []).reduce(
    (max, s) => Math.max(max, s.current_count),
    0
  );

  const verdict = verdictRes.data;
  const goals = goalsRes.data ?? [];
  const scoreByDate = new Map((scoreRes.data ?? []).map((row) => [row.date, row.score as number | null]));
  const gridDays = (gridPlansRes.data ?? []).map((plan) => {
    const planTasks = (plan.tasks ?? []) as { status: string }[];
    return { date: plan.date, planned: planTasks.length, completed: planTasks.filter((task) => task.status === "completed").length, score: scoreByDate.get(plan.date) ?? null };
  });
  const currentStreak = (streaksRes.data ?? []).reduce((max, streak) => Math.max(max, streak.current_count), 0);

  // Localized date string
  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="space-y-5 pb-6">
      {/* HEADER SECTION */}
      <header className="flex items-center justify-between pt-1 border-b border-neutral-800/80 pb-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Daily Command Ledger
          </h1>
          <p className="font-mono text-xs text-neutral-400 capitalize">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition"
            aria-label="Settings"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 3.2h3.4l.6 2.1c.5.2 1 .5 1.5.8l2.1-.6 1.7 3-1.5 1.6c.1.3.1.7.1 1s0 .7-.1 1l1.5 1.6-1.7 3-2.1-.6c-.5.3-1 .6-1.5.8l-.6 2.1h-3.4l-.6-2.1c-.5-.2-1-.5-1.5-.8l-2.1.6-1.7-3 1.5-1.6a6.4 6.4 0 0 1 0-2L4.8 8.5l1.7-3 2.1.6c.5-.3 1-.6 1.5-.8l.2-2.1Z" />
              <circle cx="12" cy="12" r="2.75" />
            </svg>
          </Link>
        </div>
      </header>

      <HomeSectionManager
        date={date}
        today={today}
        initialSection={section}
        tasks={tasks}
        goals={goals}
        checkIns={(checkInsRes.data ?? []) as ActivityEntry[]}
        scheduleItems={scheduleItems}
        gridDays={gridDays}
        currentStreak={currentStreak}
        maxStreak={maxStreak}
        nextItem={nextItem}
        verdict={verdict}
      />
    </div>
  );
}
