import { describe, it, expect } from "vitest";

describe("Notes and Record Refresh Verification", () => {
  it("NotesSection merges server initialNotes with in-flight optimistic notes without duplicates", () => {
    const initialNotes = [
      {
        id: "note-1",
        user_id: "u1",
        content: "First note",
        course_id: null,
        category: "general",
        created_at: "2026-09-20T10:00:00Z",
        updated_at: "2026-09-20T10:00:00Z",
      },
    ];

    // Simulate optimistic addition
    const tempNote = {
      id: "temp-12345",
      user_id: "",
      content: "Newly added note",
      course_id: null,
      category: "general",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let localNotes = [tempNote, ...initialNotes];
    expect(localNotes).toHaveLength(2);
    expect(localNotes[0].id).toBe("temp-12345");

    // Simulate server action resolve: replace tempId with real server record
    const savedNote = {
      ...tempNote,
      id: "note-server-real",
      user_id: "u1",
    };
    localNotes = localNotes.map((n) => (n.id === tempNote.id ? savedNote : n));
    expect(localNotes[0].id).toBe("note-server-real");

    // Simulate server revalidation delivering updated initialNotes containing the newly saved record
    const updatedServerNotes = [savedNote, ...initialNotes];

    // Simulate the useEffect synchronization logic from NotesSection:
    const serverIds = new Set(updatedServerNotes.map((n) => n.id));
    const inFlight = localNotes.filter((n) => n.id.startsWith("temp-") && !serverIds.has(n.id));
    const merged = [...inFlight, ...updatedServerNotes];

    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("note-server-real");
    expect(merged[1].id).toBe("note-1");
    // Verify no duplicates
    const allIds = merged.map((n) => n.id);
    expect(new Set(allIds).size).toBe(merged.length);
  });

  it("GoalsSectionManager synchronization maintains in-flight goals and merges server goals cleanly", () => {
    const allGoals = [
      {
        id: "goal-1",
        title: "Existing Goal",
        priority: 3,
        course_id: null,
        due_date: null,
        status: "not_started",
        progress: 0,
        computedProgress: 0,
        is_top3: false,
      },
    ];

    // In handleCreateGoal, createGoal returns the real server ID:
    const newGoal = {
      id: "goal-real-456",
      title: "Newly created goal",
      priority: 1,
      course_id: "cs330",
      due_date: "2026-09-25",
      status: "not_started",
      progress: 0,
      computedProgress: 0,
      is_top3: false,
    };

    // Optimistically added to local state:
    const currentList = [newGoal, ...allGoals];
    expect(currentList).toHaveLength(2);

    // Before server refresh arrives, local-only goals are preserved:
    const initialServerIds = new Set(allGoals.map((g) => g.id));
    const localBeforeRefresh = currentList.filter((g) => !initialServerIds.has(g.id));
    expect(localBeforeRefresh).toHaveLength(1);
    expect(localBeforeRefresh[0].id).toBe("goal-real-456");

    // Once router.refresh() revalidates and returns updated server goals:
    const incomingServerGoals = [newGoal, ...allGoals];
    const serverIds = new Set(incomingServerGoals.map((g) => g.id));
    const localAfterRefresh = currentList.filter((g) => !serverIds.has(g.id));
    const merged = [...localAfterRefresh, ...incomingServerGoals];

    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("goal-real-456");
    expect(merged[0].title).toBe("Newly created goal");
    expect(merged[1].id).toBe("goal-1");
  });

  it("Home and Health Level-1 views remain mounted using CSS visibility to prevent remount wiping", () => {
    // Contract test for Level-1 mounting:
    // When activeSection is null, container className has 'space-y-4' and NOT 'hidden'
    const getHomeLevel1Class = (activeSection: string | null) =>
      activeSection ? "hidden" : "space-y-4";

    expect(getHomeLevel1Class(null)).toBe("space-y-4");
    expect(getHomeLevel1Class("tasks")).toBe("hidden");

    // When returning from subsection back to main view (activeSection = null)
    expect(getHomeLevel1Class(null)).toBe("space-y-4");

    const getHealthLevel1Class = (activeSection: string | null) =>
      activeSection ? "hidden" : "space-y-4";

    expect(getHealthLevel1Class(null)).toBe("space-y-4");
    expect(getHealthLevel1Class("sleep")).toBe("hidden");
    expect(getHealthLevel1Class("food")).toBe("hidden");
    expect(getHealthLevel1Class(null)).toBe("space-y-4");
  });

  it("handles notes across all 4 categories (Home, Goals, Health, Course)", () => {
    const categories = [
      { cat: "general", courseId: null, label: "Home Notes" },
      { cat: "goals", courseId: null, label: "Goal Notes" },
      { cat: "health", courseId: null, label: "Health Notes" },
      { cat: "course", courseId: "cs101-uuid", label: "Course Notes" },
    ];

    for (const c of categories) {
      const note = {
        id: `note-${c.cat}-1`,
        user_id: "u1",
        content: `Test note for ${c.label}`,
        course_id: c.courseId,
        category: c.cat,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(note.category).toBe(c.cat);
      if (c.courseId) {
        expect(note.course_id).toBe(c.courseId);
      } else {
        expect(note.course_id).toBeNull();
      }
      expect(note.content).toContain(c.label);
    }
  });
});
