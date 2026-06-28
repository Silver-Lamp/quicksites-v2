# Pricing redesign — hybrid model

> Status: Phase 1 (page redesign) in progress. Decision: **hybrid** monetization.
> Last updated: 2026-06-28.

## Why we're redesigning

The old `/pricing` page sold a flat SaaS subscription (per-user + per-site) — which:
1. **Contradicted the locked strategy** (`REVIVAL_PLAN.md`: "Model A — free hosting + e-commerce take-rate" is the lead). No mention of take-rate, free hosting, or the partner 80% residual.
2. **Wasn't implemented** — checkout has a single Stripe price (`STRIPE_PRICE_PRO_MONTHLY`); no per-user/per-site metering, no tier selector, **no feature gates by plan**.
3. **Fought the new funnel** — "build free → sign up to publish" lands on a subscription paywall (conversion cliff).
4. **Conflated personas** — direct merchants and resellers crammed into one reseller-margin calculator.

## The hybrid model — three paths

| Path | Who | Pays | Backed by |
|---|---|---|---|
| **A. Build my own** (default) | Local businesses / solo | **Free** build+host+publish; **5% per order** when they sell. Paid add-ons (custom domain, AI, remove branding). | take-rate (≈60% built) + guest-build funnel |
| **B. Run sites for clients** | Agencies wanting predictable cost | **Flat subscription** ($15–19/user + $5–6/site); **no per-order fee** on this plan | existing tiers (billing not yet metered) |
| **C. Resell under my brand** | Partners / processors | Free to merchants; set fee ≤10%, **keep 80% lifetime** | `/partners` (already correct) |

### Defaults locked for Phase 1
- Public **order fee = 5%** (Path A). Min-fee floor TBD.
- Agency flat plan (Path B) **waives the per-order fee** (flat instead of %).
- Free Merchant tier publishes to a **subdomain**; **custom domain = paid add-on**.
- Free tier carries a **"Made with QuickSites"** watermark; removable as a paid add-on.
- AI Assist Pack = **$10/user/mo** (free tier gets the existing guest AI cap).

## Build gaps (so the page doesn't over-promise)
- **Path A take-rate:** order-fee compute + Stripe Connect exist; **missing settlement reconciliation + refund fee-reversal.**
- **Path B subscription:** only one Stripe price; **per-site metering + tier selector not wired** → Phase 1 presents tiers but routes to "talk to us / trial," not self-serve per-site checkout.
- **Add-ons & free-vs-paid limits:** **no entitlements/feature-gating layer exists** → needed for custom domain / branding removal / AI tiers.

## Phasing
- **Phase 1 (this):** Rebuild `/pricing` as the 3-path hybrid with accurate, shippable copy. Path A live (free + 5%); Path B tiers shown with honest CTA; Path C → `/partners`. Align CTAs to the guest funnel. *Front-end only.*
- **Phase 2:** Wire Path B billing (Stripe tier products + per-site quantity/usage metering + selector); finish Path A take-rate (settlement + refund reversal).
- **Phase 3:** Add-ons + a real plan→entitlements gate (custom domain, remove branding, AI tiers).

## Open decisions for later
- Exact order-fee % at public launch (5% assumed) + min-fee floor.
- Whether the free Merchant tier has any hard limits (pages/sites/storage) beyond branding + subdomain.
- Agency tier: keep per-user+per-site, or simplify to per-site only.
