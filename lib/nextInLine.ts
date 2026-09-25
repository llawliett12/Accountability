// Pure deterministic shared logic for "Next in Line" across Home and Academics.
// No DB calls, no AI, no side effects — fully testable in isolation.
//
// Home's rule, in one line: an academic event inside the near-term window wins,
// unless an open Task is due sooner; otherwise the soonest-due open Task or
// Goal wins. On the same due date (or when neither has one) a Task comes first,
// then priority (P1 first) within the same kind.

import { isOpenTask } from "@/lib/tasks";

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

export interface TaskCandidate {
  id: string;
  title: string;
  priority: number; // 1 (highest) .. 5
  status: string; // 'not_started' | 'in_progress' | 'completed' | ...
  deadline?: string | null; // ISO date or timestamp; only the date part is used
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

export interface NextInLineTaskResult {
  kind: "task";
  id: string;
  title: string;
  dueDate?: string | null;
  priority: number;
  href: string;
}

export type NextInLineResult =
  | NextInLineAcademicResult
  | NextInLineGoalResult
  | NextInLineTaskResult;

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

function dayOf(value?: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

interface RankedCandidate {
  kind: "task" | "goal";
  id: string;
  due: string | null; // YYYY-MM-DD
  priority: number;
  bucket: 0 | 1 | 2; // 0 = overdue task, 1 = dated (due today or later), 2 = undated / overdue goal
}

function compareRanked(a: RankedCandidate, b: RankedCandidate): number {
  if (a.bucket !== b.bucket) return a.bucket - b.bucket;
  if (a.bucket !== 2 && a.due !== b.due) return a.due!.localeCompare(b.due!);
  // Task priority and Goal priority are separate scales, so never compare them
  // across kinds: on the same due date (or both undated) a Task comes first.
  if (a.kind !== b.kind) return a.kind === "task" ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.id.localeCompare(b.id);
}

/**
 * Home Next in Line:
 * 1. If the closest academic event is within ~7 days it is the default winner…
 *    …unless an open Task is due strictly sooner, in which case the Task wins.
 * 2. Otherwise the soonest-due open Task or active Goal wins. On the same due
 *    date (or when both are undated) a Task beats a Goal; priority (P1 first)
 *    only orders items of the same kind.
 * 3. With nothing else, a far-off academic event is still shown rather than nothing.
 */
export function resolveHomeNextInLine(
  events: AcademicCandidateEvent[],
  courses: NextInLineCourse[],
  goals: GoalCandidate[],
  todayISO: string,
  nearTermThresholdDays = 7,
  tasks: TaskCandidate[] = []
): NextInLineResult | null {
  const academicNext = resolveAcademicsNextInLine(events, courses, todayISO);

  const courseMap = new Map<string, NextInLineCourse>();
  for (const c of courses) {
    courseMap.set(c.id, c);
  }

  const openTasks = tasks.filter(isOpenTask);
  const taskById = new Map(openTasks.map((t) => [t.id, t]));
  const goalById = new Map(
    goals
      .filter((g) => g.status === "in_progress" || g.status === "not_started")
      .map((g) => [g.id, g])
  );

  const ranked: RankedCandidate[] = [];
  for (const t of openTasks) {
    const due = dayOf(t.deadline);
    ranked.push({
      kind: "task",
      id: t.id,
      due,
      priority: t.priority,
      bucket: due && due < todayISO ? 0 : due ? 1 : 2,
    });
  }
  for (const g of goalById.values()) {
    const hasDue = Boolean(g.due_date && g.due_date >= todayISO);
    ranked.push({
      kind: "goal",
      id: g.id,
      due: hasDue ? g.due_date! : null,
      priority: g.priority,
      bucket: hasDue ? 1 : 2,
    });
  }
  ranked.sort(compareRanked);

  const toResult = (r: RankedCandidate): NextInLineResult => {
    if (r.kind === "task") {
      const t = taskById.get(r.id)!;
      return {
        kind: "task",
        id: t.id,
        title: t.title,
        dueDate: dayOf(t.deadline),
        priority: t.priority,
        href: `/?date=${todayISO}&section=tasks`,
      };
    }
    const g = goalById.get(r.id)!;
    const linkedCourse = g.course_id ? courseMap.get(g.course_id) : undefined;
    return {
      kind: "goal",
      id: g.id,
      title: g.title,
      dueDate: g.due_date ?? null,
      priority: g.priority,
      courseCode: linkedCourse?.code ?? null,
      href: `/goals/${g.id}`,
    };
  };

  if (academicNext) {
    const diffDays = daysBetween(todayISO, academicNext.date);
    if (diffDays >= 0 && diffDays <= nearTermThresholdDays) {
      // A dated Task due strictly before the academic event takes the slot.
      const soonestDatedTask = ranked.find((r) => r.kind === "task" && r.bucket !== 2);
      if (soonestDatedTask && soonestDatedTask.due! < academicNext.date) {
        return toResult(soonestDatedTask);
      }
      return academicNext;
    }
  }

  if (ranked.length === 0) {
    // Nothing else to show: a far-off academic event still beats an empty card.
    return academicNext;
  }

  return toResult(ranked[0]);
}
