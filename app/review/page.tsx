import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateDailyPlan } from "@/lib/actions";
import { fetchDailyMetrics, addDays } from "@/lib/analytics/queries";
import { sum, average } from "@/lib/analytics/engine";
import { fetchAcademicDashboard } from "@/lib/academics/queries";
import { fetchScreenTimeMinutesByDate } from "@/lib/screen-time/queries";
import { todayISO } from "@/lib/date";
import ReconciliationList from "@/components/ReconciliationList";
import RunScoringButton from "@/components/RunScoringButton";
import SleepLogForm from "@/components/SleepLogForm";
import MeditationLogForm from "@/components/MeditationLogForm";
import ReviewNotesLedger from "@/components/ReviewNotesLedger";

function formatMinutesToHours(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default async function ReviewPage() {
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

  const today = todayISO();
  const weekStart = addDays(today, -6);

  // Parallel fetch: daily plan, 7-day metrics, academic summary, screen time, streaks, today score, weekly scores
  const [
    planId,
    weeklyMetrics,
    academicDash,
    screenTimeMap,
    streaksRes,
    todayMetricRes,
    weekDailyScoresRes,
    reviewNoteRes,
  ] = await Promise.all([
    getOrCreateDailyPlan(today, user.id),
    fetchDailyMetrics(user.id, weekStart, today),
    fetchAcademicDashboard(user.id).catch(() => null),
    fetchScreenTimeMinutesByDate(user.id, weekStart, today).catch(() => new Map<string, number>()),
    supabase.from("streaks").select("*").eq("user_id", user.id),
    supabase
      .from("daily_metrics")
      .select("discipline_score")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("daily_metrics")
      .select("date, discipline_score")
      .eq("user_id", user.id)
      .gte("date", weekStart)
      .lte("date", today),
    supabase
      .from("review_notes")
      .select("content")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle(),
  ]);

  // Map of date -> score
  const scoreByDate = new Map<string, number>();
  (weekDailyScoresRes.data ?? []).forEach((row) => {
    if (row.discipline_score !== null && row.discipline_score !== undefined) {
      scoreByDate.set(row.date, row.discipline_score);
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

  const todayScore = todayMetricRes.data?.discipline_score ?? null;

  return (
    <div className="space-y-6 pb-6">
      <header className="border-b border-neutral-800/80 pb-3">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Review Ledger</h1>
        <p className="font-mono text-xs text-neutral-400">Weekly progress, academic performance &amp; night check-in</p>
      </header>

      {/* SECTION 1: WEEKLY 7-DAY PERFORMANCE LEDGER (SQL TABLE) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Weekly Performance Ledger
            </span>
            <span className="font-mono text-[11px] text-neutral-500">
              [Last 7 Days: {weekStart} → {today}]
            </span>
          </div>
          <span className="font-mono text-xs text-emerald-400">
            🔥 {bestStreak}d streak
          </span>
        </div>

        <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
          <table className="w-full text-left text-xs border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3 text-center">Tasks (Done / Plan)</th>
                <th className="py-2 px-2 text-center">Focus</th>
                <th className="py-2 px-2 text-center">Sleep</th>
                <th className="py-2 px-2 text-center">Screen</th>
                <th className="py-2 px-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
              {weeklyMetrics.map((row) => {
                const isCurrent = row.date === today;
                const score = scoreByDate.get(row.date) ?? null;
                const scrTime = screenTimeMap.get(row.date) ?? null;

                return (
                  <tr
                    key={row.date}
                    className={`hover:bg-neutral-900/50 transition-colors ${
                      isCurrent ? "bg-amber-950/15" : ""
                    }`}
                  >
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={isCurrent ? "font-bold text-amber-300" : "text-neutral-300"}>
                        {row.date}
                      </span>
                      {isCurrent && (
                        <span className="ml-2 text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded uppercase">
                          Today
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center text-neutral-200">
                      {row.tasksCompleted} / {row.tasksPlanned}
                      {row.tasksPlanned > 0 && (
                        <span className="text-neutral-500 text-[10px] ml-1">
                          ({Math.round((row.tasksCompleted / row.tasksPlanned) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center text-amber-300/90">
                      {formatMinutesToHours(row.focusMinutes)}
                    </td>
                    <td className="py-2 px-2 text-center text-indigo-300/90">
                      {formatMinutesToHours(row.sleepMinutes)}
                    </td>
                    <td className="py-2 px-2 text-center text-neutral-400">
                      {formatMinutesToHours(scrTime)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {score !== null ? (
                        <span className="font-bold text-emerald-400">{score}</span>
                      ) : (
                        <span className="text-neutral-600">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* TOTALS & AVERAGES ROW */}
              <tr className="border-t border-neutral-700 bg-neutral-900/60 font-semibold text-neutral-200">
                <td className="py-2.5 px-3 uppercase text-[10px] tracking-wider text-neutral-400">
                  Total / Avg
                </td>
                <td className="py-2.5 px-3 text-center">
                  {tasksCompleted} / {tasksPlanned}
                  {tasksPlanned > 0 && (
                    <span className="text-neutral-400 text-[10px] ml-1">
                      ({Math.round((tasksCompleted / tasksPlanned) * 100)}%)
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-2 text-center text-amber-300">
                  {formatMinutesToHours(totalFocusMinutes)}
                </td>
                <td className="py-2.5 px-2 text-center text-indigo-300">
                  {formatMinutesToHours(avgSleepMinutes)}
                </td>
                <td className="py-2.5 px-2 text-center text-neutral-300">
                  {formatMinutesToHours(avgScreenTimeMinutes)}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-400 font-mono">
                  {todayScore !== null ? `${todayScore}` : "--"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 2: ACADEMIC LEDGER SUMMARY */}
      <section className="space-y-2">
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Academic Status Ledger
          </span>
          <Link
            href="/academics"
            className="text-xs font-mono font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            Academics Hub →
          </Link>
        </div>

        <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                <th className="py-2 px-3">Metric</th>
                <th className="py-2 px-3 text-center">Value</th>
                <th className="py-2 px-3 text-left">Detail</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
              <tr className="hover:bg-neutral-900/50 transition-colors">
                <td className="py-2.5 px-3 text-neutral-300 font-medium">Assessment Average</td>
                <td className="py-2.5 px-3 text-center font-bold text-base text-neutral-100">
                  {averageAcademicPct !== null ? `${averageAcademicPct}%` : "--"}
                </td>
                <td className="py-2.5 px-3 text-neutral-400 text-[11px]">
                  {scoredCount > 0 ? `${scoredCount} tests scored` : "No scored tests yet"}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <Link
                    href="/academics"
                    className="text-amber-400 hover:text-amber-300 text-xs"
                  >
                    View Sheet →
                  </Link>
                </td>
              </tr>
              <tr className="hover:bg-neutral-900/50 transition-colors">
                <td className="py-2.5 px-3 text-neutral-300 font-medium">Class Attendance Rate</td>
                <td className="py-2.5 px-3 text-center font-bold text-base text-neutral-100">
                  {avgAttendancePct !== null ? `${avgAttendancePct}%` : "--"}
                </td>
                <td className="py-2.5 px-3 text-neutral-400 text-[11px]">
                  {totalClassesTracked > 0 ? `${totalClassesTracked} subjects tracked` : "No subjects logged"}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <Link
                    href="/academics"
                    className="text-amber-400 hover:text-amber-300 text-xs"
                  >
                    Timetable →
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3: TODAY'S NIGHT CHECK-IN LEDGER */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Today&apos;s Night Check-in
            </span>
            <span className="font-mono text-[11px] text-neutral-500">[{today}]</span>
          </div>
          {todayScore !== null && (
            <span className="rounded bg-emerald-950/80 border border-emerald-800/50 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
              Score: {todayScore} / 100
            </span>
          )}
        </div>

        {/* TASK RECONCILIATION */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-neutral-300 font-mono">1. Reconcile Open Tasks</div>
          <ReconciliationList tasks={(tasksToReconcile as unknown as import("@/lib/types").Task[]) ?? []} />
        </div>

        {/* SLEEP LOG FORM */}
        <div className="space-y-1.5 pt-2">
          <div className="text-xs font-medium text-neutral-300 font-mono">2. Log Sleep</div>
          <SleepLogForm />
        </div>

        {/* MEDITATION LOG FORM */}
        <div className="space-y-1.5 pt-2">
          <div className="text-xs font-medium text-neutral-300 font-mono">3. Log Meditation &amp; Habits</div>
          <MeditationLogForm />
        </div>

        <div className="space-y-1.5 pt-2">
          <div className="text-xs font-medium text-neutral-300 font-mono">4. Closing Notes</div>
          <ReviewNotesLedger date={today} initialContent={reviewNoteRes.data?.content ?? null} />
        </div>

        {/* DISCIPLINE SCORING */}
        <div className="pt-2">
          <div className="flex items-center justify-between border-t border-neutral-800 pt-3">
            <span className="text-xs font-medium text-neutral-300 font-mono">5. Run Daily Discipline Score</span>
            <RunScoringButton date={today} />
          </div>
        </div>
      </section>
    </div>
  );
}
