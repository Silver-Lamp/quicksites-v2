-- Attribute a rental to REFERRAL CODES rather than to free-text names.
--
-- Supersedes the columns added in 20260831 (same session, no data written). Free text was
-- the wrong call: commission_ledger.referral_code is `not null references referral_codes(code)`,
-- so a name can never become a ledger row, a payout run, or a clawback. Codes can already be
-- minted before the person exists (owner_id is nullable, balances accrue as 'held' until they
-- claim and connect Stripe), which is exactly the contractor-paid-before-they-have-a-login case
-- the free text was invented to serve.
--
-- manager_is_recruiter is DROPPED rather than kept: whether one rep recruited another is
-- already recorded once, as referral_codes.parent_code, and is what drives the existing hub
-- override. A second copy on the campaign can disagree with it, and then the override rate
-- depends on which table you read.

alter table public.geo_industry_campaigns
  drop column if exists sold_by,
  drop column if exists sold_by_manager,
  drop column if exists manager_is_recruiter;

alter table public.geo_industry_campaigns
  add column if not exists sold_by_code text references public.referral_codes(code),
  add column if not exists manager_code text references public.referral_codes(code);

create index if not exists geo_campaigns_sold_by_code_idx on public.geo_industry_campaigns (sold_by_code);
create index if not exists geo_campaigns_manager_code_idx on public.geo_industry_campaigns (manager_code);

comment on column public.geo_industry_campaigns.sold_by_code is
  'Referral code of the closer. Takes 50% of net for as long as the rental pays; commission_ledger rows are written against this code.';
comment on column public.geo_industry_campaigns.manager_code is
  'Referral code earning the override on this rental. The override is 25% when this code is the closer''s referral_codes.parent_code (i.e. they recruited them) and 15% otherwise — derived, never stored twice.';
