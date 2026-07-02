-- A1 follow-up — Retire the legacy Stripe Connect ("System 1") fee model now that
-- every route reads AND writes the canonical open_commerce ("System 2") tables.
--
-- This is the drop step explicitly deferred by 20260626_commerce_canonicalize_open_commerce.sql
-- ("NOTE (follow-up migration, after route rewire)"). The rewire is now complete:
--   • GET  /api/admin/payments/status       reads  payment_accounts.platform_fee_percent
--   • POST /api/admin/payments/save-settings writes payment_accounts.platform_fee_percent
--   • POST /api/connect/onboard              writes payment_accounts (Express)
--   • lib/commerce/orders.ts#createDraftOrder reads payment_accounts fee config
-- Nothing in the codebase references merchant_payment_accounts, merchants.default_platform_fee_bps,
-- or sites.platform_fee_bps anymore (grep-verified).
--
-- SAFE TO RUN: commerce data is greenfield/disposable — merchant_payment_accounts = 0 rows
-- (confirmed 2026-06-26); the bps columns fed a write path that no reader consumed. Idempotent.

-- Deprecated System 1 account table (superseded by payment_accounts).
drop table if exists public.merchant_payment_accounts;

-- Legacy bps fee columns (superseded by payment_accounts.platform_fee_percent, a 0..1 percent).
alter table public.merchants drop column if exists default_platform_fee_bps;
alter table public.sites     drop column if exists platform_fee_bps;
