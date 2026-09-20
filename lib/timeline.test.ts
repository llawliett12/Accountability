import { describe, it, expect } from "vitest";
import { computeInferredTimeline, type RawActivityEntry } from "./timeline";

describe("computeInferredTimeline", () => {
  it("computes inferred durations between consecutive timestamps and handles missing next timestamp", () => {
    const entries: RawActivityEntry[] = [
      {
        id: "1",
        timestamp: "2026-09-20T10:05:00Z",
        actual_activity: "Studying",
        entry_type: "journal",
      },
      {
        id: "2",
        timestamp: "2026-09-20T11:20:00Z",
        actual_activity: "Playing chess",
        entry_type: "journal",
      },
      {
        id: "3",
        timestamp: "2026-09-20T12:00:00Z",
        actual_activity: "Lunch",
        entry_type: "journal",
      },
      {
        id: "4",
        timestamp: "2026-09-20T13:10:00Z",
        actual_activity: "Studying OS",
        entry_type: "journal",
      },
      {
        id: "5",
        timestamp: "2026-09-20T15:05:00Z",
        actual_activity: "Walking",
        entry_type: "journal",
      },
    ];

    const timeline = computeInferredTimeline(entries, "UTC");
    expect(timeline).toHaveLength(5);

    // Block 1: 10:05 to 11:20 -> 1h 15m (75m)
    expect(timeline[0].startTime).toBe("10:05");
    expect(timeline[0].endTime).toBe("11:20");
    expect(timeline[0].durationMinutes).toBe(75);
    expect(timeline[0].durationLabel).toBe("1h 15m");
    expect(timeline[0].isLatest).toBe(false);

    // Block 2: 11:20 to 12:00 -> 40m
    expect(timeline[1].startTime).toBe("11:20");
    expect(timeline[1].endTime).toBe("12:00");
    expect(timeline[1].durationMinutes).toBe(40);
    expect(timeline[1].durationLabel).toBe("40m");

    // Block 3: 12:00 to 13:10 -> 1h 10m (70m)
    expect(timeline[2].startTime).toBe("12:00");
    expect(timeline[2].endTime).toBe("13:10");
    expect(timeline[2].durationMinutes).toBe(70);
    expect(timeline[2].durationLabel).toBe("1h 10m");

    // Block 4: 13:10 to 15:05 -> 1h 55m (115m)
    expect(timeline[3].startTime).toBe("13:10");
    expect(timeline[3].endTime).toBe("15:05");
    expect(timeline[3].durationMinutes).toBe(115);
    expect(timeline[3].durationLabel).toBe("1h 55m");

    // Block 5 (Last): No later check-in
    expect(timeline[4].startTime).toBe("15:05");
    expect(timeline[4].endTime).toBeNull();
    expect(timeline[4].durationMinutes).toBeNull();
    expect(timeline[4].durationLabel).toBe("No later check-in");
    expect(timeline[4].isLatest).toBe(true);
  });

  it("handles out-of-order entries by sorting chronologically", () => {
    const entries: RawActivityEntry[] = [
      { id: "2", timestamp: "2026-09-20T12:00:00Z", actual_activity: "Second" },
      { id: "1", timestamp: "2026-09-20T10:00:00Z", actual_activity: "First" },
    ];

    const timeline = computeInferredTimeline(entries, "UTC");
    expect(timeline[0].activity).toBe("First");
    expect(timeline[1].activity).toBe("Second");
    expect(timeline[0].durationLabel).toBe("2h");
    expect(timeline[1].durationLabel).toBe("No later check-in");
  });

  it("handles single entry correctly", () => {
    const entries: RawActivityEntry[] = [
      { id: "1", timestamp: "2026-09-20T10:00:00Z", actual_activity: "Single task" },
    ];

    const timeline = computeInferredTimeline(entries, "UTC");
    expect(timeline).toHaveLength(1);
    expect(timeline[0].durationLabel).toBe("No later check-in");
    expect(timeline[0].isLatest).toBe(true);
  });
});
