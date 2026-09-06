// Pure functions only — no Supabase, no Date.now(), no fetch. Every function
// takes "now" and preferences/data explicitly so it's fully deterministic and
// testable, matching every other lib/*/engine.ts in this repo.
//
// Timezone handling: we never assume the server's timezone or UTC is the
// user's local time. Callers pass an IANA zone (e.g. "Asia/Kolkata") and we
// derive the user's local wall-clock time from it via Intl — the same
// mechanism the browser uses when it captures the zone in the first place.

export interface NotificationPreferences {
  enabled: boolean;
  timezone: string;
  classReminders: boolean;
  classReminderLeadMin: number;
  studyReminders: boolean;
  deadlineReminders: boolean;
  deadlineReminderLeadHours: number;
  examReminders: boolean;
  examReminderLeadHours: number;
  hydrationReminders: boolean;
  hydrationIntervalMin: number;
  hydrationStartTime: string; // "HH:MM"
  hydrationEndTime: string; // "HH:MM"
  dailyReviewReminder: boolean;
  dailyReviewTime: string; // "HH:MM"
  accountabilityReminders: boolean;
  accountabilityIntervalMin: number;
  sleepReminders: boolean;
  sleepReminderTime: string; // "HH:MM"
}

export type ReminderCategory =
  | "class_reminder"
  | "study_reminder"
  | "deadline_reminder"
  | "exam_reminder"
  | "hydration_reminder"
  | "daily_review"
  | "accountability_reminder"
  | "sleep_reminder";

export interface DueReminder {
  category: ReminderCategory;
  slot: string; // disambiguates repeatable reminders within one local day
  title: string;
  body: string;
}

/** The user's local date + minute-of-day, derived from an IANA timezone. */
export function localDateAndMinutes(
  nowUtc: Date,
  timezone: string
): { localDate: string; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(nowUtc);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const localDate = `${get("year")}-${get("month")}-${get("day")}`;
  const minuteOfDay = Number(get("hour")) * 60 + Number(get("minute"));
  return { localDate, minuteOfDay };
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * A reminder is "due" at a given wall-clock minute if `nowMinute` has just
 * reached or passed the target minute, within a tolerance window equal to
 * the dispatch interval. This makes the function safe to call at whatever
 * cadence the dispatcher actually runs at (which, per platform limits, may
 * not be every minute) without either double-firing or silently skipping a
 * reminder that fell between two runs.
 */
export function isMinuteDue(
  targetMinute: number,
  nowMinute: number,
  toleranceMinutes: number
): boolean {
  const diff = nowMinute - targetMinute;
  return diff >= 0 && diff < toleranceMinutes;
}

/** Hydration reminders repeat on an interval within a daily window. */
export function hydrationSlotsForDay(prefs: NotificationPreferences): number[] {
  const start = timeToMinutes(prefs.hydrationStartTime);
  const end = timeToMinutes(prefs.hydrationEndTime);
  const interval = Math.max(15, prefs.hydrationIntervalMin);
  const slots: number[] = [];
  for (let m = start; m <= end; m += interval) slots.push(m);
  return slots;
}

/** Accountability check-in reminders repeat on an interval, all day. */
export function accountabilitySlotsForDay(prefs: NotificationPreferences): number[] {
  const interval = Math.max(30, prefs.accountabilityIntervalMin);
  const slots: number[] = [];
  for (let m = 0; m < 24 * 60; m += interval) slots.push(m);
  return slots;
}

export interface UpcomingClassOccurrence {
  occurrenceId: string;
  className: string;
  startMinuteOfDay: number; // in the class's local day, same tz as prefs
}

export interface UpcomingDeadline {
  id: string;
  title: string;
  dueLocalDate: string; // "YYYY-MM-DD"
  dueMinuteOfDay: number;
}

export interface UpcomingAssessment {
  id: string;
  title: string;
  type: "quiz" | "exam";
  dueLocalDate: string;
  dueMinuteOfDay: number;
}

export interface UpcomingPlannedTask {
  id: string;
  title: string;
  startLocalDate: string;
  startMinuteOfDay: number;
}

/**
 * Computes every reminder that is due right now, given the user's
 * preferences and the day's raw data. Never fabricates a reminder for a
 * disabled category, and every "slot" is deterministic so the caller can
 * de-duplicate against notification_log without re-deriving this logic.
 *
 * `toleranceMinutes` should match (or exceed) the real gap between
 * dispatcher runs so a reminder isn't silently missed between two ticks.
 */
export function computeDueReminders(params: {
  nowUtc: Date;
  prefs: NotificationPreferences;
  toleranceMinutes: number;
  todaysClasses: UpcomingClassOccurrence[];
  upcomingDeadlines: UpcomingDeadline[];
  upcomingAssessments: UpcomingAssessment[];
  plannedTasksWithStart?: UpcomingPlannedTask[];
  studyReminderLeadMin?: number;
}): DueReminder[] {
  const {
    nowUtc,
    prefs,
    toleranceMinutes,
    todaysClasses,
    upcomingDeadlines,
    upcomingAssessments,
    plannedTasksWithStart = [],
    studyReminderLeadMin = 10,
  } = params;
  if (!prefs.enabled) return [];

  const { localDate, minuteOfDay } = localDateAndMinutes(nowUtc, prefs.timezone);
  const due: DueReminder[] = [];

  if (prefs.studyReminders) {
    for (const t of plannedTasksWithStart) {
      if (t.startLocalDate !== localDate) continue;
      const targetMinute = t.startMinuteOfDay - studyReminderLeadMin;
      if (isMinuteDue(targetMinute, minuteOfDay, toleranceMinutes)) {
        due.push({
          category: "study_reminder",
          slot: t.id,
          title: "Planned task starting soon",
          body: `"${t.title}" starts in ${studyReminderLeadMin} min`,
        });
      }
    }
  }

  if (prefs.classReminders) {
    for (const c of todaysClasses) {
      const targetMinute = c.startMinuteOfDay - prefs.classReminderLeadMin;
      if (isMinuteDue(targetMinute, minuteOfDay, toleranceMinutes)) {
        due.push({
          category: "class_reminder",
          slot: c.occurrenceId,
          title: "Class starting soon",
          body: `${c.className} starts in ${prefs.classReminderLeadMin} min`,
        });
      }
    }
  }

  if (prefs.deadlineReminders) {
    for (const d of upcomingDeadlines) {
      if (d.dueLocalDate !== localDate) continue;
      const targetMinute = d.dueMinuteOfDay - prefs.deadlineReminderLeadHours * 60;
      if (isMinuteDue(targetMinute, minuteOfDay, toleranceMinutes)) {
        due.push({
          category: "deadline_reminder",
          slot: d.id,
          title: "Deadline coming up",
          body: `"${d.title}" is due in ${prefs.deadlineReminderLeadHours}h`,
        });
      }
    }
  }

  if (prefs.examReminders) {
    for (const a of upcomingAssessments) {
      if (a.dueLocalDate !== localDate) continue;
      const targetMinute = a.dueMinuteOfDay - prefs.examReminderLeadHours * 60;
      if (isMinuteDue(targetMinute, minuteOfDay, toleranceMinutes)) {
        due.push({
          category: "exam_reminder",
          slot: a.id,
          title: a.type === "exam" ? "Exam coming up" : "Quiz coming up",
          body: `"${a.title}" is in ${prefs.examReminderLeadHours}h`,
        });
      }
    }
  }

  if (prefs.hydrationReminders) {
    for (const slotMinute of hydrationSlotsForDay(prefs)) {
      if (isMinuteDue(slotMinute, minuteOfDay, toleranceMinutes)) {
        due.push({
          category: "hydration_reminder",
          slot: String(slotMinute),
          title: "Hydration check",
          body: "Time for some water.",
        });
      }
    }
  }

  if (prefs.dailyReviewReminder) {
    const targetMinute = timeToMinutes(prefs.dailyReviewTime);
    if (isMinuteDue(targetMinute, minuteOfDay, toleranceMinutes)) {
      due.push({
        category: "daily_review",
        slot: "default",
        title: "Night reconciliation",
        body: "Reconcile today's plan before you close out.",
      });
    }
  }

  if (prefs.accountabilityReminders) {
    for (const slotMinute of accountabilitySlotsForDay(prefs)) {
      if (isMinuteDue(slotMinute, minuteOfDay, toleranceMinutes)) {
        due.push({
          category: "accountability_reminder",
          slot: String(slotMinute),
          title: "Quick check-in",
          body: "What are you doing right now?",
        });
      }
    }
  }

  if (prefs.sleepReminders) {
    const targetMinute = timeToMinutes(prefs.sleepReminderTime);
    if (isMinuteDue(targetMinute, minuteOfDay, toleranceMinutes)) {
      due.push({
        category: "sleep_reminder",
        slot: "default",
        title: "Wind-down reminder",
        body: "Start your sleep routine.",
      });
    }
  }

  return due;
}
