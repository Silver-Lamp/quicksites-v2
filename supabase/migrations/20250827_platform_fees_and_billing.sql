-- Add fee config to payment_accounts (per-merchant provider)
alter table payment_accounts
  add column if not exists collect_platform_fee boolean not null default false,
  add column if not exists platform_fee_percent numeric(5,4) not null default 0, -- e.g. 0.1000 = 10%
  add column if not exists platform_fee_min_cents int not null default 0;

-- Map a merchant to QS billing objects (customer/subscription in your platform Stripe)
create table if not exists merchant_billing (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,                    -- e.g. 'starter', 'pro'
  price_cents int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (merchant_id)
);

alter table merchant_billing enable row level security;
create policy mb_owner_read on merchant_billing for select using (is_owner(auth.uid(), merchant_id));
create policy mb_owner_rw   on merchant_billing for all    using (is_owner(auth.uid(), merchant_id)) with check (is_owner(auth.uid(), merchant_id));

-- Idempotency for commission entries to avoid double-logging (by subject unique)
create unique index if not exists commission_unique_subject
  on commission_ledger (referral_code, subject, subject_id);
