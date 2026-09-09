"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SectionBlock from "@/components/SectionBlock";
import GoalsTable from "@/components/GoalsTable";
import GoalQuickAdd from "@/components/GoalQuickAdd";
import type { GoalWithMeta } from "@/lib/goals/queries";

export type GoalsSection = "active" | "today" | "upcoming" | "completed" | "overdue";

interface GoalsSectionManagerProps {
  initialSection?: GoalsSection | null;
  active: GoalWithMeta[];
  overdue: GoalWithMeta[];
  todayGoals: GoalWithMeta[];
  upcoming: GoalWithMeta[];
  recentlyCompleted: GoalWithMeta[];
  parentOptions: { id: string; title: string; level: string }[];
  goalsCount: number;
}

export default function GoalsSectionManager({
  initialSection = null,
  active,
  overdue,
  todayGoals,
  upcoming,
  recentlyCompleted,
  parentOptions,
  goalsCount,
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

  return (
    <>
      {/* SECTION BLOCKS LANDING VIEW */}
      {!activeSection && (
        <section aria-label="Goal sections">
          <SectionBlock
            href="/goals?section=active"
            onClick={() => selectSection("active")}
            title="Active Goals"
            summary={`${active.length} goals in progress`}
            tone="active"
          />
          <SectionBlock
            href="/goals?section=today"
            onClick={() => selectSection("today")}
            title="Today&apos;s Priorities"
            summary={todayGoals.length ? `${todayGoals.length} goals linked to today` : "No goals linked to today"}
          />
          <SectionBlock
            href="/goals?section=upcoming"
            onClick={() => selectSection("upcoming")}
            title="Upcoming Deadlines"
            summary={upcoming.length ? `${upcoming.length} goals with upcoming dates` : "No upcoming goal deadlines"}
            tone={overdue.length ? "warn" : "neutral"}
          />
          <SectionBlock
            href="/goals?section=completed"
            onClick={() => selectSection("completed")}
            title="Completed Goals"
            summary={`${recentlyCompleted.length} recently completed`}
            tone="good"
          />
        </section>
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
          {overdue.length > 0 && <GoalsTable goals={overdue} title="Overdue Goals" />}
          {(["year", "quarter", "month", "week"] as const).map((level) => {
            const levelGoals = active.filter((g) => g.level === level);
            return levelGoals.length ? (
              <GoalsTable key={level} goals={levelGoals} title={`${level} Goals`} />
            ) : null;
          })}
        </section>
      )}

      {/* SECTION DETAIL: TODAY'S LINKED GOALS */}
      {activeSection === "today" && (
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
          <GoalsTable goals={todayGoals} title="Today&apos;s Linked Goals" />
          {todayGoals.length === 0 && (
            <p className="text-xs text-neutral-500">No goals are linked to today&apos;s tasks.</p>
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
          <GoalsTable goals={upcoming} title="Upcoming Goals" />
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
          <GoalsTable goals={recentlyCompleted} title="Recently Completed" />
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
