-- 20260627_rls_logs_forms_batch.sql
--
-- SECURITY batch 3: logs + the public contact form.

-- Deny-default (no active code refs → server/service-role only):
alter table public.role_change_logs enable row level security;
alter table public.verification_logs enable row level security;

-- user_deletion_logs: admin reads it in the browser (audit page, profile-form);
-- writes are server-side. Admin-only read.
alter table public.user_deletion_logs enable row level security;
drop policy if exists "Allow service role full access" on public.user_deletion_logs;
drop policy if exists user_deletion_logs_admin_select on public.user_deletion_logs;
create policy user_deletion_logs_admin_select on public.user_deletion_logs
  for select using (public.is_platform_admin());

-- form_submissions: PUBLIC contact-form block (on rendered sites) inserts a row and
-- then updates its email_status, both via the anon key. The leak to close is anon
-- READ of submissions (email/phone/message PII). Keep insert/update for the form;
-- restrict reads to admins.
-- TODO(tighten): move the email-status update server-side (service role) so anon
-- needs INSERT only; or column-grant the anon UPDATE to delivery-status columns.
alter table public.form_submissions enable row level security;
drop policy if exists "Allow service role full access" on public.form_submissions;

drop policy if exists form_submissions_public_insert on public.form_submissions;
create policy form_submissions_public_insert on public.form_submissions
  for insert to anon, authenticated with check (true);

drop policy if exists form_submissions_public_update on public.form_submissions;
create policy form_submissions_public_update on public.form_submissions
  for update to anon, authenticated using (true) with check (true);

drop policy if exists form_submissions_admin_select on public.form_submissions;
create policy form_submissions_admin_select on public.form_submissions
  for select using (public.is_platform_admin());
