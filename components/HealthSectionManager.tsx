"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SectionBlock from "@/components/SectionBlock";
import FoodLogTable from "@/components/FoodLogTable";
import MeditationQuickLog from "@/components/MeditationQuickLog";
import SleepLogForm from "@/components/SleepLogForm";
import type { FoodEntry, SleepLogRecord, MeditationLogRecord } from "@/lib/health/types";
import type { ScreenTimeDay } from "@/lib/screen-time/queries";

export type HealthSection = "sleep" | "food" | "meditation" | "screen-time" | "trends";

export interface HealthDayTrend {
  date: string;
  sleepHours: number | null;
  foodCount: number;
  meditationMinutes: number | null;
  screenTimeHours: number | null;
}

export interface HealthAverages {
  sleepAvg7d: number | null;
  sleepAvg30d: number | null;
  meditationAvg7d: number | null;
  meditationAvg30d: number | null;
  screenTimeAvg7d: number | null;
  foodAvg7d: number | null;
}

interface HealthSectionManagerProps {
  initialSection?: HealthSection | null;
  today: string;
  // Deterministic averages
  averages: HealthAverages;
  // Sleep data
  lastNightSleep: SleepLogRecord | null;
  recentSleepLogs: SleepLogRecord[];
  // Food data
  todayFoodEntries: FoodEntry[];
  // Meditation data
  todayMeditation: MeditationLogRecord | null;
  meditationStreak: number;
  recentMeditationLogs: MeditationLogRecord[];
  // Screen time data
  todayScreenTime: ScreenTimeDay | null;
  recentScreenTime: ScreenTimeDay[];
  // Trends
  sevenDayTrends: HealthDayTrend[];
}

export default function HealthSectionManager({
  initialSection = null,
  today,
  averages,
  lastNightSleep,
  recentSleepLogs,
  todayFoodEntries,
  todayMeditation,
  meditationStreak,
  recentMeditationLogs,
  todayScreenTime,
  recentScreenTime,
  sevenDayTrends,
}: HealthSectionManagerProps) {
  const [activeSection, setActiveSection] = useState<HealthSection | null>(initialSection);
  const [prevInitial, setPrevInitial] = useState(initialSection);
  if (prevInitial !== initialSection) {
    setPrevInitial(initialSection);
    setActiveSection(initialSection);
  }

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const sectionParam = params.get("section") as HealthSection | null;
      setActiveSection(sectionParam ?? null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const selectSection = useCallback((sec: HealthSection) => {
    setActiveSection(sec);
    window.history.pushState(null, "", `/health?section=${sec}`);
  }, []);

  const handleBack = useCallback(() => {
    setActiveSection(null);
    window.history.pushState(null, "", "/health");
  }, []);

  // Formatted summaries
  const lastNightHours = lastNightSleep
    ? (lastNightSleep.total_minutes / 60).toFixed(1)
    : null;
  const todayMeditationMins = todayMeditation?.duration_min ?? (todayMeditation?.happened ? 15 : null);
  const todayScreenHours = todayScreenTime
    ? (todayScreenTime.totalMinutes / 60).toFixed(1)
    : null;

  return (
    <>
      {/* LEVEL 1: MINIMAL HEALTH CONTROL CENTER */}
      {!activeSection && (
        <div className="space-y-4">
          {/* COMPACT DETERMINISTIC AVERAGES OVERVIEW */}
          <section
            aria-label="Health Deterministic Averages"
            className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-3.5 space-y-2.5 font-mono"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                Health Averages · Stored Records
              </span>
              <span className="text-[10px] text-neutral-500">7d &amp; 30d Trends</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {/* Sleep Averages */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2.5 space-y-1">
                <div className="text-[10px] text-neutral-400 uppercase font-semibold">Sleep</div>
                <div className="text-base font-bold text-white">
                  {averages.sleepAvg7d !== null ? `${averages.sleepAvg7d}h` : "--"}
                  <span className="text-[10px] font-normal text-neutral-500 ml-1">7d</span>
                </div>
                <div className="text-[10px] text-neutral-500">
                  30d avg: <strong className="text-neutral-300">{averages.sleepAvg30d !== null ? `${averages.sleepAvg30d}h` : "--"}</strong>
                </div>
              </div>

              {/* Meditation Averages */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2.5 space-y-1">
                <div className="text-[10px] text-neutral-400 uppercase font-semibold">Meditation</div>
                <div className="text-base font-bold text-amber-300">
                  {averages.meditationAvg7d !== null ? `${averages.meditationAvg7d}m` : "--"}
                  <span className="text-[10px] font-normal text-neutral-500 ml-1">/day</span>
                </div>
                <div className="text-[10px] text-neutral-500">
                  30d avg: <strong className="text-neutral-300">{averages.meditationAvg30d !== null ? `${averages.meditationAvg30d}m` : "--"}</strong>
                </div>
              </div>

              {/* Screen Time Averages */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2.5 space-y-1">
                <div className="text-[10px] text-neutral-400 uppercase font-semibold">Screen Time</div>
                <div className="text-base font-bold text-blue-300">
                  {averages.screenTimeAvg7d !== null ? `${averages.screenTimeAvg7d}h` : "--"}
                  <span className="text-[10px] font-normal text-neutral-500 ml-1">/day</span>
                </div>
                <div className="text-[10px] text-neutral-500">
                  Today: <strong className="text-neutral-300">{todayScreenHours ? `${todayScreenHours}h` : "--"}</strong>
                </div>
              </div>

              {/* Food Consistency */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-2.5 space-y-1">
                <div className="text-[10px] text-neutral-400 uppercase font-semibold">Food Logged</div>
                <div className="text-base font-bold text-emerald-300">
                  {averages.foodAvg7d !== null ? `${averages.foodAvg7d}` : "--"}
                  <span className="text-[10px] font-normal text-neutral-500 ml-1">meals/d</span>
                </div>
                <div className="text-[10px] text-neutral-500">
                  Today: <strong className="text-neutral-300">{todayFoodEntries.length} logged</strong>
                </div>
              </div>
            </div>
          </section>

          {/* DEEP HEALTH LOGGING DOORS */}
          <section aria-label="Health navigation" className="space-y-1">
            <SectionBlock
              href="/health?section=sleep"
              onClick={() => selectSection("sleep")}
              title="Sleep"
              summary={
                lastNightHours
                  ? `Last night: ${lastNightHours}h · 7d avg: ${averages.sleepAvg7d ?? "--"}h`
                  : `Last night: Not logged · 7d avg: ${averages.sleepAvg7d ?? "--"}h`
              }
              tone={lastNightHours ? "good" : "neutral"}
            />
            <SectionBlock
              href="/health?section=food"
              onClick={() => selectSection("food")}
              title="Food"
              summary={
                todayFoodEntries.length
                  ? `${todayFoodEntries.length} meals/snacks logged today · 7d avg: ${averages.foodAvg7d} meals/d`
                  : `No food logged today · 7d avg: ${averages.foodAvg7d} meals/d`
              }
              tone={todayFoodEntries.length ? "active" : "neutral"}
            />
            <SectionBlock
              href="/health?section=meditation"
              onClick={() => selectSection("meditation")}
              title="Meditation"
              summary={
                todayMeditationMins
                  ? `Today: ${todayMeditationMins}m · ${meditationStreak}d streak · 7d avg: ${averages.meditationAvg7d}m/d`
                  : `Today: Not logged · ${meditationStreak}d streak · 7d avg: ${averages.meditationAvg7d}m/d`
              }
              tone={todayMeditationMins ? "good" : "neutral"}
            />
            <SectionBlock
              href="/health?section=screen-time"
              onClick={() => selectSection("screen-time")}
              title="Screen Time"
              summary={
                todayScreenHours
                  ? `Today: ${todayScreenHours}h · 7d avg: ${averages.screenTimeAvg7d ?? "--"}h/d`
                  : `Today: Not logged · 7d avg: ${averages.screenTimeAvg7d ?? "--"}h/d`
              }
              tone={todayScreenHours ? "active" : "neutral"}
            />
            <SectionBlock
              href="/health?section=trends"
              onClick={() => selectSection("trends")}
              title="Trends &amp; History"
              summary="7-day consolidated health matrix and consistency trends"
              tone="good"
            />
          </section>
        </div>
      )}



      {/* LEVEL 2: SLEEP */}
      {activeSection === "sleep" && (
        <section className="space-y-4">
          <Link
            href="/health"
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Health
          </Link>

          {/* Last Night Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="text-[10px] font-mono text-neutral-500 uppercase">Last Night Sleep</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {lastNightHours ? `${lastNightHours}h` : "--"}
              </div>
              <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                {lastNightSleep?.bedtime ? new Date(lastNightSleep.bedtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--"} → {lastNightSleep?.wake_time ? new Date(lastNightSleep.wake_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--"}
              </div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="text-[10px] font-mono text-neutral-500 uppercase">Sleep Quality</div>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                {lastNightSleep?.quality ? `${lastNightSleep.quality} / 5` : "--"}
              </div>
              <div className="text-[11px] text-neutral-400 font-sans mt-0.5 truncate">
                {lastNightSleep?.poor_sleep_reason || "Good rest"}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="text-[10px] font-mono text-neutral-500 uppercase">7-Day Average</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {averages.sleepAvg7d !== null ? `${averages.sleepAvg7d}h` : "--"}
              </div>
              <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                Target: 7-8h
              </div>
            </div>
          </div>

          <SleepLogForm />

          {/* Recent Sleep Logs */}
          {recentSleepLogs.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Recent Sleep History
              </div>
              <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950/50">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-neutral-800 text-[10px] text-neutral-500 bg-neutral-900/60">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Bedtime → Wake</th>
                      <th className="py-2 px-3">Hours</th>
                      <th className="py-2 px-3">Quality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {recentSleepLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-900/30">
                        <td className="py-2 px-3 text-neutral-300">{log.date}</td>
                        <td className="py-2 px-3 text-neutral-400 text-[11px]">
                          {new Date(log.bedtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {new Date(log.wake_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 px-3 text-white font-semibold">
                          {(log.total_minutes / 60).toFixed(1)}h
                        </td>
                        <td className="py-2 px-3 text-amber-400">
                          {log.quality ? `${log.quality}★` : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* LEVEL 2: FOOD */}
      {activeSection === "food" && (
        <section className="space-y-4">
          <Link
            href="/health"
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Health
          </Link>
          <FoodLogTable date={today} initialEntries={todayFoodEntries} />
        </section>
      )}

      {/* LEVEL 2: MEDITATION */}
      {activeSection === "meditation" && (
        <section className="space-y-4">
          <Link
            href="/health"
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Health
          </Link>
          <MeditationQuickLog
            date={today}
            initialDuration={todayMeditation?.duration_min ?? null}
            initialHappened={todayMeditation?.happened ?? null}
            streak={meditationStreak}
          />

          {recentMeditationLogs.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Recent Sessions
              </div>
              <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950/50">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-neutral-800 text-[10px] text-neutral-500 bg-neutral-900/60">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Completed</th>
                      <th className="py-2 px-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {recentMeditationLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-900/30">
                        <td className="py-2 px-3 text-neutral-300">{log.date}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${log.happened ? "bg-emerald-950/80 text-emerald-300" : "bg-neutral-900 text-neutral-500"}`}>
                            {log.happened ? "Completed" : "Skipped"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-white font-semibold">
                          {log.duration_min ? `${log.duration_min} min` : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* LEVEL 2: SCREEN TIME */}
      {activeSection === "screen-time" && (
        <section className="space-y-4">
          <Link
            href="/health"
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Health
          </Link>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Today&apos;s Screen Time</h3>
              <span className="font-mono text-lg font-bold text-amber-400">
                {todayScreenHours ? `${todayScreenHours}h` : "Not logged"}
              </span>
            </div>

            {todayScreenTime?.topApps && todayScreenTime.topApps.length > 0 ? (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-mono text-neutral-400">Top Applications:</div>
                <div className="space-y-1.5">
                  {todayScreenTime.topApps.map((app) => (
                    <div
                      key={app.app_name}
                      className="flex items-center justify-between py-1 px-2.5 rounded bg-neutral-950/60 border border-neutral-800/80 text-xs font-mono"
                    >
                      <span className="text-neutral-200">{app.app_name}</span>
                      <span className="text-neutral-400 font-semibold">{app.duration_minutes} min</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500 font-sans">
                No app breakdown recorded for today.
              </p>
            )}

            <div className="pt-2 flex gap-3">
              <Link
                href="/screen-time"
                className="inline-flex items-center rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 text-xs font-mono text-amber-300 transition-colors"
              >
                Open Screen Time OCR & Details →
              </Link>
            </div>
          </div>

          {recentScreenTime.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Recent Days
              </div>
              <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950/50">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-neutral-800 text-[10px] text-neutral-500 bg-neutral-900/60">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Total Time</th>
                      <th className="py-2 px-3">Top App</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {recentScreenTime.map((item) => (
                      <tr key={item.date} className="hover:bg-neutral-900/30">
                        <td className="py-2 px-3 text-neutral-300">{item.date}</td>
                        <td className="py-2 px-3 text-white font-semibold">
                          {(item.totalMinutes / 60).toFixed(1)}h
                        </td>
                        <td className="py-2 px-3 text-neutral-400">
                          {item.topApps[0]?.app_name || "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* LEVEL 2: TRENDS */}
      {activeSection === "trends" && (
        <section className="space-y-4">
          <Link
            href="/health"
            prefetch={false}
            onClick={(e) => {
              e.preventDefault();
              handleBack();
            }}
            className="section-detail-back"
          >
            ← Back to Health
          </Link>

          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
                7-Day Health Overview
              </span>
            </div>

            <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950/50">
              <table className="w-full text-left text-xs font-mono min-w-[480px]">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] text-neutral-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-center">Sleep</th>
                    <th className="py-2.5 px-3 text-center">Food Logged</th>
                    <th className="py-2.5 px-3 text-center">Meditation</th>
                    <th className="py-2.5 px-3 text-center">Screen Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {sevenDayTrends.map((day) => (
                    <tr key={day.date} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="py-2.5 px-3 text-neutral-300 font-semibold">{day.date}</td>
                      <td className="py-2.5 px-3 text-center">
                        {day.sleepHours !== null ? (
                          <span className="text-white font-medium">{day.sleepHours.toFixed(1)}h</span>
                        ) : (
                          <span className="text-neutral-600">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {day.foodCount > 0 ? (
                          <span className="text-amber-400 font-medium">{day.foodCount} entries</span>
                        ) : (
                          <span className="text-neutral-600">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {day.meditationMinutes !== null ? (
                          <span className="text-emerald-400 font-medium">{day.meditationMinutes}m</span>
                        ) : (
                          <span className="text-neutral-600">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {day.screenTimeHours !== null ? (
                          <span className="text-neutral-300 font-medium">{day.screenTimeHours.toFixed(1)}h</span>
                        ) : (
                          <span className="text-neutral-600">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
