-- Homepage A/B test events (owner, 2026-10-16: "want to use A/B testing on the homepage").
-- One row per exposure or conversion, keyed by experiment + variant + an anonymous visitor id
-- (the sticky assignment cookie). No IP, no UA stored — the synthetic-visitor filter runs
-- before the insert. Service role only; the public route writes through it.
create table if not exists public.ab_events (
  id uuid primary key default gen_random_uuid(),
  experiment text not null,
  variant text not null check (variant in ('A', 'B')),
  visitor text not null,
  event text not null,
  path text,
  created_at timestamptz not null default now()
);
create index if not exists ab_events_exp_variant_event_idx on public.ab_events (experiment, variant, event, created_at desc);
create index if not exists ab_events_visitor_idx on public.ab_events (experiment, visitor);

alter table public.ab_events enable row level security;
-- deny-default: no policies for anon/authenticated; the service role bypasses RLS.
