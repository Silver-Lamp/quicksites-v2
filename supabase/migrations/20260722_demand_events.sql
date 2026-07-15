-- Demand capture on unclaimed delivered.menu drafts (CedarSites outreach).
-- When a visitor tries to order from an auto-built restaurant draft we haven't yet
-- convinced the owner to claim, we log the *intent* here — a tap-to-call or an
-- "order ahead" lead. We never take money and never hold funds pre-claim (that would
-- be the DoorDash phantom-order problem); this is a demand signal only. The count
-- drives the claim pitch ("N people tried to order here — claim to start collecting").
-- See docs/RESTAURANT_VERTICAL.md. Deny-default RLS — service-role (server) only;
-- the public capture route validates + inserts with the admin client.
create table if not exists public.demand_events (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.templates(id) on delete cascade,
  kind          text not null default 'call',   -- 'call' | 'order_ahead'
  contact_name  text,                            -- order_ahead: who to call back
  contact_phone text,                            -- order_ahead: the customer's number (a lead, not a charge)
  items         jsonb,                           -- order_ahead: free-text of what they wanted
  notified_at   timestamptz,                     -- Phase 2: when we SMS'd the restaurant (null until then)
  created_ip    text,
  created_at    timestamptz not null default now()
);

create index if not exists demand_events_template_idx
  on public.demand_events (template_id, created_at desc);

alter table public.demand_events enable row level security;
-- Deny-default: no policies → only the service role (server routes) can read/write.
revoke all on public.demand_events from anon, authenticated;
