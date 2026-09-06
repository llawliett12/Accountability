# Accountability

Personal planning/tracking/discipline PWA.

**Status**: Phases 1–6 are all present in this repo. Phase 5
(screenshots → Gemini Vision screen-time extraction, behavioral pattern
discovery, AI insights) and Phase 6 (notifications, offline queue, PWA
completion, deployment prep, security audit) were built independently in
two separate Claude sessions on top of a shared Phase 1–4 base, then
integrated into this single repository. See `PROGRESS.md` for the exact,
itemized status of every phase, what was and wasn't run/tested in which
environment, and the integration notes for this merge specifically.

**Important**: this integration was performed in a sandbox with no network
access. `npm install`, `npm run test`, `npx eslint`, `npx tsc --noEmit`,
and `npm run build` could **not** be run here. What *was* verified: every
local import in the tree resolves to a real file, all JSON config files
parse, and every `.ts`/`.tsx` file passes a syntax-only TypeScript check
(no type errors were checked — that requires `npm install`). **Before
deploying, run the full verification yourself**:
```bash
npm install
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Setup

1. **Create a Supabase project** at supabase.com (free tier).
2. **Run the migrations**, in order, in the Supabase SQL editor:
   `0001_phase1_core.sql`, `0002_scoring_config_constants.sql`,
   `0003_phase2_health.sql`, `0004_phase4_goals.sql`,
   `0005_phase3_academics.sql`, `0006_phase3_assessment_targets.sql`,
   `0007_phase5_screen_time.sql`, `0008_phase6_notifications_offline.sql`.
   All are idempotent (`create table if not exists` / `add column if not
   exists`) and enable Row Level Security — every row is scoped to the
   logged-in user. (Migrations 0007 and 0008 were originally both numbered
   0007 by their independent sessions — renumbered during integration; see
   PROGRESS.md "Integration notes".)
3. **Create the private storage bucket** — migration `0007` creates
   `screen-time-screenshots` (private, RLS-scoped to each user's own
   folder) automatically; nothing extra to do by hand.
4. **Enable email auth**: Supabase dashboard → Authentication → Providers →
   Email (on by default). For local testing, disable "Confirm email" under
   Authentication → Settings so you can sign up and use the app immediately.
5. **Generate a VAPID keypair** for Web Push (Phase 6 notifications):
   ```bash
   npx web-push generate-vapid-keys
   ```
6. **Copy env vars**: `cp .env.local.example .env.local` and fill in every
   value — see that file for which are public (`NEXT_PUBLIC_*`, safe to
   expose) vs. server secrets (never expose, never commit). `GEMINI_API_KEY`
   is optional — leave it unset and screen-time falls back to manual entry
   everywhere, and insights fall back to statistics-only.
7. **Install and run**:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000 — you'll be redirected to `/login` until you
   sign up.
8. **Run the test suite** (pure logic, no DB needed):
   ```bash
   npm run test
   ```

## What's wired up

- **Auth**: Supabase email/password, session refreshed via middleware.
- **Plan** (`/plan`): quick-add tasks, mark Top 3, one-tap status changes.
- **Now** (`/now`): check-in ("what am I doing right now?") + focus timer,
  offline-capable (queues and syncs if the network drops mid-action).
- **Night review** (`/night`): reconciles any task left `not_started` or
  `in_progress` at day's end, then computes the day's discipline score.
- **Discipline log** (`/discipline/[date]`): verdict + transparent score
  breakdown, kept structurally separate from the Daily Report.
- **Daily report** (`/report/[date]`): factual metrics only, no scoring.
- **Scoring engine** (`lib/scoring/engine.ts`): pure TypeScript, unit-tested.
  Weights/verdict bands live in `scoring_config`, editable from `/settings`.
- **Health** (`/`): sleep, meditation, mood/energy quick-log.
- **Academics** (`/academics`): classes, recurring occurrences, attendance,
  listening/prep/review, quizzes/exams with target-vs-actual + practice
  scores, deadlines, a Mon–Sun calendar, and a dashboard.
- **Goals** (`/goals`): Year → Quarter → Month → Week → Day hierarchy,
  progress computed bottom-up from children/linked tasks.
- **Screen time** (`/screen-time`, `/screen-time/history`): upload a
  screenshot for Gemini Vision extraction (structured, user-confirms/edits
  before saving) or enter manually if Gemini is unset/unavailable.
- **Insights** (`/insights`): deterministic behavioral pattern discovery
  (minimum sample size + correlation-vs-causation guards) plus an optional
  Gemini-generated weekly/monthly narrative on top of the same numbers —
  AI is an interpretation layer, never the source of the underlying stats.
- **Notifications** (`/settings`): per-category reminders (class, study,
  deadline, exam, hydration, daily review, accountability, sleep) delivered
  via Web Push + a service worker, dispatched by `/api/notifications/dispatch`
  on a schedule you wire up externally (see "Notifications" below).
- **Offline + PWA**: installable (manifest + icons), a service worker with
  a real offline fallback page, and an offline action queue for task
  status/check-ins/mood logs/focus-timer pauses with idempotent replay.

## Notifications — external scheduler required

Vercel's Hobby (free) plan only runs `vercel.json` cron jobs once a day,
which isn't fine-grained enough for "class in 15 minutes" style reminders.
`vercel.json` registers a daily run as a floor; for real timely reminders,
point an external scheduler (cron-job.org, a scheduled GitHub Actions
workflow, a Supabase Edge Function cron) at `/api/notifications/dispatch`
every 5–15 minutes, sending `Authorization: Bearer <CRON_SECRET>`.

## Known simplifications (intentional, not bugs)

- Deadlines/assessments store a due *date*, not a due *time* — reminder
  lead time is computed back from end-of-day.
- Offline support covers 4 quick-action flows (task status, check-ins,
  mood logs, focus-timer pause/start), not every mutation in the app.
  Finishing (`stopFocusSession`) a session is deliberately **not** queued —
  it needs the full session+pause history to compute focused time, so it
  surfaces a retry message instead of fabricating a client-side total.
- No in-repo way to manage/name multiple `push_subscriptions` devices —
  push is on/off per device only.
- The live Gemini API itself could not be exercised in either contributing
  session's sandbox (both had the external endpoint blocked) — the
  extraction/validation/fallback code paths were reviewed and unit-tested,
  but a real Gemini call has not been made against this code.

## Deployment

Never expose: `SUPABASE_SERVICE_ROLE_KEY` (used only by the notification
dispatch job via `lib/supabase/admin.ts`, marked `import "server-only"`),
`VAPID_PRIVATE_KEY`, `CRON_SECRET`, `GEMINI_API_KEY`. To deploy on Vercel:
push to GitHub, import the repo, set every var from `.env.local.example`
in Project Settings → Environment Variables, run all eight migrations
against your Supabase project, and wire an external scheduler to
`/api/notifications/dispatch` as described above.

## Security

See `SECURITY_AUDIT.md` for the Phase 6 write-up (RLS cross-isolation +
IDOR-attempt test against a real local Postgres instance). During
integration, one additional issue was found and fixed: the auth middleware
was redirecting *every* unauthenticated request — including the
notification dispatch route's cron calls, which carry no Supabase session
at all — to `/login` before the route's own Bearer-token check could ever
run. Fixed by excluding `/api/*` from the redirect (session refresh still
runs; each API route still enforces its own auth). See PROGRESS.md
"Integration notes" for details.

## Next steps

1. Run the full local verification (`npm install && npm test && npm run
   lint && npx tsc --noEmit && npm run build`) — not yet possible in the
   sandbox that produced this integration.
2. Wire the external scheduler for `/api/notifications/dispatch`.
3. Test against a real Supabase project, a real Gemini API key, and a real
   Android device for the install/offline/push/screenshot-upload flows.
