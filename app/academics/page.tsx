import { createClient } from "@/lib/supabase/server";
import {
  fetchClassesWithAttendance,
  fetchAssessments,
  fetchDeadlines,
  fetchOccurrencesInRange,
} from "@/lib/academics/queries";
import { todayISO, shiftDateISO } from "@/lib/date";
import AcademicsHub, { AcademicsTab } from "@/components/AcademicsHub";
import AcademicScheduleScreenshots from "@/components/AcademicScheduleScreenshots";
import Link from "next/link";
import SectionBlock from "@/components/SectionBlock";

export default async function AcademicsPage(props: {
  searchParams?: Promise<{ tab?: string; section?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="py-12 text-center text-sm text-neutral-500">
        Sign in to view your academics workspace.
      </div>
    );
  }

  const validTabs: AcademicsTab[] = ["assessments", "timetable", "deadlines", "performance", "classes"];
  const requestedTab = searchParams?.tab as AcademicsTab | undefined;
  const requestedSection = searchParams?.section as AcademicsTab | "screenshots" | undefined;
  const activeSection = requestedSection ?? (requestedTab && validTabs.includes(requestedTab) ? requestedTab : undefined);

  if (!activeSection) {
    const [classesCount, assessmentsCount, deadlinesCount, screenshotsCount] = await Promise.all([
      supabase.from("classes").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("active", true),
      supabase.from("assessments").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "completed"),
      supabase.from("deadlines").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "completed"),
      supabase.from("academic_schedule_screenshots").select("kind", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    const activeClasses = classesCount.count ?? 0;
    const upcomingAssessments = assessmentsCount.count ?? 0;
    const openDeadlines = deadlinesCount.count ?? 0;
    const screenshots = screenshotsCount.count ?? 0;

    return <div className="space-y-5"><header className="flex items-center justify-between"><div><h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Academics</h1><p className="text-xs text-neutral-400">Integrated workspace for tests, timetable &amp; grades</p></div></header><section aria-label="Academic sections">
      <SectionBlock href="/academics?section=assessments" title="Academic Overview" summary={`${upcomingAssessments} assessments and ${openDeadlines} open deadlines`} tone="active" />
      <SectionBlock href="/academics?section=classes" title="Classes & Attendance" summary={`${activeClasses} active classes`} />
      <SectionBlock href="/academics?section=assessments" title="Assessments" summary={`${upcomingAssessments} upcoming or unscored`} tone={upcomingAssessments ? "warn" : "good"} />
      <SectionBlock href="/academics?section=deadlines" title="Deadlines" summary={`${openDeadlines} open deadlines`} tone={openDeadlines ? "warn" : "good"} />
      <SectionBlock href="/academics?section=performance" title="Scores & Performance" summary="Assessment scores and progress" />
      <SectionBlock href="/academics?section=timetable" title="Timetable / Schedule" summary="Classes and weekly timetable" />
      <SectionBlock href="/academics?section=screenshots" title="Schedule Screenshots" summary={`${screenshots} reference documents`} />
    </section></div>;
  }

  const today = todayISO();
  const nextMonth = shiftDateISO(today, 30);

  // Parallel fetch of all academic resources in a single server roundtrip
  const [classes, assessments, deadlines, occurrences, screenshotRows] = await Promise.all([
    fetchClassesWithAttendance(user.id),
    fetchAssessments(user.id),
    fetchDeadlines(user.id),
    fetchOccurrencesInRange(user.id, today, nextMonth).catch(() => []),
    supabase.from("academic_schedule_screenshots").select("kind, storage_path").eq("user_id", user.id),
  ]);

  const screenshots = await Promise.all((screenshotRows.data ?? []).map(async (row) => {
    const { data } = await supabase.storage.from("academic-schedule-screenshots").createSignedUrl(row.storage_path, 60 * 60);
    return { kind: row.kind as "timetable" | "quiz_schedule" | "exam_schedule" | "other", url: data?.signedUrl ?? null };
  }));

  const defaultTab = activeSection && activeSection !== "screenshots" ? activeSection : "assessments";

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Academics</h1>
          <p className="text-xs text-neutral-400">Integrated workspace for tests, timetable &amp; grades</p>
        </div>
      </header>

      {activeSection && activeSection !== "screenshots" && <section className="space-y-4"><Link href="/academics" className="section-detail-back">← Back to Academics</Link><AcademicsHub
        initialClasses={classes}
        initialAssessments={assessments}
        initialDeadlines={deadlines}
        initialOccurrences={occurrences}
        defaultTab={defaultTab}
      /></section>}
      {activeSection === "screenshots" && <section className="space-y-4"><Link href="/academics" className="section-detail-back">← Back to Academics</Link><AcademicScheduleScreenshots initialDocuments={screenshots} /></section>}
    </div>
  );
}

