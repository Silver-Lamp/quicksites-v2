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

⚠️ **The probe is no longer a gate, and the reason matters more than the change.** The probe was a
cheap proxy for local-pack strength, worth having *while a SERP read was unvalidated*. The
classifier has since matched a person on four rows including a 2-entry and a 3-entry pack, and a
SERP check costs less than a probe. The proxy also misled in **both** directions: `earth_natural`
read 16.2 per metro on a query that matches every general contractor, and the Places sweep missed
World Treehouses — which ranks **first** for its own query. A proxy wrong in both directions is not
worth gating on when the true measure is nearly free.

### First sweep (2026-09-23, Austin + Denver, ~$0.20, 24 niches)

| green | n | niche | |
|---|---|---|---|
| 100% | 3/3 | **Horse barns / riding arenas** | hand-check candidate |
| 75% | 6/8 | Treehouses | *the live cohort — an internal control* |
| 75% | 3/4 | **Bunkers & underground shelters** | hand-check candidate |
| 67% | 2/3 | Wine cellars | |
| 50% | | Timber frame · yurts · zip lines · observatories | |
| 43% | 3/7 | Storm shelters | |
| 33% | | Earth-sheltered · climbing walls · **domes** · grain bins · pole barns | |
| 25% | 1/4 | Sport courts & batting cages | |
| 0% | 4/4 | Natural swimming pools | |
| 0% | | Container builds · backyard studios · skate ramps · greenhouses · earthbag · saunas | |

**Treehouses at 75% is the load-bearing row.** It is the cohort we bought *before* the sweep
existed, and the sweep independently ranks it second — the ranking reproduces a decision it did not
make. Towing (control) read 0%.

⚠️ **Domes read 33% and that is a WARNING ABOUT THE METHOD, NOT ABOUT DOMES.** It is a live cohort
with 13 state sites. A green rate is a statement about *these two cities and these three queries*,
never about a niche; a niche that works can score low on a small sample of the wrong cities.

⚠️ **THE SWEEP DISAGREES WITH ITSELF ABOUT 1 CHECK IN 5, AND CHASING THAT DOWN FOUND A REAL BUG.**
Re-running the thin niches re-checked 21 queries that already had a reading: **4 came back with a
different verdict, and 3 of those crossed the green/skip line** — the only difference that changes a
decision. The script reports this every run rather than carrying the number here, because the answer
changes with the classifier and with Google. **Consequence: rank on gaps wider than the noise, not
on the ordering** — 100% vs 75% in the table above is one check.

⚠️ **THE CAUSE WAS NOT SERP WOBBLE — IT WAS A SHORT PROVIDER RESPONSE THAT SCORES AS OPPORTUNITY,
AND THAT IS THE MOST IMPORTANT LINE IN THIS FILE.** The first guess was that a pack of 2 vs 3
flips at the boundary. It does not: all three crossings were **pack 3 ↔ pack 0** — the pack
vanishing entirely. `dock builder austin`, read twice minutes apart:

| | `item_types` | `se_results_count` | verdict |
|---|---|---|---|
| read A | `local_pack, organic, people_also_ask, related_searches` | 111 | `skip` |
| read B | `organic, people_also_ask` | 57 | **`good`** |

Read B is half a SERP. Nothing in it is *wrong* — it simply does not contain the blocks that decide
the verdict, and **absence reads as "nothing is in our way."** In the first full sweep **4 of 108
readings were featureless and all four were green**: the failure has a direction, and the direction
is toward buying domains.

The remedy is a second read, not a cleverer detector — a single response cannot distinguish a
truncated SERP from a genuinely empty one, and a rule guessing which is which was tried and
measured: *missing `related_searches`* looked diagnostic and was not (7 rows lack it, 5 of those saw
a full pack). What is asymmetric is what the readings can prove: **a feature we SAW is real; a
feature we did not see may just be missing.** So `isFeatureless()` (`lib/serp/classify.ts`) marks the
suspect shape, the sweep re-fetches those rows, and the read that found something wins. About $0.008
a sweep, and it only ever moves a verdict toward `skip`.

⚠️ **`isFeatureless` is deliberately NOT wired into the scoring rule.** The classifier is correct
given its input; the input was wrong. **A person cannot be served a truncated SERP**, so a hand-check
reporting an empty page is reporting a real empty page, and compensating for a provider defect inside
`verdictFor` would corrupt the human path to patch the API path. Pinned by a test.

⚠️ **A transient API failure looks exactly like a finding.** The first sweep lost ~30% of checks to
DataForSEO's "Internal SE Server Error" and the losses *clustered* — domes came back 0% on a single
surviving check. A percentage over one sample prints identically to a percentage over four. Hence
three retries with backoff, a thin-sample warning that names every niche under 3 checks, and the
`n` column in the table above: **read it before the percentage.**

---

## Using it

```bash
npx tsx --env-file=.env.local scripts/gsc-query-harvest.mts        # what we are found for
npx tsx --env-file=.env.local scripts/niche-serp-sweep.mts --dry   # count + cost, spends nothing
npx tsx --env-file=.env.local scripts/niche-serp-sweep.mts --cities=Austin,Denver --apply
npx tsx --env-file=.env.local scripts/niche-serp-sweep.mts --only=bunker,equestrian --apply
```

The sequence is **harvest → sweep → hand-check one or two rows at `/admin/serp-check` → then**
decide whether a cohort is worth domains. The sweep's job is to pick which searches a person runs,
not to replace them: the classifier agreeing with a person on four rows is **calibration, not proof
it cannot be wrong**, and a verdict that flips on a re-run is the standing evidence for that.

`scripts/niche-probe.mts` still works and is still useful for the question it actually answers —
*how many of these businesses exist near here* — which is a supply question, not a ranking one.
