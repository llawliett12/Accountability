import { describe, it, expect } from "vitest";
import { computeDisciplineScore, DayMetrics, nextStreakState } from "./engine";

const goodDay: DayMetrics = {
  tasksPlanned: 5,
  tasksCompleted: 4,
  tasksPartial: 1,
  tasksUnreconciled: 0,
  tasksOnTimeStart: 4,
  plannedStudyMinutes: 120,
  actualFocusMinutes: 110,
  expectedCheckIns: 6,
  actualCheckIns: 6,
  driftMinutes: 10,
  missedCommitments: 0,
  reschedules: 0,
};

describe("computeDisciplineScore", () => {
  it("scores a strong day highly and labels it well", () => {
    const result = computeDisciplineScore(goodDay);
    expect(result.score).toBeGreaterThan(65);
    expect(["EXCELLENT", "GOOD", "AVERAGE"]).toContain(result.verdictLabel);
  });

  it("never treats unreconciled tasks as failures", () => {
    const withUnreconciled: DayMetrics = { ...goodDay, tasksPlanned: 6, tasksUnreconciled: 1 };
    const baseline = computeDisciplineScore(goodDay);
    const result = computeDisciplineScore(withUnreconciled);
    // completion rate denominator drops by the unreconciled task, so the rate
    // (and therefore the score) should not fall purely because of it.
    expect(result.score).toBeGreaterThanOrEqual(baseline.score - 1);
  });

  it("penalizes missed commitments and reschedules without crashing negative score", () => {
    const badDay: DayMetrics = {
      ...goodDay,
      tasksCompleted: 1,
      tasksPartial: 0,
      tasksOnTimeStart: 0,
      actualFocusMinutes: 20,
      actualCheckIns: 1,
      driftMinutes: 150,
      missedCommitments: 3,
      reschedules: 2,
    };
    const result = computeDisciplineScore(badDay);
    expect(result.score).toBeLessThan(40);
    expect(result.negativeScore).toBeGreaterThan(0);
    expect(["WEAK", "POOR", "LOSER"]).toContain(result.verdictLabel);
  });

  it("handles a day with zero planned tasks without dividing by zero", () => {
    const emptyDay: DayMetrics = {
      tasksPlanned: 0,
      tasksCompleted: 0,
      tasksPartial: 0,
      tasksUnreconciled: 0,
      tasksOnTimeStart: 0,
      plannedStudyMinutes: 0,
      actualFocusMinutes: 0,
      expectedCheckIns: 0,
      actualCheckIns: 0,
      driftMinutes: 0,
      missedCommitments: 0,
      reschedules: 0,
    };
    expect(() => computeDisciplineScore(emptyDay)).not.toThrow();
  });
});

describe("nextStreakState", () => {
  it("starts a new streak at 1 when there is no prior record", () => {
    const result = nextStreakState(null, 0, "2026-09-06");
    expect(result).toEqual({ count: 1, alreadyRecordedToday: false });
  });

  it("increments when the last record was exactly yesterday", () => {
    const result = nextStreakState("2026-09-05", 3, "2026-09-06");
    expect(result).toEqual({ count: 4, alreadyRecordedToday: false });
  });

  it("resets to 1 when there is a gap of more than one day", () => {
    const result = nextStreakState("2026-09-01", 10, "2026-09-06");
    expect(result).toEqual({ count: 1, alreadyRecordedToday: false });
  });

  it("is idempotent when called twice on the same day", () => {
    const result = nextStreakState("2026-09-06", 4, "2026-09-06");
    expect(result).toEqual({ count: 4, alreadyRecordedToday: true });
  });

  it("handles a month boundary correctly", () => {
    const result = nextStreakState("2026-08-31", 5, "2026-09-01");
    expect(result).toEqual({ count: 6, alreadyRecordedToday: false });
  });
});
