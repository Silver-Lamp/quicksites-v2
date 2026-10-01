-- 20260867_geo_campaign_forward_to_name.sql
--
-- The name of the business a geo campaign forwards to, so the CALLER can be told who is about
-- to answer before we bridge them (see lib/ppl/forwardAnnounce.ts for why: a real caller hung
-- up on 2026-10-01 when the business answered under a name the site had never mentioned).
--
-- ⚠️ This column is only safe if it is written in the SAME statement as `forward_to`, and set
-- to NULL whenever the name cannot be resolved. A name left behind from a previous destination
-- would make us announce one business and dial another — strictly worse than announcing none.
-- `setCampaignForwardTo()` is the single writer and does both. Same reasoning as
-- `call_logs.forwarded_to` (20260861): a field that can disagree with the number we dial is a
-- record of something that never happened.

alter table public.geo_industry_campaigns
  add column if not exists forward_to_name text;

comment on column public.geo_industry_campaigns.forward_to_name is
  'Registered name of the business forward_to dials, for the caller-facing announcement. Written together with forward_to and NULL when unresolved — never carried over from a previous destination.';
