-- Pricing + rank + Stripe rental fields for geo-domain campaigns.
-- Turns the two proof engines (GSC rank, call tracking) into MRR: rent the ranked
-- domain on a flat monthly plan, with a pre-rank "founder rate" that auto-steps to the
-- full rate once the domain hits page 1 (rank_status='page1'). See docs/GEO_DOMAIN_MONETIZATION.md.

alter table public.geo_industry_campaigns
  add column if not exists pricing_model         text default 'none',   -- 'none' | 'flat' | 'ppl'
  add column if not exists price_cents           int,                    -- full monthly rate
  add column if not exists locked_rate_cents     int,                    -- pre-rank founder rate
  add column if not exists billing_interval      text default 'month',
  add column if not exists rank_status           text default 'unranked',-- 'unranked'|'ranking'|'page1'
  add column if not exists rank_position         numeric,                -- last-synced GSC avg position
  add column if not exists rank_synced_at        timestamptz,
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status    text,                  -- 'checkout_created'|'active'|'canceled'|…
  add column if not exists renter_email           text;
