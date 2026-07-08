-- Allow CRM + Marketing categories on the public /features gallery (features table),
-- so the shipped customer CRM + email campaigns can be listed there. Preserves the
-- full existing allowed set; only adds the two new values.

alter table public.features drop constraint if exists features_category_check;
alter table public.features add constraint features_category_check
  check (category = any (array[
    'Editor','SEO','Hosting','AI','Admin','Leads','Web','Brand','E-Commerce',
    'Apps','Integrations','Video','Image','Link','Other',
    'CRM','Marketing'
  ]::text[]));
