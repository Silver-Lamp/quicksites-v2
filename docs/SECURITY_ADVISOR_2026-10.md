# Supabase security advisor, 2026-10-17 — what it found, how we test it, how we fix it

> Trigger: Supabase's weekly "Action required: security vulnerabilities detected" email
> (2026-10-20 07:44) for the **QuickSites** project (`kcwruliugwidsdgsrthy`) and the **Delivered
> Menu** project (`vucxytxricothuupbfvn`, PorchHearth's — their fix, our method). Three critical
> classes: `rls_disabled_in_public`, `sensitive_columns_exposed`, `auth_users_exposed`. The email
> names **no tables**; this doc re-derives them from the database and proves each one the way an
> attacker would, with the anon key that ships in every browser bundle.
>
> Re-derive, never remember: `npx tsx --env-file=.env.local scripts/rls-probe.mts --authed`.

## What is true (verified 2026-10-20, read-only probes with the anon key)

| Finding | What it is | Proof |
|---|---|---|
| **`auth_users_exposed`** | View `public.branding_profiles_with_email` joins `auth.users` and is readable by `anon`. It exposes `access_token`, `password`, `owner_id` and the owner's **auth email**. **Referenced by no code** (only `scripts/supabase-user_view.sql`). | anon GET → 206, 10 rows, columns include `access_token`, `password` |
| **`rls_disabled_in_public`** | **80 tables** in `public` with RLS off, every one with full `SELECT/INSERT/UPDATE/DELETE` grants to `anon` and `authenticated`. The 2026-07 sweep locked the crown jewels and left these as "low severity / needs policy design"; some are not low. | `call_logs` 104 rows (callers' numbers, voicemail transcripts) · `snapshots` 77 (editor emails, contact details) · `template_versions` 944 (full site data, editor ids) · `published_sites` 197 · `companies` 22 · `company_members` 22 (user ids) · `campaign_leads` 8 · `shared_previews` 4 |
| **`sensitive_columns_exposed`** | The subset of the above whose columns look like PII or secrets: `call_logs` (voicemail_*), `snapshots` (contact_email, phone, address), `public_profiles` (email), `token_logs` (token_hash, ip), `support_campaigns` (preclaim_token), `click_events`/`snapshot_views`/`template_views` (ip_address), `shared_templates` (editor_email), `review_token_events` (token). | same probe |
| **Bonus, not in the email** | Two policies that are `TO public USING (true)` on tables where RLS is **on**, so they are live, not inert: `draft_sites "Allow service role full access"` (anyone reads/writes every draft) and `agent_block_presets presets_write / presets_delete` (anyone inserts/deletes presets). | `pg_policies` |
| **Bonus 2 — views that bypass RLS** | All 12 public views are owned by `postgres` with `security_invoker = false`, so they read their base tables **as the owner, ignoring RLS**, and all carry full anon grants. Three hand out template `data` that the `templates` RLS protects (anon sees 191 published rows): **`templates_versions` 3,391 rows** (no code reads it), `templates_effective` 245, `templates_latest` 247 (one reader each). `mobile_session_summary` aggregates `session_logs` (locked in July) back into the open. | probe: view rows vs table rows |
| **Also readable by anon with RLS on** | `admin_users` (2 rows — the policy `admin_users_read` is `TO public`, so the admin user ids are public), `draft_sites` (via the policy above). `templates`, `sites`, `catalog_items`, `chefs`, `features`, `availability`, `ai_model_pricing` are public **by design**. | probe |

**Verified:** the 80-table list, the grants, the view definition, the row counts and the
exposed columns were read from the live database and the live REST API on 2026-10-20.
**Assumed:** that Supabase's "46 other tables" count for the Delivered Menu project has the
same shape — we did not read their database.

## The test (before and after)

`scripts/rls-probe.mts` lists every table and view in `public` and, for each, makes a real REST
request as **anon** and (with `--authed`) as a **throwaway signed-in user** it creates and deletes.
It prints status + visible row count per table and a tally. `--write` additionally attempts an
INSERT of `{}` and deletes anything it managed to insert.

- **Before** (baseline, 2026-10-20): see the tally in the PR that ships the fix.
- **After**: every table in the deny-default and scoped lists below must answer 401/403 or
  0 rows to anon; the by-design public tables (`domains`, `sites`, `features`, `chefs`,
  `templates` published rows, `published_sites` is_public rows) must still answer 200.
- The owner then re-checks **Supabase → Advisors** on both projects, which is the only place
  the advisor's own verdict lives.

## The fix, in three PRs

### PR 1 — zero-risk, same day
1. **Drop the view** `branding_profiles_with_email` (no code reads it). **Drop**
   `templates_versions` and `mobile_session_summary` (no code reads them).
2. **`security_invoker = true`** on the nine remaining views, so each reads its base table under
   the caller's RLS (`templates_effective` / `templates_latest` then show published rows only;
   `template_bases_secure`, `organizations_public`, `org_domains_public`,
   `features_public_portfolio` sit on tables that already have public-read policies, so they
   keep working — verify each with the probe after). Revoke `INSERT/UPDATE/DELETE/TRUNCATE`
   grants on every view (a view with a DELETE grant is an accident).
3. **Drop** `draft_sites."Allow service role full access"` (the service role bypasses RLS anyway;
   the owner policy stays).
4. `agent_block_presets`: `presets_write` / `presets_delete` → `is_admin()`.
5. `admin_users_read` → `authenticated` reading their **own** row, or `is_admin()`; nothing
   public needs the list of admins.
6. **Deny-default RLS** (enable RLS, no policies, so only the service role reads) on the tables
   that only service-role code or nothing touches — **50 tables**:
   - service-role only (25): `ai_estimates, ai_pricing_sources, block_feedback, blocks, call_logs,
     click_events, compliance_notifications, deploy_logs, geo_cache, leaderboard_cache,
     not_found_logs, param_presets, published_site_views, regeneration_queue, screenshot_queue,
     short_link_clicks, snapshot_views, starter_templates, support_requests, support_tickets,
     template_admin_meta, template_events, template_views, thank_you_notes, tracking_checkins`
   - referenced nowhere in code (25): `block_checkins, claimed_handles, early_access_codes,
     guest_conversions, ip_geo_cache, meal_post_markers, nav_events, nav_preferences,
     qr_scan_events, regeneration_logs, review_helpful_votes, review_token_events,
     scheduled_posts, shared_previews, shared_templates, site_edits, site_referrals,
     site_themes, sitemap_logs, social_webhooks, steward_rewards, template_logs,
     testimonial_presets, theme_presets, user_settings` — candidates to **drop** later.

### PR 2 — the 18 tables a user-session client reaches on the server
These are read through `getServerSupabase()` (the caller's JWT), so deny-default would break
the route. Each gets a scoped policy, or the route moves to the service role with its own
auth gate (the §6 norm). From the grep:
`ai_pricing_audit, candidate_pages, candidates, client_errors, companies, company_members,
compliance_docs, compliance_requirements, compliance_status, coupons, deploy_errors, industries,
industry_themes, mehko_opt_in_counties, public_profiles, support_campaigns, template_base_meta,
template_versions`. Shape per table:
- admin-only tables (compliance_*, mehko_*, ai_pricing_audit, client_errors, candidates,
  candidate_pages, template_base_meta) → `is_admin()` for all commands;
- `companies` / `company_members` → member reads own company (`requireCompanyMember` already
  assumes this); writes admin;
- `coupons` → public SELECT of active rows only (checkout validates server-side), writes admin;
- `industries` / `industry_themes` → public SELECT (reference data), writes admin;
- `public_profiles` → public SELECT of `is_public` rows WITHOUT `email` (move `email` behind a
  column grant or a view), owner writes;
- `support_campaigns` → owner/admin; the preclaim flow is service-role;
- `template_versions` → owner of the template or admin; the public renderer reads via service role;
- `deploy_errors` → admin read, service-role write.

### PR 3 — the 12 tables browser code reads with the anon client
`campaign_leads, dashboard_layout_templates, dashboard_layout_versions, dashboard_user_layouts,
grid_presets, guest_upgrade_events, published_sites, site_events, snapshots, template_images,
token_logs, user_site_settings`. All but two are **legacy admin pages** under `app/admin/admin/*`
and `components/admin/*` → `is_admin()` policies (reads and writes). The two with owners:
- `user_site_settings` → `user_id = auth.uid()`;
- `published_sites` / `snapshots` → owner of `template_id` or admin for reads; writes service-role.
  (`snapshots.owner_id` exists; `published_sites.template_id` joins to `templates.owner_id`.)

**Observed by the after-probe (2026-10-20), to settle in PR 3:** `templates`'s
`public_read_published_sites` policy is `TO anon` only, so a **signed-in** user (including a
guest, who holds `authenticated`) reading `templates` through the browser client sees 0
published rows while anon sees 191; the same shows through `templates_effective` /
`templates_latest` now that they run under caller RLS. The public render is server-side, so
nothing visible breaks today, but any browser-side read of a published template by a logged-in
visitor would. Decide whether that policy should be `TO anon, authenticated`.

**PR 2 applied 2026-10-20 (migration `20260901`, #1280).** Three things seen on the way, none
changed by it:
- `GET /api/admin/compliance/docs/list` answers 500 *"Could not find a relationship between
  'compliance_docs' and 'merchants'"* — there is **no foreign key** from `compliance_docs` to
  `merchants`, so PostgREST could never resolve that embed; the route was last touched 2025-08
  and has been broken since. Not a policy; fix the embed (or add the FK) when the compliance
  feature is next worked on.
- `companies` is readable by anon with 22 rows (name, `created_by`, hours) through its
  pre-existing `read company hours` policy (`USING (true)`), written deliberately in 2025. Kept;
  decide in PR 3 whether `created_by` should be public.
- `support_campaigns` answers `select=*` with 401/403 to the API roles now that
  `preclaim_token` is outside their column grant — by design; a reader lists columns.

### Then
- Run the probe; paste the before/after tallies into the PR. **Done for PR 1 (#1279) and PR 2 (#1280).**
- Message PorchHearth with this doc and the probe script (their project has the same class on
  46 tables); they fix their own.
- Owner re-checks the Advisors page on both projects.
- Add a **test** that fails when a new migration creates a `public` table without
  `enable row level security` (grep the migrations), so the list cannot grow back silently.

## Why this slipped
The 2026-07 sweep triaged these as telemetry / public-by-design / needs-design and stopped at
the crown jewels. `call_logs` did not exist then; it was created for pay-per-call in September
with no RLS line and carries callers' phone numbers and voicemail transcripts. A table created
without RLS is public by default on Supabase; the migration test above is the structural fix.
