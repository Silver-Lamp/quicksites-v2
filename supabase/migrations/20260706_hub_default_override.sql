-- A hub's DEFAULT override rate, applied automatically to resellers it recruits.
--
-- On the hub's own referral_codes row: the fraction of a downline reseller's order
-- fees the hub earns. When a reseller signs up through the hub's recruit link
-- (?hub=<code> → qs_hub cookie), /api/partners/join copies this onto the new
-- reseller's row (parent_code = hub, override_share = this default). Clamped to
-- QS_FEE_SHARE in code so it always comes out of QuickSites' share.
alter table public.referral_codes
  add column if not exists default_override_share numeric(5,4) not null default 0;
