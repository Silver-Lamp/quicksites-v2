# Serving China-facing sellers — payments plan

> Written 2026-09-16 for the first white-label inquiry from a China-based partner
> (John / 李仰昭, partner code `lyz186814444`, task `762d511d`). Stripe facts below were read
> from Stripe's own documentation on that date and are dated; re-check before acting on any of them.
> Companion: [`WHITE_LABEL_PLAN.md`](WHITE_LABEL_PLAN.md) · [`MONETIZATION.md`](MONETIZATION.md) ·
> [`COMMERCE_RUNBOOK.md`](COMMERCE_RUNBOOK.md).

## 0. The one-paragraph answer

Stripe opens **no accounts in mainland China**, and our money path is Stripe Connect end to end
(merchant onboarding, platform fee, partner payouts). So "serve China via Stripe connectors" splits
into three different problems, only one of which is code:

| Who is in China? | Can Stripe do it? | What it takes from us |
|---|---|---|
| **The buyer** (Chinese consumers paying a merchant who has a Stripe account elsewhere) | **Yes, today.** Alipay + WeChat Pay + UnionPay are Checkout payment methods on US/HK/SG/EU/UK accounts, and both support Connect **destination charges** — which is exactly our flow. | Dashboard toggle + small code (locale, CNY presentment). §2. |
| **The merchant** (a seller with only a mainland entity/bank) | **No.** No mainland Stripe accounts; Connect cross-border payouts reach only US/UK/EEA/CA/CH recipients. | An entity elsewhere (HK / SG / US via Stripe Atlas), **or** a non-Stripe payout rail with QuickSites or the partner as merchant of record. §3. |
| **The partner** (John's own commission payouts) | Same as merchant — needs an entity in a Stripe country for Express onboarding. | Manual payout rail until then. §4. |

The recommended shape is **§5: partner-as-merchant-of-record** — the partner holds one Stripe
account in Hong Kong (or the US), every one of his sellers' storefronts settles to *that* connected
account, QuickSites takes its application fee as today, and the partner splits with his sellers on
his own ledger. It is the only shape that needs **no new money rail**, and it maps onto the reseller
org + hub-override model we already run.

## 1. Facts, verified 2026-09-16 (Stripe docs)

- **Supported countries:** mainland China is not one. Hong Kong is (Stripe HK; HK ID / BRN required
  for individuals — non-HK ID numbers are refused for individual sign-ups).
  Sources: [stripe.com/global](https://stripe.com/global), [HK requirements](https://support.stripe.com/questions/requirements-for-hong-kong-based-businesses).
- **Connect cross-border payouts:** platforms in **US, UK, EEA, CA, CH** may pay connected accounts
  located in **those same regions only**. "Stripe doesn't support self-serve cross-border payouts to
  countries outside the listed regions." Not China, not HK.
  Source: [docs.stripe.com/connect/cross-border-payouts](https://docs.stripe.com/connect/cross-border-payouts.md).
- **Global Payouts** (send money to a third party's bank, US/UK platforms, 50+ destination countries,
  expanding monthly in 2026 — Taiwan and Macao were added 2026-02): we did **not** find mainland
  China on the list. **Assumed, not verified:** China is absent. Check in the Dashboard before
  promising a partner anything.
  Source: [changelog 2026-02-25](https://docs.stripe.com/changelog/clover/2026-02-25/cross-border-payouts-new-countries).
- **Alipay:** accepted by Stripe accounts in US, HK, SG, GB, CA, AU, JP, MY, NZ and most of the EU.
  Presentment `cny` from any country, plus `usd` for US/HK/SG/GB/CA. Checkout ✓ (payment mode).
  Connect: **destination charges ✓, separate charges+transfers ✓**, direct charges / `on_behalf_of`
  private preview. No disputes (customer-authenticated), refunds within 90 days, async refund status.
  Source: [docs.stripe.com/payments/alipay](https://docs.stripe.com/payments/alipay).
- **WeChat Pay:** same shape — US, HK, SG, GB, CA, AU, JP + EU; `cny` from any country, `usd` from
  the US; destination charges ✓; refunds within 180 days.
  Source: [docs.stripe.com/payments/wechat-pay](https://docs.stripe.com/payments/wechat-pay).
- **Our checkout already fits.** `lib/commerce/adapters/stripeAdapter.ts` creates a payment-mode
  Checkout Session with `transfer_data.destination` + `application_fee_amount` and **no
  `payment_method_types`** — so Stripe shows whatever the platform Dashboard enables. `on_behalf_of`
  is flag-gated OFF (`stripeOnBehalfOfEnabled`) — keep it off for Alipay/WeChat orders; it is the one
  combination in private preview.

## 2. Buyers in China — the slice that ships now (small)

Goal: a merchant with a US/HK Stripe account sells to Chinese consumers.

1. **Dashboard:** enable Alipay + WeChat Pay (+ UnionPay) on the QuickSites platform account.
   Destination charges are created on *our* account, so *our* payment-method settings govern.
   No code. **Owner action.** Stripe may ask for the business category; POD/apparel is fine.
2. **Checkout locale (code, ~20 lines):** pass `locale: 'zh'` (or `zh-HK`/`zh-TW`) to the Checkout
   Session when the site's `data.meta.locale` starts with `zh`. Add `locale` to
   `CreateCheckoutParams`; the adapter forwards it. Storefront copy is already whatever the owner
   wrote (the HICUSTOM rebuild came through in Chinese cleanly).
3. **Presentment currency (code, ~50 lines + one column):** `merchants.default_currency` is `USD`
   and written by code in ten places, never by a merchant. Make it a merchant setting
   (`/merchant/settings`, validated against a short allowlist: `USD, HKD, CNY, SGD, EUR, GBP`), and
   have `createDraftOrder` carry it. Money stays integer minor units — CNY/HKD have 2 decimals, so
   `*_cents` semantics hold. **Do not** convert prices; Stripe presents in the merchant's currency
   and the wallet shows the customer the CNY equivalent.
4. **Async payments already handled:** the webhook parses `checkout.session.async_payment_succeeded`
   / `_failed`, which is how wallet payments complete. Refund status arrives via `refund.updated` —
   `markOrderRefunded` keys on the charge; verify a wallet refund once in test mode.
5. **Shipping countries:** `QS_SHIP_COUNTRIES` (default `US,CA,GB,AU,IE,NZ`) — a cross-border seller
   shipping *to* China needs `CN,HK,TW,SG,MY` added per deployment. Env, not code.

Gate: `QS_CHINA_WALLETS_ENABLED` is **not needed** — enabling the methods in the Dashboard is the
gate, and a config-health entry (`lib/config/health.ts`) should declare the locale/currency feature
so a half-configured deploy logs loudly. Cost: none beyond Stripe's per-method fee.

## 3. Merchants in China — what we can and cannot do

**Cannot:** onboard a mainland-only seller to Stripe Connect. Not with Express, not with Custom,
not via cross-border payouts. There is no flag, key, or contract that changes this.

**Can, in three shapes:**

| Shape | Who is merchant of record | Money rail | Our work |
|---|---|---|---|
| **A. Seller gets an entity** in HK / SG / US (Stripe Atlas → US LLC) | The seller | Stripe Connect Express, as today | Zero code. Prefill `country` on `accounts.create` from the merchant's declared country (`app/api/connect/onboard/route.ts`) so HK sellers land on Stripe HK. |
| **B. Partner as merchant of record** (§5) | The partner (HK/US entity) | Stripe Connect — ONE connected account shared by all of the partner's merchants | Small: org-level payment account inheritance. |
| **C. QuickSites as merchant of record**, sellers paid out by a non-Stripe rail (Airwallex, PingPong, Payoneer, LianLian) | QuickSites | Stripe for the charge; a `PayoutAdapter` for the seller | Large, **and it is a licensing question before it is a code one** — holding sellers' funds and paying them out is money transmission. Not without counsel. |

Shape A is the honest default answer to any individual seller. Shape B is the answer to a partner
who brings many sellers. Shape C is parked: do not build a payout adapter until someone has said,
in writing, that QuickSites may hold and forward third-party funds.

## 4. Partner payouts (commissions)

`app/api/partners/connect/onboard` creates an Express account for the partner — same country
constraint. A China-based partner with no foreign entity cannot receive `commission_ledger` payouts
through `runPayouts` today. Options, cheapest first: (1) the partner's HK/US entity (needed for §5
anyway); (2) Global Payouts if Stripe adds China as a destination — check the Dashboard, don't
assume; (3) manual settlement (Wise/Payoneer) recorded against the ledger by hand — acceptable for
one partner, not a product.

## 5. Recommended: partner-as-merchant-of-record

What John described (a branded multi-seller storefront platform for Chinese cross-border sellers,
at a ~1% fee) is a **marketplace**, and we are single-merchant storefronts. The shape that fits both
sides without a new rail:

1. The partner activates a **reseller org** (self-serve, `/partners/dashboard`, PR #950) and holds
   **one Stripe account** in HK or the US, onboarded as the org's connected account.
2. Every seller site the partner builds under his org is its own `merchants` row (own catalog, own
   orders, own customers — nothing changes there), but its `payment_accounts` row **inherits the
   org's connected account**. Today `payment_accounts` is `unique (merchant_id, provider)`, so many
   merchants may already share one `account_ref`; the missing piece is an **org-level default** that
   `ensureMerchantForOwner` / the connect route copy down instead of asking each seller to onboard.
   One nullable column (`organizations.payment_account_ref`) + one read in `getMerchantPaymentConfig`
   fallback. ~150 lines + a migration.
3. QuickSites' fee stays `application_fee_amount` on each order (clamped by `partner-terms`). The
   partner's split with his sellers is **his** ledger; we give him the per-merchant revenue report
   he needs (`/partners/dashboard` already shows per-site GMV — verify it groups by merchant).
4. Buyers pay by card or by Alipay/WeChat (§2). Chinese-consumer sales settle to the partner's HK
   account in HKD/USD; he pays his sellers in CNY off-platform.
5. **Never pretend the seller is the merchant of record.** Receipts, refund policy and the storefront
   footer name the partner's entity. That is an honesty requirement, not a legal nicety.

What this does NOT solve, and must be said in the reply to John: **fulfillment** (no HiCustom
adapter — orders would be re-keyed by hand; a generic supplier webhook is a separate project),
**localization** (sites can be Chinese; the admin/editor/checkout chrome is English), and
**multi-currency per site** (§2.3 is per merchant, which under §5 means per seller site — fine).

## 6. Ordered slices

| # | Slice | Size | Gate | Owner action first? |
|---|---|---|---|---|
| 1 | Enable Alipay / WeChat Pay / UnionPay on the platform Stripe account | none | Dashboard | **Yes** — and a $1 test-mode wallet order |
| 2 | Checkout `locale` from site meta | S | — | no |
| 3 | Merchant-settable `default_currency` (allowlist) + config-health gate | S | — | no |
| 4 | `country` prefill on Connect onboarding from declared merchant country | XS | — | no |
| 5 | Org-level connected account (partner-as-MoR) | M | `ORG_PAYMENT_ACCOUNT_ENABLED` | **Yes** — needs a partner with an HK/US entity to test against |
| 6 | Reply to John with §0's table and the two country questions | — | — | **Yes** |
| 7 | HiCustom / generic supplier fulfillment webhook | L | — | Only if John's answer to §5 is yes |
| 8 | zh-CN admin + editor chrome | L | — | Only with a signed partner |

Slices 2–4 are safe to build ahead of any answer; nothing in them is China-specific — a Hong Kong
bakery or a Singapore seller needs the same three things.

## 7. What was learned building the storefront half (same day)

John's two rebuilds (FOYTEA on **Shoptop**, a Chinese cross-border storefront SaaS; HICUSTOM, a POD
supplier) came out as brochures: no Shop block, nothing saying a store had been there. Shoptop
renders its catalog in the browser (`/api/mbr/goods/list`, parameters undocumented), so no static
scrape reads it. The fix shipped beside this doc: **store detection is now separate from import**
(`lib/rebuild/storefrontDetect.ts`), product pages are crawled for JSON-LD when the homepage has
none (`lib/rebuild/importProductPages.ts`), a detected-but-unreadable store gets an **empty Shop
block + `meta.ecom.import_status='no_readable_products'`**, and the rebuild summary says so.

**Later the same day, the rendering rung shipped** (`lib/rebuild/renderedCatalog.ts`), reusing the
headless Chromium the claim-verification probe already runs on Vercel. It reads product cards off
the rendered page by shape (link + image + price). Two findings that matter for this plan:

- **hicustom.com is a store after all** — 8 products read once rendered, priced "从 ¥21.01 起"
  (from-prices, CNY). Their own image tags are broken (`src="undefined/"`), so they import
  without images. The static detector had missed it; it now recognises a goods-catalog path plus
  bare cart text (购物车).
- **FOYTEA lists no products anywhere**, not even on its "FOY select" page. It is a brand-services
  site running on store software. There is nothing to import, and saying so is the right draft.

**Currency is the seam between this and §2.3.** A CNY catalog against a USD merchant is not
provisioned; it renders as a display-only product gallery until the merchant's currency is set.
Slice 3 (merchant-settable `default_currency`) is therefore what turns a rendered Chinese catalog
into a purchasable one — the two halves meet there.
