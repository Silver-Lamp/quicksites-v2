-- SECURITY: lock report_tokens.
--
-- It was RLS-DISABLED with anon/authenticated write grants, so anyone with the
-- public anon key could PLANT a token row. Combined with the (now-fixed) inverted
-- expiry check and path traversal in /api/reports/download, that was an
-- unauthenticated arbitrary server-file read (e.g. .env). Lock the table:
--   • admin tokens page writes/reads as an authenticated platform admin →
--     is_platform_admin() (reliable since the escalation fix)
--   • the download route reads via the service-role client → bypasses RLS
--   • anon / non-admins → denied (can't plant or enumerate tokens).
alter table public.report_tokens enable row level security;

create policy report_tokens_admin_all on public.report_tokens
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
