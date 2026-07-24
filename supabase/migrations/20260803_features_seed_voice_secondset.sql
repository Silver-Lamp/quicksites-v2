-- Seed three shipped/upcoming capabilities into the public /features gallery
-- (public.features): the two LIVE owner-voice audio surfaces + the SecondSet
-- transparency pilot. Idempotent — fixed UUIDs + on-conflict upsert, so re-running
-- refreshes copy without duplicating. Categories are all within the existing
-- features_category_check set (Brand/AI/Leads).
--
-- features.org_id is NOT NULL (FK -> organizations). Platform features all live under a
-- single org, so we resolve it as the org that owns the most existing features rather than
-- hardcoding a UUID. The `where exists` guard makes this a no-op on an empty table (a fresh
-- env with no platform org to attach to) instead of a null-org_id failure.

insert into public.features (id, org_id, slug, title, blurb, category, doc_href, badge, featured)
select
  v.id,
  (select org_id from public.features group by org_id order by count(*) desc, org_id limit 1),
  v.slug, v.title, v.blurb, v.category, v.doc_href, v.badge, v.featured
from (
  values
    (
      'f1a2b3c4-0001-4d5e-8f01-000000000001'::uuid,
      'in-your-voice',
      'In Your Voice',
      'Let visitors press play and hear the page in a real, warm voice — the owner''s own once cloned. A narrated ''About This'' player you can drop on any site, live on the QuickSites homepage today.',
      'Brand',
      '/',
      'Live',
      true
    ),
    (
      'f1a2b3c4-0002-4d5e-8f01-000000000002'::uuid,
      'hear-this-page',
      'Hear this page',
      'A one-tap listen button on public pages that reads a short, plain-language summary aloud — accessible, hands-free, and configurable per surface by admins.',
      'AI',
      '/',
      'Live',
      false
    ),
    (
      'f1a2b3c4-0003-4d5e-8f01-000000000003'::uuid,
      'secondset-show-the-work',
      'SecondSet — show the work',
      'A transparency pilot for auto shops: the tech captures a photo of the real problem and a voice note, the customer sees it in their own portal, hears the summary, and approves the repair before it happens.',
      'Leads',
      '/secondset',
      'Pilot',
      false
    )
) as v(id, slug, title, blurb, category, doc_href, badge, featured)
where exists (select 1 from public.features)
on conflict (id) do update set
  title    = excluded.title,
  blurb    = excluded.blurb,
  category = excluded.category,
  doc_href = excluded.doc_href,
  badge    = excluded.badge,
  featured = excluded.featured;
