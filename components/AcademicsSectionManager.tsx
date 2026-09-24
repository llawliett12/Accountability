"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SectionBlock from "@/components/SectionBlock";
import AcademicsHub from "@/components/AcademicsHub";
import AcademicScheduleScreenshots from "@/components/AcademicScheduleScreenshots";
import CanonicalTimetable from "@/components/CanonicalTimetable";
import type { ClassWithAttendance } from "@/lib/academics/queries";
import type { Assessment, Deadline, ClassOccurrence, Course } from "@/lib/academics/types";
import type { AcademicScreenshotKind } from "@/lib/academics/screenshot-actions";
import type { NextInLineAcademicResult } from "@/lib/nextInLine";
import NextInLineCard from "@/components/NextInLineCard";
import AddCourseModal from "@/components/AddCourseModal";

export type AcademicSection =
  | "deadlines"
  | "schedule"
  | "timetable"
  | "assessments"
  | "performance"
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

  // Reactive courses list
  const [coursesList, setCoursesList] = useState<CourseSummaryItem[]>(courses);
  const [prevCourses, setPrevCourses] = useState(courses);
  if (prevCourses !== courses) {
    setPrevCourses(courses);
    setCoursesList(courses);
  }

  // Ensure each canonical active course appears exactly ONCE (deduplicate by id)
  const activeCoursesMap = new Map<string, CourseSummaryItem>();
  for (const c of coursesList) {
    if (c.active && !activeCoursesMap.has(c.id)) {
      activeCoursesMap.set(c.id, c);
    }
  }
  const activeCourses = Array.from(activeCoursesMap.values());

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
      <AddCourseModal
        isOpen={showAddCourse}
        onClose={() => setShowAddCourse(false)}
        onCourseCreated={(newCourse) => {
          setCoursesList((prev) => [
            ...prev,
            { ...newCourse, attendancePct: null, nextEvent: null },
          ]);
        }}
      />

      {/* LEVEL 1: ACADEMIC CONTROL CENTER */}
      {!activeSection && (
        <div className="space-y-5">
          {/* 1. DATE HEADER */}
          <header className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-100 font-mono">Academics</h1>
              <p className="text-sm text-neutral-400 font-mono mt-0.5">{todayFormatted}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddCourse(true)}
              className="rounded-lg bg-neutral-100 px-3 py-1 font-mono text-sm font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors"
            >
              + Add Course
            </button>
          </header>

          {/* 2. LARGE NEXT IN LINE */}
          <NextInLineCard item={nextInLine} />

          {/* 3. COURSES OVERVIEW (CANONICAL COURSES - NO ATTENDANCE %, NO DUPLICATE NAMES) */}
          <section aria-label="Active Courses" className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between border-b border-neutral-800/70 pb-2">
              <h2 className="font-mono text-sm uppercase tracking-wider text-neutral-300 font-bold">
                My Courses ({activeCourses.length})
              </h2>
              <span className="font-mono text-xs text-neutral-500">Tap a course for details</span>
            </div>

            {activeCourses.length === 0 ? (
              <p className="font-mono text-sm text-neutral-500 py-2">
                No active courses found. Tap &ldquo;+ Add Course&rdquo; above to create your first course.
              </p>
            ) : (
              <div className="divide-y divide-neutral-800/60 font-mono text-sm">
                {activeCourses.map((crs) => (
                  <Link
                    key={crs.id}
                    href={`/academics/courses/${crs.id}`}
                    className="py-2.5 px-2 flex items-center justify-between group hover:bg-neutral-800/30 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-amber-300 group-hover:text-amber-200 transition-colors">
                          {crs.code}
                        </span>
                      </div>
                      {crs.nextEvent && (
                        <span className="text-xs text-neutral-500 block truncate mt-0.5">
                          Next: {crs.nextEvent}
                        </span>
                      )}
                    </div>

                    <span className="text-neutral-500 group-hover:text-neutral-300 text-sm transition-colors">
                      &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 4. ACADEMIC SCHEDULE / TIMETABLE (CANONICAL MON - FRI TIMETABLE) */}
          <section aria-label="Academic Schedule">
            <CanonicalTimetable
              initialClasses={classes}
              courses={courses}
              initialOccurrences={occurrences}
              screenshots={screenshots}
            />
          </section>

          {/* 5. DEDICATED DOORS FOR DEEPER LEDGERS */}
          <section aria-label="Academic Ledgers" className="space-y-1.5 pt-2 border-t border-neutral-800/80">
            <div className="font-mono text-xs uppercase tracking-wider text-neutral-500 font-semibold px-1">
              Academic Ledgers &amp; Records
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <SectionBlock
                href="/academics?section=deadlines"
                onClick={() => selectSection("deadlines")}
                title="Deadlines &amp; Assignments"
                summary={
                  overdueDeadlinesCount > 0
                    ? `${overdueDeadlinesCount} overdue · ${openDeadlines} pending`
                    : `${openDeadlines} pending deadlines`
                }
                tone={overdueDeadlinesCount > 0 ? "warn" : openDeadlines > 0 ? "active" : "good"}
              />

              <SectionBlock
                href="/academics?section=assessments"
                onClick={() => selectSection("assessments")}
                title="Assessments &amp; Scores"
                summary={`${upcomingAssessments} upcoming tests · Marks &amp; targets`}
                tone={upcomingAssessments > 0 ? "active" : "good"}
              />

              <SectionBlock
                href="/academics?section=performance"
                onClick={() => selectSection("performance")}
                title="Performance &amp; Attendance"
                summary="Full attendance records and zone alerts"
                tone="good"
              />
            </div>
          </section>
        </div>
      )}

      {/* LEVEL 2: DEDICATED FULL VIEWS */}
      {activeSection && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 font-mono text-sm text-neutral-400 hover:text-white transition-colors"
            >
              &larr; Back to Academics
            </button>
            <span className="font-mono text-sm font-semibold uppercase tracking-wider text-neutral-300">
              {activeSection === "deadlines"
                ? "Academic Deadlines"
                : activeSection === "schedule" || activeSection === "timetable"
                ? "Academic Timetable"
                : activeSection === "assessments"
                ? "Assessments & Tests"
                : "Course Attendance & Performance"}
            </span>
          </div>

          {activeSection === "schedule" || activeSection === "timetable" ? (
            <div className="space-y-6">
              <CanonicalTimetable
                initialClasses={classes}
                courses={courses}
                initialOccurrences={occurrences}
                screenshots={screenshots}
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
              courses={courses}
              screenshots={screenshots}
            />
          )}
        </div>
      )}
    </>
  );
}
