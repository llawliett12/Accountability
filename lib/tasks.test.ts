import { describe, it, expect } from "vitest";
import { pickTopTasks, sortTasks, isOpenTask, clampPriority } from "./tasks";

type T = { id: string; status: string; priority: number };
const t = (id: string, priority: number, status = "not_started"): T => ({ id, priority, status });

describe("tasks helpers", () => {
  it("isOpenTask treats completed/skipped/rescheduled as closed", () => {
    expect(isOpenTask({ status: "not_started" } as never)).toBe(true);
    expect(isOpenTask({ status: "in_progress" } as never)).toBe(true);
    expect(isOpenTask({ status: "partial" } as never)).toBe(true);
    expect(isOpenTask({ status: "completed" } as never)).toBe(false);
    expect(isOpenTask({ status: "skipped" } as never)).toBe(false);
    expect(isOpenTask({ status: "rescheduled" } as never)).toBe(false);
  });

  it("clampPriority keeps values in P1..P5", () => {
    expect(clampPriority(0)).toBe(1);
    expect(clampPriority(9)).toBe(5);
    expect(clampPriority(null)).toBe(3);
    expect(clampPriority(undefined)).toBe(3);
    expect(clampPriority(2)).toBe(2);
  });

  it("sortTasks puts open tasks first by priority, finished last, stable on ties", () => {
    const sorted = sortTasks([
      t("done-p1", 1, "completed"),
      t("b-p3", 3),
      t("a-p3", 3),
      t("p1", 1),
      t("p5", 5),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["p1", "b-p3", "a-p3", "p5", "done-p1"]);
  });

  it("pickTopTasks returns the top 3 OPEN tasks and never a finished one", () => {
    const top = pickTopTasks([
      t("done", 1, "completed"),
      t("p2", 2),
      t("p1", 1),
      t("p4", 4),
      t("p3", 3),
    ]);
    expect(top.map((x) => x.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("pickTopTasks backfills as tasks are completed", () => {
    const list = [t("a", 1), t("b", 2), t("c", 3), t("d", 4)];
    expect(pickTopTasks(list).map((x) => x.id)).toEqual(["a", "b", "c"]);
    list[0].status = "completed";
    expect(pickTopTasks(list).map((x) => x.id)).toEqual(["b", "c", "d"]);
  });

  it("does not mutate its input", () => {
    const list = [t("b", 2), t("a", 1)];
    pickTopTasks(list);
    sortTasks(list);
    expect(list.map((x) => x.id)).toEqual(["b", "a"]);
  });
});
