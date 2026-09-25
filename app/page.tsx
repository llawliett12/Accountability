import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import type { Task } from "@/lib/types";
import type { Course, ClassDef, ClassOccurrence } from "@/lib/academics/types";
import HomeSectionManager, { type HomeSection } from "@/components/HomeSectionManager";
import {
  resolveHomeNextInLine,
  type AcademicCandidateEvent,
  type GoalCandidate,
  type TaskCandidate,
} from "@/lib/nextInLine";
import { activeSessionCutoff, focusSessionTitle, type ActiveFocusSession } from "@/lib/focus";
import type { AcademicScheduleItem } from "@/components/TodayAcademicSchedule";
import { fetchNotes } from "@/lib/notes/queries";
import { getCachedSignedUrl } from "@/lib/storage/signedUrlCache";

export default async function MorningDashboard(props: {
  searchParams?: Promise<{ date?: string; section?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = todayISO();
  const date = searchParams?.date || today;
  const section = searchParams?.section as HomeSection | undefined;
  const userId = user?.id ?? "";

  // Compute weekday for the selected date (0 = Sunday .. 6 = Saturday)
  const targetDateObj = new Date(date + "T00:00:00Z");
  const dayOfWeek = targetDateObj.getUTCDay();

  // Only the columns Home actually uses (Next in Line + the task→goal picker).
  type HomeGoal = {
    id: string;
    course_id: string | null;
    level: string;
    title: string;
    due_date: string | null;
    priority: number;
    status: string;
  };

  // Parallel fetch for Home
  const [
    planRes,
    coursesRes,
    classesRes,
    occurrencesRes,
    assessmentsRes,
    deadlinesRes,
    goalsRes,
    activeSessionRes,
    timetableScreenshotRes,
    homeNotes,
    journalNotes,
  ] = await Promise.all([
    supabase
      .from("daily_plans")
      .select(
        "id, tasks(id, daily_plan_id, user_id, title, category, priority, planned_duration_min, planned_start, planned_end, deadline, notes, status, goal_id, course_id)"
      )
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle(),

    supabase
      .from("courses")
      .select("id, code, name, active")
      .eq("user_id", userId),

    supabase
      .from("classes")
      .select("id, course_id, name, subject, day_of_week, start_time, end_time, location, slot_type, active")
      .eq("user_id", userId)
      .eq("day_of_week", dayOfWeek)
      .eq("active", true),

    supabase
      .from("class_occurrences")
      .select("id, class_id, course_id, date, start_time, end_time, status, attendance_status, is_extra, notes")
      .eq("user_id", userId)
      .eq("date", date),

    supabase
      .from("assessments")
      .select("id, course_id, class_id, title, type, date, score, max_score, status")
      .eq("user_id", userId)
      .gte("date", today)
      .neq("status", "completed"),

    supabase
      .from("deadlines")
      .select("id, course_id, class_id, title, due_date, status, category")
      .eq("user_id", userId)
      .gte("due_date", today)
      .neq("status", "completed"),

    supabase
      .from("goals")
      .select("id, course_id, level, title, due_date, priority, status")
      .eq("user_id", userId)
      .neq("status", "completed")
      .neq("status", "abandoned"),

    // Focus Sessions are the single source of truth for "what I'm doing right now".
    supabase
      .from("focus_sessions")
      .select("id, label, started_at, tasks(title), assessments(title)")
      .eq("user_id", userId)
      .is("ended_at", null)
      .gte("started_at", activeSessionCutoff())
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("academic_schedule_screenshots")
      .select("storage_path")
      .eq("user_id", userId)
      .eq("kind", "timetable")
      .maybeSingle(),

    fetchNotes(userId, { category: "general" }),
    fetchNotes(userId, { category: "journal" }),
  ]);

  const weeklyTimetableImageUrl = timetableScreenshotRes?.data?.storage_path
    ? await getCachedSignedUrl(
        supabase,
        "academic-schedule-screenshots",
        timetableScreenshotRes.data.storage_path,
        60 * 60
      )
    : null;

  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  // Active courses map
  const courses = (coursesRes.data ?? []) as Course[];
  const courseCodeMap: Record<string, string> = {};
  const courseMap = new Map<string, Course>();
  for (const c of courses) {
    courseCodeMap[c.id] = c.code;
    courseMap.set(c.id, c);
  }

  // 1. Next in Line shared candidate events
  const academicEvents: AcademicCandidateEvent[] = [
    ...(assessmentsRes.data ?? []).map((a) => ({
      id: a.id,
      course_id: a.course_id,
      title: a.title,
      date: a.date,
      time: null,
      type: (a.type as AcademicCandidateEvent["type"]) ?? "assessment",
      status: a.status,
    })),
    ...(deadlinesRes.data ?? []).map((d) => ({
      id: d.id,
      course_id: d.course_id,
      title: d.title,
      date: d.due_date,
      time: null,
      type: "deadline" as const,
      status: d.status,
    })),
  ];

  const allGoals = (goalsRes.data ?? []) as HomeGoal[];
  const goalCandidates: GoalCandidate[] = allGoals.map((g) => ({
    id: g.id,
    title: g.title,
    due_date: g.due_date,
    priority: g.priority,
    status: g.status,
    course_id: g.course_id,
  }));

  // Tasks for the selected day (client sorts them; open tasks first, P1 → P5)
  const tasks = (planRes.data?.tasks as unknown as Task[]) ?? [];
  const taskCandidates: TaskCandidate[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority ?? 3,
    status: t.status,
    deadline: t.deadline,
  }));

  const nextInLine = resolveHomeNextInLine(
    academicEvents,
    courses.map((c) => ({ id: c.id, code: c.code, name: c.name, active: c.active })),
    goalCandidates,
    date,
    7,
    taskCandidates
  );

  // 2. Today's Academic Schedule
  const recurringSlots = (classesRes.data ?? []) as ClassDef[];
  const occurrences = (occurrencesRes.data ?? []) as ClassOccurrence[];
  const occurrenceByClassId = new Map<string, ClassOccurrence>();
  const extraOccurrences: ClassOccurrence[] = [];

  for (const occ of occurrences) {
    if (occ.is_extra) {
      extraOccurrences.push(occ);
    } else if (occ.class_id) {
      occurrenceByClassId.set(occ.class_id, occ);
    }
  }

  const academicSchedule: AcademicScheduleItem[] = [];

  // Add recurring classes
  for (const slot of recurringSlots) {
    const occ = occurrenceByClassId.get(slot.id);
    const course = slot.course_id ? courseMap.get(slot.course_id) : undefined;
    const courseCode = course?.code ?? slot.name;
    const courseName = course?.name ?? slot.subject ?? slot.name;

    academicSchedule.push({
      id: occ?.id ?? slot.id,
      courseId: slot.course_id ?? slot.id,
      courseCode,
      courseName,
      slotType: slot.slot_type ?? "lecture",
      startTime: occ?.start_time ?? slot.start_time,
      endTime: occ?.end_time ?? slot.end_time,
      location: slot.location,
      status: occ?.status ?? "scheduled",
      isExtra: false,
    });
  }

  // Add extra classes occurring today
  for (const extra of extraOccurrences) {
    const course = extra.course_id ? courseMap.get(extra.course_id) : undefined;
    const courseCode = course?.code ?? "Extra Class";
    const courseName = course?.name ?? "Extra Class";

    academicSchedule.push({
      id: extra.id,
      courseId: extra.course_id ?? extra.id,
      courseCode,
      courseName,
      slotType: "extra",
      startTime: extra.start_time ?? "09:00:00",
      endTime: extra.end_time ?? "10:00:00",
      location: null,
      status: extra.status ?? "scheduled",
      isExtra: true,
    });
  }

  // Sort schedule chronologically
  academicSchedule.sort((a, b) => a.startTime.localeCompare(b.startTime));

  // 3. Any active goal can be linked to a task
  const linkableGoals = allGoals.map((g) => ({ id: g.id, title: g.title, level: g.level }));

  // 4. What I'm doing right now
  const activeRow = activeSessionRes?.data as unknown as
    | {
        id: string;
        label: string | null;
        started_at: string;
        tasks?: { title?: string | null } | { title?: string | null }[] | null;
        assessments?: { title?: string | null } | { title?: string | null }[] | null;
      }
    | null;
  const activeSession: ActiveFocusSession | null = activeRow
    ? {
        id: activeRow.id,
        label: activeRow.label,
        title: focusSessionTitle(activeRow),
        started_at: activeRow.started_at,
      }
    : null;

  return (
    <HomeSectionManager
      date={date}
      today={today}
      initialSection={section}
      tasks={tasks}
      linkableGoals={linkableGoals}
      courseCodeMap={courseCodeMap}
      activeSession={activeSession}
      academicSchedule={academicSchedule}
      weeklyTimetableImageUrl={weeklyTimetableImageUrl}
      isWeekday={isWeekday}
      nextInLine={nextInLine}
      homeNotes={homeNotes}
      journalNotes={journalNotes}
    />
  );
}
