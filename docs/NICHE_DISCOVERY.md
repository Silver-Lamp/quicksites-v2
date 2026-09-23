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

**What would fix it — not built, and it costs N×.** The right unit is not a verdict, it is a
**rate**: read a query K times and record *what fraction of impressions showed a full pack*. That is
the quantity that actually decides whether an organic result can win, and it is what the binary
verdict has been standing in for. At K=5 a 92-check sweep is ~$0.90 — still cheap, and it would
turn "is this niche green" into a number with an error bar. **Do that before any domain is bought
on a sweep's ranking.**

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

## Using it

```bash
npx tsx --env-file=.env.local scripts/gsc-query-harvest.mts        # what we are found for
npx tsx --env-file=.env.local scripts/niche-serp-sweep.mts --dry   # count + cost, spends nothing
npx tsx --env-file=.env.local scripts/niche-serp-sweep.mts --cities=Austin,Denver --apply
npx tsx --env-file=.env.local scripts/niche-serp-sweep.mts --only=bunker,equestrian --apply
```

The sequence is **harvest → sweep → hand-check one or two rows at `/admin/serp-check` → then**
decide whether a cohort is worth domains. ⚠️ **The sweep picks which searches a person runs; it does
not rank niches.** Two full sweeps disagreed on the middle of the table and moved the live-cohort
control from 75% to 33% — see above. The classifier agreeing with a person on four rows is
**calibration, not proof it cannot be wrong**, and a verdict that flips on a re-run of the same
query is the standing evidence for that.

`scripts/niche-probe.mts` still works and is still useful for the question it actually answers —
*how many of these businesses exist near here* — which is a supply question, not a ranking one.
