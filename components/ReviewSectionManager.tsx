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
import { computeInferredTimeline } from "@/lib/timeline";

export type ReviewSection =
  | "activities"
  | "daily-review"
  | "weekly"
  | "health"
  | "night"
  | "sleep"
  | "food"
  | "meditation"
  | "notes"
  | "academics";

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
  dayActivities: {
    id: string;
    actual_activity: string;
    timestamp: string;
    completed_at: string | null;
    entry_type?: string;
    status?: string;
  }[];
  dayOccurrences?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    status: string;
    slotType?: string;
  }[];
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
  dayActivities = [],
  dayOccurrences = [],
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

  const timelineBlocks = computeInferredTimeline(dayActivities, DEFAULT_TIMEZONE);

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
      {/* LEVEL 1: MINIMAL REVIEW CONTROL CENTER */}
      {!activeSection && (
        <div className="space-y-4">
          {/* TODAY'S COMPACT REVIEW SUMMARY STRIP */}
          <section className="overview-ledger rounded-xl border border-neutral-800/80">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-neutral-800/80 font-mono text-sm">
              <div className="p-3">
                <span className="text-xs uppercase text-neutral-500 block">Tasks Done</span>
                <span className="text-base font-bold text-neutral-100">
                  {tasksCompleted}/{tasksPlanned}
                </span>
                <span className="text-xs text-neutral-400 ml-1.5 font-mono">
                  ({tasksPlanned > 0 ? Math.round((tasksCompleted / tasksPlanned) * 100) : 0}%)
                </span>
              </div>
              <div className="p-3">
                <span className="text-xs uppercase text-neutral-500 block">Focus / Work</span>
                <span className="text-base font-bold text-amber-300">
                  {formatMinutesToHours(totalFocusMinutes)}
                </span>
              </div>
              <div className="p-3">
                <span className="text-xs uppercase text-neutral-500 block">Discipline Score</span>
                <span className="text-base font-bold text-emerald-400">
                  {todayScore !== null ? `${todayScore}` : "--"}
                </span>
                <span className="text-xs text-neutral-400 ml-1 font-mono">/ 100</span>
              </div>
              <div className="p-3">
                <span className="text-xs uppercase text-neutral-500 block">Habits</span>
                <span className="text-sm text-neutral-300 truncate block pt-0.5">
                  {avgSleepMinutes ? `${formatMinutesToHours(avgSleepMinutes)} sleep` : "Sleep"} · {meditationData?.happened ? "🧘 Did" : "🧘 None"}
                </span>
              </div>
            </div>
          </section>

          {/* 5 CLEAR NAVIGATION DOORS */}
          <section aria-label="Review navigation" className="space-y-1">
            <SectionBlock
              href={`/review?date=${selectedDate}&section=activities`}
              onClick={() => selectSection("activities")}
              title="What I Did"
              summary={
                timelineBlocks.length > 0
                  ? `${timelineBlocks.length} activities logged · Inferred chronological timeline`
                  : "No activity check-ins logged for this day"
              }
              tone={timelineBlocks.length > 0 ? "good" : "neutral"}
            />
            <SectionBlock
              href={`/review?date=${selectedDate}&section=daily-review`}
              onClick={() => selectSection("daily-review")}
              title="Daily Review"
              summary={
                tasksToReconcile.length > 0
                  ? `${tasksToReconcile.length} open tasks to reconcile · Daily discipline score`
                  : todayScore !== null
                  ? `Discipline score: ${todayScore} / 100 · Day reconciled`
                  : "Tasks reconciled · Ready to run discipline score"
              }
              tone={tasksToReconcile.length > 0 ? "warn" : "good"}
            />
            <SectionBlock
              href={`/review?date=${selectedDate}&section=weekly`}
              onClick={() => selectSection("weekly")}
              title="Weekly Review"
              summary={`${tasksCompleted}/${tasksPlanned} tasks last 7 days · 🔥 ${bestStreak}d streak`}
              tone="active"
            />
            <SectionBlock
              href={`/review?date=${selectedDate}&section=health`}
              onClick={() => selectSection("health")}
              title="Health & Habits"
              summary={`${
                avgSleepMinutes ? `${formatMinutesToHours(avgSleepMinutes)} avg sleep` : "Sleep"
              }, meals, meditation & closing notes`}
              tone="good"
            />
            <SectionBlock
              href={`/review?date=${selectedDate}&section=notes`}
              onClick={() => selectSection("notes")}
              title="Notes / Brain Dump"
              summary={reviewNoteContent ? "Closing reflection recorded" : "No notes recorded yet · Tap to write"}
              tone={reviewNoteContent ? "good" : "neutral"}
            />
          </section>
        </div>
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
              <span className="font-mono text-sm font-semibold uppercase tracking-wider text-neutral-300">
                Weekly Performance Ledger
              </span>
              <span className="font-mono text-xs text-neutral-500">
                [Last 7 Days: {weekStart} → {selectedDate}]
              </span>
            </div>
            <span className="font-mono text-sm text-emerald-400">🔥 {bestStreak}d streak</span>
          </div>

          <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
            <table className="w-full text-left text-sm border-collapse min-w-[520px]">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80 text-xs font-mono uppercase tracking-wider text-neutral-400">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3 text-center">Tasks (Done / Plan)</th>
                  <th className="py-2 px-2 text-center">Focus</th>
                  <th className="py-2 px-2 text-center">Sleep</th>
                  <th className="py-2 px-2 text-center">Screen</th>
                  <th className="py-2 px-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono text-sm">
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
                          <span className="ml-2 text-[11px] bg-amber-500/20 text-amber-300 px-1 rounded uppercase">
                            Today
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-neutral-200">
                        {row.tasksCompleted} / {row.tasksPlanned}
                        {row.tasksPlanned > 0 && (
                          <span className="text-neutral-500 text-xs ml-1">
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
                  <td className="py-2.5 px-3 uppercase text-xs tracking-wider text-neutral-400">
                    Total / Avg
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {tasksCompleted} / {tasksPlanned}
                    {tasksPlanned > 0 && (
                      <span className="text-neutral-400 text-xs ml-1">
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
            <span className="font-mono text-sm font-semibold uppercase tracking-wider text-neutral-300">
              Academic Status Ledger
            </span>
            <Link
              href="/academics"
              className="text-sm font-mono font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              Academics Hub →
            </Link>
          </div>

          <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80 text-xs font-mono uppercase tracking-wider text-neutral-400">
                  <th className="py-2 px-3">Metric</th>
                  <th className="py-2 px-3 text-center">Value</th>
                  <th className="py-2 px-3 text-left">Detail</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono text-sm">
                <tr className="hover:bg-neutral-900/50 transition-colors">
                  <td className="py-2.5 px-3 text-neutral-300 font-medium">Assessment Average</td>
                  <td className="py-2.5 px-3 text-center font-bold text-base text-neutral-100">
                    {averageAcademicPct !== null ? `${averageAcademicPct}%` : "--"}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-400 text-xs">
                    {scoredCount > 0 ? `${scoredCount} tests scored` : "No scored tests yet"}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Link href="/academics" className="text-amber-400 hover:text-amber-300 text-sm">
                      View Sheet →
                    </Link>
                  </td>
                </tr>
                <tr className="hover:bg-neutral-900/50 transition-colors">
                  <td className="py-2.5 px-3 text-neutral-300 font-medium">Class Attendance Rate</td>
                  <td className="py-2.5 px-3 text-center font-bold text-base text-neutral-100">
                    {avgAttendancePct !== null ? `${avgAttendancePct}%` : "--"}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-400 text-xs">
                    {totalClassesTracked > 0 ? `${totalClassesTracked} subjects tracked` : "No subjects logged"}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Link href="/academics" className="text-amber-400 hover:text-amber-300 text-sm">
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
                <span className="font-mono text-sm font-semibold uppercase tracking-wider text-neutral-300">
                  {activeSection === "daily-review" || activeSection === "night"
                    ? "Daily Review & Reconciliation"
                    : activeSection === "activities"
                    ? "What I Did"
                    : activeSection === "health"
                    ? "Health & Habits"
                    : activeSection === "sleep"
                    ? "Sleep & Recovery"
                    : activeSection === "food"
                    ? "Eating Habits"
                    : activeSection === "meditation"
                    ? "Meditation"
                    : "Notes"}
                </span>
                <span className="font-mono text-xs text-neutral-500">[{selectedDate}]</span>
              </div>
              {todayScore !== null && (
                <span className="rounded bg-emerald-950/80 border border-emerald-800/50 px-2 py-0.5 font-mono text-sm font-bold text-emerald-400">
                  Score: {todayScore} / 100
                </span>
              )}
            </div>

            {/* TASK RECONCILIATION & DISCIPLINE SCORING */}
            {(activeSection === "daily-review" || activeSection === "night") && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="text-sm font-medium text-neutral-300 font-mono">1. Reconcile Open Tasks</div>
                  <ReconciliationList tasks={tasksToReconcile} />
                </div>
                <div className="flex items-center justify-between border-t border-neutral-800 pt-3">
                  <span className="text-sm font-medium text-neutral-300 font-mono">2. Daily Discipline Score</span>
                  <RunScoringButton date={selectedDate} />
                </div>
                <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                  <div className="text-sm font-medium text-neutral-300 font-mono">3. Day Closing Note</div>
                  <ReviewNotesLedger date={selectedDate} initialContent={reviewNoteContent} />
                </div>
              </div>
            )}

            {/* SLEEP LOG FORM */}
            {(activeSection === "health" || activeSection === "sleep") && (
              <div className="space-y-1.5 pt-2">
                <div className="text-sm font-medium text-neutral-300 font-mono">Sleep &amp; Recovery</div>
                <SleepLogForm />
                <SleepPeriodRows initialPeriods={sleepPeriods} />
              </div>
            )}

            {/* FOOD HABITS */}
            {(activeSection === "health" || activeSection === "food") && (
              <div className="space-y-1.5 pt-2">
                <div className="text-sm font-medium text-neutral-300 font-mono">Eating Habits</div>
                <FoodHabitLedger date={selectedDate} initialMeals={foodHabitsData} />
              </div>
            )}

            {/* MEDITATION LOG FORM */}
            {(activeSection === "health" || activeSection === "meditation") && (
              <div className="space-y-1.5 pt-2">
                <div className="text-sm font-medium text-neutral-300 font-mono">Meditation &amp; Habits</div>
                <MeditationLogForm
                  date={selectedDate}
                  initialHappened={meditationData?.happened ?? null}
                  initialDuration={meditationData?.duration_min ?? null}
                />
              </div>
            )}

            {/* NOTES */}
            {(activeSection === "health" || activeSection === "notes") && (
              <div className="space-y-1.5 pt-2">
                <div className="text-sm font-medium text-neutral-300 font-mono">Closing Notes</div>
                <ReviewNotesLedger date={selectedDate} initialContent={reviewNoteContent} />
              </div>
            )}

            {/* ACTIVITIES / TIMELINE OF WHAT I DID */}
            {activeSection === "activities" && (
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                  <span className="font-mono text-sm font-semibold uppercase tracking-wider text-neutral-300">
                    Chronological Timeline
                  </span>
                  <span className="font-mono text-xs text-neutral-500">[{timelineBlocks.length} entries]</span>
                </div>

                {timelineBlocks.length === 0 ? (
                  <div className="p-6 text-center text-sm text-neutral-500 font-sans space-y-1.5">
                    <p>No activity check-ins recorded for this day.</p>
                    <p className="text-xs text-neutral-600">
                      Quick activities logged via &quot;What am I doing?&quot; on Home or Work Sessions appear here chronologically with inferred durations.
                    </p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-neutral-800 ml-3 space-y-3 pl-4 pt-1">
                    {timelineBlocks.map((block) => {
                      const isJournal = block.entryType === "journal";
                      return (
                        <div key={block.id} className="relative group">
                          {/* Timeline node */}
                          <div
                            className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 ${
                              isJournal
                                ? "bg-neutral-900 border-neutral-500"
                                : "bg-amber-400 border-neutral-950"
                            }`}
                          />

                          <div className="rounded-xl bg-neutral-900/45 p-3 hover:bg-neutral-900/70 transition-colors">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 font-mono text-sm">
                                <span className="text-amber-300 font-bold">{block.startTime}</span>
                                <span className="text-neutral-600">→</span>
                                <span className="text-neutral-400">{block.endTime ?? "No later check-in"}</span>
                                <span
                                  className={`rounded px-1.5 py-0.2 text-[11px] font-semibold uppercase border ${
                                    isJournal
                                      ? "bg-neutral-800 text-neutral-400 border-neutral-700"
                                      : "bg-amber-950/80 text-amber-300 border-amber-800/60"
                                  }`}
                                >
                                  {isJournal ? "Journal" : "Work"}
                                </span>
                              </div>

                              <span className="rounded bg-neutral-950 border border-neutral-800 px-2 py-0.5 text-xs font-mono font-semibold text-neutral-300">
                                {block.durationLabel}
                              </span>
                            </div>

                            <p className="text-sm text-neutral-200 font-sans">{block.activity}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Academic occurrences for this day */}
                {dayOccurrences && dayOccurrences.length > 0 && (
                  <div className="space-y-2 pt-4">
                    <div className="font-mono text-sm font-semibold uppercase tracking-wider text-neutral-400">
                      Academic Schedule for This Day
                    </div>
                    <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950/50">
                      <table className="w-full text-left text-sm font-mono">
                        <thead>
                          <tr className="border-b border-neutral-800 text-xs text-neutral-500 bg-neutral-900/60">
                            <th className="py-2 px-3">Time</th>
                            <th className="py-2 px-3">Class / Course</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/60">
                          {dayOccurrences.map((occ) => (
                            <tr key={occ.id} className="hover:bg-neutral-900/30">
                              <td className="py-2 px-3 text-amber-300">
                                {occ.startTime ? `${occ.startTime} - ${occ.endTime}` : "Scheduled"}
                              </td>
                              <td className="py-2 px-3 text-white font-medium">{occ.name}</td>
                              <td className="py-2 px-3 text-neutral-400 uppercase text-xs">
                                {occ.slotType || "Lecture"}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                                    occ.status === "attended"
                                      ? "bg-emerald-950/80 text-emerald-300"
                                      : occ.status === "missed"
                                      ? "bg-red-950/80 text-red-300"
                                      : occ.status === "cancelled"
                                      ? "bg-neutral-800 text-neutral-500 line-through"
                                      : "bg-neutral-900 text-neutral-400"
                                  }`}
                                >
                                  {occ.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

          </section>
        </>
      )}
    </>
  );
}
