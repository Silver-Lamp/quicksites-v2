-- 20260856_one_tracking_number_per_campaign.sql
--
-- ONE TRACKING NUMBER BELONGS TO EXACTLY ONE CAMPAIGN.
--
-- The attach route already refused to give one campaign a second number, but nothing stopped the
-- same number being attached to several campaigns — the direction that actually destroys the
-- measurement. A shared number means a call arrives with no way to say which site earned it, and
-- the whole rank-and-rent argument is "this domain produced these calls".
--
-- Found live: +1 425 270 2226 renders on BOTH maplevalley-towing.com and millcreektowing.com,
-- with 13 calls logged against it and `geo_campaign_id`, `template_slug` and `custom_domain` all
-- NULL on every one of them. Not one of those calls can be credited to a site.
--
-- ⚠️ Enforced as an INDEX rather than in the route because route checks are advisory: the bulk
-- automation path, a script and a hand-written psql update all write this column too, and each
-- would need to remember. A unique index cannot be forgotten.
--
-- Partial (`where tracking_number is not null`) because most campaigns have no number and NULLs
-- must not collide. Postgres would allow repeated NULLs in a plain unique index anyway, but
-- stating it keeps the intent legible and the index small.

create unique index if not exists geo_campaigns_tracking_number_uniq
  on public.geo_industry_campaigns (tracking_number)
  where tracking_number is not null;

comment on index public.geo_campaigns_tracking_number_uniq is
  'One Twilio tracking number may back at most one campaign — a shared number makes a call unattributable to the site that earned it.';
