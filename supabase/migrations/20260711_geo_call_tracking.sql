-- Call tracking for geo-domain campaigns: a Twilio number per geo-site that forwards
-- to the business and logs every call, so we can PROVE lead volume (the sales/retention
-- engine behind the rental model — see docs/GEO_DOMAIN_MONETIZATION.md).

alter table public.geo_industry_campaigns
  add column if not exists tracking_number      text,   -- provisioned Twilio number (E.164)
  add column if not exists tracking_number_sid  text,   -- Twilio SID (for release)
  add column if not exists forward_to           text;   -- where calls forward (business/fallback)

-- Tag inbound calls with their campaign so counts are robust even after the
-- twilio-callback status update rewrites custom_domain. (call_logs isn't in the
-- migration history — it's a pre-existing live table — so guard with if not exists.)
alter table public.call_logs
  add column if not exists geo_campaign_id uuid;

create index if not exists call_logs_geo_campaign_idx on public.call_logs (geo_campaign_id);
