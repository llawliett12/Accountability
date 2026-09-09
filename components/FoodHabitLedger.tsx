"use client";

import { useState, useTransition } from "react";
import { saveFoodHabits } from "@/lib/health/actions";

type Meals = { breakfast: boolean; lunch: boolean; dinner: boolean };
const mealLabels: { key: keyof Meals; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

export default function FoodHabitLedger({ date, initialMeals }: { date: string; initialMeals: Meals | null }) {
  const [meals, setMeals] = useState<Meals>(initialMeals ?? { breakfast: false, lunch: false, dinner: false });
  const [pending, startTransition] = useTransition();

  function toggle(key: keyof Meals) {
    const next = { ...meals, [key]: !meals[key] };
    setMeals(next);
    startTransition(async () => {
      try { await saveFoodHabits({ date, ...next }); }
      catch { setMeals(meals); }
    });
  }

  return <div className="overflow-hidden border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
    <table className="w-full text-left text-xs border-collapse"><thead><tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400"><th className="py-2 px-3">Meal</th><th className="py-2 px-3 text-right">Had it?</th></tr></thead>
      <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">{mealLabels.map(({ key, label }) => <tr key={key} className="hover:bg-neutral-900/50"><td className="py-2.5 px-3 text-neutral-200">{label}</td><td className="py-1 px-3 text-right"><button type="button" disabled={pending} onClick={() => toggle(key)} aria-label={`Mark ${label} ${meals[key] ? "not eaten" : "eaten"}`} className={`min-h-9 min-w-12 rounded border px-2 text-xs ${meals[key] ? "border-emerald-800 bg-emerald-950/70 text-emerald-300" : "border-neutral-800 bg-neutral-900 text-neutral-500"}`}>{meals[key] ? "✓" : "✕"}</button></td></tr>)}</tbody>
    </table>
  </div>;
}
