-- The text-first pitch funnel, per campaign (owner, 2026-10-18): text the business the call
-- they got + the deal + a deposit link + the terms; follow up in a few days with an honest nudge
-- (a real re-point date where another shop exists, else "that was the last free one"); call
-- referencing the text; record what happened. Paying the link is the yes — there is no reply step.
alter table public.geo_industry_campaigns add column if not exists pitch_deal text
  check (pitch_deal in ('next', 'package'));
alter table public.geo_industry_campaigns add column if not exists pitch_texted_at timestamptz;
alter table public.geo_industry_campaigns add column if not exists pitch_followup_at timestamptz;
alter table public.geo_industry_campaigns add column if not exists pitch_followup_kind text
  check (pitch_followup_kind in ('repoint', 'last_free'));
alter table public.geo_industry_campaigns add column if not exists pitch_repoint_prospect_id uuid;
alter table public.geo_industry_campaigns add column if not exists pitch_repoint_by date;
alter table public.geo_industry_campaigns add column if not exists pitch_called_at timestamptz;
alter table public.geo_industry_campaigns add column if not exists pitch_result text
  check (pitch_result in ('paid', 'no', 'later', 'no_reply', 'repointed'));
alter table public.geo_industry_campaigns add column if not exists pitch_notes text;
