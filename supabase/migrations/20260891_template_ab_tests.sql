-- Per-SITE A/B tests (owner, 2026-10-16): a template's home page served as A (as published) or B
-- (the published data with the hero replaced by `b.hero`). One row per template; events land in
-- ab_events with experiment = 'site:<template_id>'. Service role only; admins edit on /admin/ab.
create table if not exists public.template_ab_tests (
  template_id uuid primary key references public.templates(id) on delete cascade,
  enabled boolean not null default false,
  split_b integer not null default 50 check (split_b between 0 and 100),
  b jsonb not null default '{}'::jsonb,
  note text,
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.template_ab_tests enable row level security;
-- deny-default: no policies; the service role bypasses RLS.
