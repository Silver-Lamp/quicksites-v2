# Niche discovery — finding SEO niches an organic result can actually win

> Two measurements, built 2026-09-22, answering one question: *not* "is there demand?" but
> **"could a website win this page at all?"** Those come apart badly, and this repo has two
> years of evidence that they do.

## The finding that motivated it

Across **92 connected domains**, 28 days to 2026-09-19: **2,903 impressions, 18 clicks, average
position 14.7.** Only 34 domains had any impressions. The geo-domain land-grab — 143 live sites,
~100 campaign domains — earned eighteen clicks.

The first query harvest (below) shows why, and it is not "we rank badly":

| query | position | impressions | clicks |
|---|---|---|---|
| `towing service near me` (bonneylake-towing.com) | **10.9** | 69 | **0** |
| `bonney lake towing` | 15.7 | 126 | 2 |
| `roadside assistance bonney lake` | 22.3 | 58 | **0** |
| `towing grafton wi` | 12.4 | 25 | **0** |

Position ~11 on a normal SERP earns a click or three per hundred impressions. Getting **0 of 69**
means the page above us is full before our result appears — three map pins, an ad, and Yelp. For
an emergency search nobody scrolls past that, ever. **Towing cannot be won with a website**, and
no amount of on-page work changes it.

Contrast the dome cohort, which works on every axis that towing fails: ~2 builders per *state*
instead of 6.4 per *city*, a buyer who plans for months instead of one standing in the rain, and
a free calculator (DomeSketch) that answers their first question.

**So the rule is: search for the STRUCTURE, not the trade.** When the thing is unusual — dome,
yurt, treehouse, storm shelter — supply is thin, the local pack starves for want of businesses to
list, the buyer researches, and organic wins the page. When the thing is ordinary — deck, fence,
roof, tow — every general contractor does it, the pack is full, and we lose.

---

## 1. GSC query harvest

**What it is.** Every Search Console call this repo made asked for `dimensions: ['page']` or no
dimension at all. We stored totals and never learned one word anyone typed. The harvest asks for
`['query']` and stores the rows.

- `lib/gsc/queryHarvest.ts` — pure: parse, window, striking-distance pick, self-lookup filter.
- `app/api/cron/gsc-query-harvest` — nightly 07:40 UTC, cron-auth, no flag (read-only at Google,
  additive here; unlike `gsc-backfill` it writes no DNS and adds no property).
- `scripts/gsc-query-harvest.mts` — the same read on demand, prints both lists. `--dry` to skip writes.
- `gsc_queries` (migration `20260846`) — one row per (domain, query, window), service-role only.

**Striking distance** = position 11–40 with ≥10 impressions, self-lookups excluded. Demand Google
has already confirmed, on a page that already exists, that we are not winning. It is the cheapest
lead in SEO because it is *measured*.

⚠️ **An average position is not a rank.** GSC averages over every impression in the window, so one
#3 and nine #40s reads as ~36. `MIN_IMPRESSIONS = 10` exists because a three-impression average is
noise; lowering it to lengthen the list only adds fiction.

⚠️ **Exclude the domain's own name.** `bonneylake-towing.com` ranking for "bonney lake towing" is
us being looked up, not demand we could win elsewhere. `isSelfReferential` drops it.

### What the first run found (2026-09-22, 31 domains with data, 292 rows)

1. **21% of all fleet impressions are people searching the owner by name.** `/sites/sandon` alone:
   **614 impressions, position 7.9, zero clicks** — the best-ranking page we own. The queries carry
   people-search `"a" or "b" or "c"` syntax, i.e. we are surfacing alongside data-broker results.
   Worth an explicit decision (lean in, or `noindex`), which is why it is written down here.
2. **Towing gets impressions and zero clicks at page-one positions** — the table above. This is the
   local pack, measured rather than assumed.
3. **Restaurant menu queries have a real pulse**: `christy's bar and grill menu` (20 impressions,
   position 11.0), `bindaas … renton menu` (31), `restaurant delivery renton wa` (15). Real people
   looking for a specific menu we actually hold.

---

## 2. Supply-density probe

**What it is.** `scripts/niche-probe.mts` sweeps Places for each candidate structure type across a
geographic spread of metros, counts local supply, and scores it.

- `lib/niches/candidates.ts` — the candidate list. `ticket`, `intent` and `toolFit` are **hand-set
  judgements**, not measurements; they are explicit so a wrong one can be argued with.
- `lib/niches/score.ts` — pure scoring, 0–100: density 40 + intent 25 + ticket 20 + tool 15.
  Density bands are anchored to **our own two cohorts**, not a rule of thumb: towing measured 6.4
  per city and loses, domes ~2 per state and works.

⚠️ **Supply density is a PROXY for local-pack strength, not a measurement of it.** Nobody has read
a SERP. Every verdict therefore says *"go read 10 real searches"* and never *"buy the domain"*.
**Superseded as a gate 2026-09-23 — see §3.** The probe answers *how much supply is here*, which is
a real question; it was only ever standing in for *can an organic result win*, which §3 measures
directly for about the same money.

⚠️ **Two controls are in the list on purpose.** Towing (known loss) must rank last or the probe is
wrong. Decks (dense, but we own DeckSketch) tests whether a tool can rescue a saturated niche.

### First run (6 metros: Seattle, Austin, Asheville, Denver, Orlando, Portland ME)

| score | per metro | empty metros | niche |
|---|---|---|---|
| 85 | 1.7 | 0/6 | **Treehouse builders** |
| 85 | 2.8 | 1/6 | Geodesic domes *(the running benchmark)* |
| 78 | 4.7 | 0/6 | **Horse barns / riding arenas** |
| 77 | 1.3 | 3/6 | **Storm shelters / safe rooms** |
| 70 | 3.2 | 1/6 | Yurts |
| 53 | 10.2 | 0/6 | Pole barns — saturated |
| 52 | 19.2 | 0/6 | Decks *(control)* — saturated |
| **0** | 23.0 | 0/6 | **Towing *(control)* — skipped on intent** |

Both controls behaved, and the live cohort landed second — the strongest evidence available that
the scorer is measuring the right thing.

⚠️ **A high count can mean a loose query, not dense supply.** `earthbag / cob / straw-bale` was
predicted thinnest and measured **16.2 per metro**, because "natural building contractor" matches
any general contractor; `sauna installer` (28.0) catches spa dealers. Before discarding a
high-scoring-on-paper niche, **read the query, not just the number** — a bad query looks exactly
like a dead niche.

---

## 3. Direct SERP sweep — what replaced the probe as the gate

**What it is.** `scripts/niche-serp-sweep.mts` runs the *real* check — the same
`lib/serp/classify.ts` a person's worksheet answers go through — across every candidate, and ranks
by green rate. One DataForSEO call per (niche × query × city), about **$0.002 each**; it prints the
count and the estimate and refuses to run without `--apply`.

⚠️ **The probe is no longer a gate — but read the next section before treating the sweep as one
either.** The probe was a cheap proxy for local-pack strength, worth having *while a SERP read was
unvalidated*. The classifier has since matched a person on four rows including a 2-entry and a
3-entry pack, and a SERP check costs less than a probe. **What the sweep then proved is that ONE
read is not a measurement** — so today neither instrument gates a purchase; a hand check does. The proxy also misled in **both** directions: `earth_natural`
read 16.2 per metro on a query that matches every general contractor, and the Places sweep missed
World Treehouses — which ranks **first** for its own query. A proxy wrong in both directions is not
worth gating on when the true measure is nearly free.

### ⚠️ The sweep ran twice and disagreed with itself. Do not rank niches on it yet.

**Two full sweeps, Austin + Denver, ~$0.40 total.** The second was run specifically to re-measure
the first. It did not confirm it.

| niche | sweep 1 | sweep 2 |
|---|---|---|
| Horse barns / riding arenas | 3/3 | 4/4 |
| Bunkers | 3/4 | 3/3 |
| Wine cellars | 2/3 | 3/4 |
| Yurts | 2/4 | 3/4 |
| **Treehouses** *(the live cohort — the control)* | **6/8** | **1/3** |
| Timber frame | 2/4 | 0/4 |
| Storm shelters | 3/7 | 0/2 |

**The control moved from 75% to 33%.** Treehouses is the cohort we bought, with four live sites and
a builder ranking first for its own query. When the instrument says the thing you know works is now
a third as good, the instrument is what moved.

⚠️ **THE CAUSE IS GOOGLE SERVING TWO DIFFERENT PAGES FOR THE SAME QUERY, AND NO AMOUNT OF
RE-READING FIXES IT.** Across both sweeps, **9 repeated queries returned a different verdict, 8 of
them across the green/skip line.** Only ONE was a short provider response. The other eight came back
the same size — and seven of them had an **AI overview in one read and a local pack in the other**:

| `treehouse builder denver` | items | `se_results_count` | `item_types` |
|---|---|---|---|
| read A → `good` | 36 | 111 | `ai_overview, organic, people_also_ask, related_searches, google_reviews, knowledge_graph` |
| read B → `skip` | 37 | 111 | `organic, local_pack, people_also_ask, related_searches` |

Same query, same location, same result count, half an hour apart. One page leads with an AI
overview and has no local pack; the other leads with a pack and has no AI overview. Both are real.
**A single read does not measure the query — it samples one of the layouts Google is serving.**

The pack sizes say the same thing: across 81 readings, **26 at pack 0 and 54 at pack 3, with
nothing at 1 or 2.** The pack is present or it is absent; it does not thin out. So `verdictFor`'s
`packSize >= 3 → skip` is, on the API path, effectively *"was a pack served to this request?"* —
and that is a coin whose bias we have not measured.

**What this costs and what it does not.** The sweep is not useless: the extremes held across both
runs (horse barns and bunkers green in both, natural pools / sport courts / skate ramps / saunas /
greenhouses / container builds 0% in both). It is the **middle of the table that is noise**, and the
ordering within the top four means nothing at n=3–4.

### The fix: a rate with an interval (`lib/serp/rate.ts`, built 2026-09-23)

The right unit is not a verdict, it is a **rate** — read a query K times and record *what fraction
of impressions showed no full pack*. That is the quantity that decides whether an organic result can
win, and it is what the binary verdict was standing in for all along.

```bash
npx tsx --env-file=.env.local scripts/serp-rates.mts              # FREE — scores every row ever stored
npx tsx --env-file=.env.local scripts/niche-serp-sweep.mts --reads=5 --dry   # 460 checks, ~$0.92
```

⚠️ **`scripts/serp-rates.mts` spends nothing.** Every read any sweep has ever taken is already a
`serp_observations` row, so the scorer re-reads history instead of buying it again — which is also
why no new table was added. Run it before spending to see which queries actually need more reads;
it prints *"needs ~1 more read"* per query, so the next spend is aimed instead of uniform.

⚠️ **THE INTERVAL IS THE THRESHOLD, NOT THE POINT ESTIMATE — that is the whole design.** `4/5 = 80%
pack-free` sounds decisive and is not: its Wilson 95% interval runs **0.376 – 0.964**, so it does
not even establish that the pack is absent more often than present. Calling that `winnable` is
precisely the mistake the binary sweep made at n=3. Wilson rather than the normal approximation
because the normal interval on 5/5 is **[1, 1]** — total certainty from five observations, an error
bar that vanishes exactly when the sample is smallest, which is worse than none because it reads as
proof.

⚠️ **At K=5 only a UNANIMOUS query resolves; most rows read `contested`, and that is the true
answer** rather than a failure of the niche or of the tool. `readsToResolve()` says how many more
reads would settle it, and returns **null at exactly 50/50** — no amount of reading settles a real
coin flip, and returning a number there would sell an unbounded budget.

⚠️ **The niche verdict asks "is there a page here we can win", and the first version got that wrong
in a way the control caught within the hour.** It read *"a niche is only as good as its worst
resolved query"* — any lost query made the niche `lost`. That scored **treehouses as lost**: a live
cohort, four sites, a builder ranking first. The per-query readings underneath were correct and are
the useful part:

```
treehouse builder austin          8 reads   100% pack-free [68–100]   winnable
custom treehouse company austin   6 reads     0% pack-free [0–39]     lost
```

Both are true, and you build for the one you can win. **A lost query constrains WHICH page to
target; it never disqualifies the niche.** Conflating those is the same error as averaging, arriving
from the other side: one blends the distinction away, the other lets the worst row speak for the
rest. So `winnable` = at least one query resolved winnable, `lost` = everything that resolved is
lost, `contested` = nothing resolved yet. Queries weigh equally regardless of read count, so a query
that happened to get re-read ten times cannot outvote the other two.

⚠️ **The guard on the whole approach: if reads never vary, they are not independent.** A cached
provider response produces identical readings, a tight interval and total confidence — this tool's
own failure restored one level up. `varied` is recorded per query and the scorer stops and says so
if *no* repeated query anywhere varied.

### The K=5 run (2026-09-23, Austin + Denver, 460 attempted, 373 stored, ~$0.92)

⚠️ **19% of reads were lost to provider errors even with three retries**, so reads per query land
between 3 and 8 rather than a flat 5. The interval absorbs that honestly — a 3-read query shows a
visibly wider band — which is the reason to read the band and not the percentage.

**The headline is that the QUERY is the unit, not the niche, and a niche score averages that away.**

| niche | reads | winnable queries | lost |
|---|---|---|---|
| **Horse barns / riding arenas** | 23 | **4 of 4** | 0 |
| Wine cellars | 28 | 3 of 4 | 1 |
| Bunkers & underground shelters | 27 | 3 of 4 | 0 (1 unresolved) |
| Yurts | 31 | 2 of 4 | 1 |
| Pole barns | 25 | 2 of 4 | 1 |
| Grain bin & silo homes | 26 | 2 of 4 | 2 |
| Treehouses *(live cohort)* | 33 | 1 of 9 | 2 |
| Geodesic domes *(live cohort)* | 26 | 1 of 4 | 3 |
| Timber frame | 27 | 1 of 4 | 3 |
| Container builds · saunas · natural pools · backyard studios · sport courts · skate ramps · greenhouses · earth-sheltered · earthbag · climbing walls | 15–27 each | **0** | most |

**Horse barns is the only niche where every query resolved winnable** — 100% pack-free on all four,
23 reads, no lost query and nothing unresolved.

⚠️ **THE PATTERN WORTH MORE THAN THE RANKING: the same niche splits by CITY and by PHRASING, and the
splits are total rather than marginal.**

```
silo home conversion austin      100% [65–100] winnable | grain bin home builder austin    0% [0–35] lost
silo home conversion denver      100% [61–100] winnable | grain bin home builder denver    0% [0–39] lost
geodesic dome builder denver     100% [65–100] winnable | geodesic dome builder austin     0% [0–35] lost
timber frame builder denver      100% [65–100] winnable | timber frame builder austin     13% [2–47] lost
treehouse builder austin         100% [65–100] winnable | custom treehouse company austin  0% [0–39] lost
yurt dealer austin               100% [68–100] winnable | yurt dealer denver               0% [0–35] lost
```

Each pair is one niche. **"Grain bin home builder" is unwinnable in both cities while "silo home
conversion" is winnable in both** — same businesses, same buyers, opposite answers, decided by the
words. Domes are winnable in Denver and lost in Austin. So *"is this niche good"* was never a
well-formed question: a niche-level rate averages over exactly the distinction that decides what to
build, which is why this file's earlier ranking tables kept disagreeing with each other.

⚠️ **Domes read 1-winnable-of-4 and we have 13 live directory sites.** Not a contradiction to settle
by picking a number — it says the pack is the answer in most dome markets and Denver is the
exception. Read it as a caution about the other twelve, not a verdict on the cohort.

⚠️ **The truncation guard earned its keep here**: it fired 13 times and **7 were genuinely short
responses** that would otherwise have scored as opportunity.

⚠️ **One of the nine WAS a short response, and that guard shipped anyway.** `dock builder austin`
returned `item_types` of `[local_pack, organic, people_also_ask, related_searches]` with
`se_results_count` 111, then `[organic, people_also_ask]` with 57 and six fewer items, then 111
again. Truncation reads as `good` — **the failure has a direction and it points at buying domains**.
`isFeatureless()` (`lib/serp/classify.ts`) marks the shape and the sweep re-fetches those rows; the
read that found a feature wins, because **a feature we SAW is real and a feature we did not see may
just be missing.** It fired once in the second sweep and confirmed. Worth keeping, but it addresses
1 of 9 flips — it is not the explanation.

⚠️ **`isFeatureless` is deliberately NOT wired into the scoring rule.** The classifier is correct
given its input; the input was wrong. **A person cannot be served a truncated SERP**, so a
hand-check reporting an empty page is reporting a real empty page, and compensating for a provider
defect inside `verdictFor` would corrupt the human path to patch the API path. Pinned by a test.

⚠️ **A single-response truncation detector was tried and MEASURED rather than assumed.** *Missing
`related_searches`* looked diagnostic and is not: 7 rows lack it and 5 of those saw a full pack.
The predicate that survived is the narrow one above.

⚠️ **A transient API failure looks exactly like a finding.** The first sweep lost ~30% of checks to
DataForSEO's "Internal SE Server Error" and the losses *clustered* — domes came back 0% on a single
surviving check. A percentage over one sample prints identically to a percentage over four. Hence
three retries, a thin-sample warning naming every niche under 3 checks, and an `n` column: **read it
before the percentage.**

---

## 4. Pack STRENGTH — the signal we already owned and never read

**What it is.** `lib/serp/packStrength.ts` + `scripts/pack-strength.mts`. DataForSEO returns
`rating.votes_count` on every `local_pack` item and we already store the raw, so **every reading ever
taken can be rescored for nothing.**

⚠️ **Why it matters: `classify.ts` calls every full pack `skip`, which is right about towing and
throws away the difference between three businesses with 4 reviews and three with 500.** Presence
and strength are different questions, and we had been treating presence as the whole answer.

**It separates our two controls on the first try**, which is the only reason it is trusted:

| | listings | under 20 reviews | median |
|---|---|---|---|
| `towing service near me` — **known LOSS** (pos 10.9, 69 impressions, **0 clicks**) | 3 | 0 | **323** |
| treehouse queries — **known WIN** (cohort bought, a builder ranks #1) | 48 | 33 | **9** |

A 36× separation, and the per-niche ordering matched the verdicts the sweep reached independently:
bunkers 1 · treehouses 4 · … · domes 59 · climbing walls 476.

⚠️ **An unrated listing counts as WEAK, not as unknown.** Google omits the rating block when a
business has no reviews to show; treating that as missing data reads the weakest possible competitor
as the most uncertain one — backwards, and biased toward `skip`.

⚠️ **Deliberately NOT wired into `verdictFor`.** The classifier was calibrated against a person's
hand-scored run and agrees on four rows; changing the rule would discard that calibration to chase a
signal validated on two controls. Pack strength reports *alongside* the verdict and produces a
**shortlist**: 31 queries we called `skip` whose pack is actually weak — e.g. `custom treehouse
company austin`, which our rate measurement calls unanimously lost (the pack is always served) while
its pack is three businesses with a median of 4 reviews. **Both are true, and they answer different
questions.**

⚠️ **The threshold is borrowed, the validation is ours.** "At least 2 competitors under 20 reviews"
comes from a rank-and-rent practitioner's public criteria. What this repo added was checking it
against a known loss and a known win before believing it.

### CPC: we were already buying it and discarding it

`lib/prospects/keywordVolume.ts` calls DataForSEO's `search_volume/live`, whose response carries
`cpc` and `competition` in the same JSON. Only `search_volume` was read. Every niche judgement
therefore leaned on a hand-set `ticket` guess in `lib/niches/candidates.ts` while a **measured**
signal of what advertisers pay per click sat unused in a response we had already paid for. Now
cached per call and readable via `metricsForKeyword()`. ⚠️ A cache, not a store — a stale CPC shown
as current is worse than no CPC.

---

## Using it

```bash
npx tsx --env-file=.env.local scripts/gsc-query-harvest.mts        # what we are found for
npx tsx --env-file=.env.local scripts/serp-rates.mts               # FREE — score what we already have
npx tsx --env-file=.env.local scripts/niche-serp-sweep.mts --reads=5 --dry     # count + cost, spends nothing
npx tsx --env-file=.env.local scripts/niche-serp-sweep.mts --only=bunker,equestrian --reads=5 --apply
```

The sequence is **harvest → score for free → sweep the queries that need reads → hand-check one or
two rows at `/admin/serp-check` → then** decide whether a cohort is worth domains. ⚠️ **The sweep picks which searches a person runs; it does
not rank niches.** Two full sweeps disagreed on the middle of the table and moved the live-cohort
control from 75% to 33% — see above. The classifier agreeing with a person on four rows is
**calibration, not proof it cannot be wrong**, and a verdict that flips on a re-run of the same
query is the standing evidence for that.

`scripts/niche-probe.mts` still works and is still useful for the question it actually answers —
*how many of these businesses exist near here* — which is a supply question, not a ranking one.
