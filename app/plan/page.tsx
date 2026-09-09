import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateDailyPlan } from "@/lib/actions";
import PlanTaskList, { ScheduleItem } from "@/components/PlanTaskList";
import { todayISO, shiftDateISO, formatDateDisplay } from "@/lib/date";
import { fetchOccurrencesInRange, fetchClasses } from "@/lib/academics/queries";
import type { Task } from "@/lib/types";

export default async function PlanPage(props: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const searchParams = await props.searchParams;
  const today = todayISO();
  const selectedDate = searchParams?.date || today;
  const isToday = selectedDate === today;

  const prevDate = shiftDateISO(selectedDate, -1);
  const nextDate = shiftDateISO(selectedDate, 1);
  const yesterday = shiftDateISO(today, -1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  // Parallelize plan resolution, goals, academic schedule, yesterday uncompleted check
  const [planId, goalsRes, occurrences, classes, yesterdayPlanRes] = await Promise.all([
    getOrCreateDailyPlan(selectedDate, userId || undefined),
    supabase
      .from("goals")
      .select("id, title, level")
      .eq("user_id", userId)
      .not("status", "in", "(completed,abandoned)")
      .order("level", { ascending: true }),
    fetchOccurrencesInRange(userId, selectedDate, selectedDate).catch(() => []),
    fetchClasses(userId).catch(() => []),
    isToday
      ? supabase
          .from("daily_plans")
          .select("id")
          .eq("user_id", userId)
          .eq("date", yesterday)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Check yesterday's unfinished tasks count if viewing today
  let yesterdayUnfinishedCount = 0;
  if (isToday && yesterdayPlanRes.data?.id) {
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("daily_plan_id", yesterdayPlanRes.data.id)
      .in("status", ["not_started", "in_progress", "partial"]);
    yesterdayUnfinishedCount = count ?? 0;
  }

  const classById = new Map(classes.map((c) => [c.id, c]));

  const scheduleItems: ScheduleItem[] = occurrences
    .filter((o) => o.status !== "cancelled")
    .map((o) => {
      const cls = classById.get(o.class_id);
      return {
        id: o.id,
        type: "class" as const,
        title: cls?.name ?? "Class",
        start_time: o.start_time,
        end_time: o.end_time,
        subtitle: cls?.location ? cls.location : undefined,
        attendance_status: o.attendance_status as ScheduleItem["attendance_status"],
        badge:
          o.attendance_status === "present"
            ? "Present"
            : o.attendance_status === "absent"
            ? "Absent"
            : "Class",
      };
    });

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("daily_plan_id", planId)
    .order("is_top3", { ascending: false })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-4 pb-6">
      {/* DAY SWITCHER (Tabular bar) */}
      <div className="flex items-center justify-between border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/60 p-2">
        <Link
          href={`/plan?date=${prevDate}`}
          prefetch={false}
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition-colors font-mono text-xs"
          aria-label="Previous day"
        >
          ← Prev
        </Link>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-semibold text-neutral-100">
              {formatDateDisplay(selectedDate)}
            </span>
            {isToday ? (
              <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 font-mono">
                Today
              </span>
            ) : (
              <Link
                href="/plan"
                prefetch={false}
                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono"
              >
                Jump to today
              </Link>
            )}
          </div>
          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">{selectedDate}</p>
        </div>

        <Link
          href={`/plan?date=${nextDate}`}
          prefetch={false}
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition-colors font-mono text-xs"
          aria-label="Next day"
        >
          Next →
        </Link>
      </div>

      {/* PLAN SPREADSHEET & SCHEDULE */}
      <PlanTaskList
        initialTasks={(tasks as unknown as Task[]) ?? []}
        goals={goalsRes.data ?? []}
        scheduleItems={scheduleItems}
        selectedDate={selectedDate}
        yesterdayUnfinishedCount={yesterdayUnfinishedCount}
        yesterdayDate={yesterday}
      />
    </div>
  );
}
