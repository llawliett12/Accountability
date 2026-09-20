"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SectionBlock from "@/components/SectionBlock";
import GoalsTable from "@/components/GoalsTable";
import GoalQuickAdd from "@/components/GoalQuickAdd";
import type { GoalWithMeta } from "@/lib/goals/queries";

export type GoalsSection = "active" | "top3" | "today" | "upcoming" | "completed" | "overdue";

interface GoalsSectionManagerProps {
  initialSection?: GoalsSection | null;
  active: GoalWithMeta[];
  overdue: GoalWithMeta[];
  top3Goals: GoalWithMeta[];
  todayGoals: GoalWithMeta[];
  upcoming: GoalWithMeta[];
  recentlyCompleted: GoalWithMeta[];
  parentOptions: { id: string; title: string; level: string }[];
  goalsCount: number;
  courseCodeMap?: Record<string, string>;
}

export default function GoalsSectionManager({
  initialSection = null,
  active,
  overdue,
  top3Goals,
  todayGoals,
  upcoming,
  recentlyCompleted,
  parentOptions,
  goalsCount,
  courseCodeMap = {},
}: GoalsSectionManagerProps) {
  const [activeSection, setActiveSection] = useState<GoalsSection | null>(initialSection);
  const [prevInitial, setPrevInitial] = useState(initialSection);
  if (prevInitial !== initialSection) {
    setPrevInitial(initialSection);
    setActiveSection(initialSection);
  }

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const sectionParam = params.get("section") as GoalsSection | null;
      setActiveSection(sectionParam ?? null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const selectSection = useCallback((sec: GoalsSection) => {
    setActiveSection(sec);
    window.history.pushState(null, "", `/goals?section=${sec}`);
  }, []);

  const handleBack = useCallback(() => {
    setActiveSection(null);
    window.history.pushState(null, "", "/goals");
  }, []);

  const isTodayOrTop3 = activeSection === "top3" || activeSection === "today";

  return (
    <>
      {/* LEVEL 1: MINIMAL GOALS CONTROL CENTER */}
      {!activeSection && (
        <div className="space-y-4">
          {/* Summary Strip */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-3 py-2 font-mono text-xs text-neutral-400">
            <span className="text-white font-semibold">{active.length}</span> active
            <span className="text-neutral-600">·</span>
            <span className="text-amber-400 font-semibold">{top3Goals.length}</span> top 3
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-300 font-semibold">{upcoming.length}</span> upcoming
            {overdue.length > 0 && (
              <>
                <span className="text-neutral-600">·</span>
                <span className="text-red-400 font-semibold">{overdue.length} overdue</span>
              </>
            )}
          </div>

          <section aria-label="Goal navigation" className="space-y-1">
            <SectionBlock
              href="/goals?section=active"
              onClick={() => selectSection("active")}
              title="Active Goals"
              summary={`${active.length} goals in progress (Year, Quarter, Month, Week)`}
              tone="active"
            />
            <SectionBlock
              href="/goals?section=top3"
              onClick={() => selectSection("top3")}
              title="Today's Top 3 Goals"
              summary={
                top3Goals.length
                  ? `${top3Goals.length} high-priority targets · ${todayGoals.length} in today's plan`
                  : todayGoals.length
                  ? `${todayGoals.length} goals linked to today's tasks`
                  : "No top 3 goals marked"
              }
              tone={top3Goals.length ? "active" : todayGoals.length ? "neutral" : "neutral"}
            />
            <SectionBlock
              href="/goals?section=upcoming"
              onClick={() => selectSection("upcoming")}
              title="Upcoming"
              summary={
                upcoming.length
                  ? `${upcoming.length} goals approaching deadlines${
                      overdue.length > 0 ? ` · ${overdue.length} overdue` : ""
                    }`
                  : overdue.length > 0
                  ? `${overdue.length} overdue goals`
                  : "No upcoming goal deadlines"
              }
              tone={overdue.length ? "warn" : "neutral"}
            />
            <SectionBlock
              href="/goals?section=completed"
              onClick={() => selectSection("completed")}
              title="Completed"
              summary={`${recentlyCompleted.length} recently completed milestones`}
              tone="good"
            />
          </section>
        </div>
      )}

      {/* SECTION DETAIL: ACTIVE GOALS */}
      {activeSection === "active" && (
        <section className="space-y-4">
          <Link
            href="/goals"
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Goals
          </Link>
          <GoalQuickAdd goals={parentOptions} />
          {overdue.length > 0 && (
            <GoalsTable goals={overdue} title="Overdue Goals" courseCodeMap={courseCodeMap} />
          )}
          {(["year", "quarter", "month", "week"] as const).map((level) => {
            const levelGoals = active.filter((g) => g.level === level);
            return levelGoals.length ? (
              <GoalsTable
                key={level}
                goals={levelGoals}
                title={`${level} Goals`}
                courseCodeMap={courseCodeMap}
              />
            ) : null;
          })}
        </section>
      )}

      {/* SECTION DETAIL: TODAY'S TOP 3 / LINKED GOALS */}
      {isTodayOrTop3 && (
        <section className="space-y-4">
          <Link
            href="/goals"
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Goals
          </Link>
          <GoalsTable
            goals={top3Goals}
            title="Today's Top 3 Goals"
            courseCodeMap={courseCodeMap}
          />
          {top3Goals.length === 0 && (
            <p className="text-xs text-neutral-500">No goals are marked as Top 3 for today. Click the star icon on any goal to designate it as Top 3.</p>
          )}

          {todayGoals.length > 0 && (
            <div className="pt-4">
              <GoalsTable
                goals={todayGoals}
                title="Today's Linked Goals (from Daily Plan)"
                courseCodeMap={courseCodeMap}
              />
            </div>
          )}
        </section>
      )}

      {/* SECTION DETAIL: UPCOMING GOALS */}
      {activeSection === "upcoming" && (
        <section className="space-y-4">
          <Link
            href="/goals"
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Goals
          </Link>
          <GoalsTable goals={upcoming} title="Upcoming Goals" courseCodeMap={courseCodeMap} />
          {upcoming.length === 0 && <p className="text-xs text-neutral-500">No upcoming goal deadlines.</p>}
        </section>
      )}

      {/* SECTION DETAIL: COMPLETED GOALS */}
      {activeSection === "completed" && (
        <section className="space-y-4">
          <Link
            href="/goals"
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Goals
          </Link>
          <GoalsTable
            goals={recentlyCompleted}
            title="Recently Completed"
            courseCodeMap={courseCodeMap}
          />
          {recentlyCompleted.length === 0 && (
            <p className="text-xs text-neutral-500">No completed goals yet.</p>
          )}
        </section>
      )}


      {goalsCount === 0 && (
        <div className="border border-neutral-800 bg-neutral-950/40 p-6 text-center rounded-lg font-mono text-xs text-neutral-500">
          No goals recorded yet. Add a Year or Quarter goal above to establish your hierarchy.
        </div>
      )}

      <div className="pt-2 text-center">
        <Link href="/plan" className="text-xs font-mono text-amber-400 hover:text-amber-300">
          ← Back to today&apos;s plan
        </Link>
      </div>
    </>
  );
}
