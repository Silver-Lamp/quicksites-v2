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

## Using it

```bash
npx tsx --env-file=.env.local scripts/gsc-query-harvest.mts        # what we are found for
npx tsx --env-file=.env.local scripts/niche-probe.mts --metros=6   # ⚠️ costs Places calls
npx tsx --env-file=.env.local scripts/niche-probe.mts --only=treehouse,yurt --metros=10
```

The intended sequence is **harvest → probe → read ten SERPs by hand → then** decide whether a
cohort is worth domains. The probe's job is to make the hand-check cheap, not to replace it.
