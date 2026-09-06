import { describe, it, expect } from "vitest";
import {
  localDateAndMinutes,
  isMinuteDue,
  hydrationSlotsForDay,
  accountabilitySlotsForDay,
  computeDueReminders,
  NotificationPreferences,
} from "./engine";

const basePrefs: NotificationPreferences = {
  enabled: true,
  timezone: "Asia/Kolkata",
  classReminders: true,
  classReminderLeadMin: 15,
  studyReminders: true,
  deadlineReminders: true,
  deadlineReminderLeadHours: 24,
  examReminders: true,
  examReminderLeadHours: 24,
  hydrationReminders: false,
  hydrationIntervalMin: 120,
  hydrationStartTime: "09:00",
  hydrationEndTime: "21:00",
  dailyReviewReminder: true,
  dailyReviewTime: "21:30",
  accountabilityReminders: false,
  accountabilityIntervalMin: 180,
  sleepReminders: false,
  sleepReminderTime: "22:30",
};

describe("localDateAndMinutes", () => {
  it("derives the correct local date/time for a timezone ahead of UTC", () => {
    // 2026-01-01T20:00:00Z is 2026-01-02T01:30 in Asia/Kolkata (+5:30)
    const { localDate, minuteOfDay } = localDateAndMinutes(
      new Date("2026-01-01T20:00:00Z"),
      "Asia/Kolkata"
    );
    expect(localDate).toBe("2026-01-02");
    expect(minuteOfDay).toBe(1 * 60 + 30);
  });

  it("derives the correct local date/time for a timezone behind UTC", () => {
    // 2026-01-01T02:00:00Z is 2025-12-31T21:00 in America/New_York (EST, UTC-5 in January)
    const { localDate, minuteOfDay } = localDateAndMinutes(
      new Date("2026-01-01T02:00:00Z"),
      "America/New_York"
    );
    expect(localDate).toBe("2025-12-31");
    expect(minuteOfDay).toBe(21 * 60);
  });

  it("never assumes UTC or a hardcoded India offset — different zones diverge", () => {
    const utc = localDateAndMinutes(new Date("2026-06-01T12:00:00Z"), "UTC");
    const kolkata = localDateAndMinutes(new Date("2026-06-01T12:00:00Z"), "Asia/Kolkata");
    const nyc = localDateAndMinutes(new Date("2026-06-01T12:00:00Z"), "America/New_York");
    expect(utc.minuteOfDay).not.toBe(kolkata.minuteOfDay);
    expect(utc.minuteOfDay).not.toBe(nyc.minuteOfDay);
    expect(kolkata.minuteOfDay).not.toBe(nyc.minuteOfDay);
  });
});

describe("isMinuteDue", () => {
  it("is due exactly at the target minute", () => {
    expect(isMinuteDue(600, 600, 10)).toBe(true);
  });
  it("is due within the tolerance window after the target", () => {
    expect(isMinuteDue(600, 605, 10)).toBe(true);
  });
  it("is not due before the target minute", () => {
    expect(isMinuteDue(600, 599, 10)).toBe(false);
  });
  it("is not due once past the tolerance window", () => {
    expect(isMinuteDue(600, 611, 10)).toBe(false);
  });
});

describe("hydrationSlotsForDay", () => {
  it("generates evenly spaced slots within the configured window", () => {
    const slots = hydrationSlotsForDay({
      ...basePrefs,
      hydrationIntervalMin: 120,
      hydrationStartTime: "09:00",
      hydrationEndTime: "13:00",
    });
    expect(slots).toEqual([9 * 60, 11 * 60, 13 * 60]);
  });

  it("clamps an absurdly small interval to avoid spamming", () => {
    const slots = hydrationSlotsForDay({
      ...basePrefs,
      hydrationIntervalMin: 1,
      hydrationStartTime: "09:00",
      hydrationEndTime: "09:30",
    });
    // clamped to 15 min minimum
    expect(slots).toEqual([9 * 60, 9 * 60 + 15, 9 * 60 + 30]);
  });
});

describe("accountabilitySlotsForDay", () => {
  it("spans the full day at the configured interval", () => {
    const slots = accountabilitySlotsForDay({ ...basePrefs, accountabilityIntervalMin: 360 });
    expect(slots).toEqual([0, 360, 720, 1080]);
  });

  it("clamps an absurdly small interval", () => {
    const slots = accountabilitySlotsForDay({ ...basePrefs, accountabilityIntervalMin: 1 });
    expect(slots.length).toBe(48); // 24h / 30min minimum
  });
});

describe("computeDueReminders", () => {
  it("returns nothing when notifications are globally disabled", () => {
    const due = computeDueReminders({
      nowUtc: new Date("2026-01-01T00:00:00Z"),
      prefs: { ...basePrefs, enabled: false },
      toleranceMinutes: 15,
      todaysClasses: [{ occurrenceId: "c1", className: "DBMS", startMinuteOfDay: 60 }],
      upcomingDeadlines: [],
      upcomingAssessments: [],
    });
    expect(due).toEqual([]);
  });

  it("never fires a category the user disabled, even with matching data", () => {
    const due = computeDueReminders({
      nowUtc: new Date("2026-01-01T00:00:00Z"), // 05:30 IST
      prefs: { ...basePrefs, classReminders: false },
      toleranceMinutes: 15,
      todaysClasses: [{ occurrenceId: "c1", className: "DBMS", startMinuteOfDay: 5 * 60 + 45 }],
      upcomingDeadlines: [],
      upcomingAssessments: [],
    });
    expect(due.find((d) => d.category === "class_reminder")).toBeUndefined();
  });

  it("fires a class reminder exactly at the lead-time boundary", () => {
    // 05:30 IST local time; class starts 05:45 IST, lead 15min -> target 05:30
    const due = computeDueReminders({
      nowUtc: new Date("2026-01-01T00:00:00Z"),
      prefs: basePrefs,
      toleranceMinutes: 5,
      todaysClasses: [{ occurrenceId: "c1", className: "DBMS", startMinuteOfDay: 5 * 60 + 45 }],
      upcomingDeadlines: [],
      upcomingAssessments: [],
    });
    expect(due).toEqual([
      {
        category: "class_reminder",
        slot: "c1",
        title: "Class starting soon",
        body: "DBMS starts in 15 min",
      },
    ]);
  });

  it("does not fire a deadline reminder for a different local date", () => {
    const due = computeDueReminders({
      nowUtc: new Date("2026-01-01T00:00:00Z"), // local date 2026-01-01 in IST
      prefs: basePrefs,
      toleranceMinutes: 15,
      todaysClasses: [],
      upcomingDeadlines: [
        { id: "d1", title: "Assignment", dueLocalDate: "2026-01-05", dueMinuteOfDay: 600 },
      ],
      upcomingAssessments: [],
    });
    expect(due).toEqual([]);
  });

  it("fires the daily review reminder at the configured local time", () => {
    // 21:30 IST = 16:00 UTC same day
    const due = computeDueReminders({
      nowUtc: new Date("2026-01-01T16:00:00Z"),
      prefs: basePrefs,
      toleranceMinutes: 5,
      todaysClasses: [],
      upcomingDeadlines: [],
      upcomingAssessments: [],
    });
    expect(due).toEqual([
      { category: "daily_review", slot: "default", title: "Night reconciliation", body: "Reconcile today's plan before you close out." },
    ]);
  });

  it("fires a study reminder for a planned task starting soon", () => {
    const due = computeDueReminders({
      nowUtc: new Date("2026-01-01T00:00:00Z"), // 05:30 IST
      prefs: basePrefs,
      toleranceMinutes: 5,
      todaysClasses: [],
      upcomingDeadlines: [],
      upcomingAssessments: [],
      plannedTasksWithStart: [
        { id: "t1", title: "DSA revision", startLocalDate: "2026-01-01", startMinuteOfDay: 5 * 60 + 40 },
      ],
      studyReminderLeadMin: 10,
    });
    expect(due).toEqual([
      { category: "study_reminder", slot: "t1", title: "Planned task starting soon", body: '"DSA revision" starts in 10 min' },
    ]);
  });

  it("produces a stable, unique slot per hydration tick so duplicates can be deduped", () => {
    const due = computeDueReminders({
      nowUtc: new Date("2026-01-01T03:30:00Z"), // 09:00 IST
      prefs: { ...basePrefs, hydrationReminders: true },
      toleranceMinutes: 5,
      todaysClasses: [],
      upcomingDeadlines: [],
      upcomingAssessments: [],
    });
    const hydration = due.filter((d) => d.category === "hydration_reminder");
    expect(hydration).toHaveLength(1);
    expect(hydration[0].slot).toBe(String(9 * 60));
  });
});
