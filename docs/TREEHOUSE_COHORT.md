# Treehouse cohort — status, and the two things that decide it

**Status: supply researched, three states clear the bar, pages built, no domains bought.** The
market is confirmed open. The only blocker is `DOMAIN_REGISTRANT_*`, not the research.

**Buy list — 4 domains, $45.00:** `customtreehousebuilders.com` (national hub) plus
`californiatreehousebuilders.com`, `northcarolinatreehousebuilders.com`,
`washingtontreehousebuilders.com`. All confirmed available at $11.25 on 2026-09-22.

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

### Coverage after the research pass (14 builders, 10 read first-hand)

| state | coverage | who | verdict |
|---|---|---|---|
| **CA** | 3 | O2 Treehouse (Oakland) · ArtisTree · Barbara Butler (Hayward) | buy |
| **NC** | 3 | Creative Treehouse Design (Weaverville) · **World Treehouses (Asheville)** · Treehouse Experts *names NC* | buy |
| **WA** | 2 | Nelson Treehouse (Fall City) · Wild Tree Woodworks (Seattle) | buy |
| NY | 1 | Buffalo Treehouse (Romero Studios dropped) | **no** |
| **TN** | 1 | Treehouse Experts *names TN*; nobody based there | **no** |

**New York dropped, 2026-09-22.** Romero Studios' own site is a near-empty redirect page stating no
base, no service area and no work; its New York City base came from third-party profiles, never
from them. A directory entry sending a buyer to a stub is worse than no entry, so they are in
`EXCLUDED_BUILDERS` with the reason rather than deleted — an absent entry looks like an oversight,
and writing down that it was a decision is the only cure. That takes NY to 1, below the bar.

⚠️ **Tennessee rests entirely on one travelling firm** naming it in a sentence. There is no builder
based in the state. That is the "near me" promise unkept, and it is a no.

⚠️ **A Places sweep measures who is listed a certain way, not who exists.** World Treehouses of
Asheville ranks **first organically** for `treehouse builder asheville nc` and Google's own AI
overview names them — and the state sweep that returned an alpaca farm and a clothing store missed
them completely. They were found by READING A SERP during the hand check, which is an argument for
running the manual rows on any cohort before concluding its supply is thin.

⚠️ **Two entries still have no first-hand read.** ArtisTree refused a TLS connection on 2026-09-22,
and Cape Cod Treehouse's own site says it is still in development. California clears the bar
without ArtisTree, so nothing hangs on it — but the entry is marked weak.

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

## The pages are built (not published)

`lib/treehouseBuilders/buildHubSite.ts` renders both from the same registry:

- **`buildHubSite()`** — the national list, alphabetical, every entry with its source, the date it
  was read, and a marker when we have not confirmed it with the company.
- **`buildStateSite()`** — the same for one state, and `stateSubtitle()` carries the honesty:
  *"2 builders are based in Washington"* vs *"No treehouse builder we found is based in Tennessee.
  This company names Tennessee as somewhere they build."* The second must never read like the first.

⚠️ **`stateSubtitle` takes the state NAME and the CODE.** The first cut took only the name and
passed it to `buildersForState`, which matches two-letter codes — so "Tennessee" never matched
"TN" and **every state page claimed no builders**, coverage notwithstanding. A test caught it.

⚠️ **A builder's first person is fine when quoted and attributed.** The voice test strips
`They say they work: "…"` spans before checking, because Treehouse Experts' own *"we build all
over North America"* is their sentence shown as theirs. What survives the strip is the page
speaking as a business, which is what must never happen.

## Open

1. Read the remaining builders' own sites (ArtisTree refused TLS on 2026-09-22 — retry).
2. `DOMAIN_REGISTRANT_*` are absent from `.env.local`, so no purchase can run. ⚠️ WHOIS registrant
   data is public unless privacy is on — use the business address, and check what the dome domains
   already expose.
3. No lead-magnet tool fits this niche (the probe scored `toolFit: none`). DeckSketch is the
   nearest neighbour — an elevated-structure estimator would be a mesh conversation, not a build.
