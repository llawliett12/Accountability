"use client";

import { useState } from "react";
import Link from "next/link";
import type { AcademicScheduleItem } from "@/components/TodayAcademicSchedule";

interface WeeklyTimetableReferenceProps {
  imageUrl: string | null;
  items: AcademicScheduleItem[];
}

export default function WeeklyTimetableReference({
  imageUrl,
  items,
}: WeeklyTimetableReferenceProps) {
  const [showFullView, setShowFullView] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<"fit" | "full">("fit");

  return (
    <section
      aria-label="Weekly Timetable Reference"
      className="space-y-3 pt-1"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-neutral-800/70 pb-2">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-neutral-200">
            Weekly Timetable Reference
          </h2>
          <span className="rounded bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-300">
            Mon &ndash; Fri
          </span>
        </div>

        <Link
          href="/academics?section=timetable"
          className="font-mono text-xs text-neutral-400 hover:text-white transition-colors"
        >
          Manage Timetable &rarr;
        </Link>
      </div>

      {/* 1. ACTUAL UPLOADED FULL WEEKLY TIMETABLE PHOTO */}
      {imageUrl ? (
        <div className="space-y-2">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowFullView(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowFullView(true);
              }
            }}
            className="group relative cursor-pointer overflow-hidden rounded-lg border border-neutral-800 bg-black/60 transition-all hover:border-neutral-600 focus:outline-none focus:border-amber-400 max-h-56 flex items-center justify-center"
            title="Click to view full weekly timetable"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Uploaded Canonical Weekly Timetable Reference"
              className="max-h-56 w-full object-contain object-top transition-transform duration-200 group-hover:scale-[1.01]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2.5">
              <span className="font-mono text-xs font-semibold text-white bg-neutral-900/90 border border-neutral-700 px-2 py-0.5 rounded shadow">
                🔍 Tap to enlarge full weekly timetable
              </span>
              <span className="font-mono text-xs text-neutral-300">Weekly Reference Photo</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-800 p-4 text-center space-y-1 font-mono text-sm">
          <p className="text-neutral-400 font-medium">No weekly timetable reference uploaded yet.</p>
          <p className="text-xs text-neutral-500">
            Upload your weekly schedule photo in{" "}
            <Link href="/academics?section=timetable" className="text-amber-400 hover:underline">
              Academics
            </Link>{" "}
            to see it here on weekdays.
          </p>
        </div>
      )}

      {/* 2. TODAY'S SCHEDULED CLASSES (STRUCTURED CANONICAL DATA) */}
      <div className="border-t border-neutral-800/80 pt-2.5">
        <div className="flex items-center justify-between mb-1.5 font-mono text-xs uppercase tracking-wider text-neutral-400 font-semibold">
          <span>Today&apos;s Classes (Structured Schedule)</span>
          <span>{items.length} {items.length === 1 ? "class" : "classes"}</span>
        </div>

        {items.length === 0 ? (
          <p className="font-mono text-sm text-neutral-500 py-1">No classes scheduled today.</p>
        ) : (
          <div className="divide-y divide-neutral-800/60 font-mono text-sm">
            {items.map((item) => {
              const isCancelled = item.status === "cancelled";
              return (
                <div
                  key={item.id}
                  className={`py-1.5 flex items-center justify-between gap-2 ${
                    isCancelled ? "opacity-50 line-through" : ""
                  }`}
                >
                  <div className="flex items-baseline gap-2.5 min-w-0">
                    <span className="text-amber-300 font-bold whitespace-nowrap text-xs">
                      {item.startTime.slice(0, 5)} &ndash; {item.endTime.slice(0, 5)}
                    </span>
                    <Link
                      href={`/academics/courses/${item.courseId}`}
                      className="font-bold text-neutral-100 hover:text-white transition-colors truncate"
                    >
                      {item.courseCode}
                    </Link>
                    <span className="text-xs text-neutral-400 capitalize truncate">
                      {item.isExtra ? "Extra Class" : item.slotType}
                    </span>
                    {item.location && (
                      <span className="text-xs text-neutral-500 hidden sm:inline truncate">
                        ({item.location})
                      </span>
                    )}
                  </div>

                  <div className="text-right whitespace-nowrap text-xs">
                    {item.status === "held" ? (
                      <span className="text-emerald-400 font-medium">Held</span>
                    ) : (
                      <span className="text-neutral-400">{item.location ?? "Scheduled"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LIGHTBOX FULL VIEW MODAL */}
      {showFullView && imageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4">
          <div className="relative flex flex-col w-full h-full max-w-5xl max-h-[92vh] rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden shadow-2xl">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 bg-neutral-900/80">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-neutral-200 uppercase tracking-wider">
                  Canonical Weekly Timetable
                </span>
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-mono text-neutral-400">
                  Full Weekly Reference
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomLevel((prev) => (prev === "fit" ? "full" : "fit"))}
                  className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 font-mono text-sm text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
                >
                  {zoomLevel === "fit" ? "🔍 100% Zoom" : "📐 Fit to Screen"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFullView(false);
                    setZoomLevel("fit");
                  }}
                  className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1 font-mono text-sm font-bold text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
                  aria-label="Close modal"
                >
                  Close &times;
                </button>
              </div>
            </div>

            {/* MODAL IMAGE CONTAINER */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Full Weekly Timetable Reference"
                className={`transition-all rounded ${
                  zoomLevel === "fit"
                    ? "max-w-full max-h-full object-contain"
                    : "w-auto max-w-none h-auto"
                }`}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
