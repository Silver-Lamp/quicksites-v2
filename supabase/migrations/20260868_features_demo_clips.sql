-- 20260868_features_demo_clips.sql
--
-- Several recorded walkthroughs per feature, each one dated.
--
-- ⚠️ NOT reusing `features.gallery`, which already means something else: it is the PORTFOLIO
-- IMAGE gallery, gated behind `portfolioMode` + `media_type='gallery'`, uploaded to
-- `portfolio/<slug>/` and described to the operator as "N images". Putting videos in it would
-- make that count a lie and make the admin card offer image controls for a clip. A column whose
-- meaning depends on which feature wrote it is the kind of thing nothing can check later.
--
-- Shape: [{ "src": "<public url>", "label": "Guest build", "recorded_on": "2026-10-01" }]
-- `recorded_on` is carried per clip rather than inferred from the URL: the storage path happens
-- to be dated today, and a reader deriving a date from a path would silently invent one the day
-- someone uploads to a path that is not.

alter table public.features
  add column if not exists demo_clips jsonb not null default '[]'::jsonb;

comment on column public.features.demo_clips is
  'Recorded walkthroughs for this feature, newest first: [{src,label,recorded_on}]. Distinct from `gallery`, which is the portfolio IMAGE gallery.';
