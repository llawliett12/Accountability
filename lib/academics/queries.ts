import { createClient } from "@/lib/supabase/server";
import {
  computeAttendanceStats,
  isDeadlineOverdue,
  isAssessmentPast,
  summarizePrepReview,
  averageAssessmentPercentage,
  type AttendanceStats,
} from "./engine";
import { todayISO } from "@/lib/date";
import type { ClassDef, ClassOccurrence, Assessment, Deadline } from "./types";

export async function fetchClasses(userId: string): Promise<ClassDef[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("user_id", userId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClassDef[];
}

export async function fetchOccurrencesInRange(
  userId: string,
  startISO: string,
  endISO: string
): Promise<ClassOccurrence[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_occurrences")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startISO)
    .lte("date", endISO)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClassOccurrence[];
}

export interface ClassWithAttendance extends ClassDef {
  attendance: AttendanceStats;
}

// One query for classes + one for all their occurrences, then the pure
// engine computes attendance % per class in memory — same two-query shape
// as fetchGoalsWithProgress.
export async function fetchClassesWithAttendance(userId: string): Promise<ClassWithAttendance[]> {
  const supabase = await createClient();
  const classes = await fetchClasses(userId);
  const classIds = classes.map((c) => c.id);

  const { data: occurrences } = classIds.length
    ? await supabase
        .from("class_occurrences")
        .select("class_id, attendance_status")
        .in("class_id", classIds)
    : { data: [] };

  const byClass = new Map<string, { attendance_status: ClassOccurrence["attendance_status"] }[]>();
  for (const o of occurrences ?? []) {
    const list = byClass.get(o.class_id) ?? [];
    list.push({ attendance_status: o.attendance_status });
    byClass.set(o.class_id, list);
  }

  return classes.map((c) => ({
    ...c,
    attendance: computeAttendanceStats(byClass.get(c.id) ?? [], c.attendance_target),
  }));
}

export async function fetchClassById(
  userId: string,
  classId: string
): Promise<ClassWithAttendance | null> {
  const all = await fetchClassesWithAttendance(userId);
  return all.find((c) => c.id === classId) ?? null;
}

export async function fetchOccurrencesForClass(
  userId: string,
  classId: string
): Promise<ClassOccurrence[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_occurrences")
    .select("*")
    .eq("user_id", userId)
    .eq("class_id", classId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClassOccurrence[];
}

export async function fetchAssessments(userId: string): Promise<Assessment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Assessment[];
}

export async function fetchAssessmentById(
  userId: string,
  id: string
): Promise<Assessment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Assessment) ?? null;
}

export async function fetchDeadlines(userId: string): Promise<Deadline[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deadlines")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Deadline[];
}

// ---------- dashboard aggregate ----------

export interface AcademicDashboardData {
  nextOccurrence: (ClassOccurrence & { className: string }) | null;
  todayOccurrences: (ClassOccurrence & { className: string })[];
  upcomingAssessments: Assessment[];
  recentScoredAssessments: (Assessment & { className?: string | null })[];
  overdueDeadlines: Deadline[];
  upcomingDeadlines: Deadline[];
  prepReview: ReturnType<typeof summarizePrepReview>;
  averageScorePct: number | null;
  attendanceZones: ClassWithAttendance[];
}

export async function fetchAcademicDashboard(userId: string): Promise<AcademicDashboardData> {
  const supabase = await createClient();
  const today = todayISO();
  const now = new Date();
  const nowTime = now.toTimeString().slice(0, 8);

  const [
    classes,
    { data: upcomingOccRaw },
    assessments,
    deadlines,
    { data: recentOccForPrep },
  ] = await Promise.all([
    fetchClassesWithAttendance(userId),
    supabase
      .from("class_occurrences")
      .select("*")
      .eq("user_id", userId)
      .gte("date", today)
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(20),
    fetchAssessments(userId),
    fetchDeadlines(userId),
    supabase
      .from("class_occurrences")
      .select("prepared, reviewed, status")
      .eq("user_id", userId)
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(30),
  ]);

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  const upcomingOcc = (upcomingOccRaw ?? []) as ClassOccurrence[];
  const withNames = upcomingOcc.map((o) => ({ ...o, className: classNameById.get(o.class_id) ?? "Class" }));

  const todayOccurrences = withNames.filter((o) => o.date === today);
  const nextOccurrence =
    withNames.find((o) => o.date > today || (o.date === today && (o.start_time ?? "23:59:59") >= nowTime)) ??
    null;

  const upcomingAssessments = assessments
    .filter((a) => !isAssessmentPast(a.date, a.status, today))
    .slice(0, 10);
  const recentScoredAssessments = assessments
    .filter((a) => a.score !== null && a.max_score !== null && a.max_score > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((a) => ({
      ...a,
      className: a.class_id ? classNameById.get(a.class_id) ?? null : null,
    }));
  const averageScorePct = averageAssessmentPercentage(assessments);

  const overdueDeadlines = deadlines.filter((d) => isDeadlineOverdue(d.due_date, d.status, today));
  const upcomingDeadlines = deadlines
    .filter((d) => d.status === "pending" && !isDeadlineOverdue(d.due_date, d.status, today))
    .slice(0, 10);

  const prepReview = summarizePrepReview((recentOccForPrep ?? []) as { prepared: boolean; reviewed: boolean; status: string }[]);

  return {
    nextOccurrence,
    todayOccurrences,
    upcomingAssessments,
    recentScoredAssessments,
    overdueDeadlines,
    upcomingDeadlines,
    prepReview,
    averageScorePct,
    attendanceZones: classes,
  };
}
