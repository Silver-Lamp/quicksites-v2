# QuickSites — Monetization Revenue Review

> Build-vs-gap analysis of the two monetization models, so we can pick a lead path with numbers in hand.
> Companion to [`../CLAUDE.md`](../CLAUDE.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md).
> Reviewed: 2026-06-26 (grounded in `supabase/migrations/2025082*` + a code audit of the money path).

> **DECISION (2026-06-26): Model A (e-commerce slice) is the locked lead.** Execution plan with tickets: [`MODEL_A_PLAN.md`](MODEL_A_PLAN.md). Model B (white-label/partner) follows on the same `commission_ledger`. The rest of this doc remains the build-vs-gap reference behind that call.

## TL;DR

**The monetization machine is ~50% built, not a blank page.** The Open Commerce schema is well-designed and the order→Stripe→fee→ledger path largely exists in code. The gaps are concentrated in **settlement, automated payouts, and a working end-to-end storefront demo** — i.e., the "last mile" of actually moving money and proving it.

| Model | Maturity | Biggest gap | Effort to first real dollar |
|---|---|---|---|
| **A. Free hosting + e-commerce slice** | **~60%** | Platform-fee *settlement/reconciliation* + Connect onboarding consolidation | **~1–2 weeks** |
| **B. White-label / partner resell (Dwayne)** | **~45%** | Automated commission approval + actual payout disbursement | **~2–4 weeks** |
| C. Live vertical (chefs/meals storefront) | ~20% | No wired public checkout demo | (proof vehicle for A) |

Recommendation rationale at the bottom (§4) — but the decision on which to *lead* is yours; this gives you the build-vs-gap to decide.

---

## Model A — Free hosting + e-commerce slice

**Thesis:** hosting is ~free; QuickSites takes a % of every order a merchant processes (`platform_fee_percent`, `platform_fee_min_cents` → `orders.platform_fee_cents`), collected via Stripe Connect.

### Built ✅
- **Order creation with fee math.** `lib/commerce/orders.ts#createDraftOrder` computes `platform_fee_cents` from the merchant's `payment_accounts` config. Orders persist with line items.
- **Stripe Checkout + Connect intent.** `lib/commerce/adapters/stripeAdapter.ts` / `lib/payments/stripe.ts` build sessions with `application_fee_amount` + `transfer_data` (the correct Connect pattern for taking a fee).
- **Payment webhook → paid.** `app/api/commerce/webhooks/stripe/route.ts` → `markOrderPaid()` records a `payments` row and flips order status.
- **Merchant fee config UI.** `app/merchant/payments/page.tsx` writes `collect_platform_fee` / `platform_fee_percent` / `platform_fee_min_cents`.
- **Cart/checkout UI.** `app/cart`, `app/checkout`, `components/cart/*`.
- **Attribution capture.** `middleware.ts` writes `qs_ref`; `lib/commerce/attribution.ts#ensureAttributionForMerchant` binds it.

### Missing / stubbed ⛔
1. **Connect onboarding is split-brained.** A newer path writes `payment_accounts`; an older `app/api/connect/onboard` writes a deprecated `merchant_payment_accounts` table. **Pick one (`payment_accounts`), delete the other.** *(S)*
2. **Fee settlement/reconciliation.** `application_fee_amount` is sent to Stripe, but there's no job that reconciles platform revenue (Stripe `application_fee` objects ↔ our `orders.platform_fee_cents`) or surfaces "QS earned $X." *(M)*
3. **Refund → fee reversal.** `charge.refunded` is received but platform-fee reversal isn't implemented. *(S–M)*
4. **No green-path E2E demo** proving create-item → buy → merchant-paid → QS-fee-collected with test keys. *(M)*

### To first real dollar (~1–2 wks)
1. Consolidate Connect onboarding on `payment_accounts`. *(S)*
2. Stand up one real merchant in Stripe **test** mode; run a live order through Checkout end-to-end. *(S)*
3. Add a **platform-revenue reconciliation** view/job (sum `application_fee` from Stripe, match ledger). *(M)*
4. Implement refund fee-reversal. *(S–M)*
5. Ship a seeded demo storefront as the repeatable proof. *(M)*

---

## Model B — White-label / partner resell (Dwayne's network)

**Thesis:** partners (resellers/agencies) sign up merchants under their own brand and earn **residual commissions**. Powered by `referral_codes` (`owner_type` = `provider_rep` | `qs_affiliate`), `attributions`, `commission_ledger`, `payout_runs`, and the affiliate-tax tables.

### Built ✅
- **Referral code creation.** `app/api/referrals/create-code` writes `referral_codes` with a `plan` JSON (percent/flat + `duration_months`).
- **Attribution + locking.** `lib/commerce/attribution.ts` binds a merchant to a code on first touch and locks on first revenue (`locked_at`).
- **Commission accrual on revenue.** `markOrderPaid()` writes a `commission_ledger` entry (`subject = order_platform_fee`); `app/api/billing/webhooks/stripe` writes one for `qs_subscription` on `invoice.payment_succeeded`, respecting the plan window.
- **Manual payout workflow.** `app/api/referrals/mark-paid` (pending→paid by code/date), `app/api/referrals/payout-runs` (audit), `app/admin/referrals/*` dashboard + `PayoutWizardClient`.
- **Tax scaffolding.** `affiliate_tax_profiles` / `affiliate_payouts` / `affiliate_1099_filings` tables; `app/api/tax/iris-export` emits a 1099-NEC CSV for IRIS e-file.

### Missing / stubbed ⛔
1. **Commission approval is manual only** — no rule moving `pending → approved` (e.g., after refund window). *(M)*
2. **No actual disbursement.** `affiliate_payouts` is schema-only; `mark-paid` just flips `commission_ledger.status`. No Stripe `Transfer`/`Payout` or ACH call moves money to partners. *(L)*
3. **Reconciliation gap.** No check that `payout_run` totals equal `SUM(commission_ledger WHERE status='paid')`. *(S)*
4. **White-label productization.** Org theming (`organizations_public`) exists, but there's no **partner self-serve onboarding** (partner signs up → gets a code + branded portal + dashboard) — today it's admin-operated. *(L)*
5. **1099 last mile.** CSV export only; no form generation/furnishing to recipients. *(M, seasonal)*

### To first real partner payout (~2–4 wks)
1. Partner onboarding flow: create partner → issue `referral_code` → branded signup link. *(M)*
2. Automated commission approval rule (post-refund-window). *(M)*
3. **Disbursement** via Stripe Connect `Transfer`/`Payout`, writing `affiliate_payouts`. *(L)*
4. Reconciliation check + dashboard number. *(S)*

---

## Model C — Live vertical (chefs/meals) as the proof vehicle

`app/chef(s)`, `app/meals`, `app/merchant` are a meal-marketplace UI on top of Open Commerce (~20% wired; storefront checkout not connected; an old `app/api/public/checkout` is commented out). **Don't treat this as a third business** — treat it as the **seeded demo** that proves Model A end-to-end. Finishing its checkout *is* step 5 of Model A's plan.

---

## Effort legend
S ≈ ≤1 day · M ≈ 2–5 days · L ≈ 1–2 weeks. Estimates assume one focused dev + the existing schema (no DB redesign needed).

## §4 — Reading the table (recommendation, your call to make)
- **If the goal is "prove revenue fastest,"** lead with **Model A**: it's closer to done, self-serve, and you own the customer. The critical work is settlement + a demo, both ~1–2 weeks.
- **If Dwayne already has channel partners ready to resell,** the constraint isn't code maturity — it's the **disbursement + partner-onboarding** build (Model B's L-items). Lead with B *only if* there are named partners waiting, because the payout/onboarding work is heavier.
- **Pragmatic sequence most likely correct:** finish **Model A settlement + demo** (it also exercises the ledger that Model B rides on), then layer **Model B disbursement + partner onboarding** on the now-proven money path. Model A de-risks Model B.

> Next concrete artifact when you pick a lead: a ticketed checklist from the relevant "To first dollar/payout" list above, wired to PostHog funnel events so we can watch activation → first order → attributed payout.

---

## Partner offer — locked terms (2026-06-26)
The reseller offer (page: `/partners`; config: `lib/commerce/partner-terms.ts`):

- **Free hosting** for merchants — no per-site charge.
- Partner sets each merchant's **per-order fee, up to 10%** (`QS_MAX_PLATFORM_FEE_PERCENT`,
  enforced in `app/merchant/payments` + clampable everywhere via `clampPlatformFeePercent`).
- On every order, the **partner keeps 80%** of that fee; **QuickSites keeps 20%**
  (`QS_PARTNER_FEE_SHARE`).
- **Lifetime residual** (`QS_RESIDUAL_MONTHS=0`) — earned on every order their merchants
  process, ongoing.

**Wiring:** `markOrderPaid` writes the partner's 80% share to `commission_ledger`
(`partnerCommissionCents`), tagged with the order's `platform_fee_cents` and share for
audit. QuickSites' 20% is the platform's net (the difference). All three values are
env-overridable, so the offer can be tuned without code.

**Worked example:** a $100 order with an 8% partner fee → $8.00 platform fee →
partner $6.40, QuickSites $1.60 — on every order, for the life of the merchant.

### Partner payout pipeline (built + verified 2026-06-26)
Completes the money loop (`lib/commerce/payouts.ts`):
1. **Approve** — `POST /api/admin/partners/payouts/approve` moves commissions
   `pending → approved` once older than `QS_REFUND_WINDOW_DAYS` (14).
2. **Run** — `POST /api/admin/partners/payouts/run` ({dryRun?}) groups approved
   commissions per partner, transfers their residual (real Stripe Connect transfer
   when the partner is connected via `partner_payout_accounts`, else a `manual`
   record), writes `affiliate_payouts`, marks commissions `paid`, and audits a
   `payout_runs` + `payout_run_items`. Admin-gated (`lib/auth/getAdminUser.ts`).

Verified: 2 approved commissions → one $5.04 payout, commissions `paid`,
`affiliate_payouts` + `payout_runs` written. **Remaining for real cash:** partner
Stripe Connect onboarding (write `partner_payout_accounts.account_ref` so transfers
go to the partner's account instead of a manual record).
