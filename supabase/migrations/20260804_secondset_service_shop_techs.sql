-- SecondSet v1 tech roster (crosstalk/contracts/glasses-capture.md, HJ lazy-discovery #1508).
-- A shop's techs are discovered passively: when a glasses capture arrives for one of the
-- shop's jobs, QS asks HJ's partner-authed GET /api/glasses/binding?job_id who was wearing
-- the glasses. HJ returns `tech_ref` = the wearer's HJ user_id = the SAME target_user_id we
-- already pass to POST /voice-notes — so no new id space. We remember (owner, tech_ref) here
-- to turn the "say something to the tech" input into a real picker + direct addressing.
-- Deny-default RLS; the discovery/list runs service-role. Inert until SECONDSET_ENABLED +
-- PARTNER_QUICKSITES_SECRET. Pending apply.

create table if not exists public.service_shop_techs (
  owner_id       uuid not null,                    -- the shop's QS account
  tech_ref       text not null,                    -- HJ user_id of the wearer (== voice-note target_user_id)
  label          text,                             -- optional display name the shop assigns
  first_bound_at timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  primary key (owner_id, tech_ref)
);
alter table public.service_shop_techs enable row level security;
-- deny-default: no policies for anon/authenticated; the discovery + list routes use the service role.
