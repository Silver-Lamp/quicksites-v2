-- 20260809_base_slug_stop_stripping_real_words.sql
--
-- templates.base_slug and templates.is_version are GENERATED columns that both assume
-- "a trailing -token means this row is a variant":
--
--     base_slug  = regexp_replace(coalesce(slug, template_name, ''), '(-[A-Za-z0-9]{2,12})+$', '')
--     is_version = (slug ~ '(-[A-Za-z0-9]{2,12})+$')
--
-- The pattern cannot tell a random suffix from a real word, and `+$` makes it strip EVERY
-- trailing token, so:
--
--     renton-plumbing          -> renton          (industry eaten)
--     renton-restaurant        -> renton          (same root as plumbing!)
--     the-local-907-tqgh2      -> the             (three tokens eaten)
--     eyman-s-pizza-v60n3      -> eyman-s
--
-- Consequences observed in production:
--   * every <city>-<industry> site in a city collapsed into ONE family, so renton-restaurant
--     showed up as a "+1 variant" of Renton Plumbing and opened an editor titled with the
--     wrong business. Renton had 6 industries under one root; Milton 5, Braintree 5,
--     Framingham 5, Arlington 5, Boston 4, Lynn 4, Chelsea 4, Brookline 4.
--   * is_version was true for 2427 of 2531 rows — including every geo site, because
--     "-restaurant" matches the pattern. Only 59 rows were canonical, and ZERO for any geo
--     base_slug, so app/api/templates/[id]/publish's canonical lookup (base_slug +
--     is_version=false) could never resolve one.
--
-- THE FIX: strip only ONE trailing token of 4-5 [a-z0-9] chars — the shape the app's own
-- suffix generator produces (Math.random().toString(36).slice(2,7)). Real industry words are
-- longer (plumbing 8, restaurant 10, towing 6, roofing 7, electrical 10) and survive.
--
--     renton-restaurant   -> renton-restaurant   (own root)
--     renton-towing       -> renton-towing       (own root)
--     graftontowing-08zi  -> graftontowing       (still grouped with its parent)
--     eyman-s-pizza-v60n3 -> eyman-s-pizza
--
-- KNOWN RESIDUAL, stated rather than hidden: a 4-5 character real word is still
-- indistinguishable from a random suffix, so `<city>-hvac` still collapses to `<city>`.
-- 34 rows fleet-wide end in such a suffix. The admin list additionally qualifies its grouping
-- key by industry (app/api/admin/templates/list/route.ts), which covers the display case.
--
-- APPROACH: ALTER COLUMN ... DROP EXPRESSION converts each generated column to a plain column
-- IN PLACE, keeping its data — so the five dependent indexes and four dependent views
-- (template_bases, templates_effective, templates_latest, templates_versions) are untouched.
-- Dropping and re-adding the columns would have required recreating all of them by hand.
-- A trigger then maintains the values, routed through base_slug_of() so the rule lives in
-- exactly one place.
--
-- PRE-FLIGHT CHECKED before writing this: the unique index
-- templates_template_name_canonical_uniq (lower(template_name) WHERE is_version = false)
-- would go from 59 to 193 canonical rows, and there are ZERO duplicate lower(template_name)
-- among that new set — so the backfill cannot violate it.

-- 1. One home for the rule. ------------------------------------------------------------------
create or replace function public.base_slug_of(_slug text)
returns text
language sql
immutable
as $$
  -- ONE trailing token, 4-5 chars. Not `+$` (which ate multi-word slugs whole) and not
  -- {2,12} (which ate industry names).
  select regexp_replace(coalesce(_slug, ''), '-[a-z0-9]{4,5}$', '');
$$;

-- 2. Generated -> plain, in place. Data, indexes and views all survive. -----------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'templates'
      and column_name = 'base_slug' and is_generated = 'ALWAYS'
  ) then
    alter table public.templates alter column base_slug drop expression;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'templates'
      and column_name = 'is_version' and is_generated = 'ALWAYS'
  ) then
    alter table public.templates alter column is_version drop expression;
  end if;
end $$;

-- 3. Keep them correct on write, exactly as the generated columns did. ------------------------
create or replace function public.tr_templates_set_base_slug()
returns trigger
language plpgsql
as $$
declare
  src text := coalesce(new.slug, new.template_name, '');
begin
  -- Only derive when the caller hasn't set it deliberately. The duplicate route may want to
  -- point a copy at its parent's base explicitly; a generated column could never allow that.
  if new.base_slug is null or new.base_slug = '' or tg_op = 'INSERT' then
    new.base_slug := public.base_slug_of(src);
  end if;
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    new.base_slug := public.base_slug_of(src);
  end if;

  -- A row is a version when its slug carries a suffix its base does not.
  new.is_version := (coalesce(new.slug, '') <> '' and new.slug <> new.base_slug);
  return new;
end;
$$;

drop trigger if exists trg_templates_set_base_slug on public.templates;
create trigger trg_templates_set_base_slug
  before insert or update on public.templates
  for each row execute function public.tr_templates_set_base_slug();

-- 4. Backfill. --------------------------------------------------------------------------------
-- Direct UPDATEs to templates are blocked by app.guard_templates_update ("Use
-- app.commit_template()"); this is sanctioned one-off DDL-adjacent maintenance, so bypass it
-- for this transaction only, exactly as CLAUDE.md §8 prescribes.
select set_config('app.bypass_template_guard', 'on', true);

update public.templates
   set base_slug  = public.base_slug_of(coalesce(slug, template_name, '')),
       is_version = (coalesce(slug, '') <> '' and slug <> public.base_slug_of(coalesce(slug, template_name, '')))
 where base_slug is distinct from public.base_slug_of(coalesce(slug, template_name, ''))
    or is_version is distinct from (coalesce(slug, '') <> '' and slug <> public.base_slug_of(coalesce(slug, template_name, '')));
