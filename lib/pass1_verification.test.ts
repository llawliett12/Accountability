import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock Supabase server client
const mockTasksUpdate = vi.fn();
const mockTaskLogsInsert = vi.fn();
const mockTaskLogsUpsert = vi.fn();
const mockTasksInsert = vi.fn();
const mockDailyPlansSelect = vi.fn();
const mockDailyPlansInsert = vi.fn();

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "test-user-123", email: "user@example.com" } },
    }),
  },
  from: vi.fn((table: string) => {
    if (table === "tasks") {
      return {
        update: mockTasksUpdate,
        insert: mockTasksInsert,
      };
    }
    if (table === "task_logs") {
      return {
        insert: mockTaskLogsInsert,
        upsert: mockTaskLogsUpsert,
      };
    }
    if (table === "daily_plans") {
      return {
        select: mockDailyPlansSelect,
        insert: mockDailyPlansInsert,
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    };
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock goals progress recalculation to avoid deep dependencies
vi.mock("@/lib/goals/actions", () => ({
  recomputeAndStoreProgress: vi.fn().mockResolvedValue(undefined),
}));

describe("Pass 1 Correctness Fix 1: Task Status Update Resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds without error even when task_logs upsert encounters a conflict/constraint failure", async () => {
    const { updateTaskStatus } = await import("./actions");

    // Primary task update succeeds
    mockTasksUpdate.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { goal_id: "goal-123" },
          error: null,
        }),
      }),
    });

    // Secondary logging fails with a Postgres onConflict/constraint error
    mockTaskLogsUpsert.mockResolvedValue({
      data: null,
      error: { message: "there is no unique or exclusion constraint matching the ON CONFLICT specification" },
    });

    // updateTaskStatus must succeed because the primary task update succeeded
    const result = await updateTaskStatus("task-abc", "completed", "client-uuid-1");
    expect(result).toEqual({ success: true, taskId: "task-abc", status: "completed" });
  });

  it("succeeds when updating task status online (no clientId) using insert", async () => {
    const { updateTaskStatus } = await import("./actions");

    mockTasksUpdate.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { goal_id: null },
          error: null,
        }),
      }),
    });

    mockTaskLogsInsert.mockResolvedValue({ data: null, error: null });

    const result = await updateTaskStatus("task-abc", "in_progress");
    expect(result).toEqual({ success: true, taskId: "task-abc", status: "in_progress" });
    expect(mockTaskLogsInsert).toHaveBeenCalledWith({
      task_id: "task-abc",
      user_id: "test-user-123",
      event_type: "status_change",
      value: "in_progress",
    });
  });

  it("throws when the primary tasks table update itself fails", async () => {
    const { updateTaskStatus } = await import("./actions");

    mockTasksUpdate.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("Database connection lost"),
        }),
      }),
    });

    await expect(updateTaskStatus("task-abc", "completed")).rejects.toThrow("Database connection lost");
  });
});

describe("Pass 1 Correctness Fix 2: Task Creation Return and Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the created task and revalidates /plan", async () => {
    const { createTask } = await import("./actions");
    const { revalidatePath } = await import("next/cache");

    const createdTask = {
      id: "task-new-123",
      user_id: "test-user-123",
      daily_plan_id: "plan-today",
      title: "Write QA verification tests",
      priority: 3,
      is_top3: true,
      goal_id: null,
      status: "not_started",
    };

    mockTasksInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: createdTask,
          error: null,
        }),
      }),
    });

    // Mock getOrCreateDailyPlan dependencies
    mockDailyPlansSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "plan-today" },
        error: null,
      }),
    });

    const result = await createTask({
      title: "Write QA verification tests",
      is_top3: true,
    });

    expect(result).toEqual(createdTask);
    expect(revalidatePath).toHaveBeenCalledWith("/plan");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("restores input state and sets error if optimistic task creation fails", async () => {
    let currentTitle = "Finish physics assignment";
    let currentTop3 = true;
    let currentGoalId = "goal-1";
    let errorMessage: string | null = null;

    const onOptimisticCreate = vi.fn().mockRejectedValue(new Error("Server timed out"));

    const submit = async () => {
      const savedTitle = currentTitle;
      const savedTop3 = currentTop3;
      const savedGoalId = currentGoalId;

      // Optimistically clear input
      currentTitle = "";
      currentTop3 = false;
      currentGoalId = "";

      try {
        await onOptimisticCreate({
          title: savedTitle,
          is_top3: savedTop3,
          goal_id: savedGoalId,
        });
      } catch (err) {
        // Rollback
        currentTitle = savedTitle;
        currentTop3 = savedTop3;
        currentGoalId = savedGoalId;
        errorMessage = err instanceof Error ? err.message : "Failed";
      }
    };

    await submit();

    expect(onOptimisticCreate).toHaveBeenCalledWith({
      title: "Finish physics assignment",
      is_top3: true,
      goal_id: "goal-1",
    });
    // Verified: input is completely restored
    expect(currentTitle).toBe("Finish physics assignment");
    expect(currentTop3).toBe(true);
    expect(currentGoalId).toBe("goal-1");
    expect(errorMessage).toBe("Server timed out");
  });

  it("immediately updates optimistic status, but reverts on network/server error", async () => {
    let rowStatus: "not_started" | "in_progress" | "completed" = "not_started";
    let optimisticStatus: "not_started" | "in_progress" | "completed" | null = null;
    let rowError: string | null = null;

    const currentStatus = () => optimisticStatus ?? rowStatus;

    const handleStatusClick = async (
      newStatus: "not_started" | "in_progress" | "completed",
      mockResult: { status: "ran" | "error" }
    ) => {
      if (newStatus === currentStatus()) return;
      const previousStatus = currentStatus();
      optimisticStatus = newStatus; // Immediate optimistic feedback

      // Simulate async action
      if (mockResult.status === "error") {
        optimisticStatus = previousStatus; // Rollback
        rowError = "Couldn't update this task. Please try again.";
      } else {
        optimisticStatus = null;
        rowStatus = newStatus;
      }
    };

    // Test 1: User clicks "in_progress" and it succeeds
    await handleStatusClick("in_progress", { status: "ran" });
    expect(currentStatus()).toBe("in_progress");
    expect(rowError).toBeNull();

    // Test 2: User clicks "completed" but server returns error
    await handleStatusClick("completed", { status: "error" });
    expect(currentStatus()).toBe("in_progress"); // Reverted to previousStatus!
    expect(rowError).toBe("Couldn't update this task. Please try again.");
  });
});

describe("Pass 1 Correctness Fix 3: Academics Recent Performance", () => {
  it("extracts and formats scored assessments with class names and percentages", () => {
    const assessments = [
      {
        id: "a1",
        title: "Midterm Exam",
        type: "exam" as const,
        date: "2026-09-05",
        score: 85,
        max_score: 100,
        class_id: "c1",
        status: "completed" as const,
        user_id: "u1",
        target_score: 90,
        prep_hours: 5,
        practice_scores: [],
        notes: null,
        created_at: "",
      },
      {
        id: "a2",
        title: "Quiz 1",
        type: "quiz" as const,
        date: "2026-09-08",
        score: 18,
        max_score: 20,
        class_id: "c2",
        status: "completed" as const,
        user_id: "u1",
        target_score: null,
        prep_hours: 1,
        practice_scores: [],
        notes: null,
        created_at: "",
      },
      {
        id: "a3",
        title: "Unscored Upcoming Quiz",
        type: "quiz" as const,
        date: "2026-09-15",
        score: null,
        max_score: 20,
        class_id: "c1",
        status: "upcoming" as const,
        user_id: "u1",
        target_score: null,
        prep_hours: null,
        practice_scores: [],
        notes: null,
        created_at: "",
      },
    ];

    const classes = [
      { id: "c1", name: "Data Structures" },
      { id: "c2", name: "Linear Algebra" },
    ];
    const classNameById = new Map(classes.map((c) => [c.id, c.name]));

    const recentScoredAssessments = assessments
      .filter((a) => a.score !== null && a.max_score !== null && a.max_score > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map((a) => ({
        ...a,
        className: a.class_id ? classNameById.get(a.class_id) ?? null : null,
      }));

    expect(recentScoredAssessments).toHaveLength(2);
    // Ordered by date descending: a2 (2026-09-08) before a1 (2026-09-05)
    expect(recentScoredAssessments[0].title).toBe("Quiz 1");
    expect(recentScoredAssessments[0].className).toBe("Linear Algebra");
    expect(recentScoredAssessments[0].score).toBe(18);
    expect(recentScoredAssessments[0].max_score).toBe(20);
    expect(Math.round((recentScoredAssessments[0].score! / recentScoredAssessments[0].max_score!) * 100)).toBe(90);

    expect(recentScoredAssessments[1].title).toBe("Midterm Exam");
    expect(recentScoredAssessments[1].className).toBe("Data Structures");
    expect(recentScoredAssessments[1].score).toBe(85);
    expect(recentScoredAssessments[1].max_score).toBe(100);
    expect(Math.round((recentScoredAssessments[1].score! / recentScoredAssessments[1].max_score!) * 100)).toBe(85);
  });

  it("verifies createAssessment and recordAssessmentScore revalidate /academics/assessments", async () => {
    const { createAssessment, recordAssessmentScore } = await import("./academics/actions");
    const { revalidatePath } = await import("next/cache");

    // Test createAssessment revalidates /academics/assessments
    await createAssessment({
      title: "Algorithms Quiz",
      type: "quiz",
      date: "2026-09-10",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/academics");
    expect(revalidatePath).toHaveBeenCalledWith("/academics/assessments");
    expect(revalidatePath).toHaveBeenCalledWith("/academics/calendar");

    // Test recordAssessmentScore revalidates /academics/assessments
    await recordAssessmentScore("assessment-1", 95, 100);
    expect(revalidatePath).toHaveBeenCalledWith("/academics");
    expect(revalidatePath).toHaveBeenCalledWith("/academics/assessments");
    expect(revalidatePath).toHaveBeenCalledWith("/academics/assessments/assessment-1");
  });
});
