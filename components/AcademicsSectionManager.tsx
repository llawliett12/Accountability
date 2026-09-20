"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SectionBlock from "@/components/SectionBlock";
import AcademicsHub from "@/components/AcademicsHub";
import AcademicScheduleScreenshots from "@/components/AcademicScheduleScreenshots";
import type { ClassWithAttendance } from "@/lib/academics/queries";
import type { Assessment, Deadline, ClassOccurrence, Course } from "@/lib/academics/types";
import type { AcademicScreenshotKind } from "@/lib/academics/screenshot-actions";
import type { NextInLineAcademicResult } from "@/lib/nextInLine";
import NextInLineCard from "@/components/NextInLineCard";
import AddCourseModal from "@/components/AddCourseModal";

export type AcademicSection =
  | "deadlines"
  | "schedule"
  | "assessments"
  | "performance"
  | "classes"
  | "timetable"
  | "screenshots";

export interface CourseSummaryItem extends Course {
  attendancePct: number | null;
  nextEvent: string | null;
}

interface AcademicsSectionManagerProps {
  initialSection?: AcademicSection | null;
  courses: CourseSummaryItem[];
  nextInLine: NextInLineAcademicResult | null;
  classes: ClassWithAttendance[];
  assessments: Assessment[];
  deadlines: Deadline[];
  occurrences: ClassOccurrence[];
  screenshots: { kind: AcademicScreenshotKind; url: string | null }[];
}

export default function AcademicsSectionManager({
  initialSection = null,
  courses,
  nextInLine,
  classes,
  assessments,
  deadlines,
  occurrences,
  screenshots,
}: AcademicsSectionManagerProps) {
  const [activeSection, setActiveSection] = useState<AcademicSection | null>(initialSection);
  const [prevInitial, setPrevInitial] = useState(initialSection);
  const [showAddCourse, setShowAddCourse] = useState(false);

  if (prevInitial !== initialSection) {
    setPrevInitial(initialSection);
    setActiveSection(initialSection);
  }

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const sectionParam = (params.get("section") || params.get("tab")) as AcademicSection | null;
      setActiveSection(sectionParam ?? null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const selectSection = useCallback((sec: AcademicSection) => {
    setActiveSection(sec);
    window.history.pushState(null, "", `/academics?section=${sec}`);
  }, []);

  const handleBack = useCallback(() => {
    setActiveSection(null);
    window.history.pushState(null, "", "/academics");
  }, []);

  const activeCourses = courses.filter((c) => c.active);
  const upcomingAssessments = assessments.filter((a) => a.status !== "completed").length;
  const openDeadlines = deadlines.filter((d) => d.status !== "completed").length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueDeadlinesCount = deadlines.filter(
    (d) => d.status !== "completed" && d.due_date && d.due_date < todayStr
  ).length;

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <AddCourseModal isOpen={showAddCourse} onClose={() => setShowAddCourse(false)} />

      {/* LEVEL 1: ACADEMIC CONTROL CENTER */}
      {!activeSection && (
        <div className="space-y-4">
          {/* 1. DATE HEADER */}
          <header className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-100 font-mono">Academics</h1>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">{todayFormatted}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddCourse(true)}
              className="rounded-lg bg-neutral-100 px-3 py-1 font-mono text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors"
            >
              + Add Course
            </button>
          </header>

          {/* RESPONSIVE DESKTOP 2-COLUMN / MOBILE STACK */}
          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 items-start">
            {/* COLUMN 1: NEXT IN LINE & COURSES */}
            <div className="space-y-4">
              {/* 2. NEXT IN LINE */}
              <NextInLineCard item={nextInLine} />

              {/* 3. COURSES (FIRST-CLASS ENTITIES) */}
              <section aria-label="Active Courses" className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
                    Active Courses ({activeCourses.length})
                  </h2>
                  <span className="font-mono text-[10px] text-neutral-500">Tap to open</span>
                </div>

                {activeCourses.length === 0 ? (
                  <p className="font-mono text-xs text-neutral-500 py-1">
                    No active courses found. Tap &quot;+ Add Course&quot; above to create one.
                  </p>
                ) : (
                  <div className="divide-y divide-neutral-800/60 font-mono text-xs">
                    {activeCourses.map((crs) => (
                      <Link
                        key={crs.id}
                        href={`/academics/courses/${crs.id}`}
                        className="py-2.5 flex items-center justify-between group hover:bg-neutral-800/30 px-1.5 rounded transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-amber-300 group-hover:text-amber-200 transition-colors">
                              {crs.code}
                            </span>
                            <span className="text-neutral-300 truncate text-[11px]">{crs.name}</span>
                          </div>
                          {crs.nextEvent && (
                            <span className="text-[10px] text-neutral-500 block truncate">
                              Next: {crs.nextEvent}
                            </span>
                          )}
                        </div>

                        <div className="text-right whitespace-nowrap">
                          {crs.attendancePct !== null ? (
                            <span
                              className={`text-xs font-semibold ${
                                crs.attendancePct >= crs.attendance_target
                                  ? "text-emerald-400"
                                  : "text-amber-400"
                              }`}
                            >
                              {crs.attendancePct}%
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-[11px]">--</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* COLUMN 2: 4. GENERAL ACADEMIC SCHEDULE & DEDICATED DOORS */}
            <div className="space-y-4">
              <section aria-label="General Academic Schedule" className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 font-semibold px-1">
                  General Academic Schedule &amp; Ledgers
                </div>

                <SectionBlock
                  href="/academics?section=schedule"
                  onClick={() => selectSection("schedule")}
                  title="Timetable &amp; Schedule"
                  summary="Recurring weekly timetable, extra classes &amp; reference screenshots"
                  tone="active"
                />

                <SectionBlock
                  href="/academics?section=deadlines"
                  onClick={() => selectSection("deadlines")}
                  title="Deadlines &amp; Assignments"
                  summary={
                    overdueDeadlinesCount > 0
                      ? `${overdueDeadlinesCount} overdue · ${openDeadlines} pending deadlines`
                      : `${openDeadlines} pending deadlines · Tap to manage`
                  }
                  tone={overdueDeadlinesCount > 0 ? "warn" : openDeadlines > 0 ? "active" : "good"}
                />

                <SectionBlock
                  href="/academics?section=assessments"
                  onClick={() => selectSection("assessments")}
                  title="Assessments &amp; Scores"
                  summary={`${upcomingAssessments} upcoming tests/quizzes · Historical marks &amp; targets`}
                  tone={upcomingAssessments > 0 ? "active" : "good"}
                />

                <SectionBlock
                  href="/academics?section=performance"
                  onClick={() => selectSection("performance")}
                  title="Performance &amp; Attendance"
                  summary="Attendance logs across all courses and danger zone alerts"
                  tone="good"
                />
              </section>
            </div>
          </div>
        </div>
      )}

      {/* LEVEL 2: DEDICATED FULL VIEWS */}
      {activeSection && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-400 hover:text-white transition-colors"
            >
              &larr; Back to Academics
            </button>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
              {activeSection === "deadlines"
                ? "Academic Deadlines"
                : activeSection === "schedule"
                ? "Academic Timetable & Screenshots"
                : activeSection === "assessments"
                ? "Assessments & Tests"
                : "Course Attendance & Performance"}
            </span>
          </div>

          {activeSection === "schedule" ? (
            <div className="space-y-6">
              <AcademicsHub
                defaultTab="timetable"
                initialClasses={classes}
                initialAssessments={assessments}
                initialDeadlines={deadlines}
                initialOccurrences={occurrences}
              />
              <AcademicScheduleScreenshots initialDocuments={screenshots} />
            </div>
          ) : (
            <AcademicsHub
              defaultTab={
                activeSection === "deadlines"
                  ? "deadlines"
                  : activeSection === "assessments"
                  ? "assessments"
                  : "performance"
              }
              initialClasses={classes}
              initialAssessments={assessments}
              initialDeadlines={deadlines}
              initialOccurrences={occurrences}
            />
          )}
        </div>
      )}

    </>
  );
}
