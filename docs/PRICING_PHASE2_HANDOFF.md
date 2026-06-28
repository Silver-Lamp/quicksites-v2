# Pricing Phase 2 — billing wiring (handoff)

> Working doc for a fresh session to make the hybrid pricing model *real* in billing.
> Phase 1 (the `/pricing` page + `/build` entry) is shipped to `main`. This is the backend.
> Companion: [`docs/PRICING_REDESIGN.md`](./PRICING_REDESIGN.md) (the model + decisions).
> Last updated: 2026-06-28.

## TL;DR — resume in 5 steps
1. `git checkout main && git pull`. Use **Node 20** (`nvm use`), `npm ci`, `npm rebuild canvas` if needed.
2. Read `docs/PRICING_REDESIGN.md` (model) + this doc + the "current reality" section below.
3. Do **2A (agency subscription)** and **2B (take-rate finish)** — they're independent; either order.
4. **The build gate is a fully-clean `next build`, NOT `tsc`** (see caveats). Test Stripe in test mode with the CLI webhook listener.
5. Update `app/pricing/page.tsx` CTAs/notes as each path becomes self-serve (today Path B says "Talk to us — beta").

## What Phase 1 shipped (don't redo)
- `/pricing` rebuilt as a 3-path hybrid (Build-my-own / Agency / Partner) — `app/pricing/page.tsx`.
- `/build` — focused no-signup guest-builder entry (`app/build/page.tsx`); merchant CTAs point here, it redirects to `/login` when `NEXT_PUBLIC_GUEST_BUILD_ENABLED` is off.
- Copy is honest about gaps: Path A "5% per order", Path B "flat billing in beta → Talk to us", Path C → `/partners`.

## The model (what billing must implement)
- **Path A — Merchant (free + take-rate):** free build/host/publish; **5% per order** via Stripe Connect. No subscription.
- **Path B — Agency (flat subscription):** per-user + per-site (Founder $15+$5 / Public $19+$6), **no per-order fee**.
- **Path C — Partner:** sets merchant order fee ≤10%, keeps **80% lifetime**. Already built end-to-end (`lib/commerce/partner-terms.ts`, `commission_ledger`, payouts) — out of scope here.

## Current billing reality (so you don't rediscover)
**Subscription (Path B) — minimal today:**
- `app/api/billing/checkout/route.ts` — creates a Stripe **subscription** Checkout session using a SINGLE price `process.env.STRIPE_PRICE_PRO_MONTHLY`; attaches `metadata.merchant_id/user_id`. No tier selection, no per-site quantity.
- `app/api/billing/webhooks/stripe/route.ts` — `checkout.session.completed` → upsert `merchant_billing`; `customer.subscription.{created,updated,deleted}` → sync status; `invoice.payment_succeeded` → commission-ledger entry. Plan label derived from Stripe price nickname/product.
- `app/api/me/membership/route.ts` — resolves plan via cascade: `user_plans` → `merchant_billing` + live Stripe sub → legacy tables → `'free'`.
- Tables: `user_plans` (user_id PK, plan, status, trial_end, current_period_end); `merchant_billing` (merchant_id PK, plan, stripe_subscription_id). **No feature gates by plan exist anywhere.**
- Trials: `user_plans.status='trialing'` + `trial_end`; expiry cron `app/api/admin/users/plan/expire-trials`.

**Take-rate (Path A) — ~60% built:**
- `lib/commerce/orders.ts` — `platform_fee_cents = max(floor(total_cents * pct), min_cents)`.
- `lib/commerce/paymentRouter.ts` — per-merchant `payment_accounts` (provider, `collect_platform_fee`, `platform_fee_percent` 0..1, `platform_fee_min_cents`, `account_ref` = Connect acct). `payment_accounts` already has RLS (owner policy `pa_owner_rw`).
- `lib/commerce/adapters/stripeAdapter.ts` / `lib/payments/stripe.ts` — set Connect `application_fee_amount` + `transfer_data`.
- `app/api/commerce/webhooks/stripe` → `markOrderPaid()` → writes `payments` + `commission_ledger`.
- Env: `QS_DEFAULT_PLATFORM_FEE_PERCENT=0.05`, `QS_MAX_PLATFORM_FEE_PERCENT=0.10`, `QS_PARTNER_FEE_SHARE=0.8`, `QS_REFUND_WINDOW_DAYS`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_MONTHLY_SITE_PRICE_ID` (legacy/likely unused).

---

## 2A — Agency subscription billing (Path B)
Make the per-user + per-site tiers actually billable & self-serve (replace "Talk to us").

1. **Create Stripe products/prices** for the tiers. Recommended structure: one **platform** recurring price per tier (Founder/Public) + a **metered or quantity-based per-site** price. Decide:
   - Per-site as a **quantity** subscription item (set `quantity = #sites`, update on site create/delete), OR **usage-based** metered (report usage). Quantity is simpler and matches "flat per-site".
   - Founder vs Public as separate prices, or one price + coupon for the 12-mo grandfather. (Founder is a 12-mo grandfather — a coupon/price with an end date is cleanest.)
   - Add env vars: `STRIPE_PRICE_AGENCY_PLATFORM_FOUNDER`, `..._PUBLIC`, `STRIPE_PRICE_AGENCY_PERSITE_FOUNDER`, `..._PUBLIC` (mirror the numbers in `app/pricing/page.tsx`: $15/$19 platform, $5/$6 per-site).
2. **Checkout** (`app/api/billing/checkout/route.ts`): accept a `tier` (founder|public) + initial `sites` count; build a subscription with platform line + per-site line (`quantity`). Keep `metadata.user_id/merchant_id`.
3. **Keep the subscription per-site quantity in sync** with the user's actual site count (on publish/create/delete) via the Stripe API — or reconcile nightly. Note: this plan **waives the per-order platform fee** for agency-plan merchants (see 2B step 4).
4. **Webhook**: extend `app/api/billing/webhooks/stripe/route.ts` to persist tier + seat/site quantities to `user_plans`/`merchant_billing`. Confirm plan-label mapping.
5. **Entitlements (Phase 3 seed):** there are NO feature gates today. Minimal: a helper `planAllows(user, feature)` reading membership; gate custom-domain + remove-branding to paid plans. (Full entitlements is Phase 3.)
6. **`/pricing` CTAs:** flip Path B from `/contact` to a real checkout entry once self-serve works.

## 2B — Finish the take-rate (Path A)
1. **Refund fee-reversal:** on Stripe `charge.refunded` / `refund.created`, reverse the proportional `application_fee` (Connect `Refund` with `refund_application_fee: true` or `Stripe.applicationFees.createRefund`), and reverse/claw back the matching `commission_ledger` entry within `QS_REFUND_WINDOW_DAYS`. Wire in `app/api/commerce/webhooks/stripe`.
2. **Settlement reconciliation:** a report/job that reconciles `orders.platform_fee_cents` ⇄ Stripe `application_fee` ⇄ `payments` ⇄ `commission_ledger`, surfacing mismatches. (Admin dashboard or a cron summary.)
3. **Verify the default fee path end-to-end** in Stripe test mode: order → Checkout → `application_fee_amount` lands in the platform account → `markOrderPaid` writes `payments` + ledger → refund reverses fee + ledger.
4. **Agency exemption:** merchants on a paid **agency** plan should have `collect_platform_fee=false` (they pay flat instead). Ensure the take-rate is skipped for them (set on `payment_accounts` or derive from plan at order creation).

---

## Critical caveats (read before building)
- **Build gate = clean `next build`, not `tsc`.** `tsc --noEmit` under-reports vs Vercel's build-worker type-check. Before pushing: `rm -rf .next node_modules/.cache *.tsbuildinfo && npm ci && npx next build` on Node 20. See memory `build-gate-and-admin-client`.
- **`admin/lib/supabaseClient` is intentionally UNTYPED** now (don't re-add `<Database>`). Server/money-path clients stay typed — keep `getServerSupabase`/`supabaseAdmin`/`serverClient` typed for billing code.
- **RLS is live** on commerce-adjacent tables (PR #12). Server billing routes use the **service role** (bypasses RLS) — keep using it; don't query these from the browser anon client. `payment_accounts` is owner-scoped.
- **Money in integer cents**, never floats. Match `*_cents` columns. Fees clamped by `QS_MAX_PLATFORM_FEE_PERCENT` (10%).
- **Stripe Connect** is the mechanism for both merchant payouts and the take-rate; partner payouts already exist — don't duplicate.
- **Test with the Stripe CLI** (`stripe listen --forward-to localhost:3000/api/...`) in test mode; never against live keys.

## Definition of done
1. Agency tier checkout is self-serve (tier + per-site quantity), webhook-synced, reflected in `/api/me/membership`; `/pricing` Path B points to it.
2. Take-rate verified E2E in test mode incl. **refund fee-reversal** + ledger clawback; reconciliation report exists.
3. Agency-plan merchants are exempt from the per-order fee.
4. `rm -rf .next … && next build` green; a runtime smoke of a test checkout + a test order.
5. Delete this doc; update `docs/PRICING_REDESIGN.md` status.

## Open questions for the owner
- Final **order fee %** at launch (5% assumed) + a **min-fee floor** (cents)?
- Per-site billing as **quantity** (simple) or **metered usage**?
- Founder grandfather: separate price or **coupon with end date**?
- Any **hard limits** on the free Merchant tier (pages/sites/storage), or only branding + subdomain?
