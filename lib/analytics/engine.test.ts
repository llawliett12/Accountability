import { describe, it, expect } from "vitest";
import {
  average,
  sum,
  compare,
  strongestDay,
  weakestDay,
  consistencyScore,
  pearsonCorrelation,
} from "./engine";

describe("sum/average", () => {
  it("computes sum and average correctly", () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(average([1, 2, 3])).toBe(2);
  });

  it("handles empty arrays without throwing", () => {
    expect(sum([])).toBe(0);
    expect(average([])).toBe(0);
  });
});

describe("compare", () => {
  it("reports up/down/flat correctly", () => {
    expect(compare(10, 5).direction).toBe("up");
    expect(compare(5, 10).direction).toBe("down");
    expect(compare(5, 5).direction).toBe("flat");
  });

  it("returns null percentChange when previous is 0", () => {
    expect(compare(5, 0).percentChange).toBeNull();
  });

  it("computes percent change correctly", () => {
    expect(compare(15, 10).percentChange).toBe(50);
  });
});

describe("strongestDay/weakestDay", () => {
  const days = [
    { date: "2026-09-01", value: 70 },
    { date: "2026-09-02", value: 95 },
    { date: "2026-09-03", value: 40 },
  ];

  it("finds the strongest and weakest day", () => {
    expect(strongestDay(days)?.date).toBe("2026-09-02");
    expect(weakestDay(days)?.date).toBe("2026-09-03");
  });

  it("returns null for empty input", () => {
    expect(strongestDay([])).toBeNull();
    expect(weakestDay([])).toBeNull();
  });
});

describe("consistencyScore", () => {
  it("scores identical values as perfectly consistent", () => {
    expect(consistencyScore([80, 80, 80])).toBe(100);
  });

  it("scores wildly varying values as inconsistent", () => {
    expect(consistencyScore([0, 100, 0, 100])).toBeLessThan(20);
  });
});

describe("pearsonCorrelation", () => {
  it("finds a strong positive correlation", () => {
    const r = pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8]);
    expect(r).toBeCloseTo(1, 1);
  });

  it("returns null with fewer than 3 points", () => {
    expect(pearsonCorrelation([1, 2], [1, 2])).toBeNull();
  });

  it("returns null when one series has zero variance", () => {
    expect(pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});
