import type { NotificationPreferences } from "./engine";

export type { NotificationPreferences };

// Snake_case row shape as stored in Postgres (notification_preferences table).
export interface NotificationPreferencesRow {
  user_id: string;
  enabled: boolean;
  timezone: string;
  class_reminders: boolean;
  class_reminder_lead_min: number;
  study_reminders: boolean;
  deadline_reminders: boolean;
  deadline_reminder_lead_hours: number;
  exam_reminders: boolean;
  exam_reminder_lead_hours: number;
  hydration_reminders: boolean;
  hydration_interval_min: number;
  hydration_start_time: string;
  hydration_end_time: string;
  daily_review_reminder: boolean;
  daily_review_time: string;
  accountability_reminders: boolean;
  accountability_interval_min: number;
  sleep_reminders: boolean;
  sleep_reminder_time: string;
}

export function rowToPreferences(row: NotificationPreferencesRow): NotificationPreferences {
  return {
    enabled: row.enabled,
    timezone: row.timezone,
    classReminders: row.class_reminders,
    classReminderLeadMin: row.class_reminder_lead_min,
    studyReminders: row.study_reminders,
    deadlineReminders: row.deadline_reminders,
    deadlineReminderLeadHours: row.deadline_reminder_lead_hours,
    examReminders: row.exam_reminders,
    examReminderLeadHours: row.exam_reminder_lead_hours,
    hydrationReminders: row.hydration_reminders,
    hydrationIntervalMin: row.hydration_interval_min,
    hydrationStartTime: row.hydration_start_time?.slice(0, 5) ?? "09:00",
    hydrationEndTime: row.hydration_end_time?.slice(0, 5) ?? "21:00",
    dailyReviewReminder: row.daily_review_reminder,
    dailyReviewTime: row.daily_review_time?.slice(0, 5) ?? "21:30",
    accountabilityReminders: row.accountability_reminders,
    accountabilityIntervalMin: row.accountability_interval_min,
    sleepReminders: row.sleep_reminders,
    sleepReminderTime: row.sleep_reminder_time?.slice(0, 5) ?? "22:30",
  };
}

export function preferencesToRow(
  userId: string,
  prefs: NotificationPreferences
): NotificationPreferencesRow {
  return {
    user_id: userId,
    enabled: prefs.enabled,
    timezone: prefs.timezone,
    class_reminders: prefs.classReminders,
    class_reminder_lead_min: prefs.classReminderLeadMin,
    study_reminders: prefs.studyReminders,
    deadline_reminders: prefs.deadlineReminders,
    deadline_reminder_lead_hours: prefs.deadlineReminderLeadHours,
    exam_reminders: prefs.examReminders,
    exam_reminder_lead_hours: prefs.examReminderLeadHours,
    hydration_reminders: prefs.hydrationReminders,
    hydration_interval_min: prefs.hydrationIntervalMin,
    hydration_start_time: prefs.hydrationStartTime,
    hydration_end_time: prefs.hydrationEndTime,
    daily_review_reminder: prefs.dailyReviewReminder,
    daily_review_time: prefs.dailyReviewTime,
    accountability_reminders: prefs.accountabilityReminders,
    accountability_interval_min: prefs.accountabilityIntervalMin,
    sleep_reminders: prefs.sleepReminders,
    sleep_reminder_time: prefs.sleepReminderTime,
  };
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  timezone: "UTC",
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
