"use client";

import { useState, useTransition } from "react";
import { logMood } from "@/lib/health/actions";
import { runOrQueue } from "@/lib/offline/client";

function Scale({
  value,
  onPick,
  label,
}: {
  value: number | null;
  onPick: (n: number) => void;
  label: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-neutral-500">{label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onPick(n)}
            className={`h-9 flex-1 rounded-lg text-sm ${
              value === n ? "bg-white text-neutral-950" : "bg-neutral-800"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MoodQuickLog() {
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [logged, setLogged] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);

  function submit() {
    if (!mood || !energy) return;
    const notes = note.trim() || undefined;
    startTransition(async () => {
      const result = await runOrQueue("mood_log", { mood, energy, notes }, () =>
        logMood({ mood, energy, notes })
      );
      setQueuedOffline(result.status === "queued");
      setLogged(true);
      setTimeout(() => {
        setLogged(false);
        setQueuedOffline(false);
      }, 1500);
      setMood(null);
      setEnergy(null);
      setNote("");
      setShowNote(false);
    });
  }

  return (
    <div className="rounded-2xl bg-neutral-900 p-3">
      <h2 className="mb-2 text-sm font-medium text-neutral-400">Mood &amp; energy</h2>
      <div className="space-y-3">
        <Scale value={mood} onPick={setMood} label="Mood (1 low – 5 high)" />
        <Scale value={energy} onPick={setEnergy} label="Energy (1 low – 5 high)" />
      </div>
      {showNote ? (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          className="mt-3 w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none"
        />
      ) : (
        <button
          onClick={() => setShowNote(true)}
          className="mt-2 text-xs text-neutral-500 underline"
        >
          + add note
        </button>
      )}
      <button
        disabled={!mood || !energy || pending}
        onClick={submit}
        className="mt-3 w-full rounded-lg bg-white py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
      >
        {logged ? (queuedOffline ? "Saved offline ✓" : "Logged ✓") : "Log check-in"}
      </button>
    </div>
  );
}
