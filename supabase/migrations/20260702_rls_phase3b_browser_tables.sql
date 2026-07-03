-- SECURITY (Phase 3b): scope the browser-written tables that were RLS-DISABLED
-- with anon+authenticated write grants (writable via the public anon key over
-- PostgREST). Unlike the service-role-only tables (which can be blanket deny-
-- defaulted), these have real user-client readers/writers, so each gets a scoped
-- policy that preserves the legitimate access while cutting off the anon key.
--
-- Verified callers (grep + live DB), 2026-07-02:
--   • domains          — all writers are service-role (claim-site, admin/org).
--                        Browser access is READ-only (sitemaps, admin lists).
--   • remix_events     — one browser INSERT (admin/templates/new) that stamps
--                        user_id = auth.uid(); no browser reader.
--   • user_action_logs — admin-page browser INSERT + SELECT; other writers are
--                        service-role (stripe webhook, claim/lead, trials cron).
--                        Audit log → immutable from the browser (no upd/del policy).
--   • dashboard_layouts— admin layout editor read/write (browser); global config.
--
-- NOTE: `public.sites` is intentionally NOT locked here. It has NO owner column
-- and a large public-render + editor-write surface, so correct write-scoping
-- needs a schema change (add an owner/created_by column) first — tracked as a
-- follow-up. A blanket authenticated-write policy would look fixed while still
-- letting any logged-in user mutate any site.
--
-- Service-role (the app's server clients) bypasses RLS entirely, so server-side
-- writes are unaffected by every policy below.

-- ── domains ─────────────────────────────────────────────────────────────────
alter table public.domains enable row level security;
drop policy if exists domains_public_read on public.domains;
create policy domains_public_read on public.domains
  for select
  using (true);
-- No write policy → INSERT/UPDATE/DELETE only via service-role. (Closes the anon-
-- key domain-claim/hijack write path; claim-site + admin writes bypass RLS.)

-- ── remix_events ────────────────────────────────────────────────────────────
alter table public.remix_events enable row level security;
drop policy if exists remix_events_insert_own on public.remix_events;
create policy remix_events_insert_own on public.remix_events
  for insert
  to authenticated
  with check (user_id = auth.uid());
-- Reads are server-side (service-role); no browser reader → no select policy.

-- ── user_action_logs ────────────────────────────────────────────────────────
alter table public.user_action_logs enable row level security;
drop policy if exists user_action_logs_read on public.user_action_logs;
create policy user_action_logs_read on public.user_action_logs
  for select
  to authenticated
  using (true);
drop policy if exists user_action_logs_insert on public.user_action_logs;
create policy user_action_logs_insert on public.user_action_logs
  for insert
  to authenticated
  with check (true);
-- No update/delete policy → append-only audit trail from the browser; the anon
-- key can no longer read (lead PII / triggered_by emails) or write these rows.

-- ── dashboard_layouts ───────────────────────────────────────────────────────
alter table public.dashboard_layouts enable row level security;
drop policy if exists dashboard_layouts_authenticated on public.dashboard_layouts;
create policy dashboard_layouts_authenticated on public.dashboard_layouts
  for all
  to authenticated
  using (true)
  with check (true);
-- Global (per-role) admin dashboard config edited via the browser layout editor.
-- Blocks anon-key access; a tighter admin-only scope can follow once
-- admin_users / ADMIN_EMAILS are reconciled (is_platform_admin() would lock out
-- any ADMIN_EMAILS-only admin not yet in admin_users).
