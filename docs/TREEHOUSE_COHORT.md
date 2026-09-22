# Treehouse cohort — status, and the two things that decide it

**Status: researching supply. No domains bought.** The market is confirmed open; whether we can
fill pages honestly is still being measured.

## Why this niche

The niche probe scored treehouses joint-first (85) and the SERP check confirmed it, decisively:

| query type | searches | winnable | avg local pack |
|---|---|---|---|
| city-qualified (`treehouse builder denver`) | 7 | **7 of 7** | **0.0** |
| `near me` | 7 | 3 of 7 | 1.7 |

**Every city-qualified search has no local pack at all.** Nashville's first organic result is a
**Facebook page**. Denver's "near me" first result is a **Montessori school**. Google has nothing
good to show — which is exactly what an exact-match geo domain is for.

⚠️ **The winning queries are city-qualified, not "near me".** "Near me" triggers the local pack
and we lose it. Target `treehouse builder <city>` / `<state>`.

## The problem the measurement found

⚠️ **A Places sweep of a state does not find treehouse builders. It finds treehouse RENTALS.**
Sweeping five states returned cabins, Airbnb listings, lodging, travel agencies, a playground, an
alpaca farm, a **clothing store**, a **paper manufacturer** and a **car-repair shop** — all with
"treehouse" in the name. Filtering on the Places *primary type* rather than the name helps and is
still not enough; the final pass is a person reading the list.

Real builders **headquartered** per state, hand-verified: NC ~1 · NY ~1 · WA ~2 · CA ~1 · **TN 0**.

That kills the obvious plan. Fifteen `<state>treehousebuilders.com` pages would be empty, and
padding them with rentals is the invented-menu failure this repo has rules against.

## The plan that survives

**The trade is national.** These firms travel — Tree Top Builders is Pennsylvania-based and ranked
first organically in *both Phoenix and Portland*. That is why no local supply exists, and it is
also the way to fill a page honestly:

- **A national hub** listing every real builder with a source: `customtreehousebuilders.com`
  (available, $11.25 — the three generic `treehousebuilder(s).com` variants are taken).
- **State pages only where `stateCoverage(state) >= 2`**, counting builders *based* there plus
  builders who **themselves name that state**. `lib/treehouseBuilders/builders.ts` computes it.

### Coverage as it stands (12 builders, 7 read first-hand)

| state | coverage | verdict |
|---|---|---|
| NC | 2 | buy |
| WA | 2 | buy |
| NY · CA · TN | 1 | **short** |

⚠️ **This is a floor, not a final answer** — five entries are still directory listings whose own
sites have not been read, and any one of them may name a multi-state service area that lifts a
state over the bar. Finishing that research is what settles NY, CA and TN.

## Rules this cohort inherits, plus one of its own

- Never speak as a business. A directory is not a builder.
- Every entry carries a source and the date it was read; a directory listing is marked weaker than
  a first-hand read of the company's own site.
- `servesStates` is **only** what a company says about itself. "Around the world" (Nelson) and
  "all across the country" (The Treehouse Guys) are **not** state lists and must never populate
  one. Empty means *they have not said*, never *they do not*.
- ⚠️ **No safety, licensing or insurance claims — not even quoting a builder's own.** These are
  structures children climb into; repeating someone's safety claim on our page makes it ours.
  Link to them and let them say it. Pinned by a test.

## Open

1. Read the remaining builders' own sites (ArtisTree refused TLS on 2026-09-22 — retry).
2. `DOMAIN_REGISTRANT_*` are absent from `.env.local`, so no purchase can run. ⚠️ WHOIS registrant
   data is public unless privacy is on — use the business address, and check what the dome domains
   already expose.
3. No lead-magnet tool fits this niche (the probe scored `toolFit: none`). DeckSketch is the
   nearest neighbour — an elevated-structure estimator would be a mesh conversation, not a build.
