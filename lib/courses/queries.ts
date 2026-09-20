import { createClient } from "@/lib/supabase/server";
import type { Course, ClassDef, Assessment, Deadline, ClassOccurrence } from "@/lib/academics/types";
import type { Goal } from "@/lib/goals/types";
import type { Task } from "@/lib/types";
import { computeAttendanceStats, type AttendanceStats } from "@/lib/academics/engine";

export async function fetchCourses(userId: string, activeOnly = true): Promise<Course[]> {
  const supabase = await createClient();
  let query = supabase
    .from("courses")
    .select("*")
    .eq("user_id", userId)
    .order("code", { ascending: true });

  if (activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Course[];
}

export async function fetchCourseById(userId: string, courseId: string): Promise<Course | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", userId)
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw error;
  return (data as Course) ?? null;
}

export interface CourseDetailData {
  course: Course;
  slots: ClassDef[];
  occurrences: ClassOccurrence[];
  attendance: AttendanceStats;
  assessments: Assessment[];
  deadlines: Deadline[];
  linkedGoals: Goal[];
  linkedTasks: Task[];
  pastScores: { id: string; title: string; score: number; maxScore: number; date: string }[];
}

export async function fetchCourseDetails(
  userId: string,
  courseId: string
): Promise<CourseDetailData | null> {
  const supabase = await createClient();

  const course = await fetchCourseById(userId, courseId);
  if (!course) return null;

  // Parallelize all course-related queries
  const [
    { data: slotsData },
    { data: occurrencesData },
    { data: assessmentsData },
    { data: deadlinesData },
    { data: goalsData },
    { data: tasksData },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),

    supabase
      .from("class_occurrences")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .order("date", { ascending: false }),

    supabase
      .from("assessments")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .order("date", { ascending: true }),

    supabase
      .from("deadlines")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .order("due_date", { ascending: true }),

    supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .order("priority", { ascending: true }),

    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const slots = (slotsData ?? []) as ClassDef[];
  const occurrences = (occurrencesData ?? []) as ClassOccurrence[];
  const assessments = (assessmentsData ?? []) as Assessment[];
  const deadlines = (deadlinesData ?? []) as Deadline[];
  const linkedGoals = (goalsData ?? []) as Goal[];
  const linkedTasks = (tasksData ?? []) as Task[];

  // Attendance stats (excludes cancelled occurrences via engine)
  const attendance = computeAttendanceStats(occurrences, course.attendance_target);

  // Past scores
  const pastScores = assessments
    .filter((a) => a.score !== null && a.max_score !== null && a.status === "completed")
    .map((a) => ({
      id: a.id,
      title: a.title,
      score: a.score!,
      maxScore: a.max_score!,
      date: a.date,
    }));

  return {
    course,
    slots,
    occurrences,
    attendance,
    assessments,
    deadlines,
    linkedGoals,
    linkedTasks,
    pastScores,
  };
}
