-- 20260858_geo_campaign_centres.sql
--
-- GIVE EVERY CAMPAIGN A CENTRE, FROM THE PROSPECTS WE ALREADY HOLD.
--
-- ⚠️ `center_lat` / `center_lon` existed on `geo_industry_campaigns` from the start and were
-- NULL on all 129 rows — the columns were declared and nothing ever wrote them. A session
-- (this one) read the schema, saw the columns, and stated that campaigns "carry" their
-- coordinates. They carry the columns. That is not the same claim.
--
-- Without a centre the forward-to matcher falls back to `prospects.city` equality, which asks
-- "did we happen to first discover you under this label" rather than "do you serve this town".
-- Maple Valley had 13 tow companies within 8 km and qualified ONE; the other twelve were parked
-- under Renton or Covington by earlier sweeps.
--
-- ⚠️ Seeded from the MEDIAN prospect position in the campaign's own city, not from a geocoder:
-- the coordinates are already in `outreach_prospects.address_lat/lon` (497 of 498 rows have
-- them), so this costs nothing and cannot fail on a rate limit or a network hiccup mid-migration.
-- Median rather than mean because one business filed against the wrong city drags a mean across
-- the county, and a wrong centre silently redefines the market.
--
-- Campaigns whose city has no located prospects stay NULL, and the matcher keeps its old
-- city-name behaviour for them. Degrading to the previous rule is the right failure; inventing
-- a centre is not.

with centres as (
  select
    c.id,
    percentile_cont(0.5) within group (order by p.address_lat) as lat,
    percentile_cont(0.5) within group (order by p.address_lon) as lon,
    count(*) as n
  from public.geo_industry_campaigns c
  join public.outreach_prospects p
    on lower(btrim(p.city)) = lower(btrim(c.city))
   and (c.region is null or p.region is null
        or lower(btrim(p.region)) = lower(btrim(c.region)))
  where p.address_lat is not null
    and p.address_lon is not null
    and c.center_lat is null
  group by c.id
)
update public.geo_industry_campaigns c
   set center_lat = centres.lat,
       center_lon = centres.lon
  from centres
 where c.id = centres.id
   -- One located business is not a town centre; it is that business's address.
   and centres.n >= 3;

comment on column public.geo_industry_campaigns.center_lat is
  'Market centre for distance matching. Seeded 20260858 from the median prospect position in the campaign city; NULL means the forward-to matcher falls back to city-name equality.';
