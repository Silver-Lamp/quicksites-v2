-- The next business in line is a tracked step, not a mention (owner, 2026-10-18: "add checking
-- out next business (Bradley's in this case) into the email statuses and reminders along the
-- path so that it's not forgotten"). Chosen and named when text 1 goes out; the follow-up that
-- would promise them the line is HELD until a person marks them vetted; "not suitable" moves
-- to the next candidate. Reminders dedupe by day.
alter table public.geo_industry_campaigns add column if not exists pitch_alternative_prospect_id uuid;
alter table public.geo_industry_campaigns add column if not exists pitch_alternative_vetted_at timestamptz;
alter table public.geo_industry_campaigns add column if not exists pitch_alternative_rejected uuid[] not null default '{}';
alter table public.geo_industry_campaigns add column if not exists pitch_vet_reminded_on date;
