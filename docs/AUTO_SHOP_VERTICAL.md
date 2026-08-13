# Auto shops — the vertical the data picked

**Status:** cohort measured 2026-08-13 · **204 independent no-website shops found across 6 cities** ·
machinery already built (PRs #600–#603) and **never run** · nothing contacted.

Companion docs: [`OUTREACH_METHOD.md`](OUTREACH_METHOD.md) (the hand-written procedure) ·
[`OUTREACH_FIVE.md`](OUTREACH_FIVE.md) (the pre-registered experiment) ·
[`RESTAURANT_VERTICAL.md`](RESTAURANT_VERTICAL.md) (the vertical this is copied from).

---

## 1. Why auto repair, in one table

We swept 9 industries looking for businesses with no website. The spread is not subtle:

| vertical (Paterson NJ) | no website |
|---|---|
| **auto repair** | **57 of 87 — 66%** |
| window washing | 28% |
| restaurants | 20% |
| junk removal | 18% |
| pressure washing | 8% |
| fencing | 6% |
| roofing | 3% |
| carpet cleaning · pest control | **0%** |

Confirmed across six cities — and it is **region-dependent**, which matters for where to start:

| city | in range | no website | rate |
|---|---|---|---|
| Paterson, NJ | 87 | 57 | **66%** |
| Union City, NJ | 76 | 49 | **64%** |
| Elizabeth, NJ | 84 | 48 | **57%** |
| Naples, FL | 63 | 18 | 29% |
| Renton, WA | 79 | 21 | 27% |
| Kent, WA | 75 | 13 | 17% |

**204 independents after removing chains and dealers** — and the category is unusually clean: only
**2** of 206 were chains (vs a union hall and a lumber yard inside a single deck-builder sweep).

## 2. The rule this revealed — it is not "trades"

We went looking for deck builders and found the cohort does not exist: **roofing 3%, fencing 0–6%**
in two regions 1,300 miles apart. The predictor is not trade-vs-food and it is not ticket size.

> **A vertical has no websites when its customers arrive by referral and proximity, and has
> websites when its customers arrive by search.**

A homeowner needing a roof has no incumbent — they search, compare, choose. A roofer without a site
does not get the job, so every roofer has one. Someone needing a mechanic asks their cousin or walks
into the shop they have used for ten years. That shop never needed a site — **and is invisible to
everyone who does search.** That gap is the entire pitch.

⚠️ **Use this rule before sweeping a new vertical.** It would have saved the roofing/fencing sweeps.

## 3. What already exists (built, never run)

- **`lib/outreach/autoShopCompetition.ts`** — `createAutoShopCompetition()`, its own competition kind,
  same shape as the restaurant contest. PRs #600–#603.
- **`geoDomainFor(city,'auto_repair')`** → **`paterson-auto-repair.com`**.
- **The `auto_repair` scaffold** seeds a `service_transparency` block (SecondSet's see-it / hear-it /
  approve-it trust panel) before contact — the differentiator a shop's own site can offer.
- **The sweep** (`npm run outreach:candidates`'s upstream) supports `--industry auto_repair` as of
  PR #785, with `--max-km` because Places does not honour its radius.

**Zero auto campaigns have ever been launched.** The three `*-auto-glass.com` rows are a different
vertical and sit in draft.

## 4. ⚠️ The unsolved problem: there is no menu

**This is the reason to go slowly, and it is not a detail.**

Every restaurant message that was worth sending led with something specific and *theirs* — a menu we
had transcribed from their own listing photos, usually with a flaw in it we could own. "Built from
their own words" was the product.

**A mechanic's listing gives a name, a phone, an address, hours and some photos.** There is no menu,
no prices, no dish names. The single most load-bearing ingredient of the restaurant pitch does not
exist here.

Candidate replacements, none tested:

1. **The searchability gap itself** — *"nobody searching 'brake repair Paterson' can find you; your
   shop only exists to people who already know it."* True by construction for this cohort, and it is
   the finding in §2 said out loud.
2. **Hours gaps** — the one signal that transfers unchanged (`lib/outreach/draftSignals.ts`).
3. **Their name versus what they do** — *NJ Auto Lab*, *One Way Auto*, *Easy Fix* say nothing about
   brakes or transmissions. Same shape as the bánh mì hook that produced batch 1's strongest message.
4. **Reviews** — ⚠️ **not captured today.** `PLACES_FIELD_MASK` requests id/name/website/phone/
   address/location/types only. `outreach_prospects` has `rating` and `review_count` columns that the
   sweep never fills. Adding `places.rating` + `places.userRatingCount` to the mask is a two-line
   change and probably the highest-value one before any outreach.

⚠️ **Do not assume the restaurant reply rate transfers.** At the time of writing it is **0 replies
from 19 restaurants**, with windows still open. Auto repair having a bigger cohort says nothing
about whether the approach works.

## 5. ⚠️ What the scaffold invents, and what it does not

Checked directly against `buildIndustryStarter({ industryKey: 'auto_repair' })` on 2026-08-13:

**Safe — the honest-scaffold standard holds:**
- `testimonial` → `testimonials: []` (empty; no invented reviews)
- `before_after` → `before_url: ""`, `after_url: ""` (empty; no fake repair photos)
- No generated people anywhere (rule 9, `lib/images/noPeople.ts`)

**Invented, and it goes out under a real shop's name:**
- **5 services**: Oil Change · Brake Service · Check Engine Diagnostics · AC Recharge · Tire Rotation.
  Plausible for most shops — but *AC Recharge* and *Check Engine Diagnostics* are equipment-dependent
  and not every shop does them.
- **FAQ answers that make PROMISES.** The seeded FAQ says *"In most cases we respond within the
  hour"* and offers *"a free, no-obligation quote."* **These are service-level commitments invented
  on behalf of a business that never said them** — a customer could hold a shop to a promise we
  wrote. This is the same class as the invented menus (#738, #766), and arguably worse, because a
  wrong dish is a mistake while a wrong promise is a liability.

⚠️ **Fix the FAQ before sending a single auto-shop message.** Either empty it the way `testimonial`
is empty, or make every answer a statement that cannot be false ("Call and we'll tell you").

## 6. The steps

Same procedure as [`OUTREACH_METHOD.md`](OUTREACH_METHOD.md) — *the machine says who you MAY write to;
a person decides what to say* — with these differences:

```bash
# 1. Sweep. --max-km is not optional for a trade: a shop 60km away is not a competitor
#    in this city, and the contest pitch is false without it.
npx tsx --env-file=.env.local scripts/find-no-website-leads.ts \
  --city "Paterson, NJ" --lat 40.9168 --lon -74.1718 \
  --industry auto_repair --radius 15000 --max-km 20 --limit 60 --out leads.json

# 2. Strip chains/dealers by hand. Only ~1% slip through, but Jiffy Lube is not a prospect.

# 3. Build drafts.
npm run import:listings -- leads.json

# 4. Qualify. ⚠️ The eligibility rule in lib/outreach/candidates.ts is MENU-BASED
#    (>= 8 items) and will disqualify every auto shop. It needs an industry-aware rule
#    before this step means anything.
npm run outreach:candidates
```

**Then, per shop, by hand:** open the page, find one true thing, write one message, log it verbatim.

## 7. What NOT to do

- ⚠️ **Do not reuse `MIN_MENU_ITEMS` eligibility.** Auto shops have no menu; the current rule
  disqualifies all of them. Write an industry-aware qualifier or the candidate list is empty.
- ⚠️ **Do not launch a contest before checking cohort size in that city.** The restaurant contest
  needs competitors; two shops is not a contest.
- **Do not sweep more cities before the first messages report.** As of writing there are 82 eligible
  restaurants, 204 auto shops, and **0 replies**. This doc's parent already recorded the lesson:
  the automated batch produced *inventory, not conversations* — building was never the bottleneck.
- **Do not promise SecondSet.** The `service_transparency` block is marketing copy; the SecondSet
  pilot itself is flag-gated OFF (`SECONDSET_ENABLED`).

## Related

- `lib/prospects/sweepQueries.ts` — query sets per industry; unknown industry fails loudly
- `lib/outreach/autoShopCompetition.ts` — the contest, built and unrun
- `lib/outreach/draftSignals.ts` — the "what's notable" detector; hours gaps transfer, menu signals do not
- `crosstalk/contracts/glasses-capture.md` — SecondSet, the eventual auto differentiator
