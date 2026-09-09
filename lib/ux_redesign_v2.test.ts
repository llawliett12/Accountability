import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
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
    select: mockSelect.mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "test-id", goal_id: null }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "test-id", goal_id: null }, error: null }),
  })),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock("@/lib/goals/actions", () => ({
  recomputeAndStoreProgress: vi.fn().mockResolvedValue(undefined),
}));

describe("UX Redesign V2 Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Task deletion and updates", () => {
    it("successfully deletes a task", async () => {
      const { deleteTask } = await import("./actions");
      const result = await deleteTask("task-123");
      expect(result).toEqual({ success: true, taskId: "task-123" });
      expect(mockDelete).toHaveBeenCalled();
    });

    it("successfully updates task fields", async () => {
      const { updateTask } = await import("./actions");
      await updateTask("task-123", {
        title: "Updated task",
        is_top3: true,
        planned_duration_min: 45,
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Updated task",
          is_top3: true,
          planned_duration_min: 45,
        })
      );
    });
  });

  describe("Academics editable spreadsheet actions", () => {
    it("updates assessment scores and auto-marks completed when scored", async () => {
      const { updateAssessment } = await import("./academics/actions");
      await updateAssessment("assessment-1", {
        score: 18,
        max_score: 20,
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          score: 18,
          max_score: 20,
          status: "completed",
        })
      );
    });

    it("deletes an assessment row", async () => {
      const { deleteAssessment } = await import("./academics/actions");
      await deleteAssessment("assessment-1");
      expect(mockDelete).toHaveBeenCalled();
    });

    it("deletes a deadline row", async () => {
      const { deleteDeadline } = await import("./academics/actions");
      await deleteDeadline("deadline-1");
      expect(mockDelete).toHaveBeenCalled();
    });

    it("updates deadline fields", async () => {
      const { updateDeadline } = await import("./academics/actions");
      await updateDeadline("deadline-1", {
        title: "Submit report v2",
        due_date: "2026-09-15",
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Submit report v2",
          due_date: "2026-09-15",
        })
      );
    });

    it("toggles task Top 3 priority", async () => {
      const { toggleTaskTop3 } = await import("./actions");
      await toggleTaskTop3("task-123", true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_top3: true,
          priority: 1,
        })
      );
    });
  });
});
