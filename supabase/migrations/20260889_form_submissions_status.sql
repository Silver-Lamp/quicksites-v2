-- Tenant contact-form leads get a triage state so the Platform Inbox can show them
-- (owner, 2026-10-16: "1 + 2" — the inbox as the system of record for site leads).
-- `form_submissions` is written by the anon key from every tenant site's contact form
-- (insert-only for anon since 20260627; admin-only select). These columns are read and written
-- by admins through the service role; the anon insert policy is untouched.
alter table public.form_submissions
  add column if not exists status text not null default 'new',
  add column if not exists responded_at timestamptz,
  add column if not exists admin_notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'form_submissions_status_check'
  ) then
    alter table public.form_submissions
      add constraint form_submissions_status_check check (status in ('new', 'contacted', 'archived'));
  end if;
end $$;

create index if not exists form_submissions_status_created_idx on public.form_submissions (status, created_at desc);
create index if not exists form_submissions_site_slug_idx on public.form_submissions (site_slug);
