# Commerce Runbook — generic product storefront (arts & crafts)

How the money path works and how to drive a **real** test-mode charge.
Companion to [`MODEL_A_PLAN.md`](MODEL_A_PLAN.md).

## The flow
```
/store/<merchant>  or a products_grid block      → browse
   → add to cart (qs:cart:add → cart-store)
   → /cart → /checkout (Place order)
   → POST /api/commerce/checkout
        → createDraftOrder (orders + order_items; platform_fee_cents)
        → createCheckout (Stripe Connect: application_fee + transfer_data) → Stripe Checkout
   → customer pays → webhook /api/commerce/webhooks/stripe → markOrderPaid
        → payments row + commission_ledger (if referral-attributed)
```
Canonical tables: `catalog_items` (products), `orders`/`order_items`, `payment_accounts`, `payments`, `commission_ledger`.

## Test mode (no Stripe) — already proven
Set in `.env.local`:
```
QS_TEST_CHECKOUT=1
QS_TEST_PLATFORM_FEE_PERCENT=0.05
QS_PUBLIC_URL=http://localhost:3000
```
Any checkout marks the order paid (test) and computes the platform fee, so you can
exercise order → fee → ledger without Stripe. (Also auto-engages when a merchant has
no `payment_account`.)

## Real test-mode charge (the genuine first dollar)
1. **Env** (`.env.local`): real test keys + turn off the test shim.
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...            # from `stripe listen` below
   APP_BASE_URL=http://localhost:3000
   QS_TEST_CHECKOUT=0
   QS_DEFAULT_PLATFORM_FEE_PERCENT=0.05       # seeded onto the payment_account
   ```
2. **Connect a merchant** (creates the `payment_accounts` row):
   - Visit `/merchant/connect?merchant=<merchantId>` → **Connect Stripe**.
   - Complete Stripe Express onboarding with test data → it returns to the page and
     status flips to **active** (via `GET /api/connect/status`).
   - (Seeded demo merchant id is in `scripts/seed-demo-products.sql` output.)
3. **Forward webhooks** (separate terminal):
   ```
   stripe listen --forward-to localhost:3000/api/commerce/webhooks/stripe
   ```
   Put the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
4. **Buy**: `/store/<merchant>` → add an item → `/checkout` → **Place order** →
   real Stripe Checkout → pay with test card `4242 4242 4242 4242` (any future date/CVC).
5. **Verify**: the `checkout.session.completed` webhook calls `markOrderPaid`; the order
   flips to `paid`, a `payments` row is written, and Stripe shows the **application fee**
   on the platform account.

## Endpoints (Connect)
- `POST /api/connect/onboard {merchantId}` → Express account + `payment_accounts` (pending) → onboarding URL
- `GET  /api/connect/status?merchantId=` → syncs `charges_enabled` → status `active`
- `POST /api/connect/login-link {merchantId}` → Express dashboard link
- Adjust fee later: `POST /api/merchant/payment-accounts` or `/merchant/payments`

## Notes / follow-ups
- Connect uses **destination charges** (`transfer_data.destination` + `application_fee_amount`)
  on the platform account — correct for the take-rate model.
- A Connect webhook (`account.updated`) could replace the manual status refresh.
- Refund → fee reversal (A4) and revenue reconciliation (A5) are still TODO — see MODEL_A_PLAN.
