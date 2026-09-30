-- 20260864_cascade_attempts.sql
--
-- The call cascade's memory AND its measurement (docs/CALL_CASCADE_PLAN.md phase 1).
--
-- A cascade is a state machine spread across Twilio webhooks: each leg is a separate HTTP
-- request with no shared memory, so "who have we already rung on this call" has to live
-- somewhere. This table is that somewhere.
--
-- ⚠️ IT IS ALSO THE ONLY PLACE THE TWO DECIDING NUMBERS WILL EVER EXIST, and that is the more
-- important half. The plan says the idea lives or dies on (1) do callers hold through a cascade
-- and (2) does any business press 1 — neither of which can be estimated from the two genuine
-- inbound calls in the product's history. Both fall out of these rows by construction:
-- attempts-per-call answers the first, `accepted` answers the second. A schema that recorded
-- only the winner would answer neither.
--
-- ⚠️ `accepted` IS RECORDED, NEVER INFERRED. A rejected whisper and a short real conversation
-- both surface from Twilio as `completed` with a small duration — reading `completed` as "a
-- person took this call" is the mistake that produced this entire line of work (a 3-second
-- `dial-completed` to Prime Towing that was three SIT beeps and a disconnect). Only the accept
-- webhook, fired by an actual keypress, sets this true.

create table if not exists public.cascade_attempts (
  id                uuid primary key default gen_random_uuid(),
  -- The inbound call being served. Not a FK: call_logs is keyed by its own id and rows can
  -- arrive out of order from Twilio, so a constraint here would drop attempts rather than
  -- record them.
  call_sid          text not null,
  campaign_id       uuid references public.geo_industry_campaigns (id) on delete set null,
  -- 1-based position in the cascade. Attempts-per-call is the hold-tolerance measurement.
  attempt           integer not null,
  phone             text not null,
  prospect_id       uuid,
  business_name     text,
  -- NULL until the leg finishes. Twilio's DialCallStatus verbatim, prefixed like call_logs.
  dial_status       text,
  dial_duration_sec integer,
  -- ⚠️ The one fact a voicemail cannot fake. Set only by the accept webhook.
  accepted          boolean not null default false,
  accepted_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- One row per (call, attempt): the cascade advances by inserting the next attempt, and a Twilio
-- webhook retry must not insert a duplicate that makes the caller skip a business.
create unique index if not exists cascade_attempts_call_attempt_uniq
  on public.cascade_attempts (call_sid, attempt);

create index if not exists cascade_attempts_call_idx
  on public.cascade_attempts (call_sid, attempt);

create index if not exists cascade_attempts_phone_idx
  on public.cascade_attempts (phone);

comment on table public.cascade_attempts is
  'One row per business rung on one inbound call. State machine memory for the cascade, and the source of the two numbers that decide whether it works: attempts-per-call (do callers hold) and accepted (does anyone press 1). See docs/CALL_CASCADE_PLAN.md §8.';
comment on column public.cascade_attempts.accepted is
  'True only when the business pressed 1. NEVER derived from DialCallStatus — voicemail answers, and Twilio calls that completed.';

-- Deny-default: these rows name real businesses and record members of the public calling them.
-- RLS on with no policy = nothing for anon or authenticated; the service role bypasses it.
alter table public.cascade_attempts enable row level security;
