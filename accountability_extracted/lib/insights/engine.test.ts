import { describe, it, expect } from "vitest";
import { buildPattern, buildGroupComparison, extractPairs, DEFAULT_MIN_SAMPLE_SIZE } from "./engine";

describe("extractPairs", () => {
  it("only includes rows where both values are present", () => {
    const rows = [
      { a: 1, b: 2 },
      { a: null, b: 3 },
      { a: 4, b: null },
      { a: 5, b: 6 },
    ];
    const { xs, ys } = extractPairs(
      rows,
      (r) => r.a,
      (r) => r.b
    );
    expect(xs).toEqual([1, 5]);
    expect(ys).toEqual([2, 6]);
  });
});

describe("buildPattern", () => {
  it("reports insufficient data below the minimum sample size", () => {
    const xs = [1, 2, 3];
    const ys = [1, 2, 3];
    const pattern = buildPattern("Sleep", "Focus", xs, ys, 7);
    expect(pattern.insufficientData).toBe(true);
    expect(pattern.interpretation).toBe("Not enough data yet.");
    expect(pattern.r).toBeNull();
  });

  it("finds a strong positive correlation with enough data", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const ys = [2, 4, 6, 8, 10, 12, 14, 16];
    const pattern = buildPattern("Sleep", "Focus", xs, ys, 7);
    expect(pattern.insufficientData).toBe(false);
    expect(pattern.direction).toBe("positive");
    expect(pattern.strength).toBe("strong");
    expect(pattern.interpretation).toContain("not proof");
  });

  it("finds a negative correlation", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const ys = [16, 14, 12, 10, 8, 6, 4, 2];
    const pattern = buildPattern("Screen time", "Focus", xs, ys, 7);
    expect(pattern.direction).toBe("negative");
    expect(pattern.interpretation).toContain("lower");
  });

  it("does not exaggerate a weak correlation", () => {
    // Near-random data with 8 points that produces a weak r.
    const xs = [1, 5, 2, 8, 3, 7, 4, 6];
    const ys = [5, 2, 8, 1, 7, 3, 6, 4];
    const pattern = buildPattern("A", "B", xs, ys, 7);
    expect(pattern.insufficientData).toBe(false);
    if (pattern.strength === "weak") {
      expect(pattern.interpretation).toContain("not a reliable pattern");
    }
  });

  it("uses the default minimum sample size when not specified", () => {
    const xs = Array.from({ length: DEFAULT_MIN_SAMPLE_SIZE - 1 }, (_, i) => i);
    const ys = Array.from({ length: DEFAULT_MIN_SAMPLE_SIZE - 1 }, (_, i) => i);
    expect(buildPattern("A", "B", xs, ys).insufficientData).toBe(true);
  });

  it("handles zero-variance input without throwing", () => {
    const xs = [5, 5, 5, 5, 5, 5, 5, 5];
    const ys = [1, 2, 3, 4, 5, 6, 7, 8];
    const pattern = buildPattern("A", "B", xs, ys, 7);
    expect(pattern.insufficientData).toBe(true); // pearsonCorrelation returns null here
  });
});

describe("buildGroupComparison", () => {
  it("reports insufficient data when either group is too small", () => {
    const result = buildGroupComparison("Morning", "Evening", [10, 20], [30, 40], 7);
    expect(result.insufficientData).toBe(true);
  });

  it("identifies the higher-averaging group", () => {
    const morning = [10, 20, 15, 25, 30, 20, 15];
    const evening = [40, 50, 45, 55, 60, 50, 45];
    const result = buildGroupComparison("Morning", "Evening", morning, evening, 7);
    expect(result.insufficientData).toBe(false);
    expect(result.interpretation).toContain("Evening");
  });
});
