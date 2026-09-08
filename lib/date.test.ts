import { describe, it, expect } from "vitest";
import { getLocalDateISO, todayISO } from "./date";

describe("lib/date local date utility", () => {
  it("correctly maps IST early morning across UTC day boundary", () => {
    // 2026-09-08 20:00:00 UTC = 2026-09-09 01:30:00 AM IST
    const lateUtc = new Date("2026-09-08T20:00:00.000Z");
    expect(getLocalDateISO(lateUtc, "Asia/Kolkata")).toBe("2026-09-09");
  });

  it("correctly maps IST late night at 23:59:59", () => {
    // 2026-09-09 18:29:59 UTC = 2026-09-09 23:59:59 PM IST
    const lateNightIst = new Date("2026-09-09T18:29:59.000Z");
    expect(getLocalDateISO(lateNightIst, "Asia/Kolkata")).toBe("2026-09-09");
  });

  it("rolls over at 00:00:00 IST", () => {
    // 2026-09-09 18:30:00 UTC = 2026-09-10 00:00:00 AM IST
    const midnightIst = new Date("2026-09-09T18:30:00.000Z");
    expect(getLocalDateISO(midnightIst, "Asia/Kolkata")).toBe("2026-09-10");
  });

  it("returns a valid YYYY-MM-DD string for todayISO()", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
