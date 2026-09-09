"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SectionBlock from "@/components/SectionBlock";
import ReconciliationList from "@/components/ReconciliationList";
import RunScoringButton from "@/components/RunScoringButton";
import SleepLogForm from "@/components/SleepLogForm";
import MeditationLogForm from "@/components/MeditationLogForm";
import ReviewNotesLedger from "@/components/ReviewNotesLedger";
import FoodHabitLedger from "@/components/FoodHabitLedger";
import SleepPeriodRows, { type SleepPeriod } from "@/components/SleepPeriodRows";
import type { Task } from "@/lib/types";
import type { DailyMetricsRow } from "@/lib/analytics/queries";
import { DEFAULT_TIMEZONE } from "@/lib/date";

export type ReviewSection = "sleep" | "food" | "activities" | "weekly" | "academics" | "night" | "meditation" | "notes";

function formatMinutesToHours(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface ReviewSectionManagerProps {
  selectedDate: string;
  weekStart: string;
  initialSection?: ReviewSection | null;
  avgSleepMinutes: number | null;
  foodHabitsData: { breakfast: boolean; lunch: boolean; dinner: boolean } | null;
  completedActivities: { id: string; actual_activity: string; timestamp: string; completed_at: string | null }[];
  tasksCompleted: number;
  tasksPlanned: number;
  averageAcademicPct: number | null;
  scoredCount: number;
  totalClassesTracked: number;
  avgAttendancePct: number | null;
  tasksToReconcile: Task[];
  meditationData: { happened?: boolean | null; duration_min?: number | null } | null;
  reviewNoteContent: string | null;
  weeklyMetrics: DailyMetricsRow[];
  scoreByDateEntries: [string, number][];
  screenTimeEntries: [string, number][];
  bestStreak: number;
  totalFocusMinutes: number;
  avgScreenTimeMinutes: number | null;
  todayScore: number | null;
  sleepPeriods: SleepPeriod[];
}

export default function ReviewSectionManager({
  selectedDate,
  weekStart,
  initialSection = null,
  avgSleepMinutes,
  foodHabitsData,
  completedActivities,
  tasksCompleted,
  tasksPlanned,
  averageAcademicPct,
  scoredCount,
  totalClassesTracked,
  avgAttendancePct,
  tasksToReconcile,
  meditationData,
  reviewNoteContent,
  weeklyMetrics,
  scoreByDateEntries,
  screenTimeEntries,
  bestStreak,
  totalFocusMinutes,
  avgScreenTimeMinutes,
  todayScore,
  sleepPeriods,
}: ReviewSectionManagerProps) {
  const [activeSection, setActiveSection] = useState<ReviewSection | null>(initialSection);
  const [prevInitial, setPrevInitial] = useState(initialSection);
  if (prevInitial !== initialSection) {
    setPrevInitial(initialSection);
    setActiveSection(initialSection);
  }
  const scoreByDate = new Map(scoreByDateEntries);
  const screenTimeMap = new Map(screenTimeEntries);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const sectionParam = params.get("section") as ReviewSection | null;
      setActiveSection(sectionParam ?? null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const selectSection = useCallback(
    (sec: ReviewSection) => {
      setActiveSection(sec);
      const targetUrl = `/review?date=${selectedDate}&section=${sec}`;
      window.history.pushState(null, "", targetUrl);
    },
    [selectedDate]
  );

  const handleBack = useCallback(() => {
    setActiveSection(null);
    const targetUrl = `/review?date=${selectedDate}`;
    window.history.pushState(null, "", targetUrl);
  }, [selectedDate]);

  return (
    <>
      {/* SECTION BLOCKS LANDING VIEW */}
      {!activeSection && (
        <section aria-label="Review sections">
          <SectionBlock
            href={`/review?date=${selectedDate}&section=sleep`}
            onClick={() => selectSection("sleep")}
            title="Sleep & Recovery"
            summary={avgSleepMinutes ? `${formatMinutesToHours(avgSleepMinutes)} average this week` : "No sleep recorded yet"}
            tone="good"
          />
          <SectionBlock
            href={`/review?date=${selectedDate}&section=food`}
            onClick={() => selectSection("food")}
            title="Eating Habits"
            summary={foodHabitsData ? "Meals recorded for this day" : "No meals recorded for this day"}
          />
          <SectionBlock
            href={`/review?date=${selectedDate}&section=activities`}
            onClick={() => selectSection("activities")}
            title="What I Did"
            summary={`${completedActivities.length} completed activities`}
            tone="good"
          />
          <SectionBlock
            href={`/review?date=${selectedDate}&section=weekly`}
            onClick={() => selectSection("weekly")}
            title="Weekly Performance"
            summary={`${tasksCompleted}/${tasksPlanned} tasks completed in the last 7 days`}
            tone="active"
          />
          <SectionBlock
            href={`/review?date=${selectedDate}&section=academics`}
            onClick={() => selectSection("academics")}
            title="Academic Status"
            summary={averageAcademicPct !== null ? `${averageAcademicPct}% assessment average` : "No scored assessments yet"}
          />
          <SectionBlock
            href={`/review?date=${selectedDate}&section=night`}
            onClick={() => selectSection("night")}
            title="Night Check-in"
            summary={`${tasksToReconcile.length} open tasks to reconcile`}
            tone={tasksToReconcile.length > 0 ? "warn" : "neutral"}
          />
          <SectionBlock
            href={`/review?date=${selectedDate}&section=meditation`}
            onClick={() => selectSection("meditation")}
            title="Meditation"
            summary={meditationData?.happened ? "Recorded for this day" : "Not recorded for this day"}
            tone={meditationData?.happened ? "good" : "neutral"}
          />
          <SectionBlock
            href={`/review?date=${selectedDate}&section=notes`}
            onClick={() => selectSection("notes")}
            title="Notes"
            summary={reviewNoteContent ? "Closing note saved" : "No closing note yet"}
          />
        </section>
      )}

      {/* SECTION DETAIL: WEEKLY PERFORMANCE */}
      {activeSection === "weekly" && (
        <section className="space-y-2">
          <Link
            href={`/review?date=${selectedDate}`}
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Review
          </Link>
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Weekly Performance Ledger
              </span>
              <span className="font-mono text-[11px] text-neutral-500">
                [Last 7 Days: {weekStart} → {selectedDate}]
              </span>
            </div>
            <span className="font-mono text-xs text-emerald-400">🔥 {bestStreak}d streak</span>
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
                  const isCurrent = row.date === selectedDate;
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
      )}

      {/* SECTION DETAIL: ACADEMIC STATUS */}
      {activeSection === "academics" && (
        <section className="space-y-2">
          <Link
            href={`/review?date=${selectedDate}`}
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Review
          </Link>
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
                    <Link href="/academics" className="text-amber-400 hover:text-amber-300 text-xs">
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
                    <Link href="/academics" className="text-amber-400 hover:text-amber-300 text-xs">
                      Timetable →
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECTION DETAIL: FORM & RECORD SECTIONS */}
      {activeSection && activeSection !== "weekly" && activeSection !== "academics" && (
        <>
          <Link
            href={`/review?date=${selectedDate}`}
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Review
          </Link>
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  {activeSection === "night"
                    ? "Night Check-in"
                    : activeSection === "activities"
                    ? "What I Did"
                    : activeSection === "sleep"
                    ? "Sleep & Recovery"
                    : activeSection === "food"
                    ? "Eating Habits"
                    : activeSection === "meditation"
                    ? "Meditation"
                    : "Notes"}
                </span>
                <span className="font-mono text-[11px] text-neutral-500">[{selectedDate}]</span>
              </div>
              {todayScore !== null && (
                <span className="rounded bg-emerald-950/80 border border-emerald-800/50 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
                  Score: {todayScore} / 100
                </span>
              )}
            </div>

            {/* TASK RECONCILIATION */}
            {activeSection === "night" && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-neutral-300 font-mono">1. Reconcile Open Tasks</div>
                <ReconciliationList tasks={tasksToReconcile} />
              </div>
            )}

            {/* SLEEP LOG FORM */}
            {activeSection === "sleep" && (
              <div className="space-y-1.5 pt-2">
                <div className="text-xs font-medium text-neutral-300 font-mono">2. Log Sleep</div>
                <SleepLogForm />
                <SleepPeriodRows initialPeriods={sleepPeriods} />
              </div>
            )}

            {/* MEDITATION LOG FORM */}
            {activeSection === "meditation" && (
              <div className="space-y-1.5 pt-2">
                <div className="text-xs font-medium text-neutral-300 font-mono">3. Log Meditation &amp; Habits</div>
                <MeditationLogForm
                  date={selectedDate}
                  initialHappened={meditationData?.happened ?? null}
                  initialDuration={meditationData?.duration_min ?? null}
                />
              </div>
            )}

            {/* NOTES */}
            {activeSection === "notes" && (
              <div className="space-y-1.5 pt-2">
                <div className="text-xs font-medium text-neutral-300 font-mono">4. Closing Notes</div>
                <ReviewNotesLedger date={selectedDate} initialContent={reviewNoteContent} />
              </div>
            )}

            {/* FOOD HABITS */}
            {activeSection === "food" && (
              <div className="space-y-1.5 pt-2">
                <div className="text-xs font-medium text-neutral-300 font-mono">5. Food Habits</div>
                <FoodHabitLedger date={selectedDate} initialMeals={foodHabitsData} />
              </div>
            )}

            {/* ACTIVITIES */}
            {activeSection === "activities" && (
              <div className="space-y-1.5 pt-2">
                <div className="text-xs font-medium text-neutral-300 font-mono">Completed Activities</div>
                {completedActivities.length === 0 ? (
                  <p className="text-xs text-neutral-500">No completed activities started on this day.</p>
                ) : (
                  <div className="ledger-scroll">
                    <table className="ledger-table min-w-[460px]">
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>Work</th>
                          <th>Started</th>
                          <th>Ended</th>
                          <th>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completedActivities.map((entry, index) => {
                          const start = new Date(entry.timestamp);
                          const end = entry.completed_at ? new Date(entry.completed_at) : null;
                          const minutes = end
                            ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))
                            : null;
                          return (
                            <tr key={entry.id}>
                              <td className="text-center font-mono text-[11px] text-neutral-500">{index + 1}</td>
                              <td className="text-neutral-200">{entry.actual_activity}</td>
                              <td className="font-mono text-[11px] text-neutral-500">
                                {start.toLocaleTimeString([], {
                                  timeZone: DEFAULT_TIMEZONE,
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="font-mono text-[11px] text-neutral-500">
                                {end?.toLocaleTimeString([], {
                                  timeZone: DEFAULT_TIMEZONE,
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }) ?? "--"}
                              </td>
                              <td className="font-mono text-[11px] text-neutral-300">
                                {minutes === null ? "--" : `${minutes} min`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* DISCIPLINE SCORING */}
            {activeSection === "night" && (
              <div className="pt-2">
                <div className="flex items-center justify-between border-t border-neutral-800 pt-3">
                  <span className="text-xs font-medium text-neutral-300 font-mono">6. Run Daily Discipline Score</span>
                  <RunScoringButton date={selectedDate} />
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
