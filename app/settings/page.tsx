import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrCreateScoringConfig } from "@/lib/actions";
import ScoringConfigEditor from "@/components/ScoringConfigEditor";
import SignOutButton from "@/components/SignOutButton";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // A missing optional settings table (for example while a deployment's
  // migrations are catching up) must not take down account settings or sign
  // out. Keep each independent settings surface available when its own query
  // succeeds instead of failing the entire route.
  const configResult = await Promise.resolve(getOrCreateScoringConfig(user.id)).then(
    (value) => ({ status: "fulfilled" as const, value }),
    () => ({ status: "rejected" as const })
  );
  const config = configResult.status === "fulfilled" ? configResult.value : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-base font-semibold text-white">Account</h2>
        <p className="text-sm text-neutral-400">
          Signed in as <span className="font-medium text-neutral-200">{user?.email}</span>
        </p>
        <div>
          <SignOutButton />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Scoring settings</h2>
          <p className="text-sm text-neutral-500">
            These weights and bands drive the Discipline Score and Log. Changes
            apply the next time a score is computed — past scores aren&apos;t
            recalculated.
          </p>
        </div>
        {config ? (
          <ScoringConfigEditor initialConfig={config} />
        ) : (
          <section className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-xs text-amber-100/70">
            Scoring settings could not be loaded right now. Try again after the settings data is available.
          </section>
        )}
      </div>
    </div>
  );
}
