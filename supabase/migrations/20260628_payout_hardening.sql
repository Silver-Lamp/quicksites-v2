-- Harden the partner payout pipeline (see lib/commerce/payouts.ts).
-- 1) affiliate_payouts gets a lifecycle: a row is written as 'processing' BEFORE
--    the money moves, then finalized to 'paid' / 'failed' / 'cancelled'. This
--    closes the orphaned-transfer hole (transfer ok, DB write missing).
-- 2) commission_ledger.payout_id links a settled commission to its payout (audit
--    + clawback).
-- 3) commission_clawbacks captures the obligation when an order is refunded after
--    its partner commission was already paid out (can't just void a paid row).

alter table affiliate_payouts add column if not exists status text not null default 'paid';
alter table affiliate_payouts add column if not exists error text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'affiliate_payouts_status_check') then
    alter table affiliate_payouts add constraint affiliate_payouts_status_check
      check (status in ('processing', 'paid', 'failed', 'cancelled'));
  end if;
end $$;

alter table commission_ledger
  add column if not exists payout_id uuid references affiliate_payouts(id) on delete set null;

create table if not exists commission_clawbacks (
  id uuid primary key default gen_random_uuid(),
  commission_ledger_id uuid not null references commission_ledger(id) on delete cascade,
  affiliate_payout_id uuid references affiliate_payouts(id) on delete set null,
  order_id text,
  amount_cents integer not null check (amount_cents >= 0),
  reason text not null default 'order_refund',
  status text not null default 'pending' check (status in ('pending', 'reversed', 'written_off', 'failed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (commission_ledger_id)
);
create index if not exists commission_clawbacks_status_idx on commission_clawbacks (status);
alter table commission_clawbacks enable row level security;
