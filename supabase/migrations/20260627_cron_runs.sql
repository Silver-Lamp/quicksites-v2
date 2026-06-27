-- Run history for scheduled jobs, powering the /admin/cron health dashboard.
create table if not exists cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,                       -- registry key (lib/cron/registry.ts)
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  status text not null default 'running',  -- 'running' | 'ok' | 'error'
  duration_ms int,
  error text,
  result jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cron_runs_job_started_idx on cron_runs (job, started_at desc);
create index if not exists cron_runs_started_idx on cron_runs (started_at desc);

alter table cron_runs enable row level security;
-- service-role only (no policies): written by cron handlers, read by admin via service key.
