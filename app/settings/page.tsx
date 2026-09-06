import { createClient } from "@/lib/supabase/server";
import { getOrCreateScoringConfig } from "@/lib/actions";
import { getOrCreateNotificationPreferences } from "@/lib/notifications/actions";
import ScoringConfigEditor from "@/components/ScoringConfigEditor";
import NotificationSettingsForm from "@/components/NotificationSettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const config = await getOrCreateScoringConfig(user!.id);
  const notificationPrefs = await getOrCreateNotificationPreferences();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <NotificationSettingsForm initialPrefs={notificationPrefs} />

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Scoring settings</h2>
          <p className="text-sm text-neutral-500">
            These weights and bands drive the Discipline Score and Log. Changes
            apply the next time a score is computed — past scores aren&apos;t
            recalculated.
          </p>
        </div>
        <ScoringConfigEditor initialConfig={config} />
      </div>
    </div>
  );
}
