import { createClient } from "@/lib/supabase/server";
import FocusTimer, { type InitialFocusSession } from "@/components/FocusTimer";
import FocusSessionLedger, { type FocusLedgerRow } from "@/components/FocusSessionLedger";
import MoodQuickLog from "@/components/MoodQuickLog";
import { activeSessionCutoff, focusSessionTitle } from "@/lib/focus";
import { todayISO } from "@/lib/date";

// Offset for the app's home timezone (see DEFAULT_TIMEZONE) so "today" matches the Home page.
const DAY_START_SUFFIX = "T00:00:00+05:30";

export default async function FocusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="py-12 text-center text-sm font-mono text-neutral-500">
        Sign in to use focus sessions.
      </div>
    );
  }

  const today = todayISO();
  const cutoff = activeSessionCutoff();

  const [activeRes, todayRes] = await Promise.all([
    supabase
      .from("focus_sessions")
      .select("id, label, started_at")
      .eq("user_id", user.id)
      .is("ended_at", null)
      .gte("started_at", cutoff)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("focus_sessions")
      .select("id, label, started_at, ended_at, focused_duration_sec, tasks(title), assessments(title)")
      .eq("user_id", user.id)
      .gte("started_at", `${today}${DAY_START_SUFFIX}`)
      .order("started_at", { ascending: false })
      .limit(50),
  ]);

  let initialSession: InitialFocusSession | null = null;
  if (activeRes.data) {
    const { data: pauses } = await supabase
      .from("focus_pauses")
      .select("id, started_at, ended_at")
      .eq("focus_session_id", activeRes.data.id)
      .order("started_at", { ascending: true });
    initialSession = {
      id: activeRes.data.id,
      label: activeRes.data.label ?? null,
      started_at: activeRes.data.started_at,
      pauses: (pauses ?? []) as InitialFocusSession["pauses"],
    };
  }

  const rows: FocusLedgerRow[] = (
    (todayRes.data ?? []) as unknown as {
      id: string;
      label: string | null;
      started_at: string;
      ended_at: string | null;
      focused_duration_sec: number | null;
      tasks?: { title?: string | null } | { title?: string | null }[] | null;
      assessments?: { title?: string | null } | { title?: string | null }[] | null;
    }[]
  ).map((s) => ({
    id: s.id,
    title: focusSessionTitle(s),
    started_at: s.started_at,
    ended_at: s.ended_at,
    focused_duration_sec: s.focused_duration_sec,
    running: s.id === activeRes.data?.id,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Focus</h1>
      <FocusTimer initialSession={initialSession} />
      <FocusSessionLedger rows={rows} />
      <MoodQuickLog />
    </div>
  );
}
