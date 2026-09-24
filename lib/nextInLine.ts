// Pure deterministic shared logic for "Next in Line" across Home and Academics.
// No DB calls, no AI, no side effects — fully testable in isolation.

export interface NextInLineCourse {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface AcademicCandidateEvent {
  id: string;
  course_id?: string | null;
  title: string;
  date: string; // ISO date YYYY-MM-DD
  time?: string | null; // HH:MM or HH:MM:SS
  type: "quiz" | "exam" | "deadline" | "extra_class" | "assessment" | "other";
  status: string; // 'upcoming' | 'pending' | 'completed' | 'cancelled'
}

export interface GoalCandidate {
  id: string;
  title: string;
  due_date?: string | null;
  priority: number; // 1 (highest) .. 5
  status: string; // 'not_started' | 'in_progress' | 'completed' | 'abandoned'
  course_id?: string | null;
}

export interface NextInLineAcademicResult {
  kind: "academic";
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  date: string;
  time?: string | null;
  category: string;
  href: string;
}

export interface NextInLineGoalResult {
  kind: "goal";
  id: string;
  title: string;
  dueDate?: string | null;
  priority: number;
  courseCode?: string | null;
  href: string;
}

export type NextInLineResult = NextInLineAcademicResult | NextInLineGoalResult;

export function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00Z");
  const to = new Date(toISO + "T00:00:00Z");
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Academics Next in Line:
 * Looks across all active courses and finds the closest upcoming academic event (assessment/deadline).
 */
export function resolveAcademicsNextInLine(
  events: AcademicCandidateEvent[],
  courses: NextInLineCourse[],
  todayISO: string
): NextInLineAcademicResult | null {
  const activeCourseMap = new Map<string, NextInLineCourse>();
  for (const c of courses) {
    if (c.active) {
      activeCourseMap.set(c.id, c);
    }
  }

  const validEvents = events.filter((e) => {
    // Must belong to an active course
    if (!e.course_id || !activeCourseMap.has(e.course_id)) return false;
    // Must not be in the past
    if (e.date < todayISO) return false;
    // Must not be cancelled or completed
    if (e.status === "cancelled" || e.status === "completed") return false;
    return true;
  });

  if (validEvents.length === 0) return null;

  // Sort by date ascending, then time ascending, then deterministic tie-break
  validEvents.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const timeA = a.time ?? "23:59:59";
    const timeB = b.time ?? "23:59:59";
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return a.id.localeCompare(b.id);
  });

  const best = validEvents[0];
  const course = activeCourseMap.get(best.course_id!)!;

  return {
    kind: "academic",
    id: best.id,
    title: best.title,
    courseCode: course.code,
    courseName: course.name,
    date: best.date,
    time: best.time ?? null,
    category: best.type,
    href:
      best.type === "deadline"
        ? `/academics?section=deadlines&id=${best.id}`
        : `/academics/assessments/${best.id}`,
  };
}

/**
 * Home Next in Line:
 * 1. Checks if closest academic event across active courses is within ~7 days.
 * 2. If yes, the academic event wins.
 * 3. If no, falls back to an active global goal (due soonest, or highest priority).
 */
export function resolveHomeNextInLine(
  events: AcademicCandidateEvent[],
  courses: NextInLineCourse[],
  goals: GoalCandidate[],
  todayISO: string,
  nearTermThresholdDays = 7
): NextInLineResult | null {
  const academicNext = resolveAcademicsNextInLine(events, courses, todayISO);

  if (academicNext) {
    const diffDays = daysBetween(todayISO, academicNext.date);
    if (diffDays >= 0 && diffDays <= nearTermThresholdDays) {
      return academicNext;
    }
  }

  // Fallback to active global goal
  const courseMap = new Map<string, NextInLineCourse>();
  for (const c of courses) {
    courseMap.set(c.id, c);
  }

  const activeGoals = goals.filter(
    (g) => g.status === "in_progress" || g.status === "not_started"
  );

  if (activeGoals.length === 0) {
    // If no goals, and there was an academic event beyond 7 days, still show the academic event rather than nothing
    return academicNext;
  }

  activeGoals.sort((a, b) => {
    // Prefer goals with upcoming due date >= today
    const aHasDue = Boolean(a.due_date && a.due_date >= todayISO);
    const bHasDue = Boolean(b.due_date && b.due_date >= todayISO);

    if (aHasDue && !bHasDue) return -1;
    if (!aHasDue && bHasDue) return 1;

    if (aHasDue && bHasDue) {
      if (a.due_date !== b.due_date) return a.due_date!.localeCompare(b.due_date!);
    }

    // Secondary: priority (1=highest .. 5)
    if (a.priority !== b.priority) return a.priority - b.priority;

    return a.id.localeCompare(b.id);
  });

  const topGoal = activeGoals[0];
  const linkedCourse = topGoal.course_id ? courseMap.get(topGoal.course_id) : undefined;

  return {
    kind: "goal",
    id: topGoal.id,
    title: topGoal.title,
    dueDate: topGoal.due_date ?? null,
    priority: topGoal.priority,
    courseCode: linkedCourse?.code ?? null,
    href: `/goals/${topGoal.id}`,
  };
}
