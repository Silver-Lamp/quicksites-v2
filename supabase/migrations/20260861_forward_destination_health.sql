-- 20260861_forward_destination_health.sql
--
-- A FORWARD-TO CAN GO DEAD, AND NOTHING COULD SEE IT OR CHANGE IT.
--
-- Found 2026-09-30: covingtontow.com took two real inbound calls at 07:33 and 07:34 Pacific and
-- both rang out at AL Ram Towing. The notice had been delivered two days earlier and no STOP had
-- come back — the business simply does not pick up. It was noticed only because the operator
-- happened to dial his own site and read the call log. Three things were missing:
--
-- 1. WHO WAS DIALLED IS NOT ON THE CALL ROW. `call_logs.to_number` is OUR tracking number; the
--    destination lives only on `geo_industry_campaigns.forward_to`, which is mutable. So an
--    answer rate could only be computed by joining to the CURRENT destination — and the moment a
--    campaign is re-pointed, every historical no-answer is silently re-attributed to the business
--    that just inherited the line. The first thing a new destination would "prove" is the failure
--    of the one before it. Hence `forwarded_to`, written at dial time.
--
-- 2. "NOTICED" WAS TRACKED PER CAMPAIGN, NOT PER DESTINATION. `forward_notice_sent_at` is a
--    timestamp with no subject, and `sendForwardNotice` returns `already_sent` whenever it is
--    non-null. Re-pointing a campaign therefore starts ringing a business that has been told
--    nothing, while the system records that the notice was handled. The notice is the consent
--    path (lib/ppl/forwardCandidates.ts header: part of the action, never a follow-up), and it
--    was one field away from being skipped exactly when it matters most. `forward_notice_sent_to`
--    makes the claim checkable: this NUMBER was told, not this campaign.
--
-- 3. "DOES NOT ANSWER" HAD NOWHERE TO GO, AND IS NOT THE SAME FACT AS "SAID STOP".
--    `forward_opt_outs` records the business's own decision. A business that never replies is
--    making no decision at all — we are the ones concluding something, on our evidence, and we
--    may be wrong (they may be screening an unknown number, which is OUR caller ID). Filing that
--    observation as an opt-out would put words in their mouth and, because `applyStop` clears the
--    forward everywhere and `applyStart` is the only undo, would be near-impossible to revisit
--    honestly. Same shape as 20260860's bad_address vs out_of_business: one is a fact about them,
--    the other a fact about us, and the remedies differ.

-- ── 1. Who was actually dialled ──────────────────────────────────────────────────────────────
-- ⚠️ DELIBERATELY NOT BACKFILLED. Every existing row could be filled from the campaign's current
-- `forward_to` and it would look complete, but it would be a guess about history presented as a
-- record of it — the one thing this column exists to prevent. NULL reads as "we did not record
-- it", which is true, and `forwardHealth` counts only rows that know their destination.
alter table public.call_logs
  add column if not exists forwarded_to text;

comment on column public.call_logs.forwarded_to is
  'E.164 number the bridge actually dialled, recorded at dial time. NULL on rows predating 20260861 — never inferred from the campaign, which is mutable.';

-- ── 2. The notice is about a destination ─────────────────────────────────────────────────────
alter table public.geo_industry_campaigns
  add column if not exists forward_notice_sent_to text;

comment on column public.geo_industry_campaigns.forward_notice_sent_to is
  'The number the one-time forwarding notice was sent to. sendForwardNotice compares it to forward_to, so re-pointing a campaign notifies the new business instead of reporting already_sent.';

-- Backfill is safe here, and for the opposite reason to `forwarded_to`: no campaign has ever been
-- re-pointed (there was no path to do it), so for every row with a notice timestamp the notice
-- demonstrably went to the destination still on the row. Verified 2026-09-30: all 12 notices were
-- sent within minutes of the forward being set.
update public.geo_industry_campaigns
   set forward_notice_sent_to = forward_to
 where forward_notice_sent_at is not null
   and forward_to is not null
   and forward_notice_sent_to is null;

-- ── 3. Our observation that a destination does not answer ────────────────────────────────────
create table if not exists public.forward_unresponsive (
  phone               text primary key,
  first_observed_at   timestamptz not null default now(),
  last_observed_at    timestamptz not null default now(),
  -- What the conclusion rests on, so a future reader can weigh it instead of trusting it.
  unanswered_calls    integer not null default 0,
  answered_calls      integer not null default 0,
  source              text not null default 'operator',
  note                text,
  -- Set when the destination is given another chance. The row is KEPT: that this number was once
  -- unresponsive is evidence, and deleting it would let the same business be re-recommended,
  -- fail, and be rediscovered from scratch every time.
  cleared_at          timestamptz,
  cleared_reason      text
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.forward_unresponsive'::regclass
      and conname = 'forward_unresponsive_source_check'
  ) then
    alter table public.forward_unresponsive
      add constraint forward_unresponsive_source_check
      check (source in ('operator', 'call_outcomes'));
  end if;
end $$;

create index if not exists forward_unresponsive_active_idx
  on public.forward_unresponsive (phone)
  where cleared_at is null;

comment on table public.forward_unresponsive is
  'Destinations we OBSERVED not answering forwarded calls. Distinct from forward_opt_outs, which is the business''s own STOP. An active row (cleared_at is null) disqualifies the phone in lib/ppl/forwardCandidates.ts.';

-- Deny-default: this names real businesses and records our judgement of them. RLS on with NO
-- policy means anon and authenticated get nothing; the service role bypasses RLS, which is how
-- every caller here reaches it.
alter table public.forward_unresponsive enable row level security;
