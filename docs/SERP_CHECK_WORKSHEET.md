# SERP check worksheet

> **Status: calibrated 2026-09-22.** The first run (11 searches, treehouses + storm shelters)
> settled the scoring rules below, and the automated version in `lib/serp/classify.ts` now matches
> them exactly. **If you hand-score a search and disagree with the tool, the tool is what changes.**
>
> **You are measuring ONE thing: what occupies the page above the first organic result.** Not
> whether we could rank — whether ranking would be worth anything.

**Do it in the app: [`/admin/serp-check`](/admin/serp-check).** One search on screen at a time,
the query one click from your clipboard, number keys 0–3 for the pack size, and the verdict
computed server-side by the same rule the automated runs use — so a disagreement is a finding
about the tool, not a difference of opinion. The run ends with a *you vs the machine* table.

This file is the reference for what the questions mean and why. Run it on paper if you prefer, or
for a niche the console has no locations for yet. Automated equivalent:

```bash
npx tsx --env-file=.env.local scripts/serp-check.mts --set=worksheet --dry
npx tsx --env-file=.env.local scripts/serp-check.mts --niche=yurt --city=Denver
```

---

## What the first run settled

**Pack size is the whole signal. Block count is not.** Every full-pack query in the run had only
1–2 elements above the first organic result — including `towing service near me`, which we know
loses (position 10.9, 69 impressions, **zero clicks**). Counting blocks could not tell the winners
from the loser; counting businesses in the map pack could.

A full pack is not "one block". It is a map, three businesses and a "More places" link, and on a
near-me query it **is** the answer. Nobody scrolls past it.

| pack | what happened | verdict |
|---|---|---|
| 0–2 businesses | 5 of 5 winnable | 🟢 |
| 3 (full) | 5 of 5 lost, incl. the known loser | 🔴 |

**Result by niche:** treehouses 4 green of 5 · storm shelters 1 of 4. Storm shelters measured
*thin* on national supply but showed a **full pack in both metros tested** — tornado-alley cities
do have local installers, and the national thinness was three metros having none at all.
Regionally dense, nationally sparse. The supply probe could not see that; this check could.

---

## Before you start

1. **Open an incognito/private window.** Your logged-in results are personalised by your own
   search history.
2. **Set location.** Google uses your real location regardless of the words you type. Either put
   the city in the phrase (`treehouse builder asheville nc`), or in Chrome DevTools (⌥⌘I) → ⋮ →
   More tools → Sensors → Location → Custom:
   - **Asheville, NC** `35.5951, -82.5515` · **Austin, TX** `30.2672, -97.7431`
3. **Laptop, not phone.** Phone SERPs show even less organic, which biases the answer pessimistic.

---

## The searches

Two metros per niche, two or three phrasings each, plus the control. For a new niche, swap the
trade words and keep the shape.

| # | Search |
|---|---|
| 1 | `<niche> builder <city> <state>` |
| 2 | `<niche> builders near me` *(location set to that city)* |
| 3 | `custom <niche> company <state>` |
| 4–5 | repeat 1–2 in a second, different metro |
| 6–10 | the same five for a second niche |
| **11** | **`towing service near me`** *(location: Bonney Lake, WA)* — **the control** |

⚠️ **Always run the control.** We know it loses. If it scores anything but 🔴, your reading — or
the tool's — is wrong, and nothing else in the run can be trusted. It has already caught one bad
model this way.

---

## What to record

The only two fields that decide the verdict are **pack** and **first organic**. The rest is
context worth noting but does not change the score.

```
Search #__:  ______________________________________________

MAP PACK — how many businesses listed?   ___   (3 = full, 1–2 = starved, none = best)
FIRST ORGANIC RESULT is:
  [ ] A directory (Yelp/Angi/Thumbtack/Houzz)   [ ] A forum (Reddit/Quora)
  [ ] A business's own site                     [ ] A national retailer
  [ ] A blog or listicle

Context (noted, not scored): ads ___   AI overview? ___   blocks above organic ___
```

| # | Pack | First organic is… | Verdict |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |
| **11** | | | **must be 🔴** |

---

## Scoring

Check these **in order**. The order matters: the control is a full pack *with a directory first*,
and reading the directory rule first is exactly how the tool got it wrong the first time.

| # | Condition | Verdict |
|---|---|---|
| 1 | No organic result on the page at all | 🔴 skip |
| 2 | **Map pack has 3 businesses** — whatever ranks first | 🔴 skip |
| 3 | Thin pack, but 4+ elements above organic (AI overview, PAA, video, images…) | 🟡 mixed |
| 4 | Thin pack, **a forum ranks first** | 🟢 **best** — demand with no published answer |
| 5 | Thin pack, a **directory or retailer** ranks first | 🟢 **best** — a better list wins it |
| 6 | Thin pack, a business's own site ranks first | 🟢 good |

⚠️ Rule 3's threshold is **not calibrated** — no search in the first run had a thin pack *and* a
crowded page, so nothing has tested where that line belongs. If you hit one, write down what you
saw; that row is what settles it.

⚠️ **Ignore the ad count.** DataForSEO returned 0 ads on all 11 rows including queries that
certainly carry them, so the automated number means "not reported", not "no ads". Note what you
see by hand, but do not score on it.

**The decision, over ten searches:**

- **7+ green** → real cohort. Say so and I'll price the domains and draft the page structure.
- **4–6 green** → one niche is probably good and the other isn't. Note which; we probe that one
  deeper (`--only=<niche> --metros=10`).
- **3 or fewer** → the supply-density proxy did not hold. That is a *useful* result: it means
  `lib/niches/score.ts` needs the local-pack term measured rather than inferred, and we buy
  nothing until it is.

---

## When you're done

Paste the table back, or just say "7 green, storm shelters were the weak one". Raw notes are fine.
