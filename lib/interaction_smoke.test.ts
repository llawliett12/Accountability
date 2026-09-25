import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveHomeNextInLine, resolveAcademicsNextInLine } from "./nextInLine";
import { computeInferredTimeline } from "./timeline";

// Mock next/cache and next/navigation
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  notFound: vi.fn(),
}));

const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "test-user-123" } },
    }),
  },
  from: vi.fn(() => ({
    delete: mockDelete.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    select: mockSelect.mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "test-id", goal_id: null }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "test-id", goal_id: null }, error: null }),
  })),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("Real Interaction Smoke Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Flow 1 & 2: Next in Line & Home Hero Prominence", () => {
    it("selects academic event within 7 days over later goals as Next in Line", () => {
      const today = "2026-09-20";
      const academicEvents = [
        {
          id: "event-1",
          course_id: "crs-1",
          title: "Midterm Exam",
          date: "2026-09-22",
          time: "10:00:00",
          type: "exam" as const,
          status: "scheduled",
        },
      ];

      const courses = [
        { id: "crs-1", code: "CS301", name: "Operating Systems", active: true },
      ];

      const goals = [
        {
          id: "goal-1",
          title: "Finish Ch 4 Review",
          due_date: "2026-09-24",
          priority: 1,
          status: "in_progress",
          course_id: "crs-1",
        },
      ];

      const result = resolveHomeNextInLine(academicEvents, courses, goals, today, 7);

      expect(result).not.toBeNull();
      // Academic event on 2026-09-22 takes priority
      expect(result?.title).toBe("Midterm Exam");
      expect(result?.kind).toBe("academic");
      expect(result?.href).toBe("/academics/assessments/event-1");
    });

    it("falls back to priority goal when no upcoming academic event is within horizon", () => {
      const today = "2026-09-20";
      const academicEvents = [
        {
          id: "event-1",
          course_id: "crs-1",
          title: "Final Exam",
          date: "2026-10-30", // 40 days away
          time: "10:00:00",
          type: "exam" as const,
          status: "scheduled",
        },
      ];

      const courses = [
        { id: "crs-1", code: "CS301", name: "Operating Systems", active: true },
      ];

      const goals = [
        {
          id: "goal-1",
          title: "Build Compiler Project",
          due_date: "2026-09-23",
          priority: 1,
          status: "in_progress",
          course_id: "crs-1",
        },
      ];

      const result = resolveHomeNextInLine(academicEvents, courses, goals, today, 7);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Build Compiler Project");
      expect(result?.kind).toBe("goal");
      expect(result?.href).toBe("/goals/goal-1");
    });

    it("academic Next in Line references canonical course identity", () => {
      const today = "2026-09-20";
      const academicEvents = [
        {
          id: "event-1",
          course_id: "crs-1",
          title: "Database Quiz",
          date: "2026-09-21",
          time: "14:00:00",
          type: "quiz" as const,
          status: "scheduled",
        },
      ];

      const courses = [
        { id: "crs-1", code: "CS303", name: "Database Systems", active: true },
      ];

      const result = resolveAcademicsNextInLine(academicEvents, courses, today);

      expect(result).not.toBeNull();
      expect(result?.courseCode).toBe("CS303");
      expect(result?.courseName).toBe("Database Systems");
      expect(result?.href).toBe("/academics/assessments/event-1");
    });
  });

  describe("Flow 2: Timetable Actions & Consistency", () => {
    it("updateTimetableSlot updates class and future unheld occurrences with course_id", async () => {
      const { updateTimetableSlot } = await import("./courses/actions");
      await updateTimetableSlot("slot-1", {
        course_id: "crs-1",
        day_of_week: 2,
        start_time: "10:00",
        end_time: "11:00",
        location: "Room 101",
        slot_type: "lecture",
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          course_id: "crs-1",
          day_of_week: 2,
          start_time: "10:00:00",
          end_time: "11:00:00",
          location: "Room 101",
        })
      );
    });

    it("deleteTimetableSlot deletes future occurrences and deactivates the slot", async () => {
      const { deleteTimetableSlot } = await import("./courses/actions");
      await deleteTimetableSlot("slot-1");

      expect(mockDelete).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          active: false,
        })
      );
    });
  });

  describe("Flow 6: Quick Activity Journaling to Review", () => {
    it("createCheckIn inserts check_ins with entry_type='journal' and status='logged'", async () => {
      const { createCheckIn } = await import("./actions");
      await createCheckIn({
        actual_activity: "Read Research Paper on Memory Hierarchies",
        startedAt: "2026-09-20T10:00:00.000Z",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actual_activity: "Read Research Paper on Memory Hierarchies",
          entry_type: "journal",
          status: "logged",
          timestamp: "2026-09-20T10:00:00.000Z",
        })
      );
    });

    it("computeInferredTimeline renders journal entries in chronological order", () => {
      const activities = [
        {
          id: "act-1",
          actual_activity: "Breakfast & News",
          timestamp: "2026-09-20T08:00:00+05:30",
          completed_at: null,
          entry_type: "journal",
          status: "logged",
        },
        {
          id: "act-2",
          actual_activity: "Compiler Design Deep Work",
          timestamp: "2026-09-20T09:30:00+05:30",
          completed_at: "2026-09-20T11:00:00+05:30",
          entry_type: "work",
          status: "completed",
        },
        {
          id: "act-3",
          actual_activity: "Lunch with Team",
          timestamp: "2026-09-20T12:30:00+05:30",
          completed_at: null,
          entry_type: "journal",
          status: "logged",
        },
      ];

      const timeline = computeInferredTimeline(activities, "Asia/Kolkata");
      expect(timeline).toHaveLength(3);
      expect(timeline[0].activity).toBe("Breakfast & News");
      expect(timeline[0].entryType).toBe("journal");
      expect(timeline[1].activity).toBe("Compiler Design Deep Work");
      expect(timeline[1].entryType).toBe("work");
      expect(timeline[2].activity).toBe("Lunch with Team");
      expect(timeline[2].entryType).toBe("journal");
    });
  });

  describe("Flow 7: Legacy Routes Redirections", () => {
    it("/academics/classes redirects to /academics", async () => {
      const ClassesPage = (await import("../app/academics/classes/page")).default;
      ClassesPage();
      expect(mockRedirect).toHaveBeenCalledWith("/academics");
    });
  });
});
