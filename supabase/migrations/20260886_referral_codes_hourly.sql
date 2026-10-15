-- Hourly pay as a per-rep OPTION (owner, 2026-10-14: "add a config on all of the existing reps —
-- false for the other ones, true for craig — and a rate, and who pays, so that we can choose to
-- pay them hourly as an option, and eventually post positions"). Three columns on the code row:
--   hourly_enabled   — may this rep log hours at all (default false: a code is commission-only)
--   hourly_rate_cents — the agreed rate; NULL when not hourly
--   hourly_paid_by   — 'operator' (QuickSites/Sandon pays) or 'partner' (the parent code's owner,
--                      e.g. a reseller paying their own rep). NULL when not hourly.
-- The rate lives on the CODE, never on a logged row: rep_hours keeps hours only, so a later rate
-- change does not rewrite what was agreed on the day (lib/rep/hours.ts).
alter table public.referral_codes add column if not exists hourly_enabled boolean not null default false;
alter table public.referral_codes add column if not exists hourly_rate_cents integer check (hourly_rate_cents is null or (hourly_rate_cents > 0 and hourly_rate_cents <= 100000));
alter table public.referral_codes add column if not exists hourly_paid_by text check (hourly_paid_by is null or hourly_paid_by in ('operator','partner'));

-- Every existing rep stays commission-only (the default); Craig is the one hourly arrangement today.
update public.referral_codes
   set hourly_enabled = true, hourly_rate_cents = 5000, hourly_paid_by = 'operator'
 where code = 'craig';
