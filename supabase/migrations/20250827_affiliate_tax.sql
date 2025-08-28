create extension if not exists pgcrypto;

-- payout method enum
do $$ begin
  if not exists (select 1 from pg_type where typname = 'payout_method') then
    create type payout_method as enum ('ach','wire','check','stripe','paypal','venmo','cash','other');
  end if;
end $$;

-- affiliates’ tax profiles (W-9/W-8 etc.)
create table if not exists affiliate_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  form_type text not null default 'w9',                    -- 'w9','w8ben','w8bene','other'
  entity_type text not null default 'individual',         -- 'individual','sole_prop','c_corp','s_corp','llc','partnership','nonprofit','attorney','other'
  legal_name text not null,
  business_name text,
  tin_type text,                                          -- 'ssn','ein'
  tin_last4 text,                                         -- last 4 for display; store full TIN only in provider vault, if ever
  tin_status text not null default 'unverified',          -- 'unverified','matched','mismatch'
  country text not null default 'US',
  address1 text, address2 text, city text, region text, postal_code text,
  backup_withholding boolean not null default false,
  form_file_url text,                                     -- link to W-9/W-8 in Supabase Storage (or external)
  signed_at timestamptz,
  year_valid_through int,                                 -- e.g., 2027 for W-9 refresh cadence
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- payouts actually SENT (cash-basis)
create table if not exists affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  paid_at timestamptz not null,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'USD',
  method payout_method not null,
  is_tpso boolean not null default false,                 -- true for card/Stripe/PayPal/Venmo (1099-K domain)
  tx_ref text,                                            -- bank ref / Stripe transfer id etc.
  notes text,
  tax_year int generated always as (extract(year from (paid_at at time zone 'UTC'))::int) stored
);

-- filing tracker (what you furnished/filed for a calendar year)
create table if not exists affiliate_1099_filings (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  tax_year int not null,
  amount_reported_cents int not null default 0,
  furnished_on date,
  filed_on date,
  iris_submission_id text,
  status text not null default 'draft',                   -- 'draft','prepared','furnished','filed','corrected'
  recipient_copy_url text,                                -- link to PDF furnished to recipient
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (affiliate_user_id, tax_year)
);

-- RLS
alter table affiliate_tax_profiles enable row level security;
alter table affiliate_payouts enable row level security;
alter table affiliate_1099_filings enable row level security;

-- Tax profiles: owner read/write; admins via service role
create policy atp_owner_rw on affiliate_tax_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Payouts: owner read; writes from server/admin only
create policy ap_owner_read on affiliate_payouts
  for select using (auth.uid() = affiliate_user_id);

-- Filings: owner read own record; writes server-only
create policy a1099_owner_read on affiliate_1099_filings
  for select using (auth.uid() = affiliate_user_id);
