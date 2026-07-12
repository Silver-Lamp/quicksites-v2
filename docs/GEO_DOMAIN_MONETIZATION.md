# Geo-Domain Monetization — renting ranked local domains to service businesses

> How the "businesses near me" fan-out (`/admin/prospects`) + the exact-match geo-domain
> land-grab (`geo_industry_campaigns`, e.g. `boston-towing.com`) becomes a revenue line.
> Companion: [`MONETIZATION.md`](MONETIZATION.md) (take-rate), [`PRICING_REDESIGN.md`](PRICING_REDESIGN.md), and the *businesses-near-me* / *geo-domain land-grab* bullets in [`../CLAUDE.md`](../CLAUDE.md).

Status: **strategy + first build (GSC rank column)**. Billing not yet built.

---

## 1. The core reframe: services are lead-gen, not commerce

The platform's default monetization is an **e-commerce take-rate** (a % of each Stripe
order). That works for the restaurant/ordering vertical (delivered.menu) because money
moves *through* the system. It **cannot** work for most service trades (towing, plumbing,
HVAC, roofing…): the "conversion" is a **phone call or form fill**, and payment happens
**offline** (cash/invoice). There is no transaction to skim, and policing offline payment
is a losing game.

**So monetize the asset you control, not the transaction:**

- The **asset** = a ranking exact-match domain + the site on it.
- Your **leverage** = the domain pointer. The site is a QuickSites template; the domain
  lives on QuickSites' registrar/Vercel. Stop-paying → repoint to the runner-up in the
  contest. (This is already how the architecture works: domain attached to our project,
  `templates.slug == apex label`, served by the middleware rewrite.)

**Golden rule: rent, don't sell** (for the recurring line). Renting keeps the leverage
that makes flat monthly fees *collectible*. Selling the domain is a separate, premium,
one-time path that forfeits the leverage.

---

## 2. Pricing menu

| Model | Fit | Notes |
|---|---|---|
| **Flat monthly rent** | **Default for services** | Predictable MRR, trivial to sell, solves offline-payment. Start here. |
| **Pay-per-lead (PPL)** | High-ticket trades, later | Angi/Thumbtack model. Needs call tracking + attribution. Higher upside, more ops. |
| **Rank-gated pricing** | The differentiator | Token/free rate until it ranks, auto-steps to full rate on page 1. GSC verifies the trigger. |
| **Buy-out** | Rare, premium | One-time to own the exact-match domain. Bank a lump; forfeit recurring + leverage. |

**Recommendation:** lead with **flat monthly rent**, tiered by **lead value × city size ×
rank status**, with **call tracking** layered on as the proof/retention engine and an
optional **PPL** upgrade later.

Price by the **value of a lead**, not our cost — and we already have `industryKey` to tier:

- **Premium trades** (towing, plumbing, HVAC, roofing, water-damage/restoration, garage
  door, locksmith): a job is $150–$5k → **$200–600/mo** or **$20–75/call**.
- **Mid** (electrician, landscaping, pest, auto): **$99–249/mo**.
- **Low-ticket** (salon, café): flat cheap rent, or push to the commerce/ordering path.

---

## 3. The ranking arbitrage (the real unlock)

The fan-out mass-produces geo-domain sites at near-zero marginal cost. Let them age and
rank passively. Every domain is then **inventory at a stage**:

```
raw land (unranked) → ranking → page 1 → rented → (churn → re-rent to runner-up)
```

This yields **two pricing windows**:

- **Pre-rank "founder rate" (lock-in):** *"boston-towing.com isn't ranking yet — grab it
  now at $99/mo, locked for life. Once it's on page 1 it lists at $399."* Monetizes even
  unranked inventory and locks the customer **before a competitor and before we've done
  the expensive part (ranking).**
- **Post-rank premium (proof):** *"renton-plumbing.com is #3 for 'plumber near me,' ~320
  impressions/mo, 28 clicks — $399/mo."* Receipts justify the premium to a fresh prospect.

**Killer offer — the rank guarantee:** pay a token rate until it hits page 1, then it
**auto-steps** to the full rate. GSC proves the trigger, so it's honest, and it inverts the
risk narrative (they feel they're getting an appreciating asset cheap).

This is a **compounding SEO-asset portfolio**, not "we sell websites." Build 1,000 geo-sites,
~15% rank, those ~150 become rentable assets that sell themselves; the pre-rank pitch
monetizes the rest.

---

## 4. The two proof engines (build these first — they convert + retain)

Both data spines already exist in the repo:

1. **GSC rank + traffic** (`/api/gsc/summary`, `/admin/gsc/*`): position / impressions /
   clicks per geo-domain → the "which have we ranked" UI **and** the auto-step-up trigger.
2. **Twilio tracked call number** (`lib/sms`, `call_logs`, existing Twilio call routing):
   a forwarding number on every geo-site **from day one** (before it's sold). "We sent you
   47 calls last month" is simultaneously the **sales proof**, the **PPL meter**, and the
   **anti-churn moat** (cancel → calls stop).

---

## 5. Other levers

- **The contest is an exclusivity auction.** One payer per domain; scarcity is the pricing
  power. "First to claim wins" is v1; letting the competing businesses *bid* for the slot
  is a v2.
- **Monetize the losers.** Each competition card surfaces ~5 prospects; the runner-ups go
  on a waitlist ("you're next if the winner lapses") or buy their own branded secondary
  site. Don't waste 4 of 5.
- **Bundle beats "a website."** Domain + site + call tracking + review requests + Google
  Business Profile help = a "Get Found" package. Higher perceived value, stickier, premium.
- **Let reps sell it.** The hub-override/referral rails can pay local salespeople a cut of
  the MRR — turns the portfolio into a channel play.

---

## 6. Risks / guardrails

- **Never transfer the domain in the rental path** — it's the churn leverage. Buy-out is a
  separate product.
- **SEO isn't guaranteed** — the pre-rank discount de-risks for the customer; the portfolio
  spreads the bet for us.
- **Quality / trust:** a ranked site routing to whoever pays can read as bait-and-switch.
  The claim flow already makes the live site genuinely represent the paying business —
  keep it that way.
- **Exclusivity accounting:** one active payer per domain; runner-ups are the churn backfill.

---

## 7. Build order

1. **GSC rank + traffic column** on the geo-campaigns table (position/impressions/clicks +
   a `rank_status` badge). Powers "which have we ranked." *(first piece — in progress)*
2. **Tracked Twilio number per geo-site** + a call count on the campaign row.
3. **Pricing fields** on `geo_industry_campaigns` (`pricing_model`, `price_cents`,
   `billing_interval`, `locked_rate`, `rank_status`) + a **Stripe subscription** for the
   rent (separate from the commerce take-rate) + the rank-gated auto-step-up job.
