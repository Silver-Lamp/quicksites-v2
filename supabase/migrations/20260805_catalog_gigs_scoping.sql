-- Store-walk gig scoping — the honesty guardrail for the AisleAsk→gig seam
-- (crosstalk/contracts + ideas.md §10/§19). A gig created from a NON-consenting store
-- (a self-dogfood) must never enter the public open pool or recruit strangers. Adds:
--   • visibility 'public'|'private' — private gigs are excluded from listOpenGigs (the pool).
--   • assigned_to — optional single tasker a private gig is locked to (only they can claim).
-- AisleAsk-sourced gigs default to PRIVATE at create time (see lib/walker/gigs.ts toRow), so
-- a store that hasn't opted in can't leak into the pool by omission. A store that consents is
-- posted explicitly public. Deny-default RLS unchanged (service-role only).

alter table public.catalog_gigs
  add column if not exists visibility text not null default 'public',
  add column if not exists assigned_to uuid;

alter table public.catalog_gigs drop constraint if exists catalog_gigs_visibility_check;
alter table public.catalog_gigs
  add constraint catalog_gigs_visibility_check check (visibility in ('public', 'private'));

-- The pool query filters on (status, visibility); the assigned queue on (assigned_to, status).
create index if not exists catalog_gigs_pool_idx on public.catalog_gigs (visibility, status, created_at desc);
create index if not exists catalog_gigs_assigned_idx on public.catalog_gigs (assigned_to, status);
