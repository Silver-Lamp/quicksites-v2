-- Stop base_slug_of() eating real words that happen to be 4-5 characters long.
--
-- The suffix this function exists to strip is produced by Math.random().toString(36).slice(2,7)
-- — 4-5 chars of [a-z0-9]. The regex cannot tell that from a word, so `<city>-hvac` based to
-- `<city>`, and because the trigger sets is_version := (slug <> base_slug), every such row was
-- filed as a VERSION of a family whose canonical does not exist.
--
-- The cost was not cosmetic: the publish canonical lookup is (base_slug, is_version = false),
-- which resolved ZERO rows for these — so 19 of 95 geo campaign sites could not be published
-- through the UI at all, failing with "Canonical not found" rather than anything that points at
-- the cause. Found 2026-08-28 when malden-hvac could not be located in the templates list.
--
-- ⚠️ The allowlist is DERIVED, not guessed, and one candidate was REJECTED by the data. Fleet-wide
-- four real words appear in the trailing position: demo (17), hvac (15), glass (5), goods (2).
-- `demo` is deliberately NOT allowlisted: every `<name>-demo` row shares its template_name with an
-- existing canonical, so it genuinely IS a variant of that template and stripping it is correct.
-- A first pass included it and the database refused — templates_template_name_canonical_uniq
-- (unique on lower(template_name) where is_version = false) rejected the backfill. Three kinds of
-- trailing token look identical to a regex and are not: a random suffix, a real industry word, and
-- a deliberate variant marker. Only the middle one is a bug.
-- The rest of the list is the remaining 4-5 character tail segments that
-- lib/outreach/geoDomain.ts#INDUSTRY_DOMAIN_WORD can emit, added so this cannot recur the first
-- time somebody launches a fencing or epoxy campaign.
--
-- Adding an industry whose domain word ends in a 4-5 character segment? Add it here too.

create or replace function public.base_slug_of(_slug text)
  returns text
  language sql
  immutable
as $function$
  -- ONE trailing token, 4-5 chars. Not `+$` (which ate multi-word slugs whole) and not
  -- {2,12} (which ate industry names). Real words in that position are never stripped.
  select case
    when substring(coalesce(_slug, '') from '-([a-z0-9]{4,5})$') = any (array[
      -- real words observed in the fleet's trailing position
      'hvac', 'glass', 'goods',
      -- remaining 4-5 char tails INDUSTRY_DOMAIN_WORD can emit
      'decks', 'epoxy', 'fence', 'salon', 'turf', 'walls'
    ])
    then coalesce(_slug, '')
    else regexp_replace(coalesce(_slug, ''), '-[a-z0-9]{4,5}$', '')
  end;
$function$;

-- Backfill the rows the old rule mis-based. Verified before applying: 24 rows change, ALL of them
-- is_version true -> false (none the other way), zero name collisions against existing canonicals,
-- and zero families end up with more than one canonical — which would reintroduce the
-- .maybeSingle() breakage that made these columns trigger-maintained in the first place.
do $$
begin
  perform set_config('app.bypass_template_guard', 'on', true);
  update public.templates
     set base_slug  = public.base_slug_of(slug),
         is_version = (slug <> public.base_slug_of(slug))
   where slug is not null
     and base_slug is distinct from public.base_slug_of(slug);
end $$;
