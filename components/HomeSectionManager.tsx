"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDateDisplay, shiftDateISO } from "@/lib/date";
import type { Task } from "@/lib/types";
import type { Goal } from "@/lib/goals/types";
import TaskSpreadsheet from "@/components/TaskSpreadsheet";
import ScheduleTable, { type ScheduleItem } from "@/components/ScheduleTable";
import ActivityLedger, { type ActivityEntry } from "@/components/ActivityLedger";
import StreakGrid from "@/components/StreakGrid";
import PlanDayGesture from "@/components/PlanDayGesture";
import SectionBlock from "@/components/SectionBlock";
import NextInLineCard from "@/components/NextInLineCard";
import TodayAcademicSchedule, { type AcademicScheduleItem } from "@/components/TodayAcademicSchedule";
import HomeTop3Goals from "@/components/HomeTop3Goals";
import WhatAmIDoingInput from "@/components/WhatAmIDoingInput";
import type { NextInLineResult } from "@/lib/nextInLine";

export type HomeSection = "priorities" | "current-work" | "schedule" | "progress" | "consistency";

interface HomeSectionManagerProps {
  date: string;
  today: string;
  initialSection?: HomeSection | null;
  tasks: Task[];
  top3Goals: Goal[];
  courseCodeMap: Record<string, string>;
  checkIns: ActivityEntry[];
  academicSchedule: AcademicScheduleItem[];
  nextInLine: NextInLineResult | null;
  gridDays: { date: string; planned: number; completed: number; score: number | null }[];
  currentStreak: number;
  maxStreak: number;
  scheduleItems: ScheduleItem[];
  verdict: { label: string; explanation: string } | null;
}

export default function HomeSectionManager({
  date,
  today,
  initialSection = null,
  tasks,
  top3Goals,
  courseCodeMap,
  checkIns,
  academicSchedule,
  nextInLine,
  gridDays,
  currentStreak,
  maxStreak,
  scheduleItems,
  verdict,
}: HomeSectionManagerProps) {
  const [activeSection, setActiveSection] = useState<HomeSection | null>(initialSection);
  const [prevInitial, setPrevInitial] = useState(initialSection);
  if (prevInitial !== initialSection) {
    setPrevInitial(initialSection);
    setActiveSection(initialSection);
  }

  // Synchronize browser history popstate (Back/Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const sectionParam = params.get("section") as HomeSection | null;
      setActiveSection(sectionParam ?? null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const selectSection = useCallback(
    (sec: HomeSection) => {
      setActiveSection(sec);
      const targetUrl = `/?date=${date}&section=${sec}`;
      window.history.pushState(null, "", targetUrl);
    },
    [date]
  );

  const handleBack = useCallback(() => {
    setActiveSection(null);
    const targetUrl = `/?date=${date}`;
    window.history.pushState(null, "", targetUrl);
  }, [date]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const remainingTasks = totalTasks - completedTasks;

  const ongoingWork = checkIns.find((c) => c.status === "ongoing" || c.status === "paused");

  return (
    <>
      {/* LEVEL 1: MINIMAL CONTROL CENTER */}
      {!activeSection && (
        <div className="space-y-4">
          {/* HEADER: DATE */}
          <header className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-100 font-mono">Home</h1>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                {formatDateDisplay(date)}
                {date === today && (
                  <span className="ml-2 inline-flex items-center rounded-md bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                    Today
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <Link
                href={`/?date=${shiftDateISO(date, -1)}`}
                className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                aria-label="Previous day"
              >
                &larr;
              </Link>
              {date !== today && (
                <Link
                  href="/"
                  className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-xs text-neutral-300 hover:text-white transition-colors font-mono text-[10px]"
                >
                  Today
                </Link>
              )}
              <Link
                href={`/?date=${shiftDateISO(date, 1)}`}
                className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                aria-label="Next day"
              >
                &rarr;
              </Link>
            </div>
          </header>

          {/* ACTIVE WORK NOTIFICATION (if work session is running) */}
          {ongoingWork && (
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-mono text-emerald-300 font-medium truncate">
                  {ongoingWork.status === "paused" ? "⏸ Paused: " : "● Ongoing: "}
                  {ongoingWork.actual_activity}
                </span>
              </div>
              <Link
                href="/now"
                className="font-mono text-[10px] text-emerald-400 hover:text-emerald-200 underline whitespace-nowrap ml-2"
              >
                Focus Session &rarr;
              </Link>
            </div>
          )}

          {/* RESPONSIVE DESKTOP 2-COLUMN / MOBILE STACK */}
          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 items-start">
            {/* COLUMN 1 */}
            <div className="space-y-4">
              {/* 2. NEXT IN LINE */}
              <NextInLineCard item={nextInLine} />

              {/* 5. WHAT AM I DOING? */}
              <WhatAmIDoingInput />

              {/* NAVIGATION DOORS TO DEEP SECTIONS */}
              <section aria-label="Home Navigation Doors" className="space-y-1.5 pt-1">
                <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 font-semibold px-1">
                  Dedicated Views
                </div>
                <SectionBlock
                  href={`/?date=${date}&section=priorities`}
                  onClick={() => selectSection("priorities")}
                  title="Daily Tasks"
                  summary={
                    remainingTasks > 0
                      ? `${remainingTasks} tasks remaining · ${completedTasks}/${totalTasks} done`
                      : totalTasks > 0
                      ? `All ${totalTasks} tasks completed`
                      : "No tasks planned yet"
                  }
                  tone={remainingTasks > 0 ? "active" : "good"}
                />
                <SectionBlock
                  href={`/?date=${date}&section=schedule`}
                  onClick={() => selectSection("schedule")}
                  title="Full Timetable"
                  summary={`${academicSchedule.length} classes scheduled · Weekly view`}
                  tone={academicSchedule.length > 0 ? "good" : "neutral"}
                />
                <SectionBlock
                  href={`/?date=${date}&section=progress`}
                  onClick={() => selectSection("progress")}
                  title="Consistency & Streaks"
                  summary={`🔥 ${currentStreak}d streak · ${verdict?.label ?? "Tracking Active"}`}
                  tone="good"
                />
                <SectionBlock
                  href={`/?date=${date}&section=current-work`}
                  onClick={() => selectSection("current-work")}
                  title="Current Work Ledger"
                  summary={
                    ongoingWork
                      ? `${ongoingWork.status}: ${ongoingWork.actual_activity}`
                      : "View tracked focus work sessions"
                  }
                  tone={ongoingWork ? "active" : "neutral"}
                />
              </section>
            </div>

            {/* COLUMN 2 */}
            <div className="space-y-4">
              {/* 3. TODAY'S ACADEMIC SCHEDULE */}
              <TodayAcademicSchedule items={academicSchedule} />

              {/* 4. THINGS TO BE DONE (TOP 3 GOALS) */}
              <HomeTop3Goals goals={top3Goals} courseCodeMap={courseCodeMap} />
            </div>
          </div>
        </div>
      )}

      {/* LEVEL 2: DEEP DEDICATED VIEWS */}
      {activeSection === "priorities" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-400 hover:text-white transition-colors"
            >
              &larr; Back to Home
            </button>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Tasks &amp; Priorities
            </span>
          </div>

          <PlanDayGesture date={date}>
            <TaskSpreadsheet
              initialTasks={tasks}
              goals={top3Goals.map((g) => ({ id: g.id, title: g.title, level: g.level }))}
              selectedDate={date}
            />
          </PlanDayGesture>
        </div>
      )}

      {activeSection === "current-work" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-400 hover:text-white transition-colors"
            >
              &larr; Back to Home
            </button>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Current Work Sessions
            </span>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400 font-mono">Work sessions with ongoing/paused/completed lifecycle</p>
            <Link
              href="/now"
              className="rounded-lg bg-neutral-100 px-3 py-1 font-mono text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors"
            >
              Open Full Screen &rarr;
            </Link>
          </div>

          <ActivityLedger initialEntries={checkIns} />
        </div>
      )}

      {activeSection === "schedule" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-400 hover:text-white transition-colors"
            >
              &larr; Back to Home
            </button>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Today&apos;s Academic Timetable
            </span>
          </div>

          <ScheduleTable items={scheduleItems} selectedDate={date} />
        </div>
      )}

      {activeSection === "progress" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-400 hover:text-white transition-colors"
            >
              &larr; Back to Home
            </button>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Consistency &amp; Discipline
            </span>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-neutral-400">Current Streak:</span>
              <span className="font-bold text-emerald-400">🔥 {currentStreak} days</span>
            </div>
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-neutral-400">Best Streak:</span>
              <span className="font-bold text-neutral-200">🔥 {maxStreak} days</span>
            </div>
            {verdict && (
              <div className="border-t border-neutral-800 pt-2 font-mono text-xs">
                <span className="text-neutral-400">Discipline Status: </span>
                <span className="font-semibold text-neutral-200">{verdict.label}</span>
                <p className="text-[11px] text-neutral-500 mt-0.5">{verdict.explanation}</p>
              </div>
            )}
          </div>

          <StreakGrid days={gridDays} currentStreak={currentStreak} longestStreak={maxStreak} />
        </div>
      )}
    </>
  );
}
