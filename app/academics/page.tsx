import { createClient } from "@/lib/supabase/server";
import {
  fetchClassesWithAttendance,
  fetchAssessments,
  fetchDeadlines,
  fetchOccurrencesInRange,
} from "@/lib/academics/queries";
import { fetchCourses } from "@/lib/courses/queries";
import { todayISO, shiftDateISO } from "@/lib/date";
import type { AcademicsTab } from "@/components/AcademicsHub";
import AcademicsSectionManager, {
  type AcademicSection,
  type CourseSummaryItem,
} from "@/components/AcademicsSectionManager";
import { resolveAcademicsNextInLine, type AcademicCandidateEvent } from "@/lib/nextInLine";
import { computeAttendanceStats, type AttendanceInput } from "@/lib/academics/engine";

export default async function AcademicsPage(props: {
  searchParams?: Promise<{ tab?: string; section?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;


  const validTabs: AcademicsTab[] = ["assessments", "timetable", "deadlines", "performance"];
  const requestedTab = searchParams?.tab as AcademicsTab | undefined;
  const requestedSection = searchParams?.section as AcademicSection | undefined;
  const activeSection = requestedSection ?? (requestedTab && validTabs.includes(requestedTab) ? requestedTab : undefined);

  const today = todayISO();
  const weekStart = shiftDateISO(today, -3);
  const weekEnd = shiftDateISO(today, 14);

  // Parallel fetch: classes with computed attendance, assessments, deadlines, occurrences, courses
  const [classes, assessments, deadlines, occurrences, coursesRaw, allOccurrencesRes, screenshotsRes] =
    await Promise.all([
      fetchClassesWithAttendance(user.id),
      fetchAssessments(user.id),
      fetchDeadlines(user.id),
      fetchOccurrencesInRange(user.id, weekStart, weekEnd),
      fetchCourses(user.id),
      supabase
        .from("class_occurrences")
        .select("course_id, attendance_status, status")
        .eq("user_id", user.id),
      supabase
        .from("academic_schedule_screenshots")
        .select("kind, storage_path")
        .eq("user_id", user.id),
    ]);

  const screenshots = await Promise.all(
    (screenshotsRes.data ?? []).map(async (row) => {
      const { data } = await supabase.storage
        .from("academic-schedule-screenshots")
        .createSignedUrl(row.storage_path, 60 * 60);
      return {
        kind: row.kind as "timetable" | "quiz_schedule" | "exam_schedule" | "other",
        url: data?.signedUrl ?? null,
      };
    })
  );

  // Map occurrences by course_id for attendance
  const occsByCourse = new Map<string, AttendanceInput[]>();
  const rawAllOccs = (allOccurrencesRes.data ?? []) as {
    course_id: string | null;
    attendance_status: AttendanceInput["attendance_status"];
    status?: AttendanceInput["status"];
  }[];
  for (const o of rawAllOccs) {
    if (o.course_id) {
      const list = occsByCourse.get(o.course_id) ?? [];
      list.push({
        attendance_status: o.attendance_status,
        status: o.status,
      });
      occsByCourse.set(o.course_id, list);
    }
  }

  // Next event per course
  const nextEventByCourse = new Map<string, string>();
  const upcomingAssessments = assessments.filter(
    (a) => a.date >= today && a.status !== "completed"
  );
  for (const a of upcomingAssessments) {
    if (a.course_id && !nextEventByCourse.has(a.course_id)) {
      nextEventByCourse.set(a.course_id, `${a.title} (${a.date.slice(5)})`);
    }
  }
  const upcomingDeadlines = deadlines.filter(
    (d) => d.due_date >= today && d.status !== "completed"
  );
  for (const d of upcomingDeadlines) {
    if (d.course_id && !nextEventByCourse.has(d.course_id)) {
      nextEventByCourse.set(d.course_id, `${d.title} (Due ${d.due_date.slice(5)})`);
    }
  }

  // Build CourseSummaryItems
  const courses: CourseSummaryItem[] = coursesRaw.map((crs) => {
    const occs = occsByCourse.get(crs.id) ?? [];
    const stats = computeAttendanceStats(occs, crs.attendance_target);
    return {
      ...crs,
      attendancePct: stats.percentage,
      nextEvent: nextEventByCourse.get(crs.id) ?? null,
    };
  });

  // Next in Line shared candidate events
  const academicEvents: AcademicCandidateEvent[] = [
    ...assessments.map((a) => ({
      id: a.id,
      course_id: a.course_id,
      title: a.title,
      date: a.date,
      time: null,
      type: (a.type as AcademicCandidateEvent["type"]) ?? "assessment",
      status: a.status,
    })),
    ...deadlines.map((d) => ({
      id: d.id,
      course_id: d.course_id,
      title: d.title,
      date: d.due_date,
      time: null,
      type: "deadline" as const,
      status: d.status,
    })),
  ];

  const nextInLine = resolveAcademicsNextInLine(
    academicEvents,
    coursesRaw.map((c) => ({ id: c.id, code: c.code, name: c.name, active: c.active })),
    today
  );

  return (
    <div className="space-y-4">
      <AcademicsSectionManager
        initialSection={activeSection}
        courses={courses}
        nextInLine={nextInLine}
        classes={classes}
        assessments={assessments}
        deadlines={deadlines}
        occurrences={occurrences}
        screenshots={screenshots}
      />
    </div>
  );
}
