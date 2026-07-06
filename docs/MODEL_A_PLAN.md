# Model A — Free Hosting + E-commerce Slice: Execution Plan

> **Decision (2026-06-26): Model A is the monetization lead.** Prove the take-rate path end-to-end before layering Model B (partner payouts), which rides the same `commission_ledger`.
> Source analysis: [`MONETIZATION.md`](MONETIZATION.md). Funnel events: [`../lib/analytics/events.ts`](../lib/analytics/events.ts).

## Goal
A real merchant processes a real (test-mode) order → QuickSites collects `platform_fee_cents` via Stripe Connect → the whole funnel is visible in PostHog. That's "first dollar." Then harden (refunds, reconciliation) and ship a repeatable demo.

## Scope reset (2026-06-26): generic product commerce, NOT food
**delivered.menu (the chef/meals food marketplace) moved to its own platform** and is being removed from this repo. QuickSites commerce = the **generic e-commerce slice** for builder sites: `catalog_items.type` ∈ {`product`, `service`, `digital`} — e.g. an **arts-&-crafts** vertical. Verified the generic stack already exists and is NOT chef-dependent:

> **Note (2026-07):** the `delivered.menu` *domain* has since been **repurposed** as the default deliverable URL for the restaurant-ordering vertical (`<slug>.delivered.menu` / `delivered.menu/<slug>` → `/sites/<slug>`) — see [`RESTAURANT_VERTICAL.md`](RESTAURANT_VERTICAL.md) §7b + [`CLAUDE.md`](../CLAUDE.md) §5b. That's the domain reused for a new purpose; the old chef/meals *marketplace product* is still gone. Don't confuse the two.
- `app/api/catalog/items` (generic CRUD, all 4 types) · `app/merchant/catalog` (merchant UI)
- `components/cart` (generic `product_type`) · `app/api/commerce/checkout` → `lib/commerce/orders.ts` (writes `order_items.catalog_item_id`)
- `payment_accounts` + platform fee

**Removal target (~99 files):** `app/chef(s)`, `app/meals`, `app/admin/{chefs,meals}`, `app/api/chef/*`, `app/api/admin/{chefs,meals,promote-chef}`, `app/api/public/meal(s)`, `app/api/dev/*meal*`/`*chef*`, `components/chef`, `components/admin/{chef,meals}`, and meal-only coupling. **Keep:** the generic commerce core above. *To be done on a branch with `tsc`/build verification before merge.*

**Schema gaps to make the product vertical run** (folded into the A1 migration — all additive, data is fake): `order_items.catalog_item_id` (live table only has `meal_id`); `merchants.default_currency` (missing, breaks `commerce/checkout`); `orders.platform_fee_cents` + siblings.

**New build (A6):** a generic **public product storefront** (browse/buy `catalog_items`), since today the only customer-facing storefront is the food one (`app/meals`).

## The money funnel (instrument as we build)
```
signup → builder_activated → site_published → merchant_connected
       → catalog_item_created → order_created → order_paid → platform_fee_collected
```
Each event name is a constant in `lib/analytics/events.ts`. Capture client-side for UI steps and **server-side** (via `captureServer` / `trackEvent`) for money steps so revenue analytics survive the Edge-Functions backend split.

---

## 🔴 Critical finding (2026-06-26): there are TWO parallel commerce stacks
A1 turned out bigger than "dedupe a table." The codebase runs **two schema-incompatible commerce systems**:

| | **System 1 — "bps"** | **System 2 — "open_commerce"** |
|---|---|---|
| Account table | `merchant_payment_accounts.provider_account_id` | `payment_accounts.account_ref` |
| Merchant shape | `merchants.user_id` / `name` / `default_platform_fee_bps` / `provider` | `merchants.owner_id` / `display_name` / `site_slug` |
| Order shape | `orders.amount_cents` | `orders.subtotal_cents` / `platform_fee_cents` |
| Fee model | **basis points** (`*_fee_bps`, site override) | **percent** (`platform_fee_percent`) |
| Checkout | `lib/payments` + `payments/create-checkout`, `public/checkout`, `admin/orders/create-test` | `lib/commerce/*` + `commerce/checkout` |
| Ledger | none | writes `commission_ledger` (Model B-ready) |
| Stripe onboarding | `connect/onboard` (creates Express acct) ✅ working | `chef/register` + `merchant/payment-accounts` |
| Documented? | ❌ schema lives only in live DB | ✅ in `supabase/migrations/` |

**Tells:** `merchants.owner_id` (System 2) is referenced **0×** in app code; `merchants.user_id` (System 1) **20×**. The *running app surfaces* (chef dashboard, admin payments) use **System 1**; the *documented/ledger* design is **System 2**.

**Blocker:** the repo has **no source of truth** for the live commerce schema — `types/supabase.ts` is stale (88 tables, none of the commerce ones) and `merchant_payment_accounts` + the bps `merchants` columns are in **no migration**. Cannot safely write a money-table migration blind.

### A1 — Reconcile the two commerce stacks onto one  ·  effort: **L**  ·  **blocker, needs decisions**
**Decided (2026-06-26, by Sandon):** **converge on System 2 (open_commerce)** — `payment_accounts` / `platform_fee_percent` / `orders.platform_fee_cents` / `commission_ledger`. Chosen for the clean, generic (non-food-too), Model-B-ready design. Live-data check made this safe: **0 rows** in `orders`/`payment_accounts`/`merchant_payment_accounts`/`catalog_items`/`commission_ledger`; the **38 `merchants`** rows are **confirmed fake/test data (disposable)** — so the entire commerce dataset is greenfield. We can reshape/wipe/drop freely; no backfill required. Port System 1's working Express onboarding (`connect/onboard`) onto `payment_accounts`; retire System 1's tables/routes.

**Live-schema notes that shape the migration:**
- `merchants` is a superset (has both `user_id` *and* `owner_id`, `display_name`, `site_slug`) but **lacks `default_currency`** — which `commerce/checkout` reads, so System 2 checkout is currently broken until we add it.
- live `orders` is System-1-shaped (`amount_cents`, no `platform_fee_cents`) → add the System 2 fee columns (additive, 0 rows).
- `order_items` references `meal_id` (chef vertical), not `catalog_item_id` → bridging handled in A6 (storefront), not A1.

**One blocking prereq (from you):** regenerate types so I can see the live `merchants`/`orders` columns (the running app uses `merchants.user_id`, but System 2's migration defines `owner_id` — I must see which the live table actually has before rewiring):
```
supabase gen types typescript --project-id <your-id> --schema public > types/supabase.ts
```
(or paste `pg_dump --schema-only -t 'public.merchants' -t 'public.orders' -t 'public.payment_accounts' -t 'public.merchant_payment_accounts'`). TypeScript can't catch wrong column names here (these tables are absent from the stale types → calls are untyped), so the live schema is the only correctness check — hence it gates the rewrite.

**Do (once schema in hand):**
1. Canonical-schema migration: ensure System 2 tables/columns exist (idempotent `add column if not exists`); align `merchants` (reconcile `user_id`/`owner_id`); add the previously-undocumented columns so a fresh DB matches prod.
2. Rewire ~10 System 1 routes (`connect/*`, `payments/create-checkout`, `public/checkout`, `chef/me`, `admin/payments/*`, `admin/orders/create-test`, `chef/dashboard`) to `payment_accounts` + percent fees; convert any bps config (`bps/10000`).
3. Drop System 1 tables (safe — no data).
**Accept:** one account table, one merchant shape, one fee model across every route; a single merchant drives a real test-mode checkout end-to-end with `platform_fee_cents` collected.

### A2 — One checkout entry point  ·  effort: M  ·  depends: A1
**Problem:** three checkout routes exist — `app/api/commerce/checkout` (canonical, uses `lib/commerce/orders.ts`), `app/api/payments/create-checkout`, `app/api/public/checkout` (legacy/partly commented).
**Do:** route all storefronts through `app/api/commerce/checkout` → `createDraftOrder` (which computes `platform_fee_cents`). Deprecate the other two (redirect or delete after callers move).
**Accept:** every storefront checkout creates an `orders` row with correct `platform_fee_cents`; legacy routes unreferenced.

### A3 — First live order, test mode  ·  effort: S  ·  depends: A1, A2  ·  **the "first dollar" proof**
**Do:** stand up one merchant, complete Stripe Connect onboarding (`payment_accounts` active), create a `catalog_item`, run a real test-mode Checkout. Confirm `application_fee_amount` + `transfer_data` land the fee in the platform account and `markOrderPaid()` writes `payments` + `commission_ledger`.
**Accept:** Stripe dashboard shows the application fee; `orders.status='paid'`; `platform_fee_cents > 0`. Capture `order_paid` + `platform_fee_collected`.

### A4 — Refund → platform-fee reversal  ·  effort: S–M
**Problem:** `charge.refunded` is received but the platform fee isn't reversed.
**Touch:** `app/api/commerce/webhooks/stripe`, `lib/commerce/orders.ts`, `lib/payments/stripe.ts`.
**Do:** on refund, reverse the application fee (Stripe `Stripe.refunds` + `refund_application_fee` / `Transfer` reversal), set order `refunded`, void the related `commission_ledger` entry.
**Accept:** a refunded order zeroes net platform revenue and voids its commission row. Capture `order_refunded` + `platform_fee_reversed`.

### A5 — Platform-revenue reconciliation  ·  effort: M
**Do:** a job/admin view that sums Stripe `application_fee` objects and reconciles against `SUM(orders.platform_fee_cents WHERE paid)` and `commission_ledger`. Flag drift.
**Touch:** new `app/api/admin/revenue/route.ts` + a small admin page; reuse `lib/payments/stripe.ts`.
**Accept:** "QS earned $X this period" with a Stripe-vs-DB delta of 0 (or explained).

### A6 — Seeded demo storefront  ·  effort: M  ·  depends: A2
**Do:** finish the `chefs`/`meals` storefront checkout (it's the existing vertical) as the repeatable end-to-end demo: seed a merchant + catalog, public store page → cart → `commerce/checkout` → paid.
**Touch:** `app/meals`, `app/chef(s)`, `components/cart/CheckoutPageClient.tsx`, seed script under `scripts/`.
**Accept:** a single command/seed yields a clickable demo that produces a paid order + platform fee.

### A7 — Funnel instrumentation  ·  effort: S  ·  cross-cutting
**Do:** emit the `lib/analytics/events.ts` events at each step (server-side for money steps). Build the PostHog funnel + a platform-revenue insight.
**Accept:** PostHog shows the 8-step funnel with real conversion and a running platform-fee total.

---

## Sequence
A1 → A2 → **A3 (first dollar)** → A4 + A5 (harden) → A6 (demo) , with A7 woven through.
Recommended first PR: **A1 + A7 scaffolding** (unblocks everything and makes progress measurable).

## Billing tiers (the "near-free hosting" upsell — after first dollar)
`merchant_billing` already exists. Once A3 works, define plans (free / pro) and gate limits (e.g. `LLM_PER_USER_DAILY_CENTS`, custom-domain count) by plan. This is also where per-merchant LLM caps plug in — see [`LLM_METERING.md`](LLM_METERING.md).

---

## Progress (2026-06-26)
Built and verified end-to-end in **test mode** (real Stripe needs keys + a connected account):

| Ticket | Status | Notes |
|---|---|---|
| A1 reconcile on `catalog_items` | ✅ | storefront read repointed; live schema reconciled (site_slug, fee cols, order_items metadata/merchant_id, meal_id nullable) |
| A2 one checkout entry | ✅ | `/checkout` → `/api/commerce/checkout` → `createDraftOrder` |
| A3 first dollar | ✅ test / ⏳ real | test order → paid, platform_fee 320 ($3.20). Real = add Stripe keys + Connect onboarding |
| A4 refund → fee reversal | ✅ | `/api/commerce/refund` (Stripe `reverse_transfer`+`refund_application_fee`); webhook `charge.refunded`; commission void |
| A5 revenue reconciliation | ✅ | `/api/admin/revenue` + `/admin/revenue` page |
| A6 storefront | ✅ | `/store/[merchant]`, `/p/[slug]`, `products_grid` block, seed script |
| A7 funnel events | ✅ | all 8 money-funnel steps + Model-B commission events now emitted server-side at their authoritative transitions (see below). PostHog funnel/insight = a dashboard build in PostHog itself |
| Connect onboarding | ✅ | `/api/connect/{onboard,status,login-link}` on `payment_accounts`; `/merchant/connect` UI. Runbook: [`COMMERCE_RUNBOOK.md`](COMMERCE_RUNBOOK.md) |

**A7 emit map (all server-side via `captureServer`, keyed to user/merchant for funnel stitching):**
| Event | Where emitted |
|---|---|
| `signup` | `app/auth/callback` + `app/api/auth/set-session` (new-user heuristic in `lib/analytics/funnel.ts`) |
| `builder_activated` | `app/api/templates/commit` (first save: template was at rev 0) |
| `site_published` | `app/api/templates/[id]/publish` |
| `merchant_connected` | `app/api/connect/status` (on Stripe `charges_enabled`) |
| `catalog_item_created` | `app/api/catalog/items` |
| `order_created` / `order_paid` / `platform_fee_collected` | `lib/commerce/orders.ts` (`createDraftOrder`, `markOrderPaid`) |
| `order_refunded` / `platform_fee_reversed` | `lib/commerce/orders.ts` (`markOrderRefunded`) |
| `commission_accrued` | `lib/commerce/orders.ts` `markOrderPaid` (on ledger upsert) |
| `commission_paid` | `lib/commerce/payouts.ts` `runPayouts` (per partner, post-transfer) |

All emits are best-effort and no-op without `POSTHOG_KEY`. Building the actual funnel/revenue insight is now a PostHog-dashboard task, not a code task.

**Remaining:** real Stripe test charge (user step); retire legacy
`products` table (entangled with membership — needs care); drop `meals`/`order_items.meal_id`
+ dead admin card fns (cosmetic).
