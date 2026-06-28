-- 20260627_rls_secrets_pii_batch.sql
--
-- SECURITY batch: more tables that were readable/writable via the public anon key
-- (RLS disabled). All verified to have NO active browser/anon-key access in the
-- codebase (server crons/routes use the service role, which bypasses RLS):
--   social_accounts        — OAuth access/refresh tokens (CRITICAL; only ref was a
--                            disabled _disabled_route.ts). Same tier as gsc_tokens.
--   subscriptions          — email + unsubscribe_token (digest sender switched to
--                            service role in admin/lib/sendDigestEmails.ts).
--   waitlist_subscriptions — email + token (service-role cron).
--   referral_logs          — email (service-role route).
--   referrals              — referred_email (no code refs).
--   early_access_signups   — email (no code refs).
--   comments               — author_email (no code refs).
--   report_webhooks        — secret_token (no code refs).
--
-- Deny-default: RLS on, no policies → anon/authenticated denied; service role bypasses.
-- Also drop the mis-scoped "Allow service role full access" (TO public USING true)
-- policy where present (it grants everyone; service role bypasses RLS anyway).

do $$
declare t text;
begin
  foreach t in array array[
    'social_accounts','subscriptions','waitlist_subscriptions','referral_logs',
    'referrals','early_access_signups','comments','report_webhooks'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'Allow service role full access', t);
  end loop;
end $$;
