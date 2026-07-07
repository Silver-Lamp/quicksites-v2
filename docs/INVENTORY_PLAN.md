# Inventory Management Plan (Shopify-style)

> Status: **planning** (2026-07-07). Grounded in an audit of the current inventory code.
> Companion to [`docs/MONETIZATION.md`](MONETIZATION.md) and the commerce money-path in [`CLAUDE.md`](../CLAUDE.md) §5.

## TL;DR

The **hard part already exists**: atomic, race-safe reserve → decrement → release with a 30-minute hold TTL and a cron sweep. Shopify-parity work is almost entirely in the **layers above** the atomic core — a management UI, an adjustments ledger, thresholds/alerts, a backorder toggle, SKU/barcode persistence, refund restock — plus **reconciling two competing stock fields onto one**. Build on the core; do not reinvent it.

## 1. What exists today (don't rebuild)

- **Enforced stock lives in `catalog_items.metadata.stock`** (plain item) and **`metadata.variants[].stock`** (per-variant). `null`/absent = untracked/unlimited; `0` = sold out. Helpers in [`lib/commerce/inventory.ts`](../lib/commerce/inventory.ts) (`normalizeStock`, `readItemStock`, `checkStock`).
- **Atomic decrement** — `decrement_catalog_stock(item, variant, qty)` RPC (`supabase/migrations/20260702_atomic_stock_decrement.sql`) does a `SELECT … FOR UPDATE` read-check-decrement, so concurrent orders serialize. **Overselling is atomically prevented.** Service-role only.
- **Reserve-then-confirm** — `stock_reservations` table + `reserve_catalog_stock` (30-min TTL), `release_order_reservations`, `consume_order_reservations`, `sweep_expired_reservations` (`supabase/migrations/20260702_stock_reservations.sql`). Checkout places a hold ([`app/api/commerce/checkout/route.ts`](../app/api/commerce/checkout/route.ts) → 409 on shortfall); `markOrderPaid` consumes it ([`lib/commerce/orders.ts`](../lib/commerce/orders.ts)); a cron releases expired holds (`app/api/cron/release-stock-reservations`).
- **Read-side gate** — `authorizeCheckoutItems` ([`lib/commerce/checkoutItems.ts`](../lib/commerce/checkoutItems.ts)) checks `checkStock` and 400s early (the reserve RPC is the authoritative guard).
- **Editing UI (limited)** — a single "Stock (blank = unlimited)" field in `components/merchant/CreateItemDrawer.tsx` / `EditItemDrawer.tsx`, and per-combination stock in `components/merchant/VariantsEditor.tsx`.

## 2. The load-bearing problem: two disconnected stock fields

There are **two** stock notions today:
- `metadata.stock` — **enforced** by checkout + the decrement RPC.
- `metadata.qty_available` — **admin display only** (`components/admin/ecommerce/product-manager-modal.tsx`, `app/api/admin/products/route.ts`), never read by the checkout gate.

**Editing the admin "N in stock" does not change what checkout enforces.** Phase 1 must collapse these onto `metadata.stock` (alias `qty_available` reads/writes to it, then retire it). This is the single most important correctness fix.

## 3. Gaps vs Shopify

| Capability | State |
|---|---|
| Per-variant quantity tracking | ✅ exists + enforced |
| Atomic reserve/decrement/release | ✅ exists |
| Oversell detection (`orders.oversold_lines`) | 🟡 written, no UI reads it |
| SKU | 🟡 parsed by `importShopify` then **dropped** in `shopifyCatalog.ts` |
| Refund restock | 🟡 TODO only (`app/api/admin/refunds/[refundId]/route.ts`) — refunds don't restock |
| Availability windows (`availability` table) | 🟡 table exists, no reader enforces `quantity` |
| Inventory adjustments / audit history | ❌ none |
| Low-stock thresholds + alerts | ❌ none |
| Explicit "track quantity" toggle | ❌ implicit (numeric present = tracked) |
| "Continue selling when out of stock" (backorder) | ❌ none |
| Barcode / UPC | ❌ none |
| Inventory management screen (list / bulk / receive) | ❌ none |
| Multi-location | ❌ none |
| Committed vs on-hand breakdown | ❌ single scalar conflates them |

## 4. Phased plan

### Phase 1 — Consistency & policy (small, high-value)
Goal: one source of truth + the two most-requested Shopify behaviors.
1. **Unify stock fields** → everything reads/writes `metadata.stock`; `qty_available` becomes an alias then is removed. Update admin product API + product-manager modal.
2. **Explicit policy per item/variant** in metadata: `inventory.track: boolean` (default: numeric present ⇒ tracked) and `inventory.policy: 'deny' | 'continue'` (backorder). Teach `checkStock` + `decrement_catalog_stock` to allow negative/continue when `policy='continue'` (record the oversell in `oversold_lines` intentionally). Add the toggle to Create/Edit drawers.
3. **Persist SKU + add barcode** — wire the already-parsed `importShopify` SKU through `shopifyCatalog.ts` into `metadata.variants[].sku`; add SKU/barcode fields to the editors; make them searchable in the catalog list.
4. **Refund restock** — implement the existing TODO: on refund, `release`/increment stock behind a `restock_on_refund` flag.

*Deliverable:* correct, policy-aware stock with SKU. ~4 focused PRs.

### Phase 2 — Visibility & control (the management surface)
1. **Inventory adjustments ledger** — new `inventory_adjustments` table `(id, catalog_item_id, variant_id, delta, reason enum['sale','restock','refund','manual','correction','initial'], order_id?, actor_id, note, created_at)`. Write a row from every decrement/release/refund/manual edit. Gives an **audit trail + running history** (Shopify's "inventory history") and disambiguates committed vs on-hand.
2. **Low-stock thresholds + alerts** — `metadata.inventory.low_stock_threshold`; a cron (reuse the `ai-cost-alert` pattern) emails the merchant + raises a dashboard badge when on-hand ≤ threshold.
3. **Surface `oversold_lines`** in the merchant order view.
4. **Inventory management screen** — `/merchant/inventory`: sortable list, filter low/out-of-stock, inline qty edit, **bulk adjust**, **receive stock** (a positive adjustment with reason), CSV export.

*Deliverable:* a real inventory dashboard + history. ~3–4 PRs.

### Phase 3 — Scale (optional, demand-driven)
- **Multi-location** — `location_id` on stock buckets + adjustments; per-location availability.
- **CSV import of quantities** (bulk restock).
- **Barcode scanning** for receive/count (mobile web).

## 5. Data-model summary
- Keep `metadata.stock` / `metadata.variants[].stock` as on-hand.
- New: `inventory_adjustments` (ledger). New metadata keys: `inventory.{track, policy, low_stock_threshold}`, `variants[].{sku, barcode}`.
- Migrations are idempotent DDL via `scripts/db-migrate.mjs` (see [`CLAUDE.md`](../CLAUDE.md) §7). New tables: deny-default RLS, service-role writes, merchant-owner read.

## 6. Testing & risks
- Pure-function tests for policy in `checkStock`; concurrency tests for the backorder path in the decrement RPC.
- **Risk:** the field-unification migration must not lose counts — backfill `metadata.stock` from `qty_available` only where `stock` is absent; never overwrite an enforced value.
- **Risk:** backorder + reservations interact — a `continue` item should never 409; verify the reserve RPC path honors policy.

## 7. Open decisions
- Retire `qty_available` outright, or keep as a read-through alias for a release?
- Backorder granularity: per-item only, or per-variant too? (Recommend per-variant, matching stock granularity.)
- Does the `availability` table (booking windows) get folded in here or stay a separate "scheduling" concern? (Recommend: separate.)
- Multi-location: worth it for the current SMB/single-maker ICP, or defer indefinitely? (Recommend: defer.)
