-- 20260879_postcard_mailings_kind.sql
--
-- Which card a mailing row is. Three campaigns share postcard_mailings and the funnel tiles
-- counted them as one: the geo competition poster (campaign_id set), the trade-site claim card
-- (campaign_id null, the automated loop) and, from 2026-10-10, the Evolve card for restaurants
-- with a site and no online ordering. A response rate is per card, not per table.
-- Backfill from the only tell the rows carry: a campaign id means the competition poster.
alter table public.postcard_mailings
  add column if not exists kind text;

update public.postcard_mailings
   set kind = case when campaign_id is not null then 'competition' else 'trade_claim' end
 where kind is null;

alter table public.postcard_mailings
  alter column kind set default 'trade_claim',
  alter column kind set not null;

comment on column public.postcard_mailings.kind is
  'Which card: trade_claim (auto-built trade site), competition (geo poster), evolve (restaurant with a site, no ordering), guest. Funnels are per kind.';

create index if not exists postcard_mailings_kind_idx
  on public.postcard_mailings (kind, created_at desc);
