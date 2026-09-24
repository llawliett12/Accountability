import { NextRequest, NextResponse } from "next/server";
import { computeDueReminders } from "@/lib/notifications/engine";
import {
  fetchUsersWithNotificationsEnabled,
  fetchTodaysClasses,
  fetchUpcomingDeadlines,
  fetchUpcomingAssessments,
  fetchPlannedTasksForDate,
  hasAlreadySent,
  markSent,
  deleteExpiredSubscription,
} from "@/lib/notifications/dispatch-queries";
import { sendPush } from "@/lib/notifications/push";
import { localDateAndMinutes } from "@/lib/notifications/engine";

export const dynamic = "force-dynamic";

// How far apart real dispatch calls can land. Vercel Hobby cron can only run
// once a day (see README/PROGRESS "Known limitations"), so if this route is
// only ever hit by Vercel's own daily cron, most timed reminders will not
// fire near their intended minute. The tolerance below is intentionally
// generous (30 min) so a single daily run doesn't miss things that fall in
// its own hour, but it cannot substitute for real sub-daily scheduling.
// Wire this route to an external scheduler (cron-job.org, GitHub Actions,
// a Supabase Edge Function cron, etc.) hitting it every 5-15 minutes for
// timely reminders — see README "Notifications" section.
const TOLERANCE_MINUTES = Number(process.env.NOTIFICATION_DISPATCH_TOLERANCE_MIN ?? "15");

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if misconfigured
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowUtc = new Date();
  const users = await fetchUsersWithNotificationsEnabled();

  let sent = 0;
  let skippedDuplicate = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const u of users) {
    try {
      const { localDate } = localDateAndMinutes(nowUtc, u.prefs.timezone);

      const [todaysClasses, upcomingDeadlines, upcomingAssessments, plannedTasksWithStart] =
        await Promise.all([
          fetchTodaysClasses(u.userId, localDate),
          fetchUpcomingDeadlines(u.userId, localDate),
          fetchUpcomingAssessments(u.userId, localDate),
          fetchPlannedTasksForDate(u.userId, localDate, u.prefs.timezone),
        ]);

      const due = computeDueReminders({
        nowUtc,
        prefs: u.prefs,
        toleranceMinutes: TOLERANCE_MINUTES,
        todaysClasses,
        upcomingDeadlines,
        upcomingAssessments,
        plannedTasksWithStart,
      });

      for (const reminder of due) {
        const already = await hasAlreadySent(u.userId, reminder.category, localDate, reminder.slot);
        if (already) {
          skippedDuplicate++;
          continue;
        }

        if (u.subscriptions.length === 0) {
          // No device subscribed to push yet — still record it as "sent" so
          // we don't re-evaluate it every dispatch tick once one exists.
          await markSent(u.userId, reminder.category, localDate, reminder.slot);
          continue;
        }

        for (const sub of u.subscriptions) {
          const result = await sendPush(sub, {
            title: reminder.title,
            body: reminder.body,
            category: reminder.category,
            slot: reminder.slot,
          });
          if (result.ok) {
            sent++;
          } else {
            failed++;
            errors.push(`${reminder.category}/${reminder.slot}: ${result.error}`);
            if (result.expired) await deleteExpiredSubscription(sub.endpoint);
          }
        }
        await markSent(u.userId, reminder.category, localDate, reminder.slot);
      }
    } catch (err) {
      failed++;
      errors.push(`user ${u.userId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    ranAt: nowUtc.toISOString(),
    usersEvaluated: users.length,
    sent,
    skippedDuplicate,
    failed,
    errors: errors.slice(0, 20),
  });
}
