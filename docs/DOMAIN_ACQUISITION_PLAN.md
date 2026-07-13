# Domain Acquisition Planner — spend a fixed budget on the *right* geo-domains

> Turn "$1000 → ~100 domains" from a hunch into a **ranked, budget-filled buy-list**.
> The pre-purchase front-end to the geo-domain land-grab.
> Companion: [`GEO_DOMAIN_MONETIZATION.md`](GEO_DOMAIN_MONETIZATION.md) (the rent model),
> [`RANKED_TARGETING_PLAN.md`](RANKED_TARGETING_PLAN.md) (post-launch rank prioritization),
> and the *businesses-near-me* bullets in [`../CLAUDE.md`](../CLAUDE.md).

Status: **Phases 1 + 2 SHIPPED (2026-07-13).** Phase 1 = the planning layer (scorer, city
seeds, batch availability, UI). Phase 2 = one-click bulk buy + campaign mint
(`POST /api/admin/prospects/buy-list/purchase`), **double-gated (admin +
`VERCEL_DOMAIN_REGISTER_ENABLED`), budget-capped, `dryRun` preview, idempotent per domain**
— OFF until the geo-engine live smoke test. Phase 3 (tracked-number + programmatic
GSC-connect on buy) is the remaining open item. The whole geo money path is flag-gated OFF
until the smoke test — see [`GEO_DOMAIN_MONETIZATION.md`](GEO_DOMAIN_MONETIZATION.md) §7.

---

## 1. The decision this answers

We can register geo-domains at ~$10–12/yr each. A fixed seed (e.g. **$1000 ≈ ~90 domains**
after fees) should buy the domains **most likely to (a) rank and (b) rent for the most**.
The two naive strategies both waste the budget:

- **`renton-<every-category>`** (city-depth) — spends ~60% of the budget on low-lead-value
  categories (salon, café) we'd never rent for real money.
- **`<every-city>-towing`** blindly (category-depth) — right instinct, but ignores *which*
  cities have the demand + soft SEO ground to actually rank.

**The play: category-depth, narrowed to a few high-ticket trades, fanned across cities,
ranked by a pre-purchase opportunity score.** This planner produces that ranked list and
fills it to the budget.

## 2. The pre-purchase opportunity score (pure, testable)

Mirrors the post-launch `rankedOpportunities` score, but for domains we **don't own yet** —
so it can't use GSC rank (there's no site). It scores each `city × industry` candidate on
the three signals available *before* buying, all already in swept-prospect data:

```
opportunityScore = leadValue × demand × winnability
```

| Factor | Source | Rationale |
|---|---|---|
| **leadValue** | `priceTier(industry).fullCents` (`lib/outreach/geoPricing.ts`) | The unlockable rent — the whole reason to prefer towing over salon. |
| **demand** | `1 + k·min(noWebsiteCount, cap)` — competing no-website businesses in that city×industry (the competition group) | More competitors with no site = likelier claim + more churn backfill. Sub-linear, capped (rents to one winner). |
| **winnability** | `1 − saturationWeight · saturation`, where `saturation = hasSite / total` in the group | Exact-match domains rank best where incumbents are weak. Low saturation = soft ground. |

`leadValue` dominates (it's dollars); `demand` and `winnability` are bounded multipliers
that reorder within a tier. Pure function, unit-tested, no I/O — the route feeds it swept
prospects; it emits a sorted `BuyCandidate[]` with the derived domain (`geoDomainFor`),
projected rent, and the score breakdown.

**Scoring v2 — map-pack strength (Niche-Finder-style weak-competition analysis).**
`winnability` also folds in **how established the incumbents are**, from the **median Google
review count** of the market's businesses (`outreach_prospects.review_count`): a "weak map
pack" (few reviews) is a softer target to rank into. `weakPackFactor = clamp(1 +
reviewWeight·(1 − 2·strength), 1−reviewWeight, 1+reviewWeight)` where `strength = medianReviews
/ (medianReviews + midpoint)` (saturating, midpoint 25). It **degrades gracefully**: no review
data → factor 1 (identical to v1). Surfaced as a **Weak/Medium/Strong "Map pack" column** +
a coverage stat.

**Populating the review data (Place Details backfill).** `outreach_prospects.rating` /
`review_count` come from Google **Place Details** (a paid Enterprise SKU), so the backfill is
bounded + throttled: `lib/outreach/placeSignals.ts` (`backfillPlaceSignals` + pure
`selectStaleSignalTargets`) refreshes only stale rows (7-day TTL), capped per run, at
concurrency 6. It **auto-runs on a discover sweep** — flag-gated `PLACE_SIGNALS_BACKFILL_ENABLED=1`,
per-sweep cap `PLACE_SIGNALS_BACKFILL_LIMIT` (default 60) — so a freshly-swept city gets
map-pack data immediately; an on-demand `POST /api/admin/prospects/backfill-signals`
(by sweep / city / industry) covers already-swept cities without re-sweeping. Needs
`GOOGLE_PLACES_API_KEY`; no-ops cleanly when unset, so the score sharpens where data exists
and never blocks where it doesn't.

**Keyword search volume (optional enrichment, flag-gated OFF).** The one Niche-Finder signal
not derivable from swept data. `lib/prospects/keywordVolume.ts` fetches monthly local search
volume per candidate (`"<city> <service>"`) from **DataForSEO** (`fetchKeywordVolumes`) and a
pure `applyKeywordVolume` folds it in as a bounded *boost* (higher-volume market → more
valuable domain; `volumeFactor = 1 + volumeWeight·strength`, `strength = vol/(vol+midpoint)`)
and re-ranks. **OFF unless `KEYWORD_VOLUME_ENABLED=1` + `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD`**
(optional `DATAFORSEO_LOCATION_CODE`, default US 2840). Costs money per batch, so it's an
opt-in "Add search volume" checkbox that only enriches the top-N; returns `{}` (unchanged
scoring) when disabled/unconfigured/on error. Surfaced as a **Vol/mo** column.

**Deliberately not in the score:** GSC rank (no site yet), on-page quality (no site yet),
review counts (a paid Places SKU, backfilled separately + often absent at sweep time — if
present later we can fold `demandProxy` in as a tiebreaker).

## 3. Budget fill

Given the sorted candidates + a `$budget` + optional per-industry caps, walk the list and
greedily accept until the budget is spent, skipping premium-priced domains (Vercel flags
`premium` — those blow the per-domain budget and rarely pencil for the aging bet). Output:
the accepted buy-list, the running total, the projected **monthly rent if all rank**, and
what was dropped (never silently truncate — `log` the cut, per CLAUDE.md).

## 4. Availability + price (batch)

Candidates are scored offline, then the top `N` (default ~120, over-fetch so budget-fill has
slack) are checked for **availability + price** via the Vercel registrar
(`checkAvailability`, `lib/domains/registrar.ts`), fanned out with bounded concurrency.
Taken / premium / over-price domains are marked and excluded from the budget fill. This is
read-only (no spend) and reuses the merged `domain-search-buy` plumbing.

## 5. City seeds

`lib/prospects/citySeeds.ts` (pure): a curated `metro → [cities]` table for the target
metros (Seattle/Renton, Boston to start) + `citiesFromProspects(prospects)` that harvests
the distinct `(city, region)` pairs already swept. The planner accepts an explicit city list
too — seeds just remove the manual typing.

## 6. Surfaces

- **Lib:** `lib/prospects/buyList.ts`, `lib/prospects/citySeeds.ts` (pure + tested).
- **API:** `POST /api/admin/prospects/buy-list` (admin-gated) — body `{ cities?, industries?,
  budgetUsd?, checkAvailability?, maxCandidates? }` → scores from swept prospects, optionally
  batch-checks availability, returns the budget-filled buy-list + totals.
- **UI:** a "Domain buy-list planner" section in `components/admin/prospects-client.tsx`,
  between the territory heat map and the geo-campaigns table — pick industries (default the
  premium set) + a budget, get the ranked list with projected domain, rent, availability,
  and a running spend/MRR tally. Each row links to the existing launch/buy actions.

## 7. Phasing

- **Phase 1 (this doc, building): the planning layer** — scorer + city seeds + batch
  availability + UI. Read-only, safe, immediately answers the budget question. No new spend
  path.
- **Phase 2 (staged behind `VERCEL_DOMAIN_REGISTER_ENABLED`): one-click bulk buy** — accept
  the buy-list → loop the existing `POST /api/domains/buy` (already admin+flag gated) per
  domain, then mint a geo-campaign per bought domain. Needs the live smoke test first.
- **Phase 3 (behind the geo flags): post-buy auto-pipeline** — on registration, auto-scaffold
  the pitch site (`buildGeoPitchSite`), provision the tracked number (`provisionTrackingNumber`,
  `CALL_TRACKING_ENABLED`), and connect the domain to GSC so the aging clock + rank
  measurement start day one. Note: **GSC property add is manual today** (OAuth over
  already-verified properties) — closing that gap (Search Console API `sites.add` + DNS TXT
  verify, feasible because Vercel-registered domains give us DNS control) is the main new work.

## 8. Guardrails

- The score is a **prioritizer, not a guarantee** — SEO isn't promised; the portfolio spreads
  the bet and the pre-rank founder rate de-risks the customer (per the rent model).
- Keep every lib function **pure + unit-tested**; keep `tsc --noEmit` green (CLAUDE.md §7/§9).
- Availability check is read-only; **no code buys a domain without the admin gate +
  `VERCEL_DOMAIN_REGISTER_ENABLED`** (Phase 2).
- `priceTier` silently falls to LOW for unrecognized industry keys — the planner only offers
  keys from `INDUSTRIES`, and defaults the industry picker to the known premium set, so a
  premium trade is never mispriced LOW by a stray string.
