"use client";

import { useState, useTransition } from "react";
import { saveNotificationPreferences } from "@/lib/notifications/actions";
import { enableWebPush, disableWebPush, getNotificationSupport, PermissionState } from "@/lib/notifications/push-client";
import type { NotificationPreferences } from "@/lib/notifications/engine";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between py-2">
      <span className="text-sm text-neutral-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`h-6 w-11 rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-neutral-700"}`}
      >
        <span
          className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </button>
    </label>
  );
}

export default function NotificationSettingsForm({
  initialPrefs,
}: {
  initialPrefs: NotificationPreferences;
}) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [permission, setPermission] = useState<PermissionState>(() => getNotificationSupport());
  const [pushError, setPushError] = useState<string | null>(null);

  function update<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  function save(next: NotificationPreferences = prefs) {
    startTransition(async () => {
      await saveNotificationPreferences(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    });
  }

  async function handleEnableClick() {
    setPushError(null);
    try {
      const result = await enableWebPush();
      setPermission(result);
      if (result === "granted") {
        const next = { ...prefs, enabled: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        setPrefs(next);
        save(next);
      } else if (result === "denied") {
        setPushError("Notification permission was denied in the browser. Enable it from your browser/site settings to turn reminders back on.");
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Couldn't enable notifications.");
    }
  }

  async function handleDisableClick() {
    await disableWebPush();
    const next = { ...prefs, enabled: false };
    setPrefs(next);
    save(next);
  }

  if (permission === "unsupported") {
    return (
      <div className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-1 text-sm font-medium text-neutral-400">Notifications</h2>
        <p className="text-xs text-neutral-500">
          This browser doesn&apos;t support push notifications for installed apps. On Android,
          install the app to your home screen from Chrome and reopen it from there — notifications
          are not available in-tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-neutral-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400">Notifications</h2>
          {prefs.enabled && permission === "granted" ? (
            <button
              onClick={handleDisableClick}
              className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300"
            >
              Turn off
            </button>
          ) : (
            <button
              onClick={handleEnableClick}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium"
            >
              Turn on
            </button>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Reminders are delivered as browser push notifications. On Android, some devices delay or
          drop background notifications under aggressive battery optimization — this is an OS
          setting, not something the app controls. Timezone: {prefs.timezone}.
        </p>
        {pushError && <p className="mt-2 text-xs text-red-400">{pushError}</p>}
      </div>

      {prefs.enabled && permission === "granted" && (
        <div className="rounded-2xl bg-neutral-900 p-4">
          <Toggle
            checked={prefs.classReminders}
            onChange={(v) => update("classReminders", v)}
            label={`Class reminders (${prefs.classReminderLeadMin}m before)`}
          />
          <Toggle
            checked={prefs.studyReminders}
            onChange={(v) => update("studyReminders", v)}
            label="Planned task reminders"
          />
          <Toggle
            checked={prefs.deadlineReminders}
            onChange={(v) => update("deadlineReminders", v)}
            label={`Deadline reminders (${prefs.deadlineReminderLeadHours}h before)`}
          />
          <Toggle
            checked={prefs.examReminders}
            onChange={(v) => update("examReminders", v)}
            label={`Exam/quiz reminders (${prefs.examReminderLeadHours}h before)`}
          />
          <Toggle
            checked={prefs.hydrationReminders}
            onChange={(v) => update("hydrationReminders", v)}
            label={`Hydration (every ${prefs.hydrationIntervalMin}m, ${prefs.hydrationStartTime}–${prefs.hydrationEndTime})`}
          />
          <Toggle
            checked={prefs.dailyReviewReminder}
            onChange={(v) => update("dailyReviewReminder", v)}
            label={`Daily review (${prefs.dailyReviewTime})`}
          />
          <Toggle
            checked={prefs.accountabilityReminders}
            onChange={(v) => update("accountabilityReminders", v)}
            label={`Accountability check-in (every ${prefs.accountabilityIntervalMin}m)`}
          />
          <Toggle
            checked={prefs.sleepReminders}
            onChange={(v) => update("sleepReminders", v)}
            label={`Sleep routine (${prefs.sleepReminderTime})`}
          />

          <button
            disabled={pending}
            onClick={() => save()}
            className="mt-3 w-full rounded-lg bg-white py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
