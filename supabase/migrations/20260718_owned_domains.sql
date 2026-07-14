-- Owned-domain inventory + recurring-cost tracking.
--
-- It's easy to buy a lot of geo-domains at once; this table is the ledger of what we
-- own and what it costs to keep. Rows come from three sources (see lib/domains/
-- ownedInventory.ts): registered geo-campaign domains, the Vercel account domain list
-- (auto-synced, renewal price fetched live), and manual entries for domains registered
-- OUTSIDE Vercel (Namecheap, etc.) whose cost we can't read from an API — the operator
-- fills those in. `renewal_cents` is the YEARLY renewal cost (null = unknown → surfaced
-- as a "needs cost" follow-up). Everything else about a domain (rank, rent, campaign
-- link) is joined at read time, not stored here.
--
-- Service-role only: no RLS policies → deny-default (all client access blocked). The
-- admin API reads/writes with the service-role key. Idempotent. Pending — run
-- `npm run db:migrate:up`.

create table if not exists public.owned_domains (
  domain         text primary key,                 -- normalized apex (no scheme/www)
  source         text not null default 'manual',   -- 'vercel' | 'campaign' | 'external' | 'manual'
  registrar      text,                              -- 'vercel' | 'namecheap' | ... (display only)
  renewal_cents  integer,                           -- YEARLY renewal cost in cents (null = unknown)
  expires_at     timestamptz,
  auto_renew     boolean,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.owned_domains enable row level security;

create index if not exists owned_domains_source_idx on public.owned_domains (source);
create index if not exists owned_domains_expires_at_idx on public.owned_domains (expires_at);
