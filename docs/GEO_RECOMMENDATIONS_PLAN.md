# Geo-Domain Recommendations — "Next steps" on the ranking + campaigns pages

> Turns the geo-domain campaigns (`geo_industry_campaigns`) into an advisor: for each
> campaign it computes **two dimensions** of next-steps and surfaces them on
> `/admin/prospects` + the template editor banner.
> Companion: [`GEO_DOMAIN_MONETIZATION.md`](GEO_DOMAIN_MONETIZATION.md), [`MONETIZATION.md`](MONETIZATION.md), [`RANKED_TARGETING_PLAN.md`](RANKED_TARGETING_PLAN.md) (the GSC-rank-aware "Ranked & ready" worklist + refine-before-postcard gate that consume these recommendations).

Two dimensions:
1. **Grow the ranking** — local-SEO recommendations (reviews, on-page, organic position).
2. **Work the lead** — the single next-best outreach action (postcard / SMS / call / email
   / wait / stop), timing-aware.

---

## 1. Signal inventory (have vs. need)

Local rank ≈ relevance × prominence × proximity. We move relevance (on-page) + prominence
(GBP reviews/categories); proximity is fixed.

| Tier | Signal | Source | Status |
|---|---|---|---|
| GBP / prominence | rating, review count, category, business_status | Places **Place Details** (public, keyed on stored `place_id`) | pulled into Phase 1 (paid SKU — throttled) |
| Organic | position, impressions, (clicks/CTR) | GSC rank-sync | position ✅; CTR needs clicks + history (P2) |
| On-page | LocalBusiness schema, city/service pages, NAP, click-to-call, title/meta | pitch site `template.data` (no external call) | ✅ Phase 1 |
| Conversion | tracked-call volume | `call_logs.geo_campaign_id` | ✅ |
| Intent | claim-link visits | new `/r/<campaignId>` redirect → `claim_link_visits` | ✅ Phase 1.5 (in this build) |
| Outreach history | `postcard_sent_at`, `sms_sent_at`, claimed, subscription | prospects/campaign | ✅ |

**Not doing:** live SERP/local-pack scraping (ToS), owner GBP API (needs the business to
connect OAuth — post-rental only). We approximate the local pack from the competition
roster + Places prominence.

## 2. Data model
- `geo_industry_campaigns.recommendations jsonb` (+ `recommendations_synced_at`) — computed
  `{ ranking: Rec[], nextAction: NextAction }`.
- `geo_industry_campaigns.claim_link_visits int` — intent counter.
- `outreach_prospects.rating`, `review_count`, `place_signals_synced_at` — GBP prominence
  (winner + roster, for the review benchmark). Throttled refresh (weekly).

## 3. The two engines (pure, testable — `lib/outreach/*`)

**`recommendations.ts` — `buildRankingRecommendations(input): Rec[]`.** Deterministic rules,
each `{ id, category, priority, title, detail, cta? }`, priority = impact × nearness-to-threshold:
- Reviews: `review_count` < top-3 roster avg → "Get to ~N reviews (you have X)"; rating < 4.2 → "Lift rating".
- Organic: position 11–20 → "One push from page 1 — add city/service pages + schema"; high impressions + position >10 → same.
- On-page: no LocalBusiness schema → "Add schema"; no `/<city>-<service>` page → "Add it"; no NAP/click-to-call → "Add tap-to-call".
- Conversion: impressions>0 + calls==0 (tracking on) → "Strengthen the CTA".
- Commercial: page 1 + founder rate → "Step-up due"; high calls + mid rank → "Upsell / PPL".

**`nextAction.ts` — `nextOutreachAction(input): NextAction`.** One campaign-level action +
reason + timing. Cadence:

| State | Action |
|---|---|
| draft built, no touch | `send_postcard` (tangible first touch) |
| postcard < ~7d ago | `wait` (next-eligible date) |
| postcard ≥ 7d, silent | `send_sms` (if phone + enabled) |
| rank→page1 / calls spiking / claim-link clicked | `reach_out_now` with proof |
| postcard+sms sent, ≥ ~30d, silent | `cold` → runner-up / archive |
| claimed, not rented | `rent_pitch` (email if available, else call) |
| rented + healthy | `nurture` (nothing) |

Properties: **proof-aware** (cites call count/rank), **cost-aware ordering** (postcard →
SMS → call → email), **wait/stop are first-class**. Email only when an address exists +
consented (Places gives no email for cold prospects → warm/claimed stages only).

Optional later: a metered-LLM pass that phrases/prioritizes the top 3, grounded strictly in
the deterministic rule outputs (rules stay the source of truth).

## 4. Compute / sync
`computeCampaignRecommendations(campaignId)` gathers signals (template `data` for on-page,
roster for reviews + outreach history, `call_logs` count, GSC rank, throttled Place Details)
→ runs both engines → stores the jsonb. Called from the existing **`geo-rank-sync` cron**;
Place Details refresh is throttled by `place_signals_synced_at`.

## 5. UI
- **Campaigns table** (`/admin/prospects`): a **"Next steps"** count badge per row; the
  expandable row shows two labeled groups — **Grow the ranking** + **Work the lead** (the one
  next action + one-tap Mail/Text/Rent button, or "wait until …").
- **Editor banner**: top ranking rec + the next action.

## 6. Constraints
Place Details rating/reviews is a paid SKU → throttle + cache (weekly). LLM stays advisory +
grounded. All best-effort; recs never block.

## 7. Phasing
- **Phase 1 (this build):** both engines (on-page + GSC position + calls + **review
  benchmark**), `recommendations` jsonb, cron compute, claim-link click tracking, two-group
  Next-steps UI. Unit-tested pure engines.
- **Phase 2:** `geo_rank_history` (trends: position improving, impressions↑/CTR↓), richer GBP.
- **Phase 3:** connected-GBP deep signals (post-rental), LLM 3-step synthesis, optional SERP API.
