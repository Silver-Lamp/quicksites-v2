-- 20260873_site_creation_alerts.sql
--
-- One row per user-created site the owner has been told about (or deliberately not).
--
-- ⚠️ The dedupe lives in the DATA, not in the sender — same rule as call_logs.alerted_at. An
-- alerter that remembers "the last site I emailed about" re-sends the world after a deploy and
-- misses whatever arrived while it was down. One row per template, written AFTER a successful
-- send (or with a skipped_reason when the site is our own test traffic), is at-most-once.
--
-- ⚠️ A separate table rather than a column on templates: direct UPDATEs to templates are blocked
-- by app.guard_templates_update, and "we emailed the owner" is not site content anyway.
--
-- `progress` keeps the analysis as it stood when the email went out, so the admin page can show
-- exactly what the owner was told rather than a recomputation that may have moved on.
--
-- Deny-default RLS, service-role only: written by the cron, read by admin-gated routes.

create table if not exists public.site_creation_alerts (
  template_id uuid primary key references public.templates(id) on delete cascade,
  owner_id uuid,
  -- When the owner email was sent. NULL with a skipped_reason = deliberately not sent.
  alerted_at timestamptz,
  skipped_reason text,
  progress jsonb,
  created_at timestamptz not null default now()
);

create index if not exists site_creation_alerts_owner_idx
  on public.site_creation_alerts (owner_id, created_at desc);

alter table public.site_creation_alerts enable row level security;

-- Deny-default: no policy on purpose. Service-role bypasses RLS; everyone else gets nothing.

comment on table public.site_creation_alerts is
  'Per user-created site: when the owner was emailed about it (alerted_at) or why not (skipped_reason), plus the where-they-left-off analysis as sent. Service-role only.';
