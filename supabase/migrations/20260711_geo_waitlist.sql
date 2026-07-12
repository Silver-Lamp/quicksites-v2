-- Competition waitlist: the businesses linked to a geo-campaign (geo_campaign_id) are
-- the contest pool. The winner is geo_industry_campaigns.claimed_by_prospect_id; the
-- rest are runner-ups (the churn backfill). waitlist_status lets the operator mark a
-- business 'passed' (out of the running). See docs/GEO_DOMAIN_MONETIZATION.md §5.

alter table public.outreach_prospects
  add column if not exists waitlist_status text;  -- null = competing, 'passed' = out
