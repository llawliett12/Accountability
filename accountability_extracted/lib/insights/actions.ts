"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchInsights } from "./queries";
import { addDays } from "@/lib/analytics/queries";
import { average, sum } from "@/lib/analytics/engine";
import { generateNarrativeInsights } from "./gemini-insights";
import { todayISO } from "@/lib/date";
import type { Pattern, GroupComparison } from "./engine";

export interface InsightsPageData {
  patterns: Pattern[];
  morningEveningComparison: GroupComparison;
  daysAnalyzed: number;
  aiBullets: string[] | null;
  aiUnavailableReason: string | null;
}

// Deterministic statistics are always computed and always returned, even if
// the AI narration step fails or is unconfigured — the page never goes
// blank just because Gemini is unavailable.
export async function loadInsights(period: "week" | "month"): Promise<InsightsPageData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const end = todayISO();
  const start = period === "week" ? addDays(end, -6) : addDays(end, -29);

  const {
    patterns,
    morningEveningComparison,
    daysAnalyzed,
    dailyRows,
    screenTimeByDate,
  } = await fetchInsights(user.id, start, end);

  const focusHours = sum(dailyRows.map((r) => r.focusMinutes)) / 60;
  const totalPlanned = sum(dailyRows.map((r) => r.tasksPlanned));
  const totalCompleted = sum(dailyRows.map((r) => r.tasksCompleted));
  const taskCompletionPct = totalPlanned > 0 ? (totalCompleted / totalPlanned) * 100 : 0;
  const screenTimeValues = Array.from(screenTimeByDate.values());
  const screenTimeHours = screenTimeValues.length > 0 ? average(screenTimeValues) / 60 : null;
  const sleepValues = dailyRows.map((r) => r.sleepMinutes).filter((s): s is number => s !== null);
  const sleepHours = sleepValues.length > 0 ? average(sleepValues) / 60 : null;
  const scoreValues = dailyRows
    .map((r) => r.disciplineScore)
    .filter((s): s is number => s !== null);
  const disciplineScore = scoreValues.length > 0 ? average(scoreValues) : null;

  const topPatterns = patterns
    .filter((p) => !p.insufficientData && p.strength !== "weak")
    .map((p) => p.interpretation)
    .slice(0, 3);

  const aiResult = await generateNarrativeInsights({
    period,
    focus_hours: Math.round(focusHours * 10) / 10,
    task_completion_pct: Math.round(taskCompletionPct),
    screen_time_hours: screenTimeHours !== null ? Math.round(screenTimeHours * 10) / 10 : null,
    sleep_hours: sleepHours !== null ? Math.round(sleepHours * 10) / 10 : null,
    discipline_score: disciplineScore !== null ? Math.round(disciplineScore) : null,
    top_patterns: topPatterns,
  });

  return {
    patterns,
    morningEveningComparison,
    daysAnalyzed,
    aiBullets: aiResult.success ? aiResult.bullets : null,
    aiUnavailableReason: aiResult.success ? null : aiResult.message,
  };
}
