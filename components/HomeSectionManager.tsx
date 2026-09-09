"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDateDisplay, shiftDateISO } from "@/lib/date";
import type { Task } from "@/lib/types";
import TaskSpreadsheet from "@/components/TaskSpreadsheet";
import ScheduleTable, { type ScheduleItem } from "@/components/ScheduleTable";
import ActivityLedger, { type ActivityEntry } from "@/components/ActivityLedger";
import StreakGrid from "@/components/StreakGrid";
import PlanDayGesture from "@/components/PlanDayGesture";
import SectionBlock from "@/components/SectionBlock";

export type HomeSection = "priorities" | "current-work" | "schedule" | "consistency";

interface HomeSectionManagerProps {
  date: string;
  today: string;
  initialSection?: HomeSection | null;
  tasks: Task[];
  goals: { id: string; title: string; level: string }[];
  checkIns: ActivityEntry[];
  scheduleItems: ScheduleItem[];
  gridDays: { date: string; planned: number; completed: number; score: number | null }[];
  currentStreak: number;
  maxStreak: number;
  nextItem: string | null;
  verdict: { label: string; explanation: string } | null;
}

export default function HomeSectionManager({
  date,
  today,
  initialSection = null,
  tasks,
  goals,
  checkIns,
  scheduleItems,
  gridDays,
  currentStreak,
  maxStreak,
  nextItem,
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
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <>
      {/* TODAY'S OVERVIEW */}
      <section className="overview-ledger">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-neutral-800/80 font-mono text-xs">
          <div className="p-3">
            <span className="text-[10px] uppercase text-neutral-500 block">Today&apos;s Tasks</span>
            <span className="text-base font-bold text-neutral-100">
              {completedTasks}/{totalTasks}
            </span>
            <span className="text-[10px] text-neutral-400 ml-1.5 font-mono">({pct}%)</span>
          </div>
          <div className="p-3">
            <span className="text-[10px] uppercase text-neutral-500 block">Streak</span>
            <span className="text-base font-bold text-emerald-400">🔥 {maxStreak}d</span>
          </div>
          <div className="p-3">
            <span className="text-[10px] uppercase text-neutral-500 block">Next Up</span>
            <span className="text-xs font-medium text-amber-300 truncate block pt-0.5">
              {nextItem ?? "None scheduled"}
            </span>
          </div>
          <div className="p-3">
            <span className="text-[10px] uppercase text-neutral-500 block">Discipline</span>
            <span className="text-xs text-neutral-300 truncate block pt-0.5">
              {verdict?.label ?? "Tracking Active"}
            </span>
          </div>
        </div>
      </section>

      {/* SECTION BLOCKS LANDING VIEW */}
      {!activeSection && (
        <section aria-label="Home sections">
          <SectionBlock
            href={`/?date=${date}&section=priorities`}
            onClick={() => selectSection("priorities")}
            title="Today&apos;s Priorities"
            summary={`${completedTasks} of ${totalTasks} tasks completed`}
            tone="active"
          />
          <SectionBlock
            href={`/?date=${date}&section=current-work`}
            onClick={() => selectSection("current-work")}
            title="What I&apos;m Doing Right Now"
            summary={`${checkIns.length} ongoing or paused activities`}
            tone="good"
          />
          <SectionBlock
            href={`/?date=${date}&section=schedule`}
            onClick={() => selectSection("schedule")}
            title="Schedule"
            summary={nextItem ?? "Nothing scheduled today"}
          />
          <SectionBlock
            href={`/?date=${date}&section=consistency`}
            onClick={() => selectSection("consistency")}
            title="Consistency / Streak"
            summary={`${currentStreak} day current streak`}
            tone="good"
          />
        </section>
      )}

      {/* SECTION DETAIL: TODAY'S PRIORITIES */}
      {activeSection === "priorities" && (
        <section className="space-y-2">
          <Link
            href={`/?date=${date}`}
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to home
          </Link>
          <h2 className="section-detail-title">Today&apos;s Priorities</h2>
          <div className="flex items-center justify-between border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/60 p-2">
            <Link
              href={`/?date=${shiftDateISO(date, -1)}&section=priorities`}
              prefetch={false}
              className="min-h-[40px] px-2 flex items-center text-xs font-mono text-neutral-300"
              aria-label="Previous day"
            >
              ← Prev
            </Link>
            <div className="text-center">
              <span className="text-sm font-semibold text-neutral-100">{formatDateDisplay(date)}</span>
              {date === today && <span className="ml-2 text-[9px] font-mono uppercase text-amber-300">Today</span>}
            </div>
            <Link
              href={`/?date=${shiftDateISO(date, 1)}&section=priorities`}
              prefetch={false}
              className="min-h-[40px] px-2 flex items-center text-xs font-mono text-neutral-300"
              aria-label="Next day"
            >
              Next →
            </Link>
          </div>
          <PlanDayGesture date={date}>
            <TaskSpreadsheet initialTasks={tasks} goals={goals} selectedDate={date} />
          </PlanDayGesture>
        </section>
      )}

      {/* SECTION DETAIL: CONSISTENCY / STREAK */}
      {activeSection === "consistency" && (
        <section className="space-y-2">
          <Link
            href={`/?date=${date}`}
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to home
          </Link>
          <h2 className="section-detail-title">Consistency / Streak</h2>
          <StreakGrid days={gridDays} currentStreak={currentStreak} longestStreak={maxStreak} />
        </section>
      )}

      {/* SECTION DETAIL: CURRENT WORK */}
      {activeSection === "current-work" && (
        <section className="space-y-2">
          <Link
            href={`/?date=${date}`}
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to home
          </Link>
          <ActivityLedger initialEntries={checkIns} />
        </section>
      )}

      {/* SECTION DETAIL: SCHEDULE */}
      {activeSection === "schedule" && (
        <section className="space-y-2">
          <Link
            href={`/?date=${date}`}
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to home
          </Link>
          <h2 className="section-detail-title">Schedule</h2>
          <ScheduleTable items={scheduleItems} selectedDate={date} isHomeView={true} />
        </section>
      )}
    </>
  );
}
