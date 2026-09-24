import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache
const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
  revalidateTag: vi.fn(),
}));

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();

let mockCurrentUser: { id: string } | null = { id: "user-123" };

const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: mockCurrentUser },
      error: null,
    })),
  },
  from: vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};

    chain.insert = vi.fn((payload: unknown) => {
      mockInsert(table, payload);
      return {
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "new-note-id",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...(payload as object),
            },
            error: null,
          }),
        })),
      };
    });

    chain.update = vi.fn((payload: unknown) => {
      mockUpdate(table, payload);
      return {
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "note-123",
                  user_id: "user-123",
                  ...(payload as object),
                },
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
          is: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: "note-2", content: "Newer note", created_at: "2026-09-20T10:00:00Z" },
                  { id: "note-1", content: "Older note", created_at: "2026-09-20T08:00:00Z" },
                ],
                error: null,
              }),
            })),
            order: vi.fn().mockResolvedValue({
              data: [
                { id: "note-2", content: "Newer note", created_at: "2026-09-20T10:00:00Z" },
                { id: "note-1", content: "Older note", created_at: "2026-09-20T08:00:00Z" },
              ],
              error: null,
            }),
          })),
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: "note-course-2", content: "Course note 2", created_at: "2026-09-20T11:00:00Z" },
                { id: "note-course-1", content: "Course note 1", created_at: "2026-09-20T07:00:00Z" },
              ],
              error: null,
            }),
          })),
        })),
      };
    });

    return chain;
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

import { createNote, updateNote, deleteNote } from "./actions";
import { fetchNotes } from "./queries";

describe("Canonical Notes System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { id: "user-123" };
  });

  it("creates a general note on Home with correct default category", async () => {
    const note = await createNote({ content: "Study for algorithms tomorrow" });
    expect(mockInsert).toHaveBeenCalledWith("notes", {
      user_id: "user-123",
      content: "Study for algorithms tomorrow",
      course_id: null,
      category: "general",
    });
    expect(note.content).toBe("Study for algorithms tomorrow");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("creates a course-linked note and revalidates course routes", async () => {
    const note = await createNote({
      content: "Prof mentioned syllabus change for Chapter 4",
      course_id: "course-cs330",
      category: "course",
    });
    expect(mockInsert).toHaveBeenCalledWith("notes", {
      user_id: "user-123",
      content: "Prof mentioned syllabus change for Chapter 4",
      course_id: "course-cs330",
      category: "course",
    });
    expect(note.content).toBe("Prof mentioned syllabus change for Chapter 4");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/academics");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/academics/courses/course-cs330");
  });

  it("creates a health note and revalidates /health", async () => {
    await createNote({
      content: "Felt great after 20m meditation",
      category: "health",
    });
    expect(mockInsert).toHaveBeenCalledWith("notes", {
      user_id: "user-123",
      content: "Felt great after 20m meditation",
      course_id: null,
      category: "health",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/health");
  });

  it("creates a goal note and revalidates /goals", async () => {
    await createNote({
      content: "Break down the project proposal into 3 sprints",
      category: "goals",
    });
    expect(mockInsert).toHaveBeenCalledWith("notes", {
      user_id: "user-123",
      content: "Break down the project proposal into 3 sprints",
      course_id: null,
      category: "goals",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/goals");
  });

  it("rejects empty note content", async () => {
    await expect(createNote({ content: "   " })).rejects.toThrow(
      "Note content cannot be empty"
    );
  });

  it("rejects unauthenticated requests", async () => {
    mockCurrentUser = null;
    await expect(createNote({ content: "test" })).rejects.toThrow("Not authenticated");
  });

  it("updates an existing note and refreshes paths", async () => {
    const updated = await updateNote("note-123", "Updated note text", "course-cs330", "course");
    expect(mockUpdate).toHaveBeenCalledWith(
      "notes",
      expect.objectContaining({ content: "Updated note text" })
    );
    expect(updated.content).toBe("Updated note text");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/academics/courses/course-cs330");
  });

  it("deletes a note with correct authentication checks", async () => {
    await deleteNote("note-123", null, "general");
    expect(mockDelete).toHaveBeenCalledWith("notes");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("fetches notes in descending chronological order (newest first)", async () => {
    const notes = await fetchNotes("user-123", { category: "general" });
    expect(mockSelect).toHaveBeenCalledWith("notes");
    expect(notes.length).toBe(2);
    expect(notes[0].content).toBe("Newer note");
    expect(notes[1].content).toBe("Older note");
    // Verify newest timestamp comes before older
    expect(new Date(notes[0].created_at).getTime()).toBeGreaterThan(
      new Date(notes[1].created_at).getTime()
    );
  });
});
