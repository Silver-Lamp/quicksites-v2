-- Customer identity spine (CRM_PLAN.md Phase 0).
--
-- QuickSites had no buyer entity — order buyer identity lived only inside payments.raw
-- JSON. This creates a per-merchant customers table keyed by normalized email, plus an
-- atomic upsert the paid-order path calls to build order history + lifetime value.

create table if not exists public.customers (
  id                 uuid primary key default gen_random_uuid(),
  merchant_id        uuid not null references public.merchants(id) on delete cascade,
  email              text not null,
  email_normalized   text not null,       -- lower(trim(email)) — the dedup key
  name               text,
  phone              text,
  stripe_customer_id text,
  marketing_consent  boolean not null default false,
  first_order_at     timestamptz,
  last_order_at      timestamptz,
  orders_count       int not null default 0,
  lifetime_cents     bigint not null default 0,
  tags               jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (merchant_id, email_normalized)
);

create index if not exists customers_merchant_idx on public.customers(merchant_id, last_order_at desc);

-- Denormalized buyer email on the order for querying/linking.
alter table public.orders add column if not exists customer_email text;

alter table public.customers enable row level security;

-- Deny-default: service-role writes; a merchant owner may READ their own customers.
drop policy if exists customers_owner_read on public.customers;
create policy customers_owner_read on public.customers
  for select using (
    exists (select 1 from public.merchants m where m.id = customers.merchant_id and m.owner_id = auth.uid())
  );

-- Atomic upsert from a paid order: create the customer or bump their order history.
create or replace function public.upsert_customer_from_order(
  p_merchant uuid, p_email text, p_name text, p_phone text, p_stripe text, p_total int, p_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_norm text;
  v_id uuid;
begin
  if p_email is null or btrim(p_email) = '' then return null; end if;
  v_norm := lower(btrim(p_email));

  insert into public.customers (
    merchant_id, email, email_normalized, name, phone, stripe_customer_id,
    first_order_at, last_order_at, orders_count, lifetime_cents
  ) values (
    p_merchant, btrim(p_email), v_norm,
    nullif(btrim(coalesce(p_name, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_stripe, '')), ''),
    p_at, p_at, 1, greatest(0, coalesce(p_total, 0))
  )
  on conflict (merchant_id, email_normalized) do update set
    orders_count       = public.customers.orders_count + 1,
    lifetime_cents     = public.customers.lifetime_cents + greatest(0, coalesce(p_total, 0)),
    last_order_at      = greatest(public.customers.last_order_at, excluded.last_order_at),
    name               = coalesce(public.customers.name, excluded.name),
    phone              = coalesce(public.customers.phone, excluded.phone),
    stripe_customer_id = coalesce(public.customers.stripe_customer_id, excluded.stripe_customer_id),
    updated_at         = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_customer_from_order(uuid, text, text, text, text, int, timestamptz) from public;
revoke all on function public.upsert_customer_from_order(uuid, text, text, text, text, int, timestamptz) from anon;
revoke all on function public.upsert_customer_from_order(uuid, text, text, text, text, int, timestamptz) from authenticated;
grant execute on function public.upsert_customer_from_order(uuid, text, text, text, text, int, timestamptz) to service_role;
