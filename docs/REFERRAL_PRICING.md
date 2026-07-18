# Referral & partner pricing — the sustainable-yet-aggressive model

> How QuickSites compensates the people who bring in merchants. Two tiers, both
> lifetime, both funded so an order can never go underwater. Companion to
> [`MONETIZATION.md`](MONETIZATION.md). Last updated 2026-07-18.

## The binding constraint: Stripe is paid out of the fee

Checkout uses Stripe **destination charges** (`application_fee_amount` +
`transfer_data.destination`, **no `on_behalf_of`** — see `lib/payments/stripe.ts`).
That means **QuickSites is the settlement merchant of record and pays Stripe
processing** (~2.9% + 30¢ ≈ 3.2% of GMV) out of the platform fee. So QS's _real_
margin per order is `platform_fee − stripe_fee`, which is thin at low fees:

| Platform fee | Gross fee on a $100 order | − Stripe (~$3.20) | **QS net** |
| ------------ | ------------------------- | ----------------- | ---------- |
| 5%           | $5.00                     | $3.20             | **$1.80**  |
| 8%           | $8.00                     | $3.20             | **$4.80**  |
| 10%          | $10.00                    | $3.20             | **$6.80**  |

**Every commission is funded from that net.** A commission expressed as a naive
"% of the gross fee" can quietly push an order negative — which is why the
affiliate tier is **net-safety-capped** (below).

## Two tiers (told apart by `referral_codes.owner_type`)

| Tier                     | `owner_type`                                    | Who                                          | Cut                                        | Funded from  |
| ------------------------ | ----------------------------------------------- | -------------------------------------------- | ------------------------------------------ | ------------ |
| **Reseller / operator**  | anything ≠ `qs_affiliate` (e.g. `provider_rep`) | Onboards + supports + brands a whole book    | **80% of the fee**, lifetime               | the fee pool |
| **Affiliate / referrer** | `qs_affiliate`                                  | Drops a code / makes an intro (Daniel, Ryan) | **share of the fee, net-capped**, lifetime | QS's share   |

The two jobs aren't the same, so the pay isn't. An operator earns their book; an
affiliate earns an introduction.

## The affiliate formula (`lib/commerce/partner-terms.ts`)

```
affiliateResidualCents(fee, orderTotal, shareOfFee):
  desired = floor(fee × clamp(shareOfFee, 0, AFFILIATE_MAX_FEE_SHARE))   # 0..0.40
  netCap  = max(0, fee − estimateStripeFeeCents(orderTotal) − QS_MIN_NET_KEEP_CENTS)
  return  min(desired, netCap)
```

- `shareOfFee` = the code's `plan.rate`. **Default 25%** (`AFFILIATE_FEE_SHARE`);
  **founding-cohort codes ride at 35%** (Daniel & Ryan are set here).
- `netCap` guarantees QuickSites keeps at least **`QS_MIN_NET_KEEP_CENTS` (25¢)**
  after Stripe, on every order, no matter the fee. The cut scales with the fee but
  can never invert the order.
- Constants are env-overridable: `QS_AFFILIATE_FEE_SHARE`,
  `QS_AFFILIATE_MAX_FEE_SHARE`, `QS_MIN_NET_KEEP_CENTS`, `QS_STRIPE_PCT`,
  `QS_STRIPE_FIXED_CENTS`.

Wired in `markOrderPaid` (`lib/commerce/orders.ts` step 5): the attributed code's
`owner_type` decides reseller (80%) vs affiliate (formula above). Subscriptions
already honor `plan.rate` via `lib/billing/subscriptionCommission.ts`. Existing
ledger rows are never recomputed — only new orders use the tiered logic.

### Worked example (affiliate, founding 35%)

A referred café does **$10k/mo GMV** at a **6% fee** → $600 gross fee.

- Stripe ≈ 3.2% of GMV ≈ $320 → **QS net ≈ $280/mo**.
- Affiliate desired = 35% × $600 = $210; netCap = $600 − $320 − $0.25 ≈ $280 →
  pays **$210/mo**, QS keeps ~$70. (At the **default 25%**: $150 to affiliate,
  ~$130 to QS.)
- Daniel refers 10 such merchants → **~$2.1k/mo passive, lifetime** at founding,
  **~$1.5k/mo** at the standard rate. Compelling to the referrer, never
  underwater for QS.

## Growth lever: founding cohort

The "aggressive" part is a **time-boxed founding rate**: mint early evangelists'
codes at **35%** (lifetime), then the default for later codes is **25%**. Early
partners lock in high (a great story), later cohorts cost less — growth is
front-loaded without permanently capping margin. There's no special machinery:
the cohort _is_ the rate the code was minted at (set it in the Referral Codes
admin).

## Guardrails

- **Net-safety cap** (above) — QS keeps ≥ 25¢ net per order after Stripe.
- **Hard ceiling** — any affiliate share is clamped to ≤ 40% of the fee.
- **Hub overrides** (reseller recruiter) stay funded from QS's share
  (`clampOverrideShare` → ≤ `QS_FEE_SHARE`); the affiliate tier and hub overrides
  can't stack past QS's net.
- **Pitch vs. mechanics** — internally the affiliate cut is a fee-share, net-capped;
  externally we say **"a lifetime share of what QuickSites earns on their orders"**
  and show real dollars on `/referrals/dashboard`, so no one is misled on
  gross-vs-net.

## Two open items for the owner

1. **⚠️ Reseller 80% may be underwater at low fees.** At a 5% fee with QS paying
   Stripe, 80%-of-gross to the reseller ($4) exceeds QS net ($1.80). Either the
   80% should be **of net**, or resellers must set fees high enough (~8%+) to clear
   Stripe. The affiliate tier is already net-safe; the reseller tier is not, and it
   predates this doc. Decide before scaling resellers.

2. **`on_behalf_of` — implemented behind a flag (`QS_STRIPE_ON_BEHALF_OF`, OFF).**
   Setting `on_behalf_of: connectedAccountId` makes the **merchant** the settlement
   merchant of record, so **Stripe fees come out of the merchant's side, not QS's**.
   QS then keeps the full application fee, which (a) fixes the reseller-80% math and
   (b) lets us be _more_ generous on affiliate cuts. Both charge sites honor the flag
   (`lib/payments/stripe.ts`, `lib/commerce/adapters/stripeAdapter.ts`) via
   `lib/payments/onBehalfOf.ts`. Tradeoffs: changes the statement descriptor /
   merchant-of-record, dispute liability, and tax reporting for the connected
   account, and the exact fee flow depends on Connect config — so it stays **OFF in
   prod**. **To adopt:** set `QS_STRIPE_ON_BEHALF_OF=1` in a **test-mode** Connect
   account, run a charge, and confirm the balance-transaction fee lands on the
   connected account before enabling in production.

   **If `on_behalf_of` is adopted, the reseller-80% concern in (1) goes away** — QS
   keeps the full fee, so 80%-of-gross to the reseller is sustainable again. The two
   items are the same root cause (Stripe fee incidence); this is the cleaner fix
   because it doesn't reduce anyone's payout.
