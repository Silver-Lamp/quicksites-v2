-- Open Commerce core

-- Extensions
create extension if not exists pgcrypto;

-- ===== Enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'catalog_item_type') then
    create type catalog_item_type as enum ('meal','product','service','digital');
  end if;
end $$;

-- ===== Tables
create table if not exists merchants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  site_slug text not null,                       -- default sales channel
  default_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists merchants_owner_site_idx on merchants(owner_id, site_slug);

create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  type catalog_item_type not null,
  title text not null,
  slug text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  tax_code text,
  status text not null default 'active',         -- 'active','draft','archived'
  images jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, slug)
);

create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references catalog_items(id) on delete cascade,
  kind text not null,                            -- 'always'|'window'|'calendar'
  starts_at timestamptz,
  ends_at timestamptz,
  quantity int,                                  -- null = unlimited
  metadata jsonb not null default '{}'::jsonb
);

-- Carts (optional for later; kept minimal)
create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  customer_id uuid,                               -- nullable (guest)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  catalog_item_id uuid not null references catalog_items(id) on delete cascade,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  metadata jsonb not null default '{}'::jsonb
);

-- Orders
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete restrict,
  site_slug text not null,
  customer_id uuid,                               -- nullable (guest)
  currency text not null default 'USD',
  subtotal_cents int not null default 0,
  tax_cents int not null default 0,
  shipping_cents int not null default 0,
  platform_fee_cents int not null default 0,      -- QS fee you assess
  total_cents int not null default 0,
  status text not null default 'pending',         -- 'pending','paid','failed','refunded','canceled'
  provider text,                                  -- 'stripe','paypal', etc
  provider_checkout_id text,
  provider_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  catalog_item_id uuid references catalog_items(id) on delete set null,
  title text not null,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  metadata jsonb not null default '{}'::jsonb
);

-- Payment accounts (merchant → provider account)
create table if not exists payment_accounts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  provider text not null,                          -- 'stripe','paypal','square','authorize_net','custom'
  account_ref text not null,
  status text not null default 'active',
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, provider)
);

-- Payments (normalized provider events)
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null,
  provider_payment_id text not null,
  amount_cents int not null,
  state text not null,                              -- 'succeeded','failed','refunded'
  raw jsonb not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

-- Referrals (reps & affiliates)
create table if not exists referral_codes (
  code text primary key,
  owner_type text not null,                         -- 'provider_rep'|'qs_affiliate'
  owner_id uuid not null,
  plan jsonb not null                               -- e.g. {"type":"percent","rate":0.2,"duration_months":12}
);

create table if not exists attributions (
  merchant_id uuid primary key references merchants(id) on delete cascade,
  referral_code text references referral_codes(code),
  first_touch_at timestamptz not null default now(),
  locked_at timestamptz
);

create table if not exists commission_ledger (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null references referral_codes(code),
  subject text not null,                            -- 'qs_subscription'|'order_platform_fee'
  subject_id text not null,
  amount_cents int not null,
  currency text not null default 'USD',
  status text not null default 'pending',           -- 'pending','approved','paid','void'
  adjustments jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ===== RLS
alter table merchants enable row level security;
alter table catalog_items enable row level security;
alter table availability enable row level security;
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payment_accounts enable row level security;
alter table payments enable row level security;
alter table referral_codes enable row level security;
alter table attributions enable row level security;
alter table commission_ledger enable row level security;

-- Helpers
create or replace function is_owner(uid uuid, m_id uuid)
returns boolean language sql stable as $$
  select exists(select 1 from merchants where id = m_id and owner_id = uid);
$$;

-- Merchants: owner full access
create policy merchants_owner_rw on merchants
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Catalog: public read of active; owner rw
create policy catalog_public_read on catalog_items
  for select using (status = 'active');
create policy catalog_owner_rw on catalog_items
  for all using (is_owner(auth.uid(), merchant_id)) with check (is_owner(auth.uid(), merchant_id));

-- Availability: owner rw, public read for items that are public
create policy avail_public_read on availability
  for select using (exists(select 1 from catalog_items ci where ci.id = catalog_item_id and ci.status='active'));
create policy avail_owner_rw on availability
  for all using (exists(select 1 from merchants m join catalog_items ci on ci.merchant_id=m.id where ci.id=catalog_item_id and m.owner_id=auth.uid()))
  with check (exists(select 1 from merchants m join catalog_items ci on ci.merchant_id=m.id where ci.id=catalog_item_id and m.owner_id=auth.uid()));

-- Orders & payments: owner read, server-side writes (no public write policies)
create policy orders_owner_read on orders for select using (is_owner(auth.uid(), merchant_id));
create policy order_items_owner_read on order_items for select using (exists(select 1 from orders o where o.id=order_id and is_owner(auth.uid(), o.merchant_id)));
create policy payments_owner_read on payments for select using (exists(select 1 from orders o where o.id=order_id and is_owner(auth.uid(), o.merchant_id)));

-- Payment accounts: owner rw
create policy pa_owner_rw on payment_accounts
  for all using (is_owner(auth.uid(), merchant_id)) with check (is_owner(auth.uid(), merchant_id));

-- Referral / attribution / ledger: service role only (no policies) -> accessed via server key
