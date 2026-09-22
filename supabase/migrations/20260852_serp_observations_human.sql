-- 20260852_serp_observations_human.sql
--
-- A human-run SERP check stores into the SAME table as the automated one, because the whole
-- value of the worksheet is comparing them row for row. `provider` already distinguishes them
-- ('dataforseo' vs 'human'); these two columns record who looked and what they noticed that the
-- form had no box for.
--
-- ⚠️ `notes` is the escape hatch that keeps the form honest. A fixed set of inputs can only
-- capture what we already thought to ask, and the one thing a person is better at than an API is
-- noticing the thing nobody anticipated. Without somewhere to put it, they either discard it or
-- bend an answer to fit — and a bent answer is worse than no answer.

alter table public.serp_observations add column if not exists checked_by uuid;
alter table public.serp_observations add column if not exists notes text;

create index if not exists serp_observations_provider_idx
  on public.serp_observations (provider, checked_at desc);
