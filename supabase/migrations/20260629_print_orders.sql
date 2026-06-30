-- Print-on-demand fulfillment records (Lulu books / Gelato posters+apparel).
-- Links a QuickSites order to a provider print job + status. Server/service-role
-- only (RLS on, no policies) — mirrors the commerce tables.
create table if not exists public.print_orders (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid references public.orders(id) on delete set null,
  merchant_id     uuid,
  provider        text not null check (provider in ('lulu','gelato')),
  provider_job_id text,
  status          text not null default 'pending',
  shipping_address jsonb,
  cost_cents      int,
  raw             jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.print_orders enable row level security;

create index if not exists print_orders_order_id_idx on public.print_orders(order_id);
create index if not exists print_orders_status_idx   on public.print_orders(status);
create index if not exists print_orders_provider_idx on public.print_orders(provider, provider_job_id);

comment on table public.print_orders is
  'POD fulfillment records (Lulu/Gelato). Service-role only; RLS denies anon/auth.';
