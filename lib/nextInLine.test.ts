import { describe, it, expect } from "vitest";
import {
  resolveAcademicsNextInLine,
  resolveHomeNextInLine,
  type AcademicCandidateEvent,
  type NextInLineCourse,
  type GoalCandidate,
} from "./nextInLine";

describe("Next in Line logic", () => {
  const courses: NextInLineCourse[] = [
    { id: "c1", code: "CS340", name: "Operating Systems", active: true },
    { id: "c2", code: "EE200", name: "Signals & Systems", active: true },
    { id: "c3", code: "MATH101", name: "Calculus", active: false }, // Inactive course
  ];

  const today = "2026-09-20";

  it("chooses the closest upcoming academic event across active courses", () => {
    const events: AcademicCandidateEvent[] = [
      {
        id: "e1",
        course_id: "c1",
        title: "Quiz 2",
        date: "2026-09-24",
        time: "10:00",
        type: "quiz",
        status: "upcoming",
      },
      {
        id: "e2",
        course_id: "c2",
        title: "Assignment 1",
        date: "2026-09-22",
        time: "23:59",
        type: "deadline",
        status: "pending",
      },
    ];

    const result = resolveAcademicsNextInLine(events, courses, today);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("e2");
    expect(result?.courseCode).toBe("EE200");
    expect(result?.title).toBe("Assignment 1");
  });

  it("ignores events in the past", () => {
    const events: AcademicCandidateEvent[] = [
      {
        id: "e-past",
        course_id: "c1",
        title: "Quiz 1",
        date: "2026-09-18",
        type: "quiz",
        status: "upcoming",
      },
      {
        id: "e-future",
        course_id: "c1",
        title: "Quiz 2",
        date: "2026-09-25",
        type: "quiz",
        status: "upcoming",
      },
    ];

    const result = resolveAcademicsNextInLine(events, courses, today);
    expect(result?.id).toBe("e-future");
  });

  it("ignores cancelled and completed academic events", () => {
    const events: AcademicCandidateEvent[] = [
      {
        id: "e-cancelled",
        course_id: "c1",
        title: "Quiz 2 Cancelled",
        date: "2026-09-21",
        type: "quiz",
        status: "cancelled",
      },
      {
        id: "e-completed",
        course_id: "c1",
        title: "Midsem Done",
        date: "2026-09-21",
        type: "exam",
        status: "completed",
      },
      {
        id: "e-valid",
        course_id: "c1",
        title: "Endsem",
        date: "2026-09-28",
        type: "exam",
        status: "upcoming",
      },
    ];

    const result = resolveAcademicsNextInLine(events, courses, today);
    expect(result?.id).toBe("e-valid");
  });

  it("ignores events belonging to inactive courses", () => {
    const events: AcademicCandidateEvent[] = [
      {
        id: "e-inactive",
        course_id: "c3", // MATH101 is inactive
        title: "Calculus Exam",
        date: "2026-09-21",
        type: "exam",
        status: "upcoming",
      },
      {
        id: "e-active",
        course_id: "c1",
        title: "OS Quiz",
        date: "2026-09-23",
        type: "quiz",
        status: "upcoming",
      },
    ];

    const result = resolveAcademicsNextInLine(events, courses, today);
    expect(result?.id).toBe("e-active");
  });

  it("resolves date and time ties deterministically", () => {
    const events: AcademicCandidateEvent[] = [
      {
        id: "b-event",
        course_id: "c1",
        title: "Event B",
        date: "2026-09-22",
        time: "10:00",
        type: "quiz",
        status: "upcoming",
      },
      {
        id: "a-event",
        course_id: "c2",
        title: "Event A",
        date: "2026-09-22",
        time: "10:00",
        type: "quiz",
        status: "upcoming",
      },
    ];

    const result = resolveAcademicsNextInLine(events, courses, today);
    expect(result?.id).toBe("a-event");
  });

  it("Home: academic event within 7 days beats global goal", () => {
    const events: AcademicCandidateEvent[] = [
      {
        id: "e1",
        course_id: "c1",
        title: "Quiz 2",
        date: "2026-09-23", // 3 days away
        type: "quiz",
        status: "upcoming",
      },
    ];

    const goals: GoalCandidate[] = [
      {
        id: "g1",
        title: "Top Priority Goal",
        due_date: "2026-09-21",
        priority: 1,
        status: "in_progress",
      },
    ];

    const result = resolveHomeNextInLine(events, courses, goals, today, 7);
    expect(result?.kind).toBe("academic");
    expect(result?.id).toBe("e1");
  });

  it("Home: falls back to active goal when no academic event is within 7 days", () => {
    const events: AcademicCandidateEvent[] = [
      {
        id: "e-far",
        course_id: "c1",
        title: "Final Exam",
        date: "2026-10-15", // 25 days away (> 7 days)
        type: "exam",
        status: "upcoming",
      },
    ];

    const goals: GoalCandidate[] = [
      {
        id: "g1",
        title: "Finish Revision",
        due_date: "2026-09-22",
        priority: 2,
        status: "in_progress",
      },
      {
        id: "g2",
        title: "Later Goal",
        due_date: "2026-09-29",
        priority: 1,
        status: "not_started",
      },
    ];

    const result = resolveHomeNextInLine(events, courses, goals, today, 7);
    expect(result?.kind).toBe("goal");
    expect(result?.id).toBe("g1");
  });
});
