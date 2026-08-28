-- Who sold a geo-domain rental, and who manages them.
--
-- The rental rail records that a payment happened (payment_count, last_invoice_id) but
-- nothing about who is owed a commission on it. Splits are 50/15/35 of net — the shares
-- are computable, the PEOPLE are not, so a payout run today has no source for "pay Shelly".
--
-- Deliberately free-text rather than a FK to auth.users: reps are contractors who are
-- pitched and paid before they ever have a login, and a nullable FK to a row that does not
-- exist yet is worse than a name. Revisit if reps get accounts.

alter table public.geo_industry_campaigns
  add column if not exists sold_by            text,
  add column if not exists sold_by_manager    text,
  add column if not exists manager_is_recruiter boolean not null default false;

comment on column public.geo_industry_campaigns.sold_by is
  'Closer credited with this rental — takes 50% of net for as long as the rental pays. Free text (name or email); reps predate having accounts.';
comment on column public.geo_industry_campaigns.sold_by_manager is
  'Who earns the override on this rental. Null = no override; the house keeps that share.';
comment on column public.geo_industry_campaigns.manager_is_recruiter is
  'True when the manager recruited the closer: the override rises 15%->25%, funded out of the house share and never out of the closer''s.';
