-- 20260627_rls_email_logs.sql
--
-- SECURITY: email_logs (recipient address, subject, message body — PII) was
-- readable/writable via the public anon key (RLS disabled). Admin reads it via the
-- browser (components/admin/email-logs-panel.tsx); writes are server-side
-- (app/api/send-contact-email, service role).
--
-- Policy: platform admins read; writes via service role (bypasses RLS).

alter table public.email_logs enable row level security;

-- guard against the mis-scoped "Allow service role full access" (TO public USING true)
-- pattern seen on other tables, in case it exists here too.
drop policy if exists "Allow service role full access" on public.email_logs;

drop policy if exists email_logs_admin_select on public.email_logs;
create policy email_logs_admin_select on public.email_logs
  for select using (public.is_platform_admin());

-- (no insert/update/delete policy → writes only via service role)
