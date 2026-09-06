import { describe, it, expect } from "vitest";
import {
  computeGoalProgress,
  computeAllProgress,
  isOverdue,
  parentLevelFor,
  childLevelFor,
  GoalProgressNode,
} from "./engine";
import type { GoalStatus } from "./types";

function baseGoal(overrides: Partial<{
  status: GoalStatus;
  target_value: number | null;
  current_value: number | null;
  manual_progress: number | null;
}> = {}) {
  return {
    status: "in_progress" as GoalStatus,
    target_value: null,
    current_value: null,
    manual_progress: null,
    ...overrides,
  };
}

describe("parentLevelFor / childLevelFor", () => {
  it("walks the year -> quarter -> month -> week -> day hierarchy both ways", () => {
    expect(parentLevelFor("year")).toBeNull();
    expect(parentLevelFor("quarter")).toBe("year");
    expect(parentLevelFor("day")).toBe("week");
    expect(childLevelFor("day")).toBeNull();
    expect(childLevelFor("week")).toBe("day");
    expect(childLevelFor("year")).toBe("quarter");
  });
});

describe("computeGoalProgress", () => {
  it("averages children's progress when children exist, ignoring other fields", () => {
    const result = computeGoalProgress(
      baseGoal({ target_value: 100, current_value: 1, manual_progress: 5 }),
      [40, 60],
      [{ status: "completed" }]
    );
    expect(result).toEqual({ progress: 50, source: "children" });
  });

  it("uses target/current ratio when there are no children", () => {
    const result = computeGoalProgress(baseGoal({ target_value: 200, current_value: 50 }), [], []);
    expect(result).toEqual({ progress: 25, source: "target" });
  });

  it("clamps a target ratio that overshoots 100", () => {
    const result = computeGoalProgress(baseGoal({ target_value: 10, current_value: 25 }), [], []);
    expect(result.progress).toBe(100);
    expect(result.source).toBe("target");
  });

  it("derives progress from linked tasks, weighting partial at half", () => {
    const result = computeGoalProgress(baseGoal(), [], [
      { status: "completed" },
      { status: "partial" },
      { status: "not_started" },
      { status: "skipped" },
    ]);
    // (1 + 0.5 + 0 + 0) / 4 = 37.5%
    expect(result).toEqual({ progress: 37.5, source: "tasks" });
  });

  it("does not invent progress just because tasks exist with no real completion", () => {
    const result = computeGoalProgress(baseGoal(), [], [
      { status: "not_started" },
      { status: "in_progress" },
    ]);
    expect(result.progress).toBe(0);
  });

  it("falls back to manual_progress when there are no children, target, or tasks", () => {
    const result = computeGoalProgress(baseGoal({ manual_progress: 42 }), [], []);
    expect(result).toEqual({ progress: 42, source: "manual" });
  });

  it("falls back to a status-based 0/100 when nothing else is available", () => {
    expect(computeGoalProgress(baseGoal({ status: "completed" }), [], [])).toEqual({
      progress: 100,
      source: "manual",
    });
    expect(computeGoalProgress(baseGoal({ status: "not_started" }), [], [])).toEqual({
      progress: 0,
      source: "manual",
    });
  });

  it("treats a zero target as absent rather than dividing by zero", () => {
    const result = computeGoalProgress(baseGoal({ target_value: 0, current_value: 5 }), [], []);
    expect(() => result).not.toThrow();
    expect(result.source).not.toBe("target");
  });
});

describe("computeAllProgress (bottom-up hierarchy)", () => {
  it("rolls daily completion up through week -> month -> quarter -> year", () => {
    const nodes: GoalProgressNode[] = [
      { id: "year", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [], childIds: ["quarter"] },
      { id: "quarter", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [], childIds: ["month"] },
      { id: "month", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [], childIds: ["week"] },
      { id: "week", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [], childIds: ["day1", "day2"] },
      { id: "day1", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [{ status: "completed" }], childIds: [] },
      { id: "day2", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [{ status: "not_started" }], childIds: [] },
    ];

    const results = computeAllProgress(nodes);
    expect(results.get("day1")!.progress).toBe(100);
    expect(results.get("day2")!.progress).toBe(0);
    expect(results.get("week")!.progress).toBe(50); // average of the two days
    expect(results.get("month")!.progress).toBe(50);
    expect(results.get("quarter")!.progress).toBe(50);
    expect(results.get("year")!.progress).toBe(50);
  });

  it("does not double-count a child's contribution at multiple ancestor levels", () => {
    const nodes: GoalProgressNode[] = [
      { id: "parent", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [], childIds: ["childA", "childB"] },
      { id: "childA", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [{ status: "completed" }], childIds: [] },
      { id: "childB", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [{ status: "completed" }, { status: "not_started" }, { status: "not_started" }, { status: "not_started" }], childIds: [] },
    ];
    const results = computeAllProgress(nodes);
    // childA=100, childB=25 -> parent average = 62.5, not some weighted-by-task-count figure
    expect(results.get("parent")!.progress).toBe(62.5);
  });

  it("ignores a childId that does not resolve to a real goal (edge case)", () => {
    const nodes: GoalProgressNode[] = [
      { id: "parent", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [], childIds: ["ghost"] },
    ];
    expect(() => computeAllProgress(nodes)).not.toThrow();
    expect(computeAllProgress(nodes).get("parent")!.progress).toBe(0);
  });

  it("guards against a circular parent/child chain instead of infinite-looping", () => {
    const nodes: GoalProgressNode[] = [
      { id: "a", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [], childIds: ["b"] },
      { id: "b", status: "in_progress", target_value: null, current_value: null, manual_progress: null, linkedTasks: [], childIds: ["a"] },
    ];
    expect(() => computeAllProgress(nodes)).not.toThrow();
  });

  it("handles an empty goal set", () => {
    expect(computeAllProgress([]).size).toBe(0);
  });
});

describe("isOverdue", () => {
  it("is true when the due date has passed and the goal isn't finished", () => {
    expect(isOverdue("2026-09-01", "in_progress", "2026-09-06")).toBe(true);
  });

  it("is false when there is no due date", () => {
    expect(isOverdue(null, "in_progress", "2026-09-06")).toBe(false);
  });

  it("is never true for a completed or abandoned goal, even if the date passed", () => {
    expect(isOverdue("2026-09-01", "completed", "2026-09-06")).toBe(false);
    expect(isOverdue("2026-09-01", "abandoned", "2026-09-06")).toBe(false);
  });

  it("is false when the due date is today or in the future", () => {
    expect(isOverdue("2026-09-06", "in_progress", "2026-09-06")).toBe(false);
    expect(isOverdue("2026-09-10", "in_progress", "2026-09-06")).toBe(false);
  });
});
