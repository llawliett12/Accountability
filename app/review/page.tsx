import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateDailyPlan } from "@/lib/actions";
import { fetchDailyMetrics, addDays } from "@/lib/analytics/queries";
import { sum, average } from "@/lib/analytics/engine";
import { fetchAcademicDashboard } from "@/lib/academics/queries";
import { fetchScreenTimeMinutesByDate } from "@/lib/screen-time/queries";
import { todayISO } from "@/lib/date";
import ReviewSectionManager, { type ReviewSection } from "@/components/ReviewSectionManager";
import { type SleepPeriod } from "@/components/SleepPeriodRows";

export default async function ReviewPage(props: { searchParams?: Promise<{ date?: string; section?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="py-12 text-center text-xs font-mono text-neutral-500">
        Sign in to view your review hub.
      </div>
    );
  }

  const selectedDate = searchParams?.date ?? todayISO();
  const section = searchParams?.section as ReviewSection | undefined;
  const weekStart = addDays(selectedDate, -6);
  const tomorrow = addDays(selectedDate, 1);

  // Parallel fetch: daily plan, 7-day metrics, academic summary, screen time, and streaks.
  const [
    planId,
    weeklyMetrics,
    academicDash,
    screenTimeMap,
    streaksRes,
    reviewNoteRes,
    foodHabitsRes,
    sleepPeriodsRes,
    completedActivitiesRes,
    meditationRes,
  ] = await Promise.all([
    getOrCreateDailyPlan(selectedDate, user.id),
    fetchDailyMetrics(user.id, weekStart, selectedDate),
    fetchAcademicDashboard(user.id).catch(() => null),
    fetchScreenTimeMinutesByDate(user.id, weekStart, selectedDate).catch(() => new Map<string, number>()),
    supabase.from("streaks").select("*").eq("user_id", user.id),
    supabase
      .from("review_notes")
      .select("content")
      .eq("user_id", user.id)
      .eq("date", selectedDate)
      .maybeSingle(),
    supabase
      .from("food_habits")
      .select("breakfast, lunch, dinner")
      .eq("user_id", user.id)
      .eq("date", selectedDate)
      .maybeSingle(),
    supabase
      .from("sleep_logs")
      .select("id, bedtime, wake_time, total_minutes, period_type")
      .eq("user_id", user.id)
      .eq("date", selectedDate)
      .order("bedtime", { ascending: false }),
    supabase
      .from("check_ins")
      .select("id, actual_activity, timestamp, completed_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("timestamp", `${selectedDate}T00:00:00+05:30`)
      .lt("timestamp", `${tomorrow}T00:00:00+05:30`)
      .order("timestamp", { ascending: true }),
    supabase
      .from("meditation_logs")
      .select("happened, duration_min")
      .eq("user_id", user.id)
      .eq("date", selectedDate)
      .maybeSingle(),
  ]);

  // Map of date -> score
  const scoreByDate = new Map<string, number>();
  weeklyMetrics.forEach((row) => {
    if (row.disciplineScore !== null) {
      scoreByDate.set(row.date, row.disciplineScore);
    }
  });

  // Tasks needing reconciliation for today
  const { data: tasksToReconcile } = await supabase
    .from("tasks")
    .select("*")
    .eq("daily_plan_id", planId)
    .in("status", ["not_started", "in_progress"]);

  // --- SECTION 1: WEEKLY METRICS COMPUTATION ---
  const tasksPlanned = sum(weeklyMetrics.map((r) => r.tasksPlanned));
  const tasksCompleted = sum(weeklyMetrics.map((r) => r.tasksCompleted));
  const totalFocusMinutes = sum(weeklyMetrics.map((r) => r.focusMinutes));

  const validSleep = weeklyMetrics
    .map((r) => r.sleepMinutes)
    .filter((s): s is number => s !== null && s > 0);
  const avgSleepMinutes = validSleep.length > 0 ? average(validSleep) : null;

  const screenTimeValues = Array.from(screenTimeMap.values()).filter((m) => m > 0);
  const avgScreenTimeMinutes =
    screenTimeValues.length > 0
      ? Math.round(screenTimeValues.reduce((a, b) => a + b, 0) / screenTimeValues.length)
      : null;

  // Streaks
  const streaks = streaksRes.data ?? [];
  const planningStreak = streaks.find((s) => s.type === "planning")?.current_streak ?? 0;
  const trackingStreak = streaks.find((s) => s.type === "tracking")?.current_streak ?? 0;
  const bestStreak = Math.max(planningStreak, trackingStreak, 0);

  // --- SECTION 2: ACADEMIC COMPUTATION ---
  const averageAcademicPct = academicDash?.averageScorePct ?? null;
  const scoredCount = academicDash?.recentScoredAssessments.length ?? 0;

  // Overall attendance calculation
  const totalClassesTracked = (academicDash?.attendanceZones ?? []).reduce(
    (acc, c) => acc + (c.attendance.trackedCount > 0 ? 1 : 0),
    0
  );
  const avgAttendancePct =
    totalClassesTracked > 0
      ? Math.round(
          (academicDash?.attendanceZones ?? []).reduce(
            (acc, c) => acc + (c.attendance.percentage ?? 0),
            0
          ) / totalClassesTracked
        )
      : null;

  const todayScore = scoreByDate.get(selectedDate) ?? null;
  const completedActivities = (completedActivitiesRes.data ?? []) as { id: string; actual_activity: string; timestamp: string; completed_at: string | null }[];

  return (
    <div className="space-y-6 pb-6">
      <header className="border-b border-neutral-800/80 pb-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Review Ledger</h1>
        <div className="mt-2 flex items-center justify-between font-mono text-xs text-neutral-400">
          <Link href={`/review?date=${addDays(selectedDate, -1)}`} className="min-h-10 flex items-center px-1">← Prev</Link>
          <span>{selectedDate}</span>
          <Link href={`/review?date=${addDays(selectedDate, 1)}`} className="min-h-10 flex items-center px-1">Next →</Link>
        </div>
      </header>

      <ReviewSectionManager
        selectedDate={selectedDate}
        weekStart={weekStart}
        initialSection={section}
        avgSleepMinutes={avgSleepMinutes}
        foodHabitsData={foodHabitsRes.data ?? null}
        completedActivities={completedActivities}
        tasksCompleted={tasksCompleted}
        tasksPlanned={tasksPlanned}
        averageAcademicPct={averageAcademicPct}
        scoredCount={scoredCount}
        totalClassesTracked={totalClassesTracked}
        avgAttendancePct={avgAttendancePct}
        tasksToReconcile={(tasksToReconcile as unknown as import("@/lib/types").Task[]) ?? []}
        meditationData={meditationRes.data ?? null}
        reviewNoteContent={reviewNoteRes.data?.content ?? null}
        weeklyMetrics={weeklyMetrics}
        scoreByDateEntries={Array.from(scoreByDate.entries())}
        screenTimeEntries={Array.from(screenTimeMap.entries())}
        bestStreak={bestStreak}
        totalFocusMinutes={totalFocusMinutes}
        avgScreenTimeMinutes={avgScreenTimeMinutes}
        todayScore={todayScore}
        sleepPeriods={(sleepPeriodsRes.data ?? []) as SleepPeriod[]}
      />
    </div>
  );
}
