import { createClient } from "@/lib/supabase/server";
import { shiftDateISO, todayISO } from "@/lib/date";
import type { ScheduleItem } from "@/components/ScheduleTable";
import type { ActivityEntry } from "@/components/ActivityLedger";
import type { Task } from "@/lib/types";
import type { Goal } from "@/lib/goals/types";
import type { Course, ClassDef, ClassOccurrence } from "@/lib/academics/types";
import HomeSectionManager, { type HomeSection } from "@/components/HomeSectionManager";
import {
  resolveHomeNextInLine,
  type AcademicCandidateEvent,
  type GoalCandidate,
} from "@/lib/nextInLine";
import type { AcademicScheduleItem } from "@/components/TodayAcademicSchedule";
import { fetchNotes } from "@/lib/notes/queries";

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

  const gridStart = shiftDateISO(date, -83);

  // Parallel fetch for Home
  const [
    planRes,
    coursesRes,
    classesRes,
    occurrencesRes,
    assessmentsRes,
    deadlinesRes,
    goalsRes,
    checkInsRes,
    verdictRes,
    streaksRes,
    gridPlansRes,
    scoreRes,
    timetableScreenshotRes,
    homeNotes,
  ] = await Promise.all([
    supabase
      .from("daily_plans")
      .select(
        "id, tasks(id, daily_plan_id, user_id, title, category, priority, planned_duration_min, planned_start, planned_end, deadline, notes, status, is_top3, goal_id, course_id)"
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
      .select("id, user_id, parent_id, course_id, level, title, description, start_date, due_date, priority, is_top3, status, progress, target_value, current_value, manual_progress, created_at, updated_at")
      .eq("user_id", userId)
      .neq("status", "completed")
      .neq("status", "abandoned"),

    supabase
      .from("check_ins")
      .select("id, actual_activity, drift_state, timestamp, status, completed_at, entry_type")
      .eq("user_id", userId)
      .eq("entry_type", "work")
      .in("status", ["ongoing", "paused"])
      .order("timestamp", { ascending: false })
      .limit(5),

    supabase
      .from("discipline_verdicts")
      .select("label, explanation")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("streaks")
      .select("streak_type, current_count")
      .eq("user_id", userId),

    supabase
      .from("daily_plans")
      .select("date, tasks(status)")
      .eq("user_id", userId)
      .gte("date", gridStart)
      .lte("date", date)
      .order("date", { ascending: true }),

    supabase
      .from("discipline_scores")
      .select("date, score")
      .eq("user_id", userId)
      .gte("date", gridStart)
      .lte("date", date),

    supabase
      .from("academic_schedule_screenshots")
      .select("storage_path")
      .eq("user_id", userId)
      .eq("kind", "timetable")
      .maybeSingle(),

    fetchNotes(userId, { category: "general" }),
  ]);

  let weeklyTimetableImageUrl: string | null = null;
  if (timetableScreenshotRes?.data?.storage_path) {
    const { data: signedData } = await supabase.storage
      .from("academic-schedule-screenshots")
      .createSignedUrl(timetableScreenshotRes.data.storage_path, 60 * 60);
    weeklyTimetableImageUrl = signedData?.signedUrl ?? null;
  }

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

  const allGoals = (goalsRes.data ?? []) as Goal[];
  const goalCandidates: GoalCandidate[] = allGoals.map((g) => ({
    id: g.id,
    title: g.title,
    due_date: g.due_date,
    priority: g.priority,
    status: g.status,
    course_id: g.course_id,
  }));

  const nextInLine = resolveHomeNextInLine(
    academicEvents,
    courses.map((c) => ({ id: c.id, code: c.code, name: c.name, active: c.active })),
    goalCandidates,
    date,
    7
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

  // Schedule items for deep ScheduleTable
  const scheduleItems: ScheduleItem[] = academicSchedule.map((item) => ({
    id: item.id,
    type: "class",
    title: `${item.courseCode} · ${item.slotType}`,
    subtitle: item.location ?? undefined,
    start_time: item.startTime,
    end_time: item.endTime,
    attendance_status: (occurrences.find((o) => o.id === item.id)?.attendance_status as ScheduleItem["attendance_status"]) ?? null,
  }));

  // 3. Things To Be Done: Top 3 Goals
  const top3Goals = allGoals
    .filter((g) => g.is_top3)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  // Tasks
  const rawTasks = (planRes.data?.tasks as unknown as Task[]) ?? [];
  const tasks = [...rawTasks].sort((a, b) => {
    if (a.is_top3 && !b.is_top3) return -1;
    if (!a.is_top3 && b.is_top3) return 1;
    return (a.priority ?? 3) - (b.priority ?? 3);
  });

  // Streaks & discipline
  const maxStreak = (streaksRes.data ?? []).reduce(
    (max, s) => Math.max(max, s.current_count),
    0
  );
  const currentStreak = (streaksRes.data ?? []).reduce(
    (max, s) => Math.max(max, s.current_count),
    0
  );
  const verdict = verdictRes.data;

  // Grid
  const scoreByDate = new Map(
    (scoreRes.data ?? []).map((row) => [row.date, row.score as number | null])
  );
  const gridDays = (gridPlansRes.data ?? []).map((plan) => {
    const planTasks = (plan.tasks ?? []) as { status: string }[];
    return {
      date: plan.date,
      planned: planTasks.length,
      completed: planTasks.filter((task) => task.status === "completed").length,
      score: scoreByDate.get(plan.date) ?? null,
    };
  });

  const checkIns = (checkInsRes.data ?? []) as ActivityEntry[];

  return (
    <HomeSectionManager
      date={date}
      today={today}
      initialSection={section}
      tasks={tasks}
      top3Goals={top3Goals}
      courseCodeMap={courseCodeMap}
      checkIns={checkIns}
      academicSchedule={academicSchedule}
      weeklyTimetableImageUrl={weeklyTimetableImageUrl}
      isWeekday={isWeekday}
      nextInLine={nextInLine}
      gridDays={gridDays}
      currentStreak={currentStreak}
      maxStreak={maxStreak}
      scheduleItems={scheduleItems}
      verdict={verdict}
      homeNotes={homeNotes}
    />
  );
}
