# Pricing Phase 2 — billing wiring (status: code complete, awaiting Stripe setup)

> Phase 2 backend is **built and the build is green**. What remains is owner-only:
> create the Stripe objects, set env, flip a flag, and verify E2E in Stripe test
> mode (needs your Stripe account). Companion: [`docs/PRICING_REDESIGN.md`](./PRICING_REDESIGN.md).
> Last updated: 2026-06-28.

## Decisions locked (this session)
- Per-site billing = **quantity** subscription item (qty = #published sites).
- Founder rate = **coupon with duration** (one Public price set; founder discount via coupon, auto-rolls off after 12 mo).
- Take-rate **min-fee floor = $0** (exactly 5% of every order).
- Both 2A (agency subscription) + 2B (take-rate finish) implemented.

## What shipped (code)
**Shared billing core**
- `lib/billing/plans.ts` — plan constants/labels (`agency`, `agency_founder`, `free`), `agencyStripeConfig()` (env price/coupon IDs), `countBillableSites()` (published, non-archived, `is_site` templates by owner), `getUserPlan()`, **`isAgencyPlanMerchant()`** (drives fee exemption).
- `lib/billing/agency.ts` — `buildAgencyLineItems()` (platform qty 1 + per-site qty), `agencyDiscountConfig()` (founder coupons vs promo codes), **`syncAgencySiteQuantity()`** (reconcile Stripe per-site qty to live site count).
- `lib/billing/entitlements.ts` — `planAllows(user, feature)` seed; `custom_domain` + `remove_branding` gated to paid plans (Phase 3 will expand + actually enforce at call sites).

**2A — Agency subscription (Path B)**
- `app/api/billing/checkout/route.ts` — accepts `{ tier: 'founder'|'public', sites? }`, builds the per-user + per-site subscription, applies founder coupon(s); legacy `{ priceId }` path preserved.
- `app/api/billing/webhooks/stripe/route.ts` — now also upserts **`user_plans`** (authoritative for membership + exemption) with the canonical plan label from subscription metadata; `subscription.deleted` downgrades to `free`.
- `app/api/cron/agency-site-sync/route.ts` (nightly 03:30, in `vercel.json`) — reconciles per-site quantity for all active agency users. Best-effort sync also fires on publish (`app/api/templates/[id]/publish/route.ts`).
- `/pricing` Path B CTA → self-serve checkout when `NEXT_PUBLIC_AGENCY_BILLING_ENABLED=true` (else "Talk to us", as today).

**2B — Take-rate finish (Path A)**
- `lib/commerce/refunds.ts` — `reverseApplicationFeeForCharge()` reverses the platform application fee proportionally on refund; idempotent + partial-refund-safe (computes target from refunded ratio, refunds only the un-reversed delta). Wired into `app/api/commerce/webhooks/stripe/route.ts`. Ledger void/clawback already existed in `lib/commerce/orders.ts#markOrderRefunded`.
- `lib/commerce/orders.ts#createDraftOrder` — **agency-plan merchants are fee-exempt** (`isAgencyPlanMerchant` → `platform_fee_cents = 0`).
- `app/api/admin/commerce/reconcile/route.ts` — read-only settlement report (admin or cron). Flags: paid-without-payment, ledger amount ≠ partner share, refunded-with-live-ledger; optional live Stripe fee cross-check with `?stripe=1`. Params: `?days=30&limit=500`.

## Owner action required to go live
1. **Create Stripe objects** (test mode first):
   - Public platform price: recurring **$19/user/mo**.
   - Public per-site price: recurring **$6/site/mo** (billed by quantity).
   - Founder coupon(s), `duration=repeating, duration_in_months=12`. To hit **$15 / $5** exactly per line, create **two product-restricted `percent_off` coupons**: platform **21.05%** ($19→$15), per-site **16.67%** ($6→$5). (A single whole-subscription coupon can't reproduce both numbers because the discounts aren't a uniform %.) Put both IDs, comma-separated, in `STRIPE_COUPON_AGENCY_FOUNDER`.
2. **Set env** (see `.env.example`): `STRIPE_PRICE_AGENCY_PLATFORM`, `STRIPE_PRICE_AGENCY_PERSITE`, `STRIPE_COUPON_AGENCY_FOUNDER`, and `NEXT_PUBLIC_AGENCY_BILLING_ENABLED=true`.
3. **Verify E2E in test mode** with the Stripe CLI (`stripe listen --forward-to localhost:3000/api/billing/webhooks/stripe` and `.../api/commerce/webhooks/stripe`):
   - Agency: checkout founder + public → `user_plans` shows `agency_founder`/`agency`; publish a 2nd site → per-site qty bumps (or run the cron); `/api/me/membership` reflects it.
   - Take-rate: order → checkout → `application_fee_amount` lands in platform acct → `markOrderPaid` writes `payments` + ledger → refund reverses the fee (`charge.refunded`) and voids/claws back the ledger; `/api/admin/commerce/reconcile?stripe=1` clean.
   - Agency exemption: an order for an agency-plan merchant has `platform_fee_cents = 0`.
4. Flip `NEXT_PUBLIC_AGENCY_BILLING_ENABLED=true` in prod once verified.

## Caveats (unchanged, still apply)
- **Build gate = clean `next build`, not `tsc`.** This session: `tsc --noEmit` clean + `rm -rf .next && npx next build` green (new routes registered).
- Server/money-path Supabase clients stay typed; loosely-typed tables (`user_plans`, `templates`, `merchant_billing`) are cast `as any` where columns are absent from the trimmed `types/supabase.ts` — matches existing code.
- Service-role bypasses RLS; all new billing routes are server-side + auth-gated (admin/cron). `payment_accounts` stays owner-scoped.
- Money in integer cents; fees clamped by `QS_MAX_PLATFORM_FEE_PERCENT` (10%).

## Deferred to Phase 3
- Actually **enforce** `planAllows()` at the custom-domain attach + remove-branding call sites (helper exists; gates not yet inserted to avoid regressing free flows without a test pass).
- Full entitlements matrix + AI tier gating; add-ons billing.

## Definition of done (remaining)
Items 1–4 above (owner Stripe setup + test-mode E2E). Once green in prod, delete this doc and mark Phase 2 complete in `docs/PRICING_REDESIGN.md`.
