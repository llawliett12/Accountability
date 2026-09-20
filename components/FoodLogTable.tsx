"use client";

import { useState, useTransition } from "react";
import { addFoodEntry, deleteFoodEntry } from "@/lib/health/actions";
import type { FoodEntry } from "@/lib/health/types";
import TrashIcon from "@/components/icons/TrashIcon";

function getCurrentTimeStr(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default function FoodLogTable({
  date,
  initialEntries = [],
}: {
  date: string;
  initialEntries?: FoodEntry[];
}) {
  const [entries, setEntries] = useState<FoodEntry[]>(initialEntries);
  const [time, setTime] = useState(getCurrentTimeStr());
  const [food, setFood] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!food.trim() || !time.trim()) return;

    setError(null);
    const newEntry: FoodEntry = {
      id: crypto.randomUUID(),
      time: time.trim(),
      food: food.trim(),
      notes: notes.trim() || undefined,
    };

    // Optimistic update
    setEntries((prev) => [...prev, newEntry]);
    setFood("");
    setNotes("");

    startTransition(async () => {
      try {
        await addFoodEntry({
          date,
          entry: newEntry,
        });
      } catch (err: unknown) {
        // Rollback
        setEntries((prev) => prev.filter((item) => item.id !== newEntry.id));
        setError(err instanceof Error ? err.message : "Failed to add food entry");
      }
    });
  };

  const handleDelete = (id: string) => {
    setError(null);
    const entryToDelete = entries.find((e) => e.id === id);
    setEntries((prev) => prev.filter((item) => item.id !== id));

    startTransition(async () => {
      try {
        await deleteFoodEntry({
          date,
          entryId: id,
        });
      } catch (err: unknown) {
        if (entryToDelete) {
          setEntries((prev) => [...prev, entryToDelete]);
        }
        setError(err instanceof Error ? err.message : "Failed to delete entry");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Quick Entry Form */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 sm:p-4 space-y-3"
      >
        <div className="text-xs font-mono font-medium text-neutral-400 uppercase tracking-wider">
          Quick Food Entry
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-3">
            <label className="block text-[10px] font-mono text-neutral-500 mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-5">
            <label className="block text-[10px] font-mono text-neutral-500 mb-1">What I ate</label>
            <input
              type="text"
              value={food}
              onChange={(e) => setFood(e.target.value)}
              required
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-[10px] font-mono text-neutral-500 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-1 flex items-end">
            <button
              type="submit"
              disabled={pending || !food.trim()}
              className="w-full h-8 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              Add
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
      </form>

      {/* Food Log Table */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Today&apos;s Food Log
          </span>
          <span className="font-mono text-[11px] text-neutral-500">[{entries.length}]</span>
        </div>

        <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
          <table className="w-full text-left text-xs border-collapse min-w-[360px]">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                <th className="py-2 px-3 w-20">Time</th>
                <th className="py-2 px-3">What I ate</th>
                <th className="py-2 px-3">Notes</th>
                <th className="py-2 px-2 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-neutral-500 font-sans">
                    No food entries logged for today. Use the form above to log meals or snacks.
                  </td>
                </tr>
              ) : (
                entries.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="py-2.5 px-3 text-amber-300 whitespace-nowrap font-mono">
                      {item.time}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-neutral-200">
                      {item.food}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400 font-sans text-[11px]">
                      {item.notes || <span className="text-neutral-700">--</span>}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={pending}
                        className="text-neutral-600 hover:text-red-400 text-xs transition-colors p-1"
                        aria-label="Delete entry"
                        title="Delete entry"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
