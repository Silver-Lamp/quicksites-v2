# QuickSites — Competitive Landscape

> Where QuickSites sits against the market, who actually threatens us, and the gap punch-list to win our niche.
> Companion to [`../CLAUDE.md`](../CLAUDE.md), [`MONETIZATION.md`](MONETIZATION.md), and [`PRICING_REDESIGN.md`](PRICING_REDESIGN.md).
> Reviewed: 2026-07-01 · grounded in a code audit of the money path + market research (links inline).
> **Punch-list status (§8): all tiers shipped** — Tier 0–3 items are ✅ below; the full white-label surface (Tier 1.5) is scoped + built in [`WHITE_LABEL_PLAN.md`](WHITE_LABEL_PLAN.md).

---

## TL;DR

**Our real competitive set is GoHighLevel and Duda — not Square or the AI builders.** Square is a payment rail we ride on; AI builders (Durable, Wix AI) commoditize a feature we have. But GHL and Duda are fighting for the *same agency/reseller dollar* our entire `commission_ledger` is built around.

**The one fact that defines our wedge:** *neither Duda nor GoHighLevel monetizes the merchant's transaction volume.* Duda takes **0%** on store sales; GHL has essentially **no ecommerce**. Both monetize **flat agency SaaS seats**. QuickSites' **take-rate + lifetime reseller residual** is the revenue model both leaders have structurally chosen not to build.

**The catch:** each beats us where we're weakest. Duda has a mature storefront + polished self-serve white-label (the exact things our Model A must *prove*). GHL has a proven $497 rebrand-and-resell motion at scale. We sell a better *model*; they sell a finished *product*. The model is the moat — the proof is the prerequisite (see [`MONETIZATION.md`](MONETIZATION.md)).

---

## 1. What QuickSites actually is

Not a generic website builder — a **schema-driven site builder fused with a multi-tenant commerce take-rate engine and a reseller/affiliate residual system**. Three things most competitors do only one or two of: **build the site, take a cut of commerce, and pay residuals to a reseller channel.**

- **Site builder** — schema-driven blocks, AI copy/image gen (hero/services/FAQ), industry scaffolds, dark-mode default, subdomain + programmatic custom-domain provisioning (Namecheap + Vercel).
- **Open Commerce** — Stripe Connect checkout with a platform fee in `application_fee_amount` (~60% built), order/fee math, paid webhooks, refund fee-reversal, reconciliation.
- **Reseller/residual engine** (the differentiated part) — partner sets a per-order fee up to 10%, **keeps 80%, QuickSites keeps 20%, lifetime residual**; approve → payout → Stripe-transfer loop + 1099 scaffolding.
- **Print-on-demand + author sites** — Lulu (books) + Gelato (apparel/posters) firing from `markOrderPaid`.
- **Agency billing** — per-user + per-site tiers, fee-exemption, margin-aware fees.

## 2. The competitor map — by the axis on which each threatens us

| Category | Player | How they monetize | Threat to us |
|---|---|---|---|
| **Agency site builder** | **Duda** | Flat per-site SaaS ($149/mo white-label) | **Direct** — same agency audience, mature builder |
| **Agency CRM/SaaS resale** | **GoHighLevel** | $497/mo rebrandable SaaS + usage rebill | **Direct** — same reseller dollar, CRM-led |
| Reseller marketplace | Vendasta | Resell 3rd-party tools; margin shrinks w/ clients | Indirect |
| Commerce / payments | Square | 2.9%+30¢; $0/$49/$149 tiers | Adjacent rail (we ride Stripe) |
| AI site builders | Durable, Wix AI, Hostinger | Flat subscription | Commoditizes our AI feature |
| Print-on-demand | Lulu, Gelato | Print/ship cost | **Partners, not competitors** (we embed them) |

Detail on Square / AI builders / Vendasta is in §6. The deep dives that matter are Duda and GHL.

## 3. Duda — deep dive

**Who:** web pros + agencies building *for clients* (18,000+ agencies). Best-in-class editor, cleanest white-label.

**Pricing (2026):** Basic $19 · Team $29 · Agency $52 (4 sites) · **White Label $149/mo** (4 sites), ~$17/extra site. eCommerce add-on *per site*: Standard $8 · Advanced $22 · Elite $52/mo ([Duda eComm pricing](https://www.duda.co/ecommerce/pricing)).

**The economic gap that matters:** Duda takes **0% on store transactions** ([native ecommerce](https://www.duda.co/features/native-ecommerce-features)) and dropped Client Billing transaction fees in 2023. Its *entire* revenue is flat per-site SaaS. The agency's money is a **manual markup spread** — pay $149, resell at ~$49/site, pocket the difference ([reseller markup](https://creatingawebsitetoday.com/duda-pricing/)). Duda's agency earns the same whether the client does $0 or $1M in sales. **Ours scales with GMV.**

**Where Duda beats us:**
- **Storefront maturity** — up to 20,000 products (Elite), automated tax/shipping, subscriptions/memberships, multiple gateways (Stripe, PayPal, Square, Mollie, Authorize.net). Ours is ~60% built, Stripe-Connect-only, unproven E2E.
- **White-label** — entire surface rebrands (editor, dashboard, client login, auto-emails, support portal, custom CSS/HTML); built-in Client Billing. Ours is partial + admin-operated.

**Where Duda is weak vs us:** no take-rate, no residual/affiliate channel, Client Billing is Stripe-only + one card per account, no print-on-demand, no commission ledger. **AI limitation:** "Copilot cannot complete actions related to the canvas, such as adding a widget or section" — their AI writes *into* a human-driven editor; ours seeds whole sites via scaffolds.

## 4. GoHighLevel — deep dive

**Who:** marketing agencies reselling an all-in-one CRM + marketing + funnel/site stack as **their own rebranded SaaS**. Closest analog to our Model B — but CRM-led, not commerce-led.

**Pricing (2026):** Starter $97 · Agency Unlimited $297 · **Agency Pro $497/mo** (SaaS Mode) ([pricing](https://www.gohighlevel.com/pricing)). **SaaS Mode** rebrands the whole app, sells subscriptions from the agency's site, auto-provisions sub-accounts, and **rebills usage** (SMS/email/AI/WP hosting) — rebilling-*with-markup* is $497-only. Usage stacks: voice ~$0.018/min, email $0.675/1k, WP hosting $10/site.

**The economic model:** flat $497 base, then each client is near-pure margin (resellers charge $197–$497/client/mo); margin *expands* with client count. Like Duda, GHL monetizes **recurring SaaS seats + usage rebilling — not a commerce take-rate.**

**Where GHL is far ahead:** CRM, pipelines, two-way SMS, unified inbox (SMS/email/FB/IG/WhatsApp), marketing automation, reputation mgmt, AI voice/chat, a proven $497 SaaS-resale motion at scale. If the agency's job is *marketing*, we don't compete.

**Where GHL is weak — our exact lane** ([disadvantages](https://netpartners.marketing/gohighlevel-disadvantages/), [vs Shopify](https://marketingautomationinsider.com/gohighlevel/)):
- **"No native product catalogue management, no inventory tracking, no order fulfilment workflows, no deep ecommerce integrations."** Built for *service* businesses, not product commerce.
- No commerce take-rate / GMV monetization.
- Steep learning curve (60–90 days to competence), email deliverability problems, white-label "rough edges," costs balloon with AI/usage.

## 5. Head-to-head vs QuickSites

| Dimension | Duda | GoHighLevel | QuickSites |
|---|---|---|---|
| Core identity | Best-in-class agency builder | All-in-one agency CRM/marketing SaaS | Builder + commerce take-rate + reseller residual |
| Partner monetization | Manual markup on flat seats | Resell rebranded SaaS seats + usage rebill | **80% of per-order fee, lifetime residual on GMV** |
| Commerce take-rate | **0%** | **None (no real ecommerce)** | **Platform fee via Stripe Connect** ← wedge |
| Native store depth | **Mature** (20k products, tax/ship) | **Weak/absent** | ~60% built, unproven E2E |
| Print-on-demand | No | No | **Lulu + Gelato wired** |
| White-label maturity | **Excellent, self-serve** | **Good, $497 SaaS mode** | Partial; admin-operated |
| AI | Copy/SEO (can't build canvas) | Voice/chat/copy | Generative scaffold + copy/hero |
| CRM / SMS / marketing | Light | **Dominant** | Minimal |
| Maturity / scale | Proven, 18k agencies | Proven, huge | Pre-proof |

## 6. Adjacent players (ride-on rails, not direct threats)

- **Square** — incumbent local-business checkout: free store, 2.9%+30¢ online, $0/$49/$149 tiers ([Square plans](https://squareup.com/us/en/online-store/plans)). Single-tenant; no agency/reseller layer; no site-as-a-product. We're closer to "Square Online + an affiliate network" than to Square. We ride Stripe, not replace the rail.
- **AI builders (Durable / Wix AI / Hostinger)** — fast on "prompt → site," but single-tenant, subscription, no take-rate, no reseller layer. They commoditize our AI feature, not our model.
- **Vendasta** — reseller marketplace of 3rd-party tools; margin *shrinks* as clients add products. Weaker resale economics than GHL.
- **Lulu / Gelato** — fulfillment partners we embed ([Lulu Direct](https://www.lulu.com/sell/sell-on-your-site)); the real competitor for authors is "Shopify + a Lulu plugin."

## 7. Strategic read

The defensible position is narrow and specific:

> **"Free hosting + a real store + the agency earns a lifetime cut of every sale (not a flat markup) — for product/commerce merchants (incl. authors/POD) that GHL can't serve and Duda can't monetize."**

That sentence only beats them once two gaps close (both from [`MONETIZATION.md`](MONETIZATION.md)): a **green-path E2E commerce demo** and **partner self-serve onboarding**. Until then we sell a better *model* against two finished *products*. The model is the moat; the proof is the prerequisite.

---

## 8. Gap punch-list — what to ship to win the "agency + commerce residual" niche

Ordered by leverage. Effort: S ≈ ≤1 day · M ≈ 2–5 days · L ≈ 1–2 weeks. Cross-refs to existing plans where the work is already scoped.

### Tier 0 — Prove the model (without these, the wedge is just a claim)
1. **Green-path E2E commerce demo** *(M)* — seeded merchant → create item → buy → merchant-paid → QS fee collected → partner residual accrued, in Stripe **test** mode. This is the single highest-leverage item; it converts "better model" from slide to demo. (Model A step 5 / Model C in [`MONETIZATION.md`](MONETIZATION.md).)
2. ~~**Platform-revenue reconciliation surface** *(M)*~~ ✅ — the "QS earned $X / partners owed $Y" number is now the headline of `/admin/revenue`. The prior dashboard mislabeled **gross** fees as net and dumped the commission ledger as raw statuses; the fee math is now a pure, unit-tested `summarizePlatformRevenue()` (`lib/commerce/revenue.ts`, 8 cases) that computes **QS net take** = gross fees on paid orders − the non-void partner residual (owed + paid) against them, plus a clean **partners owed** (pending+approved) vs **paid** split — scoped to the fee subject + the same window so the totals reconcile. Dashboard wired to it and linked in the admin nav (was orphaned). Per-order mismatch auditing remains in `app/api/admin/commerce/reconcile`; the aggregate Stripe `application_fee` cross-check stays a future add.
3. ~~**Consolidate Connect onboarding on `payment_accounts`** *(S)*~~ ✅ — the money story is now single-brained on `payment_accounts`. The read side already used it; the last split-brain was `POST /api/admin/payments/save-settings`, which **wrote** the dead `merchants.default_platform_fee_bps` / `sites.platform_fee_bps` columns that nothing read (setting a fee in the admin panel silently no-op'd) — rewired to write `payment_accounts.platform_fee_percent` (bps→0..1, clamped to the 10% cap), with the panel slider corrected from a 1% ceiling to the real 10% so a real fee round-trips. Deprecated table + bps columns dropped in `supabase/migrations/20260701_retire_legacy_connect_bps.sql`.

### Tier 1 — Close the white-label gap vs Duda/GHL (the reseller motion)
4. **Partner self-serve onboarding** *(L)* — partner signs up → auto-issued `referral_code` → branded signup link → branded dashboard, no admin in the loop. This is GHL's SaaS Mode bar and our biggest Model B gap.
5. **Full white-label surface** *(M–L)* — agency branding on client login, editor chrome, transactional emails, support touchpoints. Match Duda's "brand front-and-center" baseline (`organizations_public` theming → extend to auth + emails). **Scoped** into ordered, shippable slices in [`WHITE_LABEL_PLAN.md`](WHITE_LABEL_PLAN.md) — the org/brand plumbing already exists (`resolveOrg`/`OrgProvider`/`useOrgBranding`); the foundation is a missing `GET /api/org/branding` route (referenced by 4 callers) + an `orgEmailBrand()` helper, then emails → login/join → admin chrome, all gated on `billing_mode==='reseller'`.
6. **Partner-facing residual dashboard** *(M)* — live "you've earned $X across N merchants, $Y pending payout," riding `commission_ledger` + `payout_runs`. Turns the residual from backend fact into a sales weapon.

### Tier 2 — Match table-stakes storefront depth (where Duda is ahead)
7. **Storefront hardening** *(M–L)* — wire the chefs/meals checkout end-to-end (currently ~20%), add product/variant management parity for the common cases. Doesn't need Duda's 20k-product depth — needs *one credible vertical that visibly works*.
8. ~~**Refund fee-reversal verification** *(S)*~~ ✅ — confirm `charge.refunded` reverses the platform application fee cleanly. **Shipped**: the proportional-reversal math is extracted to a pure `computeFeeReversalDeltaCents()` in `lib/commerce/refunds.ts` and covered by `lib/commerce/__tests__/refunds.test.ts` (17 cases) — full/partial/floored reversals, idempotency on retried webhooks, incremental-slice math across successive partials, cooperation with `refund_application_fee:true`, the fee-cap guard, and the best-effort swallow-don't-throw contract (mocked Stripe, no network).
9. ~~**Tax/shipping basics** *(M)*~~ ✅ — automated tax + flat/zoned shipping for physical/POD orders, so author/apparel merchants aren't blocked. **Shipped**: opt-in flat shipping (#72) + Stripe `automatic_tax` on POD/physical checkouts (`QS_STRIPE_TAX_ENABLED`), with the computed tax recorded to `orders.tax_cents` in `markOrderPaid` (`parseStripeTaxTotals`, unit-tested), surfaced on the receipt, and deliberately excluded from the platform-fee basis (we take a cut of margin, not tax).

### Tier 3 — Lean into what neither competitor has
10. ~~**POD/author funnel as a flagship demo** *(M)*~~ ✅ — GHL has zero ecommerce and Duda has no print-on-demand; the Lulu/Gelato author site is a category neither can answer. **Shipped** as a repeatable green-path proof: `POST /api/admin/commerce/pod-demo` seeds an author merchant + a Lulu book + a Gelato poster, runs the real money path, and asserts the wedge — the platform fee is taken on the merchant's **margin** (printer's base cost carved out, e.g. $3.08 not $4.32 on the full price), the partner accrues an 80% lifetime residual, and a print job is queued (when `POD_ENABLED`). Mirrors the Tier 0 `e2e-demo` route. (See [`POD_AUTHOR_PLAN.md`](POD_AUTHOR_PLAN.md).)
11. **GMV-based pricing calculator** *(S)* — a "Duda charges you $149 flat; here you earn 80% of every sale" comparison page targeting agencies. Weaponize the §7 positioning. ✅ Shipped: `/partners/calculator` (interactive earnings) + a public **features-vs-competition chart at `/compare`** (QuickSites vs Duda vs GoHighLevel, honest "where they lead" section, sourced pricing) linked from `/partners`.
12. **Automated commission approval rule** *(M)* — `pending → approved` after the refund window, so payouts don't bottleneck on manual review (partly built in `lib/commerce/payouts.ts`; close the loop).

### Explicitly NOT competing on (don't chase)
- CRM / pipelines / unified inbox / SMS marketing — GHL's moat; out of scope.
- 20k-product catalog depth, dozens of gateways — Duda's moat; we need *one vertical that works*, not breadth.
- Pure "AI builds a site in 30s" UX races — commoditized; our AI is a scaffold seed, not the headline.

---

**Sources:** [Duda pricing](https://www.duda.co/pricing) · [Duda eComm pricing](https://www.duda.co/ecommerce/pricing) · [Duda native ecommerce (0% fees)](https://www.duda.co/features/native-ecommerce-features) · [Duda client billing](https://www.duda.co/client-billing) · [Duda reseller markup](https://creatingawebsitetoday.com/duda-pricing/) · [GHL pricing](https://www.gohighlevel.com/pricing) · [GHL white-label/SaaS guide](https://www.highlevel.ai/gohighlevel-white-label-guide) · [GHL disadvantages](https://netpartners.marketing/gohighlevel-disadvantages/) · [GHL review / ecommerce limits](https://marketingautomationinsider.com/gohighlevel/) · [Square Online plans](https://squareup.com/us/en/online-store/plans) · [Lulu Direct](https://www.lulu.com/sell/sell-on-your-site)
