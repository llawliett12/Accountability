"use client";

import { useState, useTransition } from "react";
import { deleteSleepPeriod } from "@/lib/health/actions";

export type SleepPeriod = { id: string; bedtime: string; wake_time: string; total_minutes: number; period_type: "night" | "daytime" };

export default function SleepPeriodRows({ initialPeriods }: { initialPeriods: SleepPeriod[] }) {
  const [periods, setPeriods] = useState(initialPeriods);
  const [pending, startTransition] = useTransition();
  if (!periods.length) return null;
  return <div className="overflow-hidden border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50"><table className="w-full text-left text-xs font-mono"><thead><tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] uppercase text-neutral-400"><th className="px-3 py-2">Period</th><th className="px-3 py-2">Time</th><th className="px-3 py-2 text-right">Duration</th><th className="px-3 py-2"></th></tr></thead><tbody className="divide-y divide-neutral-800/60">{periods.map((period) => <tr key={period.id}><td className="px-3 py-2.5 text-neutral-300">{period.period_type === "daytime" ? "Daytime" : "Night"}</td><td className="px-3 py-2.5 text-neutral-500">{new Date(period.bedtime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{new Date(period.wake_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td><td className="px-3 py-2.5 text-right text-neutral-300">{Math.floor(period.total_minutes / 60)}h {period.total_minutes % 60}m</td><td className="px-3 py-1 text-right"><button type="button" disabled={pending} onClick={() => { if (!confirm("Delete this sleep period?")) return; const prior = periods; setPeriods((rows) => rows.filter((row) => row.id !== period.id)); startTransition(async () => { try { await deleteSleepPeriod(period.id); } catch { setPeriods(prior); } }); }} className="min-h-9 text-xs text-red-400 disabled:opacity-50">Delete</button></td></tr>)}</tbody></table></div>;
}
