"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SectionBlock from "@/components/SectionBlock";
import AcademicsHub, { type AcademicsTab } from "@/components/AcademicsHub";
import AcademicScheduleScreenshots from "@/components/AcademicScheduleScreenshots";
import type { ClassWithAttendance } from "@/lib/academics/queries";
import type { Assessment, Deadline, ClassOccurrence } from "@/lib/academics/types";
import type { AcademicScreenshotKind } from "@/lib/academics/screenshot-actions";

type AcademicSection = AcademicsTab | "screenshots";

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

  const activeClassesCount = classes.filter((c) => c.active).length;
  const upcomingAssessments = assessments.filter((a) => a.status !== "completed").length;
  const openDeadlines = deadlines.filter((d) => d.status !== "completed").length;

  const defaultTab: AcademicsTab =
    activeSection && activeSection !== "screenshots" ? activeSection : "assessments";

  return (
    <>
      {/* SECTION BLOCKS LANDING VIEW */}
      {!activeSection && (
        <section aria-label="Academic sections">
          <SectionBlock
            href="/academics?section=assessments"
            onClick={() => selectSection("assessments")}
            title="Academic Overview"
            summary={`${upcomingAssessments} assessments and ${openDeadlines} open deadlines`}
            tone="active"
          />
          <SectionBlock
            href="/academics?section=classes"
            onClick={() => selectSection("classes")}
            title="Classes & Attendance"
            summary={`${activeClassesCount} active classes`}
          />
          <SectionBlock
            href="/academics?section=assessments"
            onClick={() => selectSection("assessments")}
            title="Assessments"
            summary={`${upcomingAssessments} upcoming or unscored`}
            tone={upcomingAssessments ? "warn" : "good"}
          />
          <SectionBlock
            href="/academics?section=deadlines"
            onClick={() => selectSection("deadlines")}
            title="Deadlines"
            summary={`${openDeadlines} open deadlines`}
            tone={openDeadlines ? "warn" : "good"}
          />
          <SectionBlock
            href="/academics?section=performance"
            onClick={() => selectSection("performance")}
            title="Scores & Performance"
            summary="Assessment scores and progress"
          />
          <SectionBlock
            href="/academics?section=timetable"
            onClick={() => selectSection("timetable")}
            title="Timetable / Schedule"
            summary="Classes and weekly timetable"
          />
          <SectionBlock
            href="/academics?section=screenshots"
            onClick={() => selectSection("screenshots")}
            title="Schedule Screenshots"
            summary={`${screenshots.length} reference documents`}
          />
        </section>
      )}

      {/* SECTION DETAIL: CORE ACADEMIC TABS */}
      {activeSection && activeSection !== "screenshots" && (
        <section className="space-y-4">
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

      {/* SECTION DETAIL: SCHEDULE SCREENSHOTS */}
      {activeSection === "screenshots" && (
        <section className="space-y-4">
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
