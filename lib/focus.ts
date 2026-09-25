// Pure helpers for Focus Sessions — "what I'm doing right now".

/** An open session older than this is treated as forgotten, not as live work. */
export const ACTIVE_SESSION_MAX_HOURS = 12;

export interface ActiveFocusSession {
  id: string;
  /** Text to show for the session: label, else linked task/assessment title. */
  title: string;
  label: string | null;
  started_at: string;
}

export function activeSessionCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - ACTIVE_SESSION_MAX_HOURS * 60 * 60 * 1000).toISOString();
}

type Related = { title?: string | null } | { title?: string | null }[] | null | undefined;

function relatedTitle(rel: Related): string | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  const title = row?.title?.trim();
  return title ? title : null;
}

/** label → linked task title → linked assessment title → generic name. */
export function focusSessionTitle(session: {
  label?: string | null;
  tasks?: Related;
  assessments?: Related;
}): string {
  return (
    session.label?.trim() ||
    relatedTitle(session.tasks) ||
    relatedTitle(session.assessments) ||
    "Focus session"
  );
}

export function elapsedMinutes(startedAtISO: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(startedAtISO).getTime()) / 60000));
}

export function formatElapsed(minutes: number): string {
  if (minutes < 1) return "<1m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
