import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock server actions
vi.mock("@/lib/notes/actions", () => ({
  createNote: vi.fn().mockResolvedValue({
    id: "note-real-1",
    user_id: "u1",
    content: "Saved note",
    course_id: null,
    category: "general",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  updateNote: vi.fn().mockResolvedValue({}),
  deleteNote: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/goals/actions", () => ({
  createGoal: vi.fn().mockResolvedValue("goal-real-1"),
  updateGoal: vi.fn().mockResolvedValue({}),
  toggleGoalTop3: vi.fn().mockResolvedValue({}),
  deleteGoal: vi.fn().mockResolvedValue({}),
}));

import NotesSection from "@/components/NotesSection";
import GoalsSectionManager from "@/components/GoalsSectionManager";
import HomeSectionManager from "@/components/HomeSectionManager";
import HealthSectionManager from "@/components/HealthSectionManager";

describe("React Render Smoke & Crash Prevention Tests", () => {
  it("renders NotesSection without freeze or crash (Home, Goals, Health, Course notes)", () => {
    // 1. Home Note
    const homeHtml = renderToString(
      <NotesSection
        title="Notes"
        notes={[
          {
            id: "n-home",
            user_id: "u1",
            content: "Review morning lecture slides",
            course_id: null,
            category: "general",
            created_at: "2026-09-20T08:30:00Z",
            updated_at: "2026-09-20T08:30:00Z",
          },
        ]}
        category="general"
      />
    );
    expect(homeHtml).toContain("Review morning lecture slides");
    expect(homeHtml).toContain("(1)");

    // 2. Goals Note
    const goalsHtml = renderToString(
      <NotesSection
        title="Goal Notes"
        notes={[
          {
            id: "n-goal",
            user_id: "u1",
            content: "Finish 5 problem sets before Friday",
            course_id: null,
            category: "goals",
            created_at: "2026-09-20T09:00:00Z",
            updated_at: "2026-09-20T09:00:00Z",
          },
        ]}
        category="goals"
      />
    );
    expect(goalsHtml).toContain("Finish 5 problem sets before Friday");

    // 3. Health Note
    const healthHtml = renderToString(
      <NotesSection
        title="Health Notes"
        notes={[
          {
            id: "n-health",
            user_id: "u1",
            content: "Slept 8 hours, felt energized",
            course_id: null,
            category: "health",
            created_at: "2026-09-20T07:15:00Z",
            updated_at: "2026-09-20T07:15:00Z",
          },
        ]}
        category="health"
      />
    );
    expect(healthHtml).toContain("Slept 8 hours, felt energized");

    // 4. Course Note
    const courseHtml = renderToString(
      <NotesSection
        title="Course Notes"
        notes={[
          {
            id: "n-course",
            user_id: "u1",
            content: "Instructor mentioned Chapter 4 will be on midterm",
            course_id: "course-cs330",
            category: "course",
            created_at: "2026-09-20T11:00:00Z",
            updated_at: "2026-09-20T11:00:00Z",
          },
        ]}
        courseId="course-cs330"
        category="course"
      />
    );
    expect(courseHtml).toContain("Instructor mentioned Chapter 4 will be on midterm");
  });

  it("renders HomeSectionManager Level-1 with persistent notes and hidden subsection toggle", () => {
    const html = renderToString(
      <HomeSectionManager
        date="2026-09-20"
        today="2026-09-20"
        isWeekday={true}
        tasks={[]}
        top3Goals={[]}
        checkIns={[]}
        courseCodeMap={{}}
        nextInLine={null}
        weeklyTimetableImageUrl="https://example.com/timetable.jpg"
        academicSchedule={[]}
        homeNotes={[
          {
            id: "n-h1",
            user_id: "u1",
            content: "Remember to submit lab report",
            course_id: null,
            category: "general",
            created_at: "2026-09-20T09:00:00Z",
            updated_at: "2026-09-20T09:00:00Z",
          },
        ]}
      />
    );

    // Level-1 rendered and contains notes
    expect(html).toContain("Remember to submit lab report");
    // Does not crash, contains Home title
    expect(html).toContain("Home");
  });

  it("renders HealthSectionManager Level-1 with persistent notes and hidden subsection toggle", () => {
    const html = renderToString(
      <HealthSectionManager
        today="2026-09-20"
        averages={{
          sleepAvg7d: 7.5,
          sleepAvg30d: 7.2,
          meditationAvg7d: 15,
          meditationAvg30d: 14,
          screenTimeAvg7d: 3.5,
          foodAvg7d: 3,
        }}
        lastNightSleep={null}
        recentSleepLogs={[]}
        todayMeals={{ breakfast: false, lunch: false, dinner: false }}
        todayMeditation={null}
        meditationStreak={5}
        recentMeditationLogs={[]}
        todayScreenTime={null}
        recentScreenTime={[]}
        sevenDayTrends={[]}
        healthNotes={[
          {
            id: "n-hl1",
            user_id: "u1",
            content: "Hydration goal: 3L reached",
            course_id: null,
            category: "health",
            created_at: "2026-09-20T09:00:00Z",
            updated_at: "2026-09-20T09:00:00Z",
          },
        ]}
      />
    );

    expect(html).toContain("Hydration goal: 3L reached");
    expect(html).toContain("Health Averages");
  });

  it("renders GoalsSectionManager with controlled GoalsTable without render-phase loop", () => {
    const allGoals = [
      {
        id: "goal-1",
        title: "Master Dynamic Programming",
        priority: 1,
        course_id: "cs330",
        due_date: "2026-09-30",
        status: "in_progress" as const,
        progress: 60,
        computedProgress: 60,
        is_top3: true,
        user_id: "u1",
        parent_id: null,
        level: "week" as const,
        description: null,
        start_date: null,
        target_value: null,
        current_value: null,
        manual_progress: null,
        created_at: "2026-09-20T09:00:00Z",
        updated_at: "2026-09-20T09:00:00Z",
        progressSource: "manual",
        overdue: false,
        childIds: [],
        linkedTaskCount: 3,
      },
    ];

    const html = renderToString(
      <GoalsSectionManager
        allGoals={allGoals}
        active={allGoals}
        overdue={[]}
        top3Goals={allGoals}
        todayGoals={[]}
        upcoming={allGoals}
        recentlyCompleted={[]}
        goalsCount={1}
        courseCodeMap={{ cs330: "CS330" }}
        courses={[{ id: "cs330", code: "CS330", name: "Algorithms" }]}
        goalNotes={[
          {
            id: "gn-1",
            user_id: "u1",
            content: "Target 2 problems per day",
            course_id: null,
            category: "goals",
            created_at: "2026-09-20T09:00:00Z",
            updated_at: "2026-09-20T09:00:00Z",
          },
        ]}
      />
    );

    expect(html).toContain("Master Dynamic Programming");
    expect(html).toContain("CS330");
    expect(html).toContain("Target 2 problems per day");
  });
});
