"use client";

import { useState, useTransition, useRef } from "react";
import { analyzeScreenshot, saveScreenTimeRecord } from "@/lib/screen-time/actions";
import type { AppUsage } from "@/lib/screen-time/types";
import AppUsageRows from "./AppUsageRows";

type Phase = "idle" | "analyzing" | "review" | "saved";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ScreenTimeCapture() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [date, setDate] = useState(todayISO());
  const [apps, setApps] = useState<AppUsage[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [source, setSource] = useState<"gemini" | "manual">("manual");
  const [banner, setBanner] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelected(file: File) {
    setPhase("analyzing");
    setBanner(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("screenshot", file);
      const result = await analyzeScreenshot(formData);

      setScreenshotPath(result.screenshotPath);

      if (result.success) {
        setSource("gemini");
        setDate(result.date ?? todayISO());
        setApps(result.apps);
        setTotalMinutes(result.totalMinutes);
        setWarnings(result.warnings);
        if (!result.date) {
          setBanner("Couldn't read the date automatically — please set it below.");
        }
      } else {
        setSource("manual");
        setApps([]);
        setTotalMinutes(0);
        setWarnings([]);
        setBanner(`${result.errorMessage} You can still enter it manually below.`);
      }
      setPhase("review");
    });
  }

  function startManualEntry() {
    setSource("manual");
    setDate(todayISO());
    setApps([]);
    setTotalMinutes(0);
    setBanner(null);
    setWarnings([]);
    setPhase("review");
  }

  const computedTotal = apps.length > 0 ? apps.reduce((s, a) => s + a.duration_minutes, 0) : totalMinutes;

  function save() {
    startTransition(async () => {
      await saveScreenTimeRecord({
        date,
        apps,
        totalMinutes: computedTotal,
        source,
        screenshotPath,
      });
      setPhase("saved");
    });
  }

  if (phase === "idle") {
    return (
      <div className="space-y-2 rounded-2xl bg-neutral-900 p-4">
        <h2 className="text-sm font-medium text-neutral-400">Log screen time</h2>
        <p className="text-xs text-neutral-500">
          Upload a screenshot of your phone&apos;s screen-time page — this app can&apos;t read
          Android&apos;s usage stats directly, only what&apos;s visible in the image.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-lg bg-white py-3 text-sm font-medium text-neutral-950"
        >
          Upload screenshot
        </button>
        <button
          onClick={startManualEntry}
          className="w-full rounded-lg bg-neutral-800 py-2 text-xs text-neutral-400"
        >
          Enter manually instead
        </button>
      </div>
    );
  }

  if (phase === "analyzing") {
    return (
      <div className="rounded-2xl bg-neutral-900 p-4 text-center text-sm text-neutral-400">
        Reading screenshot…
      </div>
    );
  }

  if (phase === "saved") {
    return (
      <div className="rounded-2xl bg-neutral-900 p-4 text-center">
        <p className="text-sm text-emerald-400">Saved ✓</p>
        <button
          onClick={() => setPhase("idle")}
          className="mt-2 text-xs text-neutral-500 underline"
        >
          Log another day
        </button>
      </div>
    );
  }

  // review
  return (
    <div className="space-y-3 rounded-2xl bg-neutral-900 p-4">
      <h2 className="text-sm font-medium text-neutral-400">
        {source === "gemini" ? "Review extracted data" : "Manual entry"}
      </h2>

      {banner && <p className="rounded-lg bg-amber-950 p-2 text-xs text-amber-300">{banner}</p>}
      {warnings.map((w, i) => (
        <p key={i} className="rounded-lg bg-amber-950 p-2 text-xs text-amber-300">
          {w}
        </p>
      ))}

      <label className="block text-xs text-neutral-500">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-lg bg-neutral-800 px-2 py-1.5 text-sm"
        />
      </label>

      <div className="text-sm">
        <span className="text-neutral-500">Total: </span>
        <span className="font-medium">{computedTotal} min</span>
        {apps.length === 0 && (
          <input
            type="number"
            value={totalMinutes}
            onChange={(e) => setTotalMinutes(Number(e.target.value) || 0)}
            placeholder="Total minutes (no app breakdown)"
            className="mt-1 block w-full rounded-lg bg-neutral-800 px-2 py-1.5 text-sm"
          />
        )}
      </div>

      <AppUsageRows apps={apps} onChange={setApps} />

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => setPhase("idle")}
          className="flex-1 rounded-lg bg-neutral-800 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={pending}
          className="flex-1 rounded-lg bg-white py-2 text-sm font-medium text-neutral-950"
        >
          Confirm &amp; Save
        </button>
      </div>
    </div>
  );
}
