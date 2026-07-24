-- SecondSet capture pull (crosstalk/contracts/glasses-capture.md, HJ v2 partner-grant read).
-- Per-shop grant token (the owner grants QS read of their secondset_field captures on HJ's
-- side and hands us the token) + a rail_capture_id de-dupe on captures (belt-and-suspenders
-- so a re-pull before ack can't duplicate). Deny-default RLS; the pull runs service-role.
-- Inert until SECONDSET_ENABLED + PARTNER_QUICKSITES_SECRET. Pending apply.

create table if not exists public.secondset_capture_grants (
  owner_id     uuid primary key,           -- the shop's QS account
  grant_token  text not null,              -- HJ grant token (scoped to partner+owner+purpose)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.secondset_capture_grants enable row level security;
-- deny-default: no policies for anon/authenticated; the sync/grant routes use the service role.

-- De-dupe pulled captures by the rail's capture id (idempotent re-pulls).
alter table public.service_job_captures add column if not exists rail_capture_id text;
create unique index if not exists service_job_captures_rail_id_uidx
  on public.service_job_captures (rail_capture_id)
  where rail_capture_id is not null;
