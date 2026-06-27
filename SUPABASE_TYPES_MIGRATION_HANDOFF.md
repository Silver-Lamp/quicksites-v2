# Supabase types migration — handoff (audit #8, phase 2)

> Working doc for a fresh session to finish the migration. **Delete before the PR goes to `main`.**
> Branch: **`fix/supabase-types`** · Draft PR **#10** · As of this handoff: **~180 tsc errors across ~78 files** (down from the original 819).

## TL;DR for the next session
1. `git checkout fix/supabase-types && npm install` (deps are bumped — see below).
2. Goal: get `rm -f .tsbuildinfo && npx tsc --noEmit` to **0**, then `npm run build` to pass.
3. Work file-by-file from the error list. **Every fix needs a live-DB schema check** (commands below) — the errors are real latent bugs (code querying columns/tables that don't exist), not type noise.
4. Commit in batches to `fix/supabase-types` (draft PR #10). Keep commits scoped + messaged.
5. **Before marking the PR ready: runtime auth smoke-test** (the `@supabase/ssr` bump touches cookies — types compiling ≠ auth working).

---

## What's already done (the foundation — don't redo)

The root cause: the old hand-trimmed `types/supabase.ts` (88 tables, old format, no `__InternalSupabase` marker) was **incompatible with the installed `@supabase/postgrest-js`**, collapsing every typed `.from()` query to `never`. It only "passed" in the original dev's local `node_modules`; a clean install (CI) failed with hundreds of errors.

Fix applied on this branch:
- **`package.json`**: `@supabase/supabase-js` 2.75.0 → **2.108.2**, `@supabase/ssr` 0.6.1 → **0.12.0**; removed the `overrides` that pinned the old versions.
- **`types/supabase.ts`**: regenerated from the live DB via `supabase gen types` (new format, `__InternalSupabase` + `PostgrestVersion`): **88 → 196 tables**, now including all commerce tables.
- This **cured the `never` epidemic** (649 → 28) and surfaced the real pre-existing type bugs that are the remaining work.

Already-fixed files (committed): `useThemeContext`, `useGlowTheme`, `useLiveTable`, `site/resolve`, and the **entire `profiles` cluster** (21 files — see "Decisions" below).

To regenerate types if ever needed:
```bash
source .env.local
supabase gen types typescript --db-url "$SUPABASE_DB_URL" --schema public --schema graphql_public > types/supabase.ts
```

---

## Critical caveats

- **`tsc` is SLOW (~3–6 min/run).** The large 196-table types + dynamic queries strain the compiler (see `TS2589` below). Batch many file fixes between runs. Always `rm -f .tsbuildinfo` first for an accurate count (incremental cache hides errors — this is what created the original "0 errors locally" illusion).
- **`next build` is the real gate** — it type-checks too (only eslint is ignored in `next.config.mjs`). A passing `tsc` should mean a passing build, but confirm with `npm run build` at the end.
- **Runtime auth risk.** `@supabase/ssr` 0.6 → 0.12 changed cookie handling. Do a login/session smoke-test before merge.
- **CI:** `.github/workflows/ci.yml` currently runs typecheck/build as **non-blocking** annotations (PR #9) precisely because of this migration. Once this lands and `tsc`/`build` are green from a clean install, flip those to blocking (tracker has the follow-up).

## How to work

Get the current error list grouped by file:
```bash
rm -f .tsbuildinfo
npx tsc --noEmit 2>&1 | tee /tmp/tsc.log
grep "error TS" /tmp/tsc.log | sed -E 's/\(.*//' | sort | uniq -c | sort -rn   # files by count
grep -F "path/to/file.tsx" /tmp/tsc.log                                         # errors for one file
```

**Live DB schema check (essential — do this for every column/table question):**
```bash
source .env.local
psql "$SUPABASE_DB_URL" -tA -c "select column_name from information_schema.columns where table_name='X' order by ordinal_position"
psql "$SUPABASE_DB_URL" -tA -c "select table_name from information_schema.tables where table_name='X'"   # does table/view exist?
```
The regenerated `types/supabase.ts` is the source of truth and matches the live DB — but verifying against `psql` is faster than scrolling a 7600-line file.

---

## Error-category playbook (the 180 remaining, by `tsc` code)

| Code | Count | Meaning | How to fix |
|---|---|---|---|
| `TS2345` | 60 | arg not assignable | mostly **nullability** (`string \| null` → `string`): filter `.filter((x): x is string => !!x)` before `.in()`, or `?? ''`/`?? undefined`, or null-guard. Some are insert-shape mismatches. |
| `TS2769` | 39 | no overload matches | **insert/upsert shape** doesn't match the table's `Insert` type, OR a dynamic `.from(var)`. Align the object to `TablesInsert<'table'>`, or cast dynamic queries `(supabase as any)`. |
| `TS2339` | 37 | property doesn't exist (often `on type 'never'`) | **stale columns / dynamic queries**. Check the live schema: remap to the real column or remove. 28 are still `never` (dynamic `.from(string)` → cast to `any`). |
| `TS2322` | 27 | type not assignable | **nullability** assignments (`string \| null` into a non-null field) — `?? ''`/`?? undefined`, or widen the local type. |
| `TS2589` | 11 | instantiation excessively deep | the compiler-strain ones — **dynamic/generic `.from(string)`** (e.g. `useZodPlaygroundState`, `app/admin/admin/*`). Cast the client/query to `any`. |

**Guiding principle (behavior preservation):** where the code queried a **non-existent column/table**, it was already failing silently at runtime → removing/defaulting it is behavior-preserving (make that explicit in a comment). Where it's just nullability the accurate types now expose, add the guard.

## Decisions already made (stay consistent)

- **`.from('profiles')` → `user_profiles`.** `profiles` doesn't exist. `user_profiles` columns: `user_id, email, name, role, plan, avatar_url, org_role, bio, last_seen_*`. Mapping: `id`→`user_id`, `display_name`→`name`, `is_admin`→`(role === 'admin')`.
- **Admin gates → `getAdminUser()`** (from `@/lib/auth/getAdminUser`). The 15 ad-hoc `.from('profiles').select('role')` gates were consolidated onto it (also advances the audit's "standardize admin checks" item). Pattern: `if (!(await getAdminUser())) return/throw forbidden;`. It checks `ADMIN_EMAILS` + `app_metadata`/`user_metadata` role.
- **`sites` table:** the column is `domain`, not `hostname`.
- **`user_site_settings`:** only has `user_id, site_slug, glow_config` — the `theme_*` columns never existed.
- **`profiles.default_org_id`:** exists on no table; org/resolve now uses `org_members` directly.

## Remaining hotspots (top files; full list via the grep above)
```
10  hooks/useZodPlaygroundState.ts      (TS2589 dynamic — cast to any)
10  app/admin/admin/dashboard.tsx       (literal .from with deep instantiation)
 9  components/profile-form.tsx         (insert shape / nullability)
 7  lib/sites/context.ts
 7  hooks/useDashboardLayout.ts         (dashboard_user_layouts columns — verify schema)
 6  app/api/electinfo/unlock-request/route.ts
 5  hooks/useOrgBranding.ts             (orgs vs organizations — verify table)
 5  components/admin/template-user-viewer.tsx
 5  app/admin/inbox/[id]/page.tsx
 5  app/admin/admin/access-requests.tsx
 4  lib/electinfo/entitlements.ts · app/api/admin/compliance/{seed,approve_all} · app/admin/short-links · app/admin/billing/map
 ... then a long tail of ~50 files with 1–3 errors each
```

## Definition of done
1. `rm -f .tsbuildinfo && npx tsc --noEmit` → **0 errors**.
2. `npm run build` → succeeds.
3. **Login/session smoke-test passes** (ssr bump).
4. Delete this file.
5. Mark PR #10 ready; then flip CI typecheck/build to blocking (PR #9 / tracker).

## Tracker
The task tracker (`/admin/tasks`, `admin_tasks` table) has "Regenerate Supabase types (align versions)" as `high`/`in_progress` with the running status. Update it when phase-2 completes.
