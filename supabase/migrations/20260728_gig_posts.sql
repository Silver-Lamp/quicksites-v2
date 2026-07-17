-- Gig cross-post tracking — the record of WHERE a cataloging gig (catalog_gigs) has been
-- posted to recruit taskers (FB Page / Craigslist / our own gigs page / email / SMS), so the
-- operator sees which gigs are live on which channels and doesn't double-post. See
-- docs/AISLEASK_OPS_PLAN.md Feature B #4.
--
-- Honesty note baked into the model: a row here means the operator posted (or an owned-channel
-- automation posted) — NOT that we headless-bot-posted to Marketplace/Craigslist (neither has a
-- posting API and both forbid it). For assisted channels the row is created when the operator
-- confirms "I posted it"; for owned channels (FB Page via Graph API, email/SMS) it's the machine.
--
-- Deny-default RLS: service-role (admin server routes) only, matching catalog_gigs.
create table if not exists public.gig_posts (
  id          uuid primary key default gen_random_uuid(),
  gig_id      uuid not null references public.catalog_gigs(id) on delete cascade,
  channel     text not null,             -- 'craigslist' | 'facebook_marketplace' | 'facebook_page' | 'gigs_page' | 'email' | 'sms' | 'other'
  posted_at   timestamptz not null default now(),
  posted_by   uuid,                      -- operator user id (auth.users), null for automated owned-channel posts
  url         text,                      -- link to the live post, when the operator captures it
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists gig_posts_gig_idx on public.gig_posts (gig_id, posted_at desc);
create index if not exists gig_posts_channel_idx on public.gig_posts (channel, posted_at desc);

alter table public.gig_posts enable row level security;
-- Deny-default: no policies → only the service role (server) reads/writes.
revoke all on public.gig_posts from anon, authenticated;
