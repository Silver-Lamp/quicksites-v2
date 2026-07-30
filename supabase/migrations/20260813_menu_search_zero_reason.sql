-- 20260813_menu_search_zero_reason.sql
--
-- WHY a search returned nothing — because "returned nothing" was four different facts.
--
-- Three separate times today the fix was to split a bucket that was quietly averaging two
-- different things: leak vs remedy, closed vs unserved, and unserved vs unmatched. Each split
-- made an instrument honest that had looked fine. This records the fourth-level answer so the
-- averaging cannot come back.
--
--   closed_now    the dish IS served nearby; the kitchens are shut. NOT a menu gap — it's
--                 latent after-hours demand, a different signal with a different action
--                 (extend hours) and a different buyer.
--   relaxed_tags  OUR filter chips were wrong. A product-quality signal about our own UI,
--                 and ⚠️ it must never be counted anywhere near the demand number — that
--                 would be reporting our own interface design as market evidence.
--   naming        served nearby under a different spelling ("pad thai" vs "Phad Thai").
--                 OUR INDEX failed, not the market. The remedy is a synonym layer, and
--                 counting it as demand argues for building the wrong thing entirely.
--   none          nobody nearby serves it. THE ONLY ONE THAT IS ACTUAL UNMET DEMAND.
--
-- ⚠️ WHY THIS IS LOGGED AT SEARCH TIME AND NOT DERIVED LATER. The query text is already
-- stored, so it is tempting to reclassify old rows in a batch job. That would be wrong: the
-- index CHANGES as menus are added, so re-running an old query against today's cohort answers
-- a different question than the visitor asked. The classification is a fact about the moment,
-- and the moment is not recoverable.
--
-- Nullable: rows with results, and rows written before this shipped, have no reason. A NULL
-- means "not recorded", never "none" — do not coalesce it into the demand bucket.

alter table public.menu_search_events
  add column if not exists zero_reason text;

do $$
begin
  alter table public.menu_search_events
    add constraint menu_search_events_zero_reason_check
    check (zero_reason is null or zero_reason in ('closed_now', 'relaxed_tags', 'naming', 'none'));
exception
  when duplicate_object then null;
end
$$;

-- The honest unmet-demand query: genuinely unserved only.
create index if not exists menu_search_events_unserved_idx
  on public.menu_search_events (campaign_id, created_at desc)
  where zero_reason = 'none';

comment on column public.menu_search_events.zero_reason is
  'Why a zero-result search found nothing. Only zero_reason=''none'' is real unmet demand; closed_now is after-hours demand, relaxed_tags is our own UI, naming is our own index. NULL = not recorded, never assume none.';
