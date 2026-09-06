"use client";

import type { AppUsage } from "@/lib/screen-time/types";

export default function AppUsageRows({
  apps,
  onChange,
}: {
  apps: AppUsage[];
  onChange: (apps: AppUsage[]) => void;
}) {
  function updateApp(index: number, patch: Partial<AppUsage>) {
    const next = apps.map((a, i) => (i === index ? { ...a, ...patch } : a));
    onChange(next);
  }

  function removeApp(index: number) {
    onChange(apps.filter((_, i) => i !== index));
  }

  function addApp() {
    onChange([...apps, { app_name: "", duration_minutes: 0, category: null }]);
  }

  return (
    <div className="space-y-2">
      {apps.map((app, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={app.app_name}
            onChange={(e) => updateApp(i, { app_name: e.target.value })}
            placeholder="App name"
            className="flex-1 rounded-lg bg-neutral-800 px-2 py-1.5 text-sm outline-none"
          />
          <input
            type="number"
            value={app.duration_minutes}
            onChange={(e) => updateApp(i, { duration_minutes: Number(e.target.value) || 0 })}
            placeholder="min"
            className="w-16 rounded-lg bg-neutral-800 px-2 py-1.5 text-sm outline-none"
          />
          <button
            onClick={() => removeApp(i)}
            className="rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-500"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={addApp}
        className="w-full rounded-lg bg-neutral-800 py-1.5 text-xs text-neutral-400"
      >
        + Add app
      </button>
    </div>
  );
}
