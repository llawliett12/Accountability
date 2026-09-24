"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDateDisplay, shiftDateISO } from "@/lib/date";
import type { Task } from "@/lib/types";
import type { Goal } from "@/lib/goals/types";
import TaskSpreadsheet from "@/components/TaskSpreadsheet";
import ActivityLedger, { type ActivityEntry } from "@/components/ActivityLedger";
import PlanDayGesture from "@/components/PlanDayGesture";
import NextInLineCard from "@/components/NextInLineCard";
import WeeklyTimetableReference from "@/components/WeeklyTimetableReference";
import type { AcademicScheduleItem } from "@/components/TodayAcademicSchedule";
import HomeTop3Goals from "@/components/HomeTop3Goals";
import WhatAmIDoingInput from "@/components/WhatAmIDoingInput";
import NotesSection from "@/components/NotesSection";
import type { Note } from "@/lib/notes/types";
import type { NextInLineResult } from "@/lib/nextInLine";

export type HomeSection = "priorities" | "current-work" | string;

interface HomeSectionManagerProps {
  date: string;
  today: string;
  initialSection?: HomeSection | null;
  tasks: Task[];
  top3Goals: Goal[];
  courseCodeMap: Record<string, string>;
  checkIns: ActivityEntry[];
  academicSchedule: AcademicScheduleItem[];
  weeklyTimetableImageUrl?: string | null;
  isWeekday?: boolean;
  nextInLine: NextInLineResult | null;
  homeNotes?: Note[];
  journalNotes?: Note[];
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
  weeklyTimetableImageUrl,
  isWeekday,
  nextInLine,
  homeNotes,
  journalNotes,
}: HomeSectionManagerProps) {
  const [activeSection, setActiveSection] = useState<HomeSection | null>(initialSection);
  const [prevInitial, setPrevInitial] = useState(initialSection);
  if (prevInitial !== initialSection) {
    setPrevInitial(initialSection);
    setActiveSection(initialSection);
  }

  const isWeekdayActive =
    isWeekday !== undefined
      ? isWeekday
      : (() => {
          const d = new Date(date + "T00:00:00Z").getUTCDay();
          return d >= 1 && d <= 5;
        })();

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


  const handleBack = useCallback(() => {
    setActiveSection(null);
    const targetUrl = `/?date=${date}`;
    window.history.pushState(null, "", targetUrl);
  }, [date]);


  const ongoingWork = checkIns.find((c) => c.status === "ongoing" || c.status === "paused");

  return (
    <>
      {/* LEVEL 1: MINIMAL CONTROL CENTER */}
      <div className={activeSection ? "hidden" : "space-y-4"}>
        {/* HEADER: DATE */}
        <header className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-100 font-mono">Home</h1>
            <p className="text-sm text-neutral-400 font-mono mt-0.5">
              {formatDateDisplay(date)}
              {date === today && (
                <span className="ml-2 inline-flex items-center rounded-md bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                  Today
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href={`/?date=${shiftDateISO(date, -1)}`}
              className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              aria-label="Previous day"
            >
              &larr;
            </Link>
            {date !== today && (
              <Link
                href="/"
                className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-sm text-neutral-300 hover:text-white transition-colors font-mono text-xs"
              >
                Today
              </Link>
            )}
            <Link
              href={`/?date=${shiftDateISO(date, 1)}`}
              className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              aria-label="Next day"
            >
              &rarr;
            </Link>
          </div>
        </header>

        {/* ACTIVE WORK NOTIFICATION (if work session is running) */}
        {ongoingWork && (
          <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-2.5 flex items-center justify-between text-sm">
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
              className="font-mono text-xs text-emerald-400 hover:text-emerald-200 underline whitespace-nowrap ml-2"
            >
              Focus Session &rarr;
            </Link>
          </div>
        )}

        {/* 2. LARGE NEXT IN LINE */}
        <NextInLineCard item={nextInLine} />

        {/* 3. WEEKLY TIMETABLE REFERENCE (SHOWN MON-FRI ONLY; HIDDEN ON SAT-SUN) */}
        {isWeekdayActive && (
          <WeeklyTimetableReference
            imageUrl={weeklyTimetableImageUrl ?? null}
            items={academicSchedule}
          />
        )}

        {/* 4. TOP 3 GOALS */}
        <HomeTop3Goals goals={top3Goals} courseCodeMap={courseCodeMap} />

        {/* 5. WHAT AM I DOING? QUICK ACTIVITY LOG */}
        <WhatAmIDoingInput />

        {/* 6. JOURNAL */}
        <NotesSection title="Journal" notes={journalNotes ?? []} category="journal" />

        {/* 7. GENERAL NOTES */}
        <NotesSection title="Notes" notes={homeNotes ?? []} category="general" />
      </div>

      {/* LEVEL 2: DEEP DEDICATED VIEWS */}
      {activeSection === "priorities" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 font-mono text-sm text-neutral-400 hover:text-white transition-colors"
            >
              &larr; Back to Home
            </button>
            <span className="font-mono text-sm font-semibold uppercase tracking-wider text-neutral-300">
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
              className="inline-flex items-center gap-1.5 font-mono text-sm text-neutral-400 hover:text-white transition-colors"
            >
              &larr; Back to Home
            </button>
            <span className="font-mono text-sm font-semibold uppercase tracking-wider text-neutral-300">
              Current Work Sessions
            </span>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-400 font-mono">Work sessions with ongoing/paused/completed lifecycle</p>
            <Link
              href="/now"
              className="rounded-lg bg-neutral-100 px-3 py-1 font-mono text-sm font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors"
            >
              Open Full Screen &rarr;
            </Link>
          </div>

          <ActivityLedger initialEntries={checkIns} />
        </div>
      )}
    </>
  );
}
