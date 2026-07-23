-- Seed three shipped/upcoming capabilities into the public /features gallery
-- (public.features): the two LIVE owner-voice audio surfaces + the SecondSet
-- transparency pilot. Idempotent — fixed UUIDs + on-conflict upsert, so re-running
-- refreshes copy without duplicating. Categories are all within the existing
-- features_category_check set (Brand/AI/Leads). org_id left null (platform feature).

insert into public.features (id, title, blurb, category, doc_href, badge, featured)
values
  (
    'f1a2b3c4-0001-4d5e-8f01-000000000001',
    'In Your Voice',
    'Let visitors press play and hear the page in a real, warm voice — the owner''s own once cloned. A narrated ''About This'' player you can drop on any site, live on the QuickSites homepage today.',
    'Brand',
    '/',
    'Live',
    true
  ),
  (
    'f1a2b3c4-0002-4d5e-8f01-000000000002',
    'Hear this page',
    'A one-tap listen button on public pages that reads a short, plain-language summary aloud — accessible, hands-free, and configurable per surface by admins.',
    'AI',
    '/',
    'Live',
    false
  ),
  (
    'f1a2b3c4-0003-4d5e-8f01-000000000003',
    'SecondSet — show the work',
    'A transparency pilot for auto shops: the tech captures a photo of the real problem and a voice note, the customer sees it in their own portal, hears the summary, and approves the repair before it happens.',
    'Leads',
    '/secondset',
    'Pilot',
    false
  )
on conflict (id) do update set
  title    = excluded.title,
  blurb    = excluded.blurb,
  category = excluded.category,
  doc_href = excluded.doc_href,
  badge    = excluded.badge,
  featured = excluded.featured;
