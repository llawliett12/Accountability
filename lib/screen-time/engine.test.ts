import { describe, it, expect } from "vitest";
import {
  mergeDuplicateApps,
  computeTotalMinutes,
  validateGeminiExtraction,
  validateManualEntry,
  MAX_MINUTES_PER_APP,
} from "./engine";

describe("mergeDuplicateApps", () => {
  it("sums durations for the same app name, case-insensitively", () => {
    const merged = mergeDuplicateApps([
      { app_name: "Instagram", duration_minutes: 30, category: "Social" },
      { app_name: "instagram", duration_minutes: 15, category: null },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].duration_minutes).toBe(45);
    expect(merged[0].category).toBe("Social"); // keeps the first known category
  });

  it("leaves distinct apps untouched", () => {
    const merged = mergeDuplicateApps([
      { app_name: "Instagram", duration_minutes: 30, category: null },
      { app_name: "YouTube", duration_minutes: 20, category: null },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe("computeTotalMinutes", () => {
  it("prefers the sum of apps when apps exist", () => {
    const apps = [
      { app_name: "A", duration_minutes: 30, category: null },
      { app_name: "B", duration_minutes: 20, category: null },
    ];
    expect(computeTotalMinutes(apps, 999)).toBe(50);
  });

  it("falls back to reported total when there are no apps", () => {
    expect(computeTotalMinutes([], 120)).toBe(120);
  });

  it("returns 0 when neither apps nor a valid total exist", () => {
    expect(computeTotalMinutes([], null)).toBe(0);
    expect(computeTotalMinutes([], undefined)).toBe(0);
  });

  it("caps at 24 hours", () => {
    expect(computeTotalMinutes([], 999999)).toBe(24 * 60);
  });
});

describe("validateGeminiExtraction", () => {
  it("parses a well-formed response", () => {
    const result = validateGeminiExtraction({
      date: "2026-09-06",
      total_minutes: 180,
      apps: [
        { app_name: "Instagram", duration_minutes: 60, category: "Social" },
        { app_name: "Chrome", duration_minutes: 40 },
      ],
    });
    expect(result.date).toBe("2026-09-06");
    expect(result.apps).toHaveLength(2);
    expect(result.totalMinutes).toBe(100); // sum of apps wins over reported total
    expect(result.warnings).toHaveLength(0);
  });

  it("handles a completely malformed response without throwing", () => {
    const result = validateGeminiExtraction({
      date: 12345,
      total_minutes: "not a number",
      apps: "not an array",
    } as never);
    expect(result.date).toBeNull();
    expect(result.apps).toEqual([]);
    expect(result.totalMinutes).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("skips individual malformed app entries but keeps the valid ones", () => {
    const result = validateGeminiExtraction({
      apps: [
        { app_name: "Instagram", duration_minutes: 30 },
        { app_name: "", duration_minutes: 20 }, // no name
        { duration_minutes: 10 }, // no name at all
        { app_name: "Chrome", duration_minutes: -5 }, // negative
        "just a string", // not an object
      ],
    });
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].app_name).toBe("Instagram");
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it("clamps an absurd single-app duration to the 24h cap and warns", () => {
    const result = validateGeminiExtraction({
      apps: [{ app_name: "Weird App", duration_minutes: 5000 }],
    });
    expect(result.apps[0].duration_minutes).toBe(MAX_MINUTES_PER_APP);
    expect(result.warnings.some((w) => w.includes("Weird App"))).toBe(true);
  });

  it("merges duplicate app names within one response", () => {
    const result = validateGeminiExtraction({
      apps: [
        { app_name: "TikTok", duration_minutes: 20 },
        { app_name: "TikTok", duration_minutes: 25 },
      ],
    });
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].duration_minutes).toBe(45);
  });

  it("rejects an unparseable date but keeps everything else", () => {
    const result = validateGeminiExtraction({
      date: "not-a-date",
      apps: [{ app_name: "Chrome", duration_minutes: 10 }],
    });
    expect(result.date).toBeNull();
    expect(result.apps).toHaveLength(1);
    expect(result.warnings.some((w) => w.toLowerCase().includes("date"))).toBe(true);
  });
});

describe("validateManualEntry", () => {
  it("applies the same bounds as Gemini extraction", () => {
    const result = validateManualEntry([
      { app_name: "Instagram", duration_minutes: 9999, category: null },
    ]);
    expect(result.apps[0].duration_minutes).toBe(MAX_MINUTES_PER_APP);
  });

  it("accepts a clean manual entry", () => {
    const result = validateManualEntry(
      [{ app_name: "Instagram", duration_minutes: 45, category: "Social" }],
      45
    );
    expect(result.totalMinutes).toBe(45);
    expect(result.warnings).toHaveLength(0);
  });
});
