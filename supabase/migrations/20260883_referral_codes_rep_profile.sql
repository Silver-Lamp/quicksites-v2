-- Partner-managed rep codes (lib/partners/repCodes.ts). A partner mints a code for a sales rep;
-- the code is OWNED by the partner (orders land on the partner's ledger, the partner pays the rep),
-- `label` is the rep's name, `owner_email` the rep's email, `parent_code` the partner's code, and
-- these two columns are where the rep walks — the dynamic /for/<code> page reads them.
alter table public.referral_codes add column if not exists rep_city text;
alter table public.referral_codes add column if not exists rep_region text;
