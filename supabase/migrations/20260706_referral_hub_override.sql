-- Multi-tier "hub" referral override: a hub recruits resellers and earns a
-- configurable, lifetime cut of what those resellers generate.
--
-- Model: the override comes OUT OF QuickSites' 20% share (clamped to QS_FEE_SHARE in
-- code), so the reseller keeps their full 80% and QS's net can never go negative.
--
-- `parent_code`   — on a reseller's code, points at the hub's code (its upline).
-- `override_share` — on a reseller's code, the fraction of the order's platform fee
--                    paid to that hub (e.g. 0.05 = 5%). 0 = no override.
-- The hub is paid automatically: markOrderPaid writes a second commission_ledger row
-- crediting parent_code (subject 'order_platform_fee_override'), and runPayouts
-- already groups by the code owner. Use owner_type='hub' for the hub's own code.
alter table public.referral_codes
  add column if not exists parent_code text references public.referral_codes(code),
  add column if not exists override_share numeric(5,4) not null default 0;
