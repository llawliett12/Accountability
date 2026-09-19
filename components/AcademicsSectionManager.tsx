"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SectionBlock from "@/components/SectionBlock";
import AcademicsHub, { type AcademicsTab } from "@/components/AcademicsHub";
import AcademicScheduleScreenshots from "@/components/AcademicScheduleScreenshots";
import type { ClassWithAttendance } from "@/lib/academics/queries";
import type { Assessment, Deadline, ClassOccurrence } from "@/lib/academics/types";
import type { AcademicScreenshotKind } from "@/lib/academics/screenshot-actions";

export type AcademicSection =
  | "deadlines"
  | "schedule"
  | "assessments"
  | "performance"
  | "classes"
  | "timetable"
  | "screenshots";

interface AcademicsSectionManagerProps {
  initialSection?: AcademicSection | null;
  classes: ClassWithAttendance[];
  assessments: Assessment[];
  deadlines: Deadline[];
  occurrences: ClassOccurrence[];
  screenshots: { kind: AcademicScreenshotKind; url: string | null }[];
}

export default function AcademicsSectionManager({
  initialSection = null,
  classes,
  assessments,
  deadlines,
  occurrences,
  screenshots,
}: AcademicsSectionManagerProps) {
  const [activeSection, setActiveSection] = useState<AcademicSection | null>(initialSection);
  const [prevInitial, setPrevInitial] = useState(initialSection);
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

  const activeClasses = classes.filter((c) => c.active);
  const activeClassesCount = activeClasses.length;
  const upcomingAssessments = assessments.filter((a) => a.status !== "completed").length;
  const openDeadlines = deadlines.filter((d) => d.status !== "completed").length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueDeadlinesCount = deadlines.filter(
    (d) => d.status !== "completed" && d.due_date && d.due_date < todayStr
  ).length;

  const scoredAssessments = assessments.filter(
    (a) => a.score !== null && a.max_score !== null && a.max_score > 0
  );
  const scoredCount = scoredAssessments.length;
  const averageScorePct =
    scoredCount > 0
      ? Math.round(
          scoredAssessments.reduce(
            (acc, a) => acc + (a.score! / a.max_score!) * 100,
            0
          ) / scoredCount
        )
      : null;

  const trackedClasses = classes.filter(
    (c) => c.attendance && c.attendance.trackedCount > 0 && c.attendance.percentage !== null
  );
  const overallAttendancePct =
    trackedClasses.length > 0
      ? Math.round(
          trackedClasses.reduce((acc, c) => acc + (c.attendance.percentage ?? 0), 0) /
            trackedClasses.length
        )
      : null;
  const attendanceAlert = trackedClasses.some(
    (c) => c.attendance.percentage !== null && c.attendance.percentage < (c.attendance_target ?? 75)
  );

  const nextOcc = occurrences.find((o) => o.status !== "cancelled");
  const nextClassText = nextOcc
    ? `${nextOcc.start_time ? nextOcc.start_time.slice(0, 5) : ""} Class`
    : null;

  const defaultTab: AcademicsTab =
    activeSection === "deadlines"
      ? "deadlines"
      : activeSection === "schedule" || activeSection === "timetable"
      ? "timetable"
      : activeSection === "performance" || activeSection === "classes"
      ? "performance"
      : "assessments";

  return (
    <>
      {/* LEVEL 1: MINIMAL ACADEMIC CONTROL CENTER */}
      {!activeSection && (
        <div className="space-y-4">
          {/* ACADEMIC PULSE OVERVIEW STRIP */}
          <section className="overview-ledger rounded-xl border border-neutral-800/80">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-neutral-800/80 font-mono text-xs">
              <div className="p-3">
                <span className="text-[10px] uppercase text-neutral-500 block">Upcoming</span>
                <span className="text-base font-bold text-neutral-100">
                  {upcomingAssessments + openDeadlines}
                </span>
                <span className="text-[10px] text-neutral-400 ml-1.5 font-mono">
                  ({upcomingAssessments} test, {openDeadlines} due)
                </span>
              </div>
              <div className="p-3">
                <span className="text-[10px] uppercase text-neutral-500 block">Attendance</span>
                <span
                  className={`text-base font-bold ${
                    attendanceAlert ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {overallAttendancePct !== null ? `${overallAttendancePct}%` : "--"}
                </span>
              </div>
              <div className="p-3">
                <span className="text-[10px] uppercase text-neutral-500 block">Next Class</span>
                <span className="text-xs font-medium text-amber-300 truncate block pt-0.5">
                  {nextClassText ?? "None scheduled"}
                </span>
              </div>
              <div className="p-3">
                <span className="text-[10px] uppercase text-neutral-500 block">Performance</span>
                <span className="text-xs text-neutral-300 truncate block pt-0.5">
                  {averageScorePct !== null ? `${averageScorePct}% avg` : "Tracking active"}
                </span>
              </div>
            </div>
          </section>

          {/* 4 CLEAR NAVIGATION DOORS */}
          <section aria-label="Academic navigation" className="space-y-1">
            <SectionBlock
              href="/academics?section=deadlines"
              onClick={() => selectSection("deadlines")}
              title="Deadlines"
              summary={
                openDeadlines > 0
                  ? `${openDeadlines} open deadline${openDeadlines > 1 ? "s" : ""}${
                      overdueDeadlinesCount > 0 ? ` · ${overdueDeadlinesCount} overdue` : ""
                    }`
                  : "No open deadlines"
              }
              tone={overdueDeadlinesCount > 0 ? "warn" : openDeadlines > 0 ? "active" : "good"}
            />
            <SectionBlock
              href="/academics?section=schedule"
              onClick={() => selectSection("schedule")}
              title="Schedule"
              summary={
                nextClassText
                  ? `Next: ${nextClassText} · Weekly timetable & reference documents`
                  : "Weekly timetable & schedule reference documents"
              }
              tone="neutral"
            />
            <SectionBlock
              href="/academics?section=assessments"
              onClick={() => selectSection("assessments")}
              title="Assessments"
              summary={
                upcomingAssessments > 0
                  ? `${upcomingAssessments} upcoming assessment${upcomingAssessments > 1 ? "s" : ""}`
                  : "All assessments scored & completed"
              }
              tone={upcomingAssessments > 0 ? "active" : "good"}
            />
            <SectionBlock
              href="/academics?section=performance"
              onClick={() => selectSection("performance")}
              title="Performance / Attendance"
              summary={`${activeClassesCount} active subjects · ${
                overallAttendancePct !== null ? `${overallAttendancePct}% attendance` : "Tracking"
              }`}
              tone={attendanceAlert ? "warn" : "good"}
            />
          </section>
        </div>
      )}

      {/* LEVEL 2: DEDICATED DETAIL VIEWS */}
      {activeSection && activeSection !== "screenshots" && (
        <section className="space-y-3">
          <Link
            href="/academics"
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Academics
          </Link>
          <AcademicsHub
            initialClasses={classes}
            initialAssessments={assessments}
            initialDeadlines={deadlines}
            initialOccurrences={occurrences}
            defaultTab={defaultTab}
          />
        </section>
      )}

      {/* LEVEL 2: SCHEDULE SCREENSHOTS VIEW */}
      {activeSection === "screenshots" && (
        <section className="space-y-3">
          <Link
            href="/academics"
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Academics
          </Link>
          <AcademicScheduleScreenshots initialDocuments={screenshots} />
        </section>
      )}
    </>
  );
}
