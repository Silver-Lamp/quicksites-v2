-- 20260839_trade_sweep_queue.sql
--
-- The nightly pipeline's to-do list (docs/TRADE_SITES_PIPELINE.md, PR 2).
--
-- A person decides WHICH cities and trades to sweep — that spends Places API money and, per
-- docs/AUTO_SHOP_VERTICAL.md, "do not sweep more cities before the first messages report" — and
-- the cron does the work: sweep, then build a draft for every no-website trade business it finds.
-- One row = one city × one category. `result` keeps the sweep's tallies so the queue doubles as
-- the log of what each sweep yielded (the hit-rate, which decides where to sweep next).

create table if not exists public.trade_sweep_queue (
  id             uuid primary key default gen_random_uuid(),
  city           text not null,
  region         text not null,
  -- The label from lib/prospects/sweepCategories.ts ("Towing", "Plumbing"); resolved at run time.
  category       text not null,
  radius_meters  int not null default 1500,
  priority       int not null default 0,
  status         text not null default 'queued'
                   check (status in ('queued','running','done','failed','cancelled')),
  requested_by   uuid,
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz,
  result         jsonb,
  error          text
);

create index if not exists trade_sweep_queue_status_idx
  on public.trade_sweep_queue (status, priority desc, created_at);

alter table public.trade_sweep_queue enable row level security;
-- No policies on purpose: admin routes + the cron, service-role only.
