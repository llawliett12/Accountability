// Pure deterministic inferred activity timeline logic.
// Calculates chronological blocks and inferred durations from consecutive timestamps.
// No DB calls, no side effects — fully testable in isolation.

export interface RawActivityEntry {
  id: string;
  timestamp: string; // ISO timestamptz
  actual_activity: string;
  entry_type?: string; // 'work' | 'journal'
  status?: string; // 'ongoing' | 'paused' | 'completed' | 'logged'
}

export interface InferredTimelineBlock {
  id: string;
  activity: string;
  entryType: "work" | "journal";
  startISO: string;
  startTime: string; // "HH:MM"
  endISO: string | null;
  endTime: string | null; // "HH:MM" or null
  durationMinutes: number | null;
  durationLabel: string; // e.g. "1h 15m", "40m", or "No later check-in"
  isLatest: boolean;
}

export function formatDurationHoursMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return "< 1m";
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export function formatTimeHM(isoString: string, timeZone = "UTC"): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    });
  } catch {
    return isoString.slice(11, 16);
  }
}

/**
 * Computes consecutive inferred durations from a chronological series of activity entries.
 * Does NOT assume explicit end times; durations are inferred from consecutive check-ins.
 */
export function computeInferredTimeline(
  entries: RawActivityEntry[],
  timeZone = "UTC"
): InferredTimelineBlock[] {
  if (!entries || entries.length === 0) return [];

  // Sort chronologically ascending
  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return sorted.map((item, idx) => {
    const start = new Date(item.timestamp);
    const hasNext = idx < sorted.length - 1;
    const nextItem = hasNext ? sorted[idx + 1] : null;

    let endISO: string | null = null;
    let endTime: string | null = null;
    let durationMinutes: number | null = null;
    let durationLabel = "No later check-in";

    if (nextItem) {
      endISO = nextItem.timestamp;
      endTime = formatTimeHM(nextItem.timestamp, timeZone);
      const nextDate = new Date(nextItem.timestamp);
      const diffMs = nextDate.getTime() - start.getTime();
      durationMinutes = Math.max(0, Math.round(diffMs / (60 * 1000)));
      durationLabel = formatDurationHoursMinutes(durationMinutes);
    }

    return {
      id: item.id,
      activity: item.actual_activity,
      entryType: item.entry_type === "journal" ? "journal" : "work",
      startISO: item.timestamp,
      startTime: formatTimeHM(item.timestamp, timeZone),
      endISO,
      endTime,
      durationMinutes,
      durationLabel,
      isLatest: !hasNext,
    };
  });
}
