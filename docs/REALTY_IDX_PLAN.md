# Real-estate IDX / MLS listings — integration plan

> How QuickSites shows **live MLS listings** on agent sites. Companion to the realty vertical
> (home_valuation / listing_alert / affordability_calculator blocks + area-guide pages, #539–542).
> Phase 1 scaffolding shipped flag-gated (`REALTY_IDX_ENABLED`, OFF). Last updated 2026-07-18.

## The headline: the gate is licensing, not code

IDX data is licensed **from an agent's MLS to that agent** (an MLS member who signs an IDX/data
agreement). QuickSites is only the **tech vendor** — we can't serve data an agent isn't entitled
to. So this is **per-agent, per-MLS onboarding + compliance**, not a generic API you flip on:

- **The long pole is paperwork/approvals** (weeks per MLS/agent), not engineering. It can't start
  without a **pilot agent** who has (or will get) IDX rights with their MLS.
- **Each MLS dictates mandatory display rules** — required disclaimers, "courtesy of" listing-office
  attribution, last-updated timestamps, prohibited uses, sold-data restrictions, opt-outs. Break
  them and the feed is revoked.
- Costs stack: **vendor API fee + each MLS's own license fee + the agent's MLS membership** (theirs).

**So the decision in front of us is not "build the code"** (~2–4 weeks, low risk, reuses our
listing blocks) — it's **"recruit a pilot agent with MLS IDX rights and accept the per-feed cost +
compliance obligation."** With a pilot agent secured, Phase 1 lights up fast.

## Providers (all RESO Web API)

| Provider                              | Vendor cost                                        | Best for                                           | Trade-off                                    |
| ------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| **Bridge Interactive** (Zillow Group) | **No vendor service fee** (MLS may charge its own) | Cheapest pilot                                     | We own compliance; per-MLS approval friction |
| **SimplyRETS**                        | **$99 one-time per feed** + monthly                | **Fastest dev experience** (clean REST/JSON, docs) | Per-feed; confirm monthly tier at signup     |
| **MLS Grid**                          | **$250/mo feed + $20/mo per license** + MLS fees   | **Scaling across many MLSs, one agreement**        | Higher fixed cost; overkill for one metro    |

Sources: [SimplyRETS](https://simplyrets.com/idx-developer-api) · [MLS Grid FAQ](https://www.mlsgrid.com/faq) ·
[Bridge API](https://www.bridgeinteractive.com/developers/bridge-api/) · [RESO Web API](https://www.reso.org/reso-web-api/).

**Recommendation:** pilot on **Bridge (free vendor fee)** or **SimplyRETS (fastest)** with ONE
agent/MLS; plan **MLS Grid as the scale path**. Monetize IDX as a **premium agent tier** (real
per-feed cost + high value) — fits the "free site, charge for premium" model.

## Architecture (reuses existing patterns)

Mirrors the DeckSketch estimate proxy / route-optimize proxy: a **server-side listings proxy** keeps
feed credentials off the browser, calls the provider's RESO Web API, and normalizes to one shape the
existing `listings_grid` / `listing_card` blocks render. New `listing_search` block for buyer search.

```
buyer → listing_search block → GET /api/realty/listings?site=<slug>&… (proxy, flag-gated)
      → resolveIdxConfig(template)  [per-agent feed: provider + dataset + token]
      → provider.search(params)     [mock | bridge | simplyrets | mlsgrid]
      → normalize → Listing[]  + compliance disclaimer/attribution
```

- **Per-agent feed config** lives on `template.data.meta.idx` (Phase 1) → a dedicated table later:
  `{ provider, dataset, token/serverToken, mlsName, disclaimer }`. Credentials never reach the client.
- **Compliance** (disclaimer + "Listing courtesy of {office}" + last-updated) is part of the
  normalized response and rendered by the blocks — non-negotiable per MLS rules.
- **Caching** respects each MLS's refresh cadence (typically 15 min–few hours); never store beyond
  the license terms.

## Phases

- **Phase 0 — licensing (weeks, ~0 eng):** recruit a pilot agent; they apply for their MLS's IDX feed
  - sign the data license. **The unlock.**
- **Phase 1 — SHIPPED (flag-gated, mock-fed):** provider-agnostic client (`lib/realty/idx/*`) with a
  normalized `Listing` type + a `ListingProvider` interface, a **mock provider** (dev without a real
  feed), a **Bridge RESO adapter** (inert until creds set), the **`GET /api/realty/listings` proxy**,
  a compliance helper, and the **`listing_search` block** (palette-only; renders a "connect a feed"
  note until configured). All behind `REALTY_IDX_ENABLED` (OFF). **Ready for a real feed by adding
  Bridge creds to `meta.idx` + flipping the flag.**
- **Phase 2 — productize (~1–2 wk eng):** per-agent feed-connect UI + credential storage table +
  upgrade **#541 `listing_alert`** from a lead form into a real saved-search matcher.
- **Phase 3 — scale:** add **MLS Grid** for multi-MLS coverage under one agreement; seed the
  listing blocks into the `real_estate` scaffold once a feed is standard.

## Compliance checklist (per MLS, before going live)

- [ ] Data license signed (agent ↔ MLS); vendor registered with the provider.
- [ ] Required disclaimer text + listing-office attribution rendered on every listing + results page.
- [ ] Last-updated timestamp shown; refresh cadence honored.
- [ ] Prohibited uses respected (no scraping/reselling; sold-data rules; agent opt-outs).
- [ ] Only the licensed dataset/geography served.
