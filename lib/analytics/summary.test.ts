import { describe, it, expect } from "vitest";
import { summarizePeriod, averagePositive } from "./summary";
import type { DailyMetricsRow } from "./queries";

function row(date: string, over: Partial<DailyMetricsRow> = {}): DailyMetricsRow {
  return {
    date,
    tasksPlanned: 0,
    tasksCompleted: 0,
    focusMinutes: 0,
    pauseCount: 0,
    pauseReasons: {},
    driftCount: 0,
    disciplineScore: null,
    negativeScore: null,
    sleepMinutes: null,
    meditationMinutes: 0,
    moodAvg: null,
    energyAvg: null,
    ...over,
  };
}

describe("summarizePeriod (shared weekly / monthly / review numbers)", () => {
  it("totals tasks, focus and completion rate", () => {
    const s = summarizePeriod([
      row("2026-09-01", { tasksPlanned: 4, tasksCompleted: 3, focusMinutes: 90 }),
      row("2026-09-02", { tasksPlanned: 2, tasksCompleted: 0, focusMinutes: 30 }),
    ]);
    expect(s.tasksPlanned).toBe(6);
    expect(s.tasksCompleted).toBe(3);
    expect(s.completionRate).toBe(50);
    expect(s.focusMinutes).toBe(120);
    expect(s.days).toBe(2);
  });

  it("returns null (not 0) for averages with no data", () => {
    const s = summarizePeriod([row("2026-09-01"), row("2026-09-02")]);
    expect(s.avgDisciplineScore).toBeNull();
    expect(s.avgSleepMinutes).toBeNull();
    expect(s.avgMood).toBeNull();
    expect(s.strongestDay).toBeNull();
    expect(s.completionRate).toBe(0);
    expect(s.topPauseReason).toBeNull();
  });

  it("averages sleep over logged nights only", () => {
    const s = summarizePeriod([
      row("2026-09-01", { sleepMinutes: 420 }),
      row("2026-09-02", { sleepMinutes: 0 }),
      row("2026-09-03", { sleepMinutes: null }),
      row("2026-09-04", { sleepMinutes: 480 }),
    ]);
    expect(s.avgSleepMinutes).toBe(450);
  });

  it("finds strongest/weakest day and consistency from scored days only", () => {
    const s = summarizePeriod([
      row("2026-09-01", { disciplineScore: 60 }),
      row("2026-09-02", { disciplineScore: 90 }),
      row("2026-09-03"),
    ]);
    expect(s.scoredDays).toBe(2);
    expect(s.avgDisciplineScore).toBe(75);
    expect(s.strongestDay).toEqual({ date: "2026-09-02", value: 90 });
    expect(s.weakestDay).toEqual({ date: "2026-09-01", value: 60 });
    expect(s.consistency).toBeGreaterThan(0);
  });

  it("merges pause reasons and reports the most common", () => {
    const s = summarizePeriod([
      row("2026-09-01", { pauseCount: 3, pauseReasons: { phone: 2, food: 1 } }),
      row("2026-09-02", { pauseCount: 2, pauseReasons: { phone: 1, tired: 1 } }),
    ]);
    expect(s.pauseCount).toBe(5);
    expect(s.pauseReasonTotals).toEqual({ phone: 3, food: 1, tired: 1 });
    expect(s.topPauseReason).toBe("phone");
  });

  it("gives identical numbers for the same rows regardless of caller", () => {
    const rows = [
      row("2026-09-01", { tasksPlanned: 5, tasksCompleted: 4, focusMinutes: 100, disciplineScore: 80 }),
      row("2026-09-02", { tasksPlanned: 5, tasksCompleted: 2, focusMinutes: 50, disciplineScore: 60 }),
    ];
    expect(summarizePeriod(rows)).toEqual(summarizePeriod([...rows]));
  });

  it("averagePositive ignores zero / null", () => {
    expect(averagePositive([0, null, undefined, 60, 120])).toBe(90);
    expect(averagePositive([0, null])).toBeNull();
  });
});
