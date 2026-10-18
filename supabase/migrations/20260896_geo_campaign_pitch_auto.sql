-- The pitch cron (owner, 2026-10-18: automate the texting in the business's own hours, email every
-- step). Who sent each text, and one-shot dedupe for the two emails that ask the owner to act.
alter table public.geo_industry_campaigns add column if not exists pitch_sent_by text
  check (pitch_sent_by in ('operator', 'cron'));
alter table public.geo_industry_campaigns add column if not exists pitch_intervene_emailed_at timestamptz;
alter table public.geo_industry_campaigns add column if not exists pitch_paid_emailed_at timestamptz;
