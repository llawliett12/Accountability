"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDateDisplay, shiftDateISO } from "@/lib/date";
import type { Task } from "@/lib/types";
import TaskSpreadsheet, { type LinkableGoal } from "@/components/TaskSpreadsheet";
import PlanDayGesture from "@/components/PlanDayGesture";
import NextInLineCard from "@/components/NextInLineCard";
import WeeklyTimetableReference from "@/components/WeeklyTimetableReference";
import type { AcademicScheduleItem } from "@/components/TodayAcademicSchedule";
import HomeTopTasks from "@/components/HomeTopTasks";
import RightNow from "@/components/RightNow";
import NotesSection from "@/components/NotesSection";
import type { Note } from "@/lib/notes/types";
import type { NextInLineResult } from "@/lib/nextInLine";
import type { ActiveFocusSession } from "@/lib/focus";

// Home has one deep view: the full Tasks ledger. (Focus Sessions live at /focus.)
export type HomeSection = "tasks";

// "priorities" is the old name for this view; keep old links working.
function normalizeSection(value: string | null | undefined): HomeSection | null {
  return value === "tasks" || value === "priorities" ? "tasks" : null;
}

interface HomeSectionManagerProps {
  date: string;
  today: string;
  initialSection?: string | null;
  tasks: Task[];
  /** Every active goal, so any task can be linked to any goal. */
  linkableGoals?: LinkableGoal[];
  courseCodeMap: Record<string, string>;
  activeSession?: ActiveFocusSession | null;
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
  linkableGoals = [],
  courseCodeMap,
  activeSession = null,
  academicSchedule,
  weeklyTimetableImageUrl,
  isWeekday,
  nextInLine,
  homeNotes,
  journalNotes,
}: HomeSectionManagerProps) {
  const [activeSection, setActiveSection] = useState<HomeSection | null>(
    normalizeSection(initialSection)
  );
  const [prevInitial, setPrevInitial] = useState(initialSection);
  if (prevInitial !== initialSection) {
    setPrevInitial(initialSection);
    setActiveSection(normalizeSection(initialSection));
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
      setActiveSection(normalizeSection(params.get("section")));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);


  const openTasks = useCallback(() => {
    setActiveSection("tasks");
    window.history.pushState(null, "", `/?date=${date}&section=tasks`);
  }, [date]);

  const handleBack = useCallback(() => {
    setActiveSection(null);
    const targetUrl = `/?date=${date}`;
    window.history.pushState(null, "", targetUrl);
  }, [date]);

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

        {/* RIGHT NOW: the one place for "what am I doing?" (a Focus Session) */}
        <RightNow active={activeSession} />

        {/* NEXT IN LINE */}
        <NextInLineCard item={nextInLine} />

        {/* WEEKLY TIMETABLE REFERENCE (SHOWN MON-FRI ONLY; HIDDEN ON SAT-SUN) */}
        {isWeekdayActive && (
          <WeeklyTimetableReference
            imageUrl={weeklyTimetableImageUrl ?? null}
            items={academicSchedule}
          />
        )}

        {/* TOP PRIORITIES: today's top open tasks */}
        <HomeTopTasks
          tasks={tasks}
          date={date}
          courseCodeMap={courseCodeMap}
          onOpenTasks={openTasks}
        />

        {/* JOURNAL */}
        <NotesSection title="Journal" notes={journalNotes ?? []} category="journal" />

        {/* GENERAL NOTES */}
        <NotesSection title="Notes" notes={homeNotes ?? []} category="general" />
      </div>

      {/* LEVEL 2: FULL TASKS LEDGER */}
      {activeSection === "tasks" && (
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
              Tasks
            </span>
          </div>

          <PlanDayGesture date={date}>
            <TaskSpreadsheet
              initialTasks={tasks}
              goals={linkableGoals}
              selectedDate={date}
            />
          </PlanDayGesture>
        </div>
      )}
    </>
  );
}
