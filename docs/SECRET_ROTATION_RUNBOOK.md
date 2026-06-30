# Secret rotation runbook — leaked Supabase service-role key

> Created 2026-06-28. **Priority 1 / urgent.** Companion to the RLS exposure work
> (PR #12). The code-side fix is done; the dashboard rotations below are owner-only.

## What leaked
The **Supabase `service_role` key** for the live project `kcwruliugwidsdgsrthy`
was committed to git as a hardcoded fallback in three scripts:
- `scripts/fix_nested_data_data.js`
- `scripts/maintenance/backfill-industry-services.ts`
- `scripts/maintenance/fix-legacy-props.ts`

Decoded JWT: `{ iss: supabase, ref: kcwruliugwidsdgsrthy, role: service_role, iat ~2025-05-22, exp ~2035 }`.
Confirmed this is the **live production** key (DB host `db.kcwruliugwidsdgsrthy.supabase.co`
matches the ref). The `service_role` key **bypasses RLS entirely** — anyone with it
has full read/write to every table. It is in working tree AND git history.

No other provider secrets (OpenAI / Stripe / Twilio / Resend / Google API) are
hardcoded in tracked files — verified by pattern scan. Only `.env.example`
(placeholders) is tracked.

## Done in code (this change)
- Removed the hardcoded key + project-ref fallbacks from all three scripts; they
  now require `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from the
  environment and exit if absent. Working tree verified clean of JWTs.

## Priority 1 — rotate the Supabase keys (owner, dashboard)
Rotating neutralizes the leaked value everywhere, including git history, so a
history rewrite is **not required** afterward.

### ✅ Recommended: migrate to the new API key system (and rotate as you go)
The new keys (`sb_publishable_…` / `sb_secret_…`) are **drop-in replacements** —
supabase-js (2.108) sends them to the API gateway unchanged, and nothing in this
repo decodes them as JWTs (verified). The big win: the **secret key rolls
independently** — no session drop, no publishable-key invalidation — which is
exactly what the leaked-key rotation needs. User auth is unaffected because session
JWTs are still signed by `SUPABASE_JWT_SECRET`, separate from the API keys.

The codebase already supports this with **zero refactor** (see `instrumentation.ts`,
which maps `SUPABASE_SECRET_KEY` → `SUPABASE_SERVICE_ROLE_KEY` at boot):

1. Dashboard → project `kcwruliugwidsdgsrthy` → **Settings → API Keys** → create
   (or reveal) the **Publishable** and **Secret** keys. If the leaked legacy key is
   still active, disable/delete it here once the new keys are live.
2. Set env (Vercel Production + Preview, then local `.env.local`), redeploy:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the **publishable** key (`sb_publishable_…`).
     It's build-time inlined and public by design, so the var name stays as-is.
   - `SUPABASE_SECRET_KEY` = the **secret** key (`sb_secret_…`). You can leave the
     old `SUPABASE_SERVICE_ROLE_KEY` unset; `instrumentation.ts` fills it from the
     secret key. (If both are set, the legacy var wins — clear it to fully cut over.)
3. Smoke-test (below). From now on, rotating the leaked/compromised secret is a
   one-click "roll secret key" in the dashboard with **no maintenance window**.

### Alternative: rotate the legacy JWT secret (heavier, only if not migrating)
1. Supabase Dashboard → project `kcwruliugwidsdgsrthy` → **Project Settings → API**.
2. Regenerating the JWT secret reissues **both** `anon` and `service_role`. ⚠️ This
   invalidates the old anon key too — every signed-in session (incl. guest
   anonymous sign-ins) is dropped and any cached anon key 401s until redeploy. Do
   it in a short maintenance window.
3. Update env everywhere the old values live, then redeploy:
   - **Vercel** (Production + Preview): `SUPABASE_SERVICE_ROLE_KEY`, and if the
     JWT secret was rotated also `NEXT_PUBLIC_SUPABASE_ANON_KEY` +
     `SUPABASE_ANON_KEY` (and any `SUPABASE_ANON_KEY` alias).
   - **Local** `.env.local` for every dev.
   - Any other host (cron runners, CI secrets, scripts' shells).
4. Redeploy and smoke-test: site loads, login works, an authed API route works,
   a service-role route (e.g. a cron) works.

## Priority 2 — exposed OAuth tokens (owner) — RISK ACCEPTED 2026-06-29
While RLS was disabled, the public anon key could read token tables (now locked,
PR #12). Current contents:
- `gsc_tokens` — **22 rows** (Google Search Console OAuth tokens). **Owner decision
  2026-06-29: leave as-is — mostly test data, risk accepted.** (Original guidance:
  revoke + force re-auth, or rotate the Google OAuth client secret and re-consent.)
- `social_accounts` — **0 rows**, nothing to revoke.

## Priority 3 — git history (optional, low value after rotation)
The leaked value remains in history but is **dead once rotated**. Only purge if a
policy/compliance scanner requires it — it rewrites shared history (9+ branches,
active `main`) and forces everyone to re-clone:
- `git filter-repo --replace-text` (preferred) or BFG to scrub the JWT string,
  then force-push and have collaborators re-clone. Coordinate first.

## Verification checklist
- [ ] New `service_role` (and anon, if JWT-secret rotated) live in Vercel + local.
- [ ] Old key 401s against the REST API (`curl` with the old key → 401).
- [ ] App + login + an authed route + a cron route all green post-rotate.
- [ ] GSC tokens revoked/re-authed (or risk explicitly accepted).
- [ ] `git grep -E 'eyJhbGciOiJ'` returns nothing in tracked files (already true).
- [ ] Add a pre-commit secret scan (gitleaks/trufflehog) so this can't recur.
