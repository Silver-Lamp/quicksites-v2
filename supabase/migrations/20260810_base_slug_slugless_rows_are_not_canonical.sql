-- 20260810_base_slug_slugless_rows_are_not_canonical.sql
--
-- Follow-up to 20260809. That migration replaced the generated is_version expression
--
--     is_version = (slug ~ '(-[A-Za-z0-9]{2,12})+$')
--
-- with a trigger computing
--
--     is_version = (coalesce(slug,'') <> '' and slug <> base_slug)
--
-- and in doing so quietly changed the answer for rows with NO SLUG.
--
-- The old expression returned NULL for a null slug (regex on NULL is NULL), so a slug-less row
-- matched neither `is_version = true` nor `is_version = false`, and never competed to be its
-- family's canonical. The new expression returned FALSE, which reads as "this is a canonical".
--
-- The fleet has slug-less rows whose base_slug still derives from template_name, so families
-- suddenly had several canonicals each: pnw-prestige-exterior-cleaning 10, auburnroofcleaning
-- 9, graftontowing 7, renton-restaurant 3. Anything resolving a canonical with `.maybeSingle()`
-- — app/api/templates/[id]/publish does exactly that — would have started erroring on
-- "multiple rows returned" instead of finding one.
--
-- A row with no slug cannot be the canonical of anything: there is no URL to be canonical AT.
-- Restore NULL for that case, preserving the original three-state semantics.

create or replace function public.tr_templates_set_base_slug()
returns trigger
language plpgsql
as $$
declare
  src text := coalesce(new.slug, new.template_name, '');
begin
  if new.base_slug is null or new.base_slug = '' or tg_op = 'INSERT' then
    new.base_slug := public.base_slug_of(src);
  end if;
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    new.base_slug := public.base_slug_of(src);
  end if;

  -- Three states, deliberately:
  --   NULL  — no slug, so the question doesn't apply and this row never counts as a canonical
  --   true  — slug carries a suffix its base does not: a version
  --   false — slug IS the base: the canonical
  if coalesce(new.slug, '') = '' then
    new.is_version := null;
  else
    new.is_version := (new.slug <> new.base_slug);
  end if;

  return new;
end;
$$;

-- Re-run over the rows the previous migration mislabelled.
select set_config('app.bypass_template_guard', 'on', true);

update public.templates
   set is_version = null
 where coalesce(slug, '') = ''
   and is_version is not null;
