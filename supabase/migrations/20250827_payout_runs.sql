create extension if not exists pgcrypto;

create table if not exists payout_runs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,                 -- who executed the run
  actor_email text,                            -- convenience for audits
  range_start date not null,
  range_end date not null,
  codes text[] not null,                       -- referral codes in scope
  total_approved_cents_before int not null,    -- sum of "approved" seen in preview
  total_marked_paid_cents int not null,        -- what we intended to mark as paid
  count_codes int not null,
  count_rows_marked int not null,              -- rows admin said were marked
  meta jsonb not null default '{}'::jsonb,     -- freeform (per-code breakdown, notes)
  created_at timestamptz not null default now()
);

create table if not exists payout_run_items (
  id uuid primary key default gen_random_uuid(),
  payout_run_id uuid not null references payout_runs(id) on delete cascade,
  referral_code text not null,
  approved_cents_before int not null,
  rows_marked int not null,
  marked_paid_cents int not null,
  created_at timestamptz not null default now()
);

-- Service-only access by default
alter table payout_runs enable row level security;
alter table payout_run_items enable row level security;
-- (Intentionally no policies: only your server key/Service Role can read/write.)
