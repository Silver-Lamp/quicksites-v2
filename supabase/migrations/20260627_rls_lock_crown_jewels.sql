-- 20260627_rls_lock_crown_jewels.sql
--
-- SECURITY: close the most dangerous holes from the "RLS disabled in public" audit.
-- 121/165 public tables had RLS disabled while anon/authenticated hold full DML
-- grants, so the PUBLIC anon key (shipped in every browser bundle) could read AND
-- write them via PostgREST. This migration locks the highest-value, server-only
-- tables. Server routes use the service-role key, which BYPASSES RLS, so they keep
-- working; the anon key is fully denied.
--
-- Verified (rg) that these tables are accessed ONLY via the service-role client:
--   gsc_tokens (after fixing lib/gsc/getAllTokens.ts), gsc_cache, email_outbox,
--   merchant_payment_accounts, login_attempts.
-- Deferred (user-context / browser access — need scoped policies): compliance_docs,
-- leads, payment_accounts, email_logs, user_profiles, and the rest of the 121.

-- Deny-by-default: RLS on, no policies → anon/authenticated get nothing; service role bypasses.
alter table public.gsc_tokens                enable row level security;
alter table public.gsc_cache                 enable row level security;
alter table public.email_outbox              enable row level security;
alter table public.merchant_payment_accounts enable row level security;
alter table public.login_attempts            enable row level security;

-- admin_users holds the authz allow-list. With RLS off + write grants, ANY anon-key
-- caller could insert themselves as admin or delete admins (privilege escalation).
-- Existing self/role checks read this table via the user-context client, so keep
-- reads working but deny all writes (service role manages membership).
alter table public.admin_users enable row level security;
drop policy if exists admin_users_read on public.admin_users;
create policy admin_users_read on public.admin_users
  for select using (true);
-- (no insert/update/delete policy → writes denied for anon & authenticated)
