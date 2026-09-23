import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCachedSignedUrl, invalidateSignedUrl } from "@/lib/storage/signedUrlCache";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "test-user-123" } },
    }),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "new-academic-id" }, error: null }),
      }),
    }),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "class-slot-1", course_id: "course-cs330" }, error: null }),
    limit: vi.fn().mockResolvedValue({ data: [{ id: "class-slot-1", course_id: "course-cs330" }], error: null }),
  })),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("Performance & Reliability Optimizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Signed URL In-Memory Caching", () => {
    it("caches signed URLs and avoids redundant storage API roundtrips", async () => {
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://storage.supabase.co/signed/test.png" },
        error: null,
      });

      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            createSignedUrl: mockCreateSignedUrl,
          })),
        },
      };

      // First call: calls storage
      const url1 = await getCachedSignedUrl(
        mockSupabase,
        "academic-schedule-screenshots",
        "user1/test-shot.png",
        3600
      );
      expect(url1).toBe("https://storage.supabase.co/signed/test.png");
      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);

      // Second call: served from memory cache (0ms, 0 API calls)
      const url2 = await getCachedSignedUrl(
        mockSupabase,
        "academic-schedule-screenshots",
        "user1/test-shot.png",
        3600
      );
      expect(url2).toBe("https://storage.supabase.co/signed/test.png");
      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);

      // Invalidation clears cache
      invalidateSignedUrl("academic-schedule-screenshots", "user1/test-shot.png");
      const url3 = await getCachedSignedUrl(
        mockSupabase,
        "academic-schedule-screenshots",
        "user1/test-shot.png",
        3600
      );
      expect(url3).toBe("https://storage.supabase.co/signed/test.png");
      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
    });

    it("handles storage errors gracefully without throwing", async () => {
      const mockSupabase = {
        storage: {
          from: vi.fn(() => ({
            createSignedUrl: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("Storage unavailable"),
            }),
          })),
        },
      };

      const result = await getCachedSignedUrl(
        mockSupabase,
        "academic-schedule-screenshots",
        "nonexistent.png"
      );
      expect(result).toBeNull();
    });
  });

  describe("Academic Events Auto-resolution & Route Revalidation", () => {
    it("revalidates course page and home page on assessment and deadline actions", async () => {
      const { createAssessment, createDeadline } = await import("@/lib/academics/actions");
      const { revalidatePath } = await import("next/cache");

      await createAssessment({
        title: "CS330 Final Exam",
        type: "exam",
        date: "2026-10-15",
        course_id: "course-cs330",
      });

      expect(revalidatePath).toHaveBeenCalledWith("/academics/courses/course-cs330");
      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(revalidatePath).toHaveBeenCalledWith("/academics");
      expect(revalidatePath).toHaveBeenCalledWith("/academics/assessments");

      await createDeadline({
        title: "Homework 5",
        due_date: "2026-10-10",
        course_id: "course-cs330",
      });

      expect(revalidatePath).toHaveBeenCalledWith("/academics/courses/course-cs330");
      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(revalidatePath).toHaveBeenCalledWith("/academics/calendar");
    });
  });
});
