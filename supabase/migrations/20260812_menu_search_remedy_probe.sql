-- 20260812_menu_search_remedy_probe.sql
--
-- Measure the REMEDY, not just the LEAK.
--
-- menu_search_events (20260811) records that a search matched nothing. That proves the leak is
-- real — "people want dishes nobody near them serves" — and it accrues for free. It cannot
-- prove that any particular fix plugs it. Those are two separate claims, and a mesh review of
-- the "cook it yourself" proposal found that all four sessions reasoned carefully about whether
-- the design was CORRECT and none of us asked whether anyone WANTS it. Four clean architectures
-- for untested demand is how a thing gets built because it is elegant.
--
-- So: one more `kind` on the same table. A visitor who searched, found nothing, and said they
-- would cook it instead is a `cook_intent` row carrying the same query. Conversion is then
--
--     count(kind='cook_intent') / count(kind='search' and result_count=0)
--
-- measured against exactly the population that matters — people who wanted a dish, at the
-- moment they were hungry, and didn't get it. That is the worst possible mood for a 40-minute
-- project, which is precisely why it has to be measured rather than assumed.
--
-- ⚠️ SAME NO-PII PROPERTY AS THE PARENT TABLE, and it survives only if nobody "improves" it:
-- no user id, no session id, no IP. The unit is still an EVENT, not a person. We cannot tell
-- whether one visitor tapped or fifty did, and we do not need to — the decision needs a rate,
-- not a roster. Adding an identifier to tie a tap back to its search would make this a
-- different product with a different consent story.
--
-- ⚠️ AND THE UI THIS FEEDS MUST NOT PROMISE A FEATURE THAT DOESN'T EXIST. A painted door that
-- reads "Want the recipe?" and dead-ends is the same dishonesty as the invented menus we
-- stripped off real restaurants this month. The prompt asks a QUESTION ("would you cook it
-- yourself if we showed you how?") and the confirmation says plainly that it isn't built yet.
-- Measuring intent is legitimate; implying a capability to harvest the signal is not.

alter table public.menu_search_events
  add column if not exists kind text not null default 'search';

do $$
begin
  alter table public.menu_search_events
    add constraint menu_search_events_kind_check
    check (kind in ('search', 'cook_intent'));
exception
  when duplicate_object then null;
end
$$;

-- The remedy-appetite query: taps, by campaign, over a window.
create index if not exists menu_search_events_cook_intent_idx
  on public.menu_search_events (campaign_id, created_at desc)
  where kind = 'cook_intent';

comment on column public.menu_search_events.kind is
  'search = a query was run; cook_intent = the visitor saw a zero-result and said they would cook it themselves. Rate of the second over zero-result firsts = remedy appetite.';
