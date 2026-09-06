# Security audit — Phase 6

Scope: everything added or changed in this session (migration `0007`,
`lib/notifications/*`, `lib/offline/*`, `lib/supabase/admin.ts`, the two new
API routes, and the `client_id`/upsert changes to existing actions in
`lib/actions.ts`/`lib/health/actions.ts`). Phases 1–5's own tables/actions
were not re-audited here — see earlier `PROGRESS.md` entries for what was
checked when each of those was built.

**Method, stated plainly**: this sandbox has no live Supabase project to
test against. Everything below that says "tested" means tested against a
real local PostgreSQL 16 instance (installed via `apt` in this sandbox)
with a minimal `auth.users` table and an `auth.uid()` function backed by a
settable session variable — the same mechanism Supabase's own `auth.uid()`
uses (reading the request's JWT), just substituted with a variable we set
directly. Tests ran as a genuine non-superuser role (`app_user`), because
Postgres RLS is silently bypassed for superusers — running these as
`postgres` would have proven nothing. Anything below that says "reviewed"
means read directly, not executed.

## 1. Row Level Security — tested, not just reviewed

Every new table (`notification_preferences`, `push_subscriptions`,
`notification_log`) enables RLS and follows the same `auth.uid() =
user_id` "own rows" pattern as every table in migrations `0001`–`0006`.

**Cross-user read isolation** (tested): seeded one row each in
`daily_plans`, `notification_preferences`, and `push_subscriptions` as
user 1, then switched the session to user 2 and ran `select count(*)` on
each table. All three returned `0`. This confirms the policy actually
filters rows for a real non-superuser session, not just that the SQL
`create policy` statement parsed.

**IDOR attempt** (tested): as user 2, ran:
```sql
insert into daily_plans (user_id, date) values ('<user-1-id>', '2026-09-07');
```
i.e. user 2 trying to write a row under user 1's identity. Postgres
rejected it: `ERROR: new row violates row-level security policy for table
"daily_plans"`. The `with check (auth.uid() = user_id)` clause on the
insert path is what catches this — confirmed it actually fires, not just
that it's present in the migration file.

**`notification_log` write protection** (tested): this table intentionally
has no `insert`/`update`/`delete` policy for ordinary users — it's written
only by the server-side dispatch job via the service-role key, which
bypasses RLS by design. Confirmed: as a regular authenticated user (the
`app_user` role, standing in for the anon-key-authenticated path), a
direct insert into `notification_log` is rejected with the same RLS
violation error. A user's browser can read their own log rows (`select`
policy) but cannot forge a "sent" record or tamper with the
dispatch job's bookkeeping.

## 2. IDOR / ownership checks — code-level review

Every new server action and route handler was checked for the same
pattern used throughout the pre-existing `lib/actions.ts`: get the user
from `supabase.auth.getUser()` (never from a client-supplied `user_id` in
the request body), then scope every query by that id.

- `lib/notifications/actions.ts` — all four functions
  (`getOrCreateNotificationPreferences`, `saveNotificationPreferences`,
  `savePushSubscription`, `deletePushSubscription`) call
  `auth.getUser()` first and use `user.id` for every read/write.
  `deletePushSubscription` additionally scopes its `delete` by both
  `endpoint` AND `user_id`, even though `endpoint` alone is already
  globally unique — belt-and-suspenders against a mistaken/forged
  endpoint value.
- `app/api/push/subscribe/route.ts` — same pattern, adapted for a route
  handler instead of a server action (it's called from imperative
  `PushManager` browser code, not a form). Both `POST` and `DELETE`
  check `auth.getUser()` before touching the database and return `401`
  immediately if there's no session.
- `app/api/notifications/dispatch/route.ts` — the one endpoint that
  legitimately needs to act across every user, so it cannot use
  per-request user auth. Instead it requires `Authorization: Bearer
  <CRON_SECRET>` and **fails closed**: if `CRON_SECRET` isn't set in the
  environment, `isAuthorized()` returns `false` unconditionally rather
  than allowing the request through on a misconfiguration.
- `lib/actions.ts`/`lib/health/actions.ts` changes (`updateTaskStatus`,
  `createCheckIn`, `startFocusSession`, `startPause`, `logMood`) — the
  new `clientId` parameter is only ever used as a value inside an
  `upsert`'s `client_id`/`id` column, scoped by the same `user_id` check
  every one of these functions already had. A forged `clientId` cannot
  let one user write into another user's row: `task_logs`/`check_ins`/
  `mood_logs` inserts still carry the authenticated `user.id`, and the
  unique index is `(user_id, client_id)`, not `client_id` alone — a
  collision with someone else's `client_id` value on a different
  `user_id` is a different row, not a conflict.

**Idempotent-replay correctness** (tested): inserted the same
`(user_id, client_id)` pair into `task_logs` twice via `on conflict (...)
do nothing` — resulted in exactly one row. Then inserted two ordinary
rows with `client_id = NULL` (the normal, non-offline code path) and
confirmed both persisted — Postgres treats every `NULL` as distinct for
uniqueness purposes, so this idempotency mechanism cannot accidentally
collapse unrelated server-issued writes into one row.

## 3. Service-role key isolation

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely, so it's the single
highest-value secret in this codebase.

- `lib/supabase/admin.ts` is the only file that reads it, and it begins
  with `import "server-only"` — importing this module from any client
  component or client bundle fails the build, not just a runtime warning.
- Grepped the entire `lib/`, `app/`, `components/` tree for
  `service_role`/`SERVICE_ROLE`: the only matches are inside
  `admin.ts` itself (the env var name and an error message).
- `lib/notifications/dispatch-queries.ts` is the only file that imports
  `admin.ts`, and it's only ever called from
  `app/api/notifications/dispatch/route.ts` — the `CRON_SECRET`-gated
  route, never from a page or client-callable action.
- `.env.local.example` documents the key under a clearly labeled "SERVER
  SECRETS (never NEXT_PUBLIC_, never committed)" section with an explicit
  warning not to prefix it `NEXT_PUBLIC_`.

## 4. VAPID / push credentials

- `VAPID_PRIVATE_KEY` is read only in `lib/notifications/push.ts`, also
  gated by `import "server-only"`.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is, correctly, the only push-related
  value exposed to the browser — this is public by design (it's a
  standard ECDSA public key; the Web Push spec assumes it's visible to
  the client, since the client needs it to create a subscription).

## 5. Input validation

- `app/api/push/subscribe/route.ts` validates `endpoint`/`p256dh`/`auth`
  are non-empty strings under explicit length bounds (2048/512/512 chars)
  before they ever reach a query, rather than only checking truthiness.
  `user_agent` is truncated to 512 chars.
- `lib/notifications/actions.ts`'s `saveNotificationPreferences` runs
  every incoming value through a `sanitize()` step before writing:
  numeric intervals/lead-times are clamped to sane ranges (e.g. hydration
  interval 15–480 min, so a `0` or negative value from a malformed client
  can't reach `hydrationSlotsForDay`'s loop), time-of-day strings are
  validated against a strict `HH:MM` regex with a safe fallback, and an
  overlong/non-string timezone falls back to `"UTC"`. This is not an
  isolation boundary (RLS already confines any bad value to the user's
  own row) — it exists so a malformed value can't produce a NaN/garbage
  slot key in the notification-scheduling engine or a broken settings UI.
- The scheduling engine itself (`lib/notifications/engine.ts`) already
  clamps hydration/accountability intervals to a positive minimum
  (`Math.max(15, ...)`/`Math.max(30, ...)`) independent of the action-layer
  sanitize step — defense in depth, not a single point of failure.
- `app/api/notifications/dispatch/route.ts` never trusts client input at
  all (it's a cron target, not user-facing) — its only "input" is the
  `Authorization` header, checked exactly as described in §2.

## 6. Error handling / no secret leakage

- `lib/notifications/push.ts`'s `sendPush` never throws — every failure
  mode (malformed subscription, push-service outage, expired
  subscription) is returned as `{ok: false, error: string}` data, so one
  bad device can't take down a whole dispatch run, and the caller decides
  whether to log/delete/retry.
- `app/api/notifications/dispatch/route.ts` catches per-user errors
  individually (`try`/`catch` inside the loop) so one user's malformed
  data (e.g. a bad timezone string that somehow slipped past sanitize)
  can't abort the whole run for every other user; it returns at most the
  first 20 error messages, not full stack traces, to the caller.
- Grepped for `console.log`/`console.error`/`console.warn` across the new
  code: two hits, both harmless (`push-client.ts` warns if the public
  VAPID key env var is missing; `ServiceWorkerRegister.tsx` warns if SW
  registration itself fails) — neither logs a token, key, or user data.

## 7. Client-side storage

- The offline queue (`lib/offline/db.ts`) uses IndexedDB, which — like
  everything else in this app — is scoped per-origin by the browser
  itself. The queued payloads are the same data the user already typed
  into the form (task status, check-in text, mood/energy numbers, pause
  reasons) — nothing more sensitive is added to it, and nothing in the
  queue is ever transmitted anywhere except back to this app's own
  server actions on replay.
- No `localStorage`/`sessionStorage` used anywhere in this Phase 6 work
  (per this project's own constraint) — IndexedDB only, and only for the
  offline queue.

## 8. Screenshot / file upload

**Not applicable.** Phase 5 (screen-time screenshot upload) does not
exist in this codebase — see the correction note in `PROGRESS.md`'s Phase
6 section and `README.md`. There is no file-upload code path anywhere in
this repo to audit.

## Summary

| Area | Status |
|---|---|
| RLS cross-user isolation | Tested against real Postgres — pass |
| IDOR write attempt | Tested against real Postgres — rejected |
| `notification_log` write protection | Tested against real Postgres — rejected |
| Offline-replay idempotency | Tested against real Postgres — pass |
| Service-role key isolation | Code-reviewed, `server-only`-enforced |
| VAPID key isolation | Code-reviewed, `server-only`-enforced |
| Auth pattern on every new action/route | Code-reviewed — consistent |
| Input validation (push subscribe, preferences) | Hardened this session |
| Error handling / no stack-trace or secret leakage | Code-reviewed |
| Screenshot upload security | N/A — Phase 5 doesn't exist |

**Not done, and worth stating plainly**: none of this was tested against
a *live* Supabase project (only a local Postgres standing in for one), and
there was no real Android device or browser available to test an actual
end-to-end push notification delivery or a real airplane-mode-triggered
offline/sync cycle. The local-Postgres tests validate that the SQL itself
enforces isolation correctly under RLS; they don't validate Supabase's own
auth/JWT layer, which is out of this repo's control and wasn't part of
this session's scope.
