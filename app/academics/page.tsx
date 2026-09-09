import { createClient } from "@/lib/supabase/server";
import {
  fetchClassesWithAttendance,
  fetchAssessments,
  fetchDeadlines,
  fetchOccurrencesInRange,
} from "@/lib/academics/queries";
import { todayISO, shiftDateISO } from "@/lib/date";
import { AcademicsTab } from "@/components/AcademicsHub";
import AcademicsSectionManager from "@/components/AcademicsSectionManager";

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

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Academics</h1>
          <p className="text-xs text-neutral-400">Integrated workspace for tests, timetable &amp; grades</p>
        </div>
      </header>

      <AcademicsSectionManager
        initialSection={activeSection}
        classes={classes}
        assessments={assessments}
        deadlines={deadlines}
        occurrences={occurrences}
        screenshots={screenshots}
      />
    </div>
  );
}
