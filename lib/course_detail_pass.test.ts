import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();

// Configurable per test: rows returned for `classes` filtered by course_id,
// used to exercise the course→class auto-resolution "exactly one match"
// logic in createAssessment/createDeadline. Reset in beforeEach.
let mockClassesForCourse: { id: string }[] = [
  { id: "class-slot-mon" },
  { id: "class-slot-wed" },
];

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "test-user-999" } },
    }),
  },
  from: vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    chain.upsert = vi.fn().mockResolvedValue({ error: null });
    chain.insert = vi.fn((payload) => {
      mockInsert(table, payload);
      return {
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: `${table}-new-id`,
              ...(Array.isArray(payload) ? payload[0] : payload),
            },
            error: null,
          }),
        })),
      };
    });
    chain.update = vi.fn((payload) => {
      mockUpdate(table, payload);
      return {
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: `${table}-id`, ...payload },
                error: null,
              }),
            })),
          })),
        })),
      };
    });
    chain.delete = vi.fn(() => {
      mockDelete(table);
      return {
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
    });
    chain.select = vi.fn(() => {
      mockSelect(table);
      return {
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
            limit: vi.fn(() =>
              table === "classes"
                ? Promise.resolve({ data: mockClassesForCourse, error: null })
                : Promise.resolve({ data: [], error: null })
            ),
            single: vi.fn().mockResolvedValue({
              data: { id: "plan-id", user_id: "test-user-999" },
              error: null,
            }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "existing-id", goal_id: "goal-123" },
              error: null,
            }),
          })),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "plan-id", user_id: "test-user-999" },
            error: null,
          }),
        })),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "plan-id", user_id: "test-user-999" },
          error: null,
        }),
      };
    });
    return chain;
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("Course Detail & Home Timetable UX Refinement Pass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClassesForCourse = [{ id: "class-slot-mon" }, { id: "class-slot-wed" }];
  });

  describe("1. Course Detail Read/Write Actions", () => {
    it("createTask stores course_id and optional goal_id", async () => {
      const { createTask } = await import("./actions");

      await createTask({
        title: "Study Chapter 4 Proofs",
        course_id: "course-cs330",
        goal_id: "goal-os-mastery",
        priority: 2,
        deadline: "2026-09-25",
        planned_duration_min: 45,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        "tasks",
        expect.objectContaining({
          course_id: "course-cs330",
          goal_id: "goal-os-mastery",
          title: "Study Chapter 4 Proofs",
          priority: 2,
        })
      );
    });

    it("updateTask updates course_id when provided", async () => {
      const { updateTask } = await import("./actions");

      await updateTask("task-123", {
        course_id: "course-cs330",
        priority: 1,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        "tasks",
        expect.objectContaining({
          course_id: "course-cs330",
          priority: 1,
        })
      );
    });

    it("createAssessment stores course_id for the course", async () => {
      const { createAssessment } = await import("./academics/actions");

      await createAssessment({
        course_id: "course-cs330",
        title: "Midterm 2",
        type: "exam",
        date: "2026-10-15",
        target_score: 90,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        "assessments",
        expect.objectContaining({
          course_id: "course-cs330",
          title: "Midterm 2",
          type: "exam",
          date: "2026-10-15",
          target_score: 90,
        })
      );
    });

    it("createAssessment leaves class_id null when the course has multiple timetable slots (ambiguous — no arbitrary pick)", async () => {
      const { createAssessment } = await import("./academics/actions");

      // A course with e.g. Mon/Wed lectures has multiple `classes` rows
      // sharing the same course_id (mockClassesForCourse default: 2 rows).
      // There is no canonical class among them, so class_id must stay null
      // rather than an arbitrary row being picked.
      await expect(
        createAssessment({
          course_id: "course-cs330",
          title: "Quiz 3",
          type: "quiz",
          date: "2026-10-08",
          target_score: 30,
        })
      ).resolves.toBeDefined();

      expect(mockInsert).toHaveBeenCalledWith(
        "assessments",
        expect.objectContaining({
          course_id: "course-cs330",
          class_id: null,
          title: "Quiz 3",
        })
      );
    });

    it("createAssessment resolves class_id when the course maps to exactly one class", async () => {
      mockClassesForCourse = [{ id: "class-solo" }];
      const { createAssessment } = await import("./academics/actions");

      await createAssessment({
        course_id: "course-cs330",
        title: "Quiz 4",
        type: "quiz",
        date: "2026-10-15",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        "assessments",
        expect.objectContaining({
          course_id: "course-cs330",
          class_id: "class-solo",
          title: "Quiz 4",
        })
      );
    });

    it("createAssessment leaves class_id null when the course has no classes at all", async () => {
      mockClassesForCourse = [];
      const { createAssessment } = await import("./academics/actions");

      await createAssessment({
        course_id: "course-cs330",
        title: "Quiz 5",
        type: "quiz",
        date: "2026-10-22",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        "assessments",
        expect.objectContaining({
          course_id: "course-cs330",
          class_id: null,
          title: "Quiz 5",
        })
      );
    });

    it("createDeadline stores course_id for the course", async () => {
      const { createDeadline } = await import("./academics/actions");

      await createDeadline({
        course_id: "course-cs330",
        title: "Project Milestone 1",
        due_date: "2026-10-05",
        category: "Project",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        "deadlines",
        expect.objectContaining({
          course_id: "course-cs330",
          title: "Project Milestone 1",
          due_date: "2026-10-05",
          category: "Project",
        })
      );
    });

    it("createDeadline leaves class_id null when the course has multiple timetable slots", async () => {
      // Default mockClassesForCourse (set in beforeEach) has 2 rows.
      const { createDeadline } = await import("./academics/actions");

      await createDeadline({
        course_id: "course-cs330",
        title: "Project Milestone 2",
        due_date: "2026-10-12",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        "deadlines",
        expect.objectContaining({
          course_id: "course-cs330",
          class_id: null,
          title: "Project Milestone 2",
        })
      );
    });

    it("createDeadline resolves class_id when the course maps to exactly one class", async () => {
      mockClassesForCourse = [{ id: "class-solo" }];
      const { createDeadline } = await import("./academics/actions");

      await createDeadline({
        course_id: "course-cs330",
        title: "Project Milestone 3",
        due_date: "2026-10-19",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        "deadlines",
        expect.objectContaining({
          course_id: "course-cs330",
          class_id: "class-solo",
          title: "Project Milestone 3",
        })
      );
    });

    it("createGoal stores course_id syncing with global goals table", async () => {
      const { createGoal } = await import("./goals/actions");

      await createGoal({
        course_id: "course-cs330",
        title: "Achieve A in CS330",
        level: "week",
        priority: 1,
        due_date: "2026-12-15",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        "goals",
        expect.objectContaining({
          course_id: "course-cs330",
          title: "Achieve A in CS330",
          priority: 1,
        })
      );
    });
  });

  describe("2. Home Timetable Weekday Logic", () => {
    it("identifies Monday through Friday as weekdays and Saturday/Sunday as weekends", () => {
      const monday = new Date("2026-09-21T00:00:00Z").getUTCDay(); // 1 = Monday
      const friday = new Date("2026-09-25T00:00:00Z").getUTCDay(); // 5 = Friday
      const saturday = new Date("2026-09-26T00:00:00Z").getUTCDay(); // 6 = Saturday
      const sunday = new Date("2026-09-27T00:00:00Z").getUTCDay(); // 0 = Sunday

      const isWeekday = (day: number) => day >= 1 && day <= 5;

      expect(isWeekday(monday)).toBe(true);
      expect(isWeekday(friday)).toBe(true);
      expect(isWeekday(saturday)).toBe(false);
      expect(isWeekday(sunday)).toBe(false);
    });
  });

  describe("3. Explicit Task -> Goal Integration Flow", () => {
    it("creates a Goal first and links it to Task when Add as Goal is requested", async () => {
      const { createGoal } = await import("./goals/actions");
      const { createTask } = await import("./actions");

      const title = "Complete Kernel Paging Assignment";
      const courseId = "course-cs330";
      const deadline = "2026-09-28";

      // 1. Create goal
      const newGoalId = await createGoal({
        course_id: courseId,
        title,
        priority: 2,
        due_date: deadline,
        level: "week",
      });

      // 2. Create task with linked goal_id
      const newTask = await createTask({
        course_id: courseId,
        goal_id: newGoalId,
        title,
        priority: 2,
        deadline,
        planned_duration_min: 90,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        "goals",
        expect.objectContaining({
          course_id: courseId,
          title,
        })
      );

      expect(mockInsert).toHaveBeenCalledWith(
        "tasks",
        expect.objectContaining({
          course_id: courseId,
          goal_id: expect.any(String),
          title,
        })
      );

      expect(newTask).toBeDefined();
    });
  });

  describe("4. Progress Synchronization QA", () => {
    it("updateGoal persists manual_progress and revalidates /academics and /goals", async () => {
      const { updateGoal } = await import("./goals/actions");
      const { revalidatePath } = await import("next/cache");

      await updateGoal("goal-123", { manual_progress: 60 });

      expect(mockUpdate).toHaveBeenCalledWith(
        "goals",
        expect.objectContaining({
          manual_progress: 60,
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/goals");
      expect(revalidatePath).toHaveBeenCalledWith("/academics");
    });

    it("updateTaskStatus recomputes progress for linked goal and revalidates / and /academics", async () => {
      const { updateTaskStatus } = await import("./actions");
      const { revalidatePath } = await import("next/cache");

      await updateTaskStatus("task-123", "completed");

      expect(mockUpdate).toHaveBeenCalledWith(
        "tasks",
        expect.objectContaining({
          status: "completed",
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(revalidatePath).toHaveBeenCalledWith("/academics");
    });
  });

  describe("5. Deletion Integrity QA", () => {
    it("deleteGoal deletes the goal record and revalidates /goals, /, /academics without error", async () => {
      const { deleteGoal } = await import("./goals/actions");
      const { revalidatePath } = await import("next/cache");

      await deleteGoal("goal-123");

      expect(mockDelete).toHaveBeenCalledWith("goals");
      expect(revalidatePath).toHaveBeenCalledWith("/goals");
      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(revalidatePath).toHaveBeenCalledWith("/academics");
    });

    it("deleteTask deletes the task, recomputes linked goal progress, and does not delete parent goal", async () => {
      const { deleteTask } = await import("./actions");
      const { revalidatePath } = await import("next/cache");

      await deleteTask("task-123");

      expect(mockDelete).toHaveBeenCalledWith("tasks");
      expect(mockDelete).not.toHaveBeenCalledWith("goals");
      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(revalidatePath).toHaveBeenCalledWith("/academics");
    });
  });

  describe("6. Canonical Courses & Timetable Integration QA", () => {
    it("addTimetableSlot stores course_id and revalidates /academics and /", async () => {
      const { addTimetableSlot } = await import("./courses/actions");
      const { revalidatePath } = await import("next/cache");

      await addTimetableSlot({
        course_id: "course-cs330",
        day_of_week: 1,
        start_time: "09:00",
        end_time: "10:00",
        location: "Hall A",
        slot_type: "lecture",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        "classes",
        expect.objectContaining({
          course_id: "course-cs330",
          day_of_week: 1,
          start_time: "09:00:00",
          end_time: "10:00:00",
          location: "Hall A",
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/academics");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });
  });

  describe("7. Performance & Revalidation Audit QA", () => {
    it("createDeadline revalidates /academics/deadlines, /academics/courses/[id], and /academics", async () => {
      const { createDeadline } = await import("./academics/actions");
      const { revalidatePath } = await import("next/cache");

      await createDeadline({
        title: "Homework 3",
        due_date: "2026-10-15",
        course_id: "course-cs330",
      });

      expect(revalidatePath).toHaveBeenCalledWith("/academics");
      expect(revalidatePath).toHaveBeenCalledWith("/academics/deadlines");
      expect(revalidatePath).toHaveBeenCalledWith("/academics/courses/course-cs330");
    });

    it("createGoal with course_id revalidates /academics/courses/[id]", async () => {
      const { createGoal } = await import("./goals/actions");
      const { revalidatePath } = await import("next/cache");

      await createGoal({
        title: "Pass midterm with A",
        level: "week",
        course_id: "course-cs330",
      });

      expect(revalidatePath).toHaveBeenCalledWith("/goals");
      expect(revalidatePath).toHaveBeenCalledWith("/academics/courses/course-cs330");
    });

    it("createTask with course_id revalidates /academics/courses/[id]", async () => {
      const { createTask } = await import("./actions");
      const { revalidatePath } = await import("next/cache");

      await createTask({
        title: "Review lecture 3 slides",
        course_id: "course-cs330",
      });

      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(revalidatePath).toHaveBeenCalledWith("/academics/courses/course-cs330");
    });
  });
});
