import { describe, it, expect } from "vitest";
import {
  computeAttendanceStats,
  isDeadlineOverdue,
  isAssessmentPast,
  occurrenceDatesInRange,
  weekBounds,
  shiftWeek,
  summarizePrepReview,
  averageAssessmentPercentage,
  compareToTarget,
  averagePracticeScore,
} from "./engine";

describe("computeAttendanceStats", () => {
  it("returns null percentage when nothing has been tracked yet (never fabricates 0 or 100)", () => {
    const stats = computeAttendanceStats(
      [{ attendance_status: null }, { attendance_status: null }],
      75
    );
    expect(stats.percentage).toBeNull();
    expect(stats.zone).toBeNull();
    expect(stats.totalOccurrences).toBe(2);
    expect(stats.trackedCount).toBe(0);
  });

  it("counts present and late as attended, absent as not, excludes untracked", () => {
    const stats = computeAttendanceStats(
      [
        { attendance_status: "present" },
        { attendance_status: "late" },
        { attendance_status: "absent" },
        { attendance_status: null },
      ],
      75
    );
    // 2 of 3 countable (present+late+absent) attended
    expect(stats.percentage).toBeCloseTo(66.7, 1);
    expect(stats.trackedCount).toBe(3);
  });

  it("excludes excused absences from the denominator entirely", () => {
    const stats = computeAttendanceStats(
      [
        { attendance_status: "present" },
        { attendance_status: "excused" },
        { attendance_status: "excused" },
      ],
      75
    );
    // Only the 1 present occurrence is countable; excused don't help or hurt.
    expect(stats.percentage).toBe(100);
  });

  it("classifies zones relative to target with a 10-point warning band", () => {
    const safe = computeAttendanceStats(
      Array(10).fill({ attendance_status: "present" }),
      75
    );
    expect(safe.zone).toBe("safe");

    const warning = computeAttendanceStats(
      [
        ...Array(7).fill({ attendance_status: "present" }),
        ...Array(3).fill({ attendance_status: "absent" }),
      ],
      75
    );
    expect(warning.zone).toBe("warning");

    const danger = computeAttendanceStats(
      [
        ...Array(5).fill({ attendance_status: "present" }),
        ...Array(5).fill({ attendance_status: "absent" }),
      ],
      75
    );
    expect(danger.zone).toBe("danger");
  });
});

describe("isDeadlineOverdue / isAssessmentPast", () => {
  it("is never overdue once completed, regardless of date", () => {
    expect(isDeadlineOverdue("2020-01-01", "completed", "2026-01-01")).toBe(false);
  });

  it("is overdue only once the due date has passed and it's still pending", () => {
    expect(isDeadlineOverdue("2026-01-01", "pending", "2026-01-02")).toBe(true);
    expect(isDeadlineOverdue("2026-01-02", "pending", "2026-01-01")).toBe(false);
  });

  it("assessments follow the same past/completed logic", () => {
    expect(isAssessmentPast("2026-01-01", "upcoming", "2026-01-02")).toBe(true);
    expect(isAssessmentPast("2026-01-01", "completed", "2026-01-02")).toBe(false);
  });
});

describe("occurrenceDatesInRange", () => {
  it("returns every date matching the weekday, never inventing off-pattern dates", () => {
    // 2026-01-01 is a Thursday (day 4).
    const dates = occurrenceDatesInRange(4, "2026-01-01", "2026-01-22");
    expect(dates).toEqual(["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22"]);
  });

  it("returns an empty array when start is after end", () => {
    expect(occurrenceDatesInRange(1, "2026-02-01", "2026-01-01")).toEqual([]);
  });

  it("handles a range with no matching weekday cleanly", () => {
    const dates = occurrenceDatesInRange(2, "2026-01-01", "2026-01-01"); // Thu range, Tue target
    expect(dates).toEqual([]);
  });
});

describe("weekBounds / shiftWeek", () => {
  it("returns Monday-Sunday bounds for a mid-week date", () => {
    // 2026-01-01 is a Thursday.
    expect(weekBounds("2026-01-01")).toEqual(["2025-12-29", "2026-01-04"]);
  });

  it("handles a Sunday date correctly", () => {
    // 2026-01-04 is a Sunday; its week should still be the same Mon-Sun span.
    expect(weekBounds("2026-01-04")).toEqual(["2025-12-29", "2026-01-04"]);
  });

  it("shifts forward and backward by whole weeks", () => {
    expect(shiftWeek("2026-01-01", 1)).toBe("2026-01-08");
    expect(shiftWeek("2026-01-01", -1)).toBe("2025-12-25");
  });
});

describe("summarizePrepReview", () => {
  it("only counts held occurrences, ignoring scheduled/cancelled", () => {
    const summary = summarizePrepReview([
      { prepared: true, reviewed: false, status: "held" },
      { prepared: false, reviewed: true, status: "held" },
      { prepared: true, reviewed: true, status: "scheduled" },
      { prepared: false, reviewed: false, status: "cancelled" },
    ]);
    expect(summary.heldCount).toBe(2);
    expect(summary.preparedRate).toBe(50);
    expect(summary.reviewedRate).toBe(50);
  });

  it("returns null rates rather than 0 when there are no held occurrences yet", () => {
    const summary = summarizePrepReview([{ prepared: false, reviewed: false, status: "scheduled" }]);
    expect(summary.preparedRate).toBeNull();
    expect(summary.reviewedRate).toBeNull();
  });
});

describe("averageAssessmentPercentage", () => {
  it("averages only scored assessments, never fabricating a score for upcoming ones", () => {
    const avg = averageAssessmentPercentage([
      { score: 8, max_score: 10 },
      { score: null, max_score: null },
      { score: 18, max_score: 20 },
    ]);
    expect(avg).toBe(85);
  });

  it("returns null when nothing has been scored yet", () => {
    expect(averageAssessmentPercentage([{ score: null, max_score: null }])).toBeNull();
  });

  it("ignores a zero max_score to avoid a division-by-zero fabrication", () => {
    const avg = averageAssessmentPercentage([{ score: 0, max_score: 0 }]);
    expect(avg).toBeNull();
  });
});

describe("compareToTarget", () => {
  it("returns null when either value is missing, never inventing a comparison", () => {
    expect(compareToTarget(null, 90)).toBeNull();
    expect(compareToTarget(80, undefined)).toBeNull();
  });

  it("computes delta and met correctly", () => {
    expect(compareToTarget(80, 90)).toEqual({ target: 80, actual: 90, delta: 10, met: true });
    expect(compareToTarget(80, 70)).toEqual({ target: 80, actual: 70, delta: -10, met: false });
  });

  it("treats hitting the target exactly as met", () => {
    expect(compareToTarget(80, 80)?.met).toBe(true);
  });
});

describe("averagePracticeScore", () => {
  it("returns null for an empty list instead of NaN", () => {
    expect(averagePracticeScore([])).toBeNull();
  });

  it("averages practice attempts", () => {
    expect(averagePracticeScore([70, 80, 90])).toBe(80);
  });
});
