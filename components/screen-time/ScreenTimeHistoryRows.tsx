"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteScreenTimeRecord } from "@/lib/screen-time/actions";

export default function ScreenTimeHistoryRows({ initialRows }: { initialRows: { date: string; totalMinutes: number; source: string }[] }) {
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();
  if (!rows.length) return <p className="py-6 text-center font-mono text-xs text-neutral-500">Nothing logged in the last 30 days.</p>;
  return <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50"><table className="w-full min-w-[360px] text-left text-xs font-mono"><thead><tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] uppercase text-neutral-400"><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Minutes</th><th className="px-3 py-2">Source</th><th className="px-3 py-2 text-right"></th></tr></thead><tbody className="divide-y divide-neutral-800/60">{rows.map((row) => <tr key={row.date}><td className="px-3 py-2.5 text-neutral-300">{row.date}</td><td className="px-3 py-2.5 text-right text-neutral-300">{row.totalMinutes}</td><td className="px-3 py-2.5 text-neutral-500">{row.source}</td><td className="px-3 py-1 text-right whitespace-nowrap"><Link href={`/screen-time?date=${row.date}`} className="inline-flex min-h-9 items-center px-1 text-amber-400">Edit</Link><button type="button" disabled={pending} onClick={() => { if (!confirm(`Delete screen time for ${row.date}?`)) return; const prior = rows; setRows((items) => items.filter((item) => item.date !== row.date)); startTransition(async () => { try { await deleteScreenTimeRecord(row.date); } catch { setRows(prior); } }); }} className="min-h-9 px-1 text-red-400 disabled:opacity-50">Delete</button></td></tr>)}</tbody></table></div>;
}
