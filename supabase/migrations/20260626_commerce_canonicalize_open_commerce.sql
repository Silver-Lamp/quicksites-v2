-- A1 — Canonicalize commerce on the open_commerce ("System 2") data model.
--
-- Decision (2026-06-26): converge on payment_accounts / percent fees /
-- orders.platform_fee_cents / commission_ledger. The competing "System 1" (bps +
-- merchant_payment_accounts) is retired.
--
-- SAFE TO RUN: all commerce data is disposable (orders/payment_accounts/
-- merchant_payment_accounts/catalog_items/commission_ledger = 0 rows; the 38
-- `merchants` rows are confirmed fake test data). This migration is additive +
-- idempotent. It does NOT drop System 1 tables — that happens in a follow-up
-- migration AFTER the routes are rewired (so nothing breaks mid-flight).
--
-- Optional: to start fully clean, uncomment the wipe block below.

-- ── Optional clean slate (fake data only) ───────────────────────────────────
-- truncate table order_items, orders, payments, commission_ledger,
--   payment_accounts, merchant_payment_accounts, catalog_items restart identity cascade;
-- truncate table merchants restart identity cascade;  -- removes the 38 fake merchants

-- ── merchants: make System 2 keys/fields authoritative ──────────────────────
alter table merchants
  add column if not exists default_currency text not null default 'USD';

-- commerce/checkout reads merchants.default_currency (was missing → checkout broke).
-- Backfill the System 2 ownership key from the legacy column where unset.
update merchants set owner_id = user_id where owner_id is null and user_id is not null;

-- ── orders: add the System 2 money columns (live table is System-1-shaped) ───
alter table orders
  add column if not exists subtotal_cents     int     not null default 0,
  add column if not exists tax_cents          int     not null default 0,
  add column if not exists shipping_cents      int     not null default 0,
  add column if not exists platform_fee_cents  int     not null default 0,
  add column if not exists total_cents         int     not null default 0,
  add column if not exists provider            text,
  add column if not exists provider_checkout_id text;

-- Keep legacy orders.amount_cents for now; code will write the new columns going
-- forward. (0 rows today, so no backfill needed.)

-- ── order_items: make it generic (catalog_item_id), not meal-bound ───────────
-- The generic order path (lib/commerce/orders.ts) writes catalog_item_id, but the
-- live table only has meal_id (chef vertical). Add the generic FK so the
-- arts-&-crafts / product vertical works without the chef framework.
alter table order_items
  add column if not exists catalog_item_id uuid references catalog_items(id) on delete set null,
  add column if not exists total_cents int not null default 0;
-- meal_id is left in place for now; it (and the chef layer) is dropped in the
-- follow-up migration once the food vertical is removed.

-- ── payment_accounts: ensure the fee-config columns exist (open_commerce) ────
alter table payment_accounts
  add column if not exists collect_platform_fee   boolean not null default false,
  add column if not exists platform_fee_percent    numeric(5,4) not null default 0,
  add column if not exists platform_fee_min_cents  int not null default 0;

-- Helpful indexes for the money path.
create index if not exists orders_merchant_created_idx on orders (merchant_id, created_at);
create index if not exists payment_accounts_merchant_idx on payment_accounts (merchant_id, provider);

-- NOTE (follow-up migration, after route rewire):
--   drop table if exists merchant_payment_accounts;
--   alter table merchants drop column if exists default_platform_fee_bps;  -- bps → percent
--   alter table sites     drop column if exists platform_fee_bps;
