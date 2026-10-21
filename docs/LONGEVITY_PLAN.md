# Longevity: affiliate products + citizen science that can actually say "it works" — or "it doesn't"

**Status: PLAN, nothing built (2026-10-21).** Owner asks, in order: (1) a `/longevity` path on
HiveJournal, "integrated with the Huberman Labs type plan of citizen science", carrying affiliate
links to research-backed longevity products; (2) "build [StemRegen] a better reselling platform on
quicksites, one that also has citizen science so that we can prove whether these things work"; (3)
"a plan for 'stem cell therapy near me' or in certain states, wondering if people searching for
the therapy might be interested in this approach."

The short version: **the citizen science is the product, and it only has value if it is allowed to
come back negative.** Everything below follows from that sentence.

---

## 1. What already exists (re-read before building)

| piece | where | what it gives us |
|---|---|---|
| **Levers** — track a level, log interventions, actual vs predicted, averaged effect per lever | HJ `docs/product/INTERVENTION_ROI.md`, `/dashboard/levers`, `levers-core.ts` | the n-of-1 engine. Open-label only today; "cross-window counterfactuals (X vs nothing)" is listed as still ahead |
| HJ citizen-science positioning | HJ `/best-citizen-science-platforms-2026`, `lib/citizen-science-compare.ts` | already says, in HJ's voice, that HJ is "the one where you run the experiment yourself" and that observation is "not experiment: there is no manipulation and no control" |
| Affiliate convention + honesty guardrails | `crosstalk/contracts/affiliate-program.md` | mandatory disclosure, no astroturf, no fabricated testimonials, no brand-term bidding |
| Re-derivable claims, rule 7 | `crosstalk/contracts/re-derivable-claims-standard.md` | a claim must not be re-derived only by the party it flatters — which is exactly a reseller grading its own product |
| Display-only product gallery | `products_grid` (CLAUDE.md "Store detection ≠ store import") | an outbound-link product card without our checkout |
| Keyword volume + SERP checks | `lib/prospects/keywordVolume.ts`, `lib/serp/*`, `scripts/serp-check.mts` | demand and winnability before any domain buy |

## 2. What StemRegen's evidence actually is (read 2026-10-21)

- **One human study of the product:** 10 people with heart failure, run by the founder, apparently
  self-funded (per Innerbody's review). Two rat studies, one a preprint.
- **Seven "white papers"** on their blog: no dates, no authors, no DOIs, no journals. Six read as
  marketing; one (#5) says "clinical studies document an 80% increase in circulating stem cells"
  without a sample size.
- **27 customer stories** (2 pages). Two name a disease (neuropathy; recovery from two strokes).
  **None discloses payment, free product or affiliation**, including three practitioners.
- They run an affiliate program (Everflow since early 2024; listed on Impact with a 30-day cookie;
  PPC/SEM and brand bidding disallowed). Commission rates are not public.

**What this means for us under the FTC's Health Products Compliance Guidance (Dec 2022):** health
benefit claims generally need randomized controlled human trials; animal and in vitro work is
supporting material only; **a testimonial cannot make a claim the advertiser could not substantiate
itself**, and "results not typical" does not cure it; consumer anecdotes, surveys included, never
substantiate a health claim. A reseller repeating a claim inherits it. So:

- We **do not republish** their white papers as evidence or their disease-naming testimonials.
- Every product we list shows its evidence **graded with n, design and funder**, written so a
  reader can check it (`n=10, open-label, founder-run`), never "clinically proven".

## 3. The study design that can answer the question

An open-label log cannot "prove" a supplement works for pain, energy, sleep or recovery — the
outcomes in StemRegen's testimonials are the ones placebo moves most. Two tiers, labelled as
different things:

**Tier 1 — "Your own log" (HJ Levers, can start now).** Someone tracks a level, starts the product,
keeps tracking. Labelled in the UI as *your record, not evidence*; aggregated only as "what people
logged", never as an effect size for the product. Useful, honest, and it builds the cohort.

**Tier 2 — a blinded, placebo-controlled decentralized trial (needs the manufacturer).** This is the
pitch: *we will run the trial your white papers don't have.*
- The manufacturer supplies **matched placebo capsules**; a third party holds the randomisation key.
- **Pre-registered** before enrolment (OSF or ClinicalTrials.gov): one primary outcome on a
  validated scale (e.g. a PROMIS short form for pain interference or fatigue), the duration, the
  sample size from a power calculation, and the analysis — fixed in advance. The FTC guidance names
  post-hoc rescue of a null trial as deception; pre-registration is how we prove we didn't.
- **An independent IRB** (a commercial IRB; not legally required for privately funded research, but
  it is what makes the result publishable and believable).
- **Publication is not the manufacturer's decision.** The agreement says we publish whatever comes
  back, null included, and they cannot veto, delay or edit it. If they won't sign that, Tier 2 does
  not happen with them.
- **We disclose our own conflict** on every page: we earn affiliate commission on the product we
  are testing. That is precisely the rule-7 case; the pre-registration and the no-veto clause are
  what keep the result from being re-derived only by the party it flatters.

### 3b. Measuring circulating stem cells — what to pin in the pre-registration (2026-10-21)

Owner asked whether to recruit from roughly the same latitude/longitude. **Randomization already
balances geography between arms**, so location is not the safeguard; it is a convenience and a
noise reducer. In order of how much each matters:

1. **Draw timing.** Circulating progenitor counts vary across the day, and the claim being tested
   is an acute release after a dose. Every draw at a fixed local clock time and a fixed interval
   after dosing.
2. **No strenuous exercise for 24–48 h before each draw.** Exercise mobilizes progenitor cells on
   its own; without this rule the result measures who went running.
3. **One central lab, one gating protocol** (a standard CD34+ flow-cytometry method). Counts are a
   few cells per microlitre; lab-to-lab differences can swamp an effect. Tubes must reach the lab
   inside its stability window — which is the practical reason to **recruit regionally**.
4. **Crossover design** (product and placebo periods, washout between): each person is their own
   control, cutting the sample size needed.
5. **Stratify, don't restrict.** If recruiting across regions, randomize within latitude band and
   enrolment season. Longitude alone matters only through clock time; exclude or record altitude.
6. **Covariates recorded and named in advance:** baseline 25(OH)D (vitamin D blood level), age,
   smoking, recent illness, medications that affect blood-cell production. At Seattle's latitude
   vitamin D falls sharply in winter — balance enrolment season across arms.

Context for the vitamin D link: the receptor is on several progenitor lines and lab work shows
effects, but the one placebo-controlled human trial found (Yiu et al. 2013, *Atherosclerosis*,
PMID 23298824 — 100 people with type 2 diabetes, 5,000 IU/day, 12 weeks) raised blood vitamin D
substantially and **did not change circulating EPC counts**. That trial is the template for the
test this plan proposes.

## 4. Commerce: refer, don't resell

- **Affiliate links through the manufacturer's own program**, not inventory. They take the payment,
  ship, handle returns. Nutraceuticals are a Stripe restricted category, and one bad merchant
  freezes the whole Connect platform (`memory: platform-blast-radius`); we keep supplements off our
  Stripe entirely.
- "A better reselling platform for StemRegen" = **QuickSites sites for their affiliates and
  practitioners**: each affiliate gets a site with their link, the graded evidence, the disclosure,
  and the study enrolment. That is something their Everflow program does not give them.
- Copy rules on those sites, enforced in the builder the way the claim-postcard forbidden list is:
  no disease claims, no "proven", no undisclosed testimonials, the affiliate line on every page.

## 5. "Stem cell therapy near me" — demand, and who is asking

US monthly volume, Google Ads via DataForSEO, pulled 2026-10-21
(re-run: `npx tsx --env-file=.env.local scripts/stemcell-search-volume.mts`, ~$0.09):

| query | volume | CPC |
|---|---|---|
| stem cell injections near me | 8,100 | $8.32 |
| longevity supplements | 5,400 | $8.07 |
| stem cell therapy for knees | 3,600 | $5.40 |
| stem cell therapy mexico | 2,900 | $7.06 |
| stemregen | 2,900 | $2.05 |
| stem cell therapy for parkinsons | 1,300 | $5.73 |
| stemregen reviews | 1,300 | $3.76 |
| stem cell supplement(s) | 1,000 each | $3.42 |
| stem cell therapy panama | 880 | $16.38 |
| longevity clinic near me | 880 | $7.27 |
| stem cell therapy utah | 590 | $6.03 |

⚠️ **"stem cell therapy near me", "stem cell therapy", every other state and city tried, "…for
neuropathy / MS / COPD / autism" all came back 0. That is not demand — Google has refused ads for
unproven stem cell therapy since 2019-09-06 and withholds Ads data for most of these terms.** The
real volume is unknown from this source; Search Console after publishing (or Trends, relative only)
is the way to see it. Do not read the zeros as "nobody in Washington searches this".

**Who is asking, and what that rules out.** The therapy searchers are mostly people with a
diagnosis — knees, Parkinson's, neuropathy — pricing a clinic or a trip to Mexico or Panama. The
FDA says the only approved stem cell products are cord-blood-derived blood-forming cells for blood
and immune disorders; most clinics sell something unapproved. **Meeting that searcher with a
supplement as the "approach" — a cheaper substitute for the therapy they came for — is the
bait-and-switch the FTC guidance targets, aimed at people with real conditions.** We don't build it.

**What we can build for them honestly** (HJ `/longevity` or a QS informational site, not a
storefront): *what is actually FDA-approved, what clinics sell and charge, the red flags, the
questions to ask a clinic, why trial recruitment is the one legitimate ad on these terms* — and,
clearly separated and disclosed, "if you're curious about supplements marketed for stem cells,
here's the evidence and here's our open study." Per-state pages only where GSC later shows the
state, and only after reading the SERP (`scripts/serp-check.mts`): this is YMYL, the local pack is
clinics, and §"Niche discovery" says search for the structure, not the trade.

### 5b. State-level "stem cell therapy" domains for trial recruitment — not defensible as framed

Owner asked (2026-10-21) whether it is defensible to buy state-level exact-match domains "for those
who might want to do a trial of other cohorts in their state, and we just happen to pick up traffic
for people doing 'near me' searches". **As framed, no** — and "happen to" is the part that fails,
because the domain name is chosen for that traffic:

- **The domain is the claim.** A visitor who searched "stem cell therapy" and lands on
  `<state>stemcelltherapy.com` reads it as therapy. The FTC judges the *net impression*; a site
  named for a treatment that offers a supplement study implies the supplement is, or substitutes
  for, the treatment.
- **It recruits from the wrong population, in the wrong frame of mind.** Those searchers mostly have
  a diagnosis and are looking for treatment. Research ethics calls this *therapeutic misconception*
  — a participant believing research is care — and an IRB reviews recruitment materials, domain
  included, specifically for it. The circulating-cell study wants healthy adults; most of this
  traffic would be excluded at screening anyway.
- **Google's doorway-page policy** targets many near-identical pages or domains built to rank for
  place-plus-query variants that funnel to one destination. Fifty state domains for one study is
  that shape. Google's 2019 carve-out for clinical-trial recruitment covers **ads** for trials of
  the experimental technique itself, not organic doorways for a supplement study.
- **It probably wouldn't rank.** This is health content (Google's highest-scrutiny category), the
  local results are clinics, exact-match domains carry little weight, and our own geo fleet shows
  how little a new domain earns: 92 domains, 2,903 impressions, 18 clicks (CLAUDE.md, "Niche
  discovery"). Real volume for these terms is unknown (§5's zeros).

**The defensible version** names each thing for what it is:
- A **therapy guide** may use the therapy name, because it answers the therapy question: what is
  FDA-approved, what clinics in the state sell and charge, red flags, questions to ask. **No
  affiliate links on it.** It may mention, separately and plainly, that a supplement study exists
  and is not a treatment. One guide with state sections, or a state page only where Search Console
  later shows real demand, after reading the SERP (`scripts/serp-check.mts`).
- **Study recruitment** goes where the matching population already is: `stemregen reviews`,
  `stem cell supplement(s)`, `longevity supplements` searchers, HJ users, and the manufacturer's own
  customers — people curious about the supplement, not people seeking a cure. Recruitment copy is
  IRB-approved before it is published.

**The demand that fits the affiliate model is the supplement demand, not the therapy demand:**
`stemregen reviews` (1,300), `stem cell supplement(s)` (1,000), `longevity supplements` (5,400).
Those people are already shopping for a supplement; an honest review with graded evidence and a
live study is the best page on that SERP, and it is the page the manufacturer cannot write.

## 6. Health data — before any form ships

Logging symptoms against a supplement is **consumer health data**. The owner and HJ are in
Washington: the **My Health My Data Act** applies to WA consumers' data, needs opt-in consent to
collect and a *separate* consent to share (a separate authorization to sell), a consumer-health-data
privacy policy, deletion and withdrawal, and carries a private right of action. The **FTC Health
Breach Notification Rule** covers apps holding personal health records. HJ holds the data, never the
manufacturer, and the manufacturer gets only the pre-registered aggregate. **Get a privacy lawyer's
read on the consent flow before Tier 1 collects anything** — this plan is not legal advice.

## 7. Owner decisions

1. **Pitch StemRegen on Tier 2** (placebo supply + no-veto publication + affiliate sites), or start
   with Tier 1 on HJ alone and approach them with a cohort in hand?
2. Which **brand carries `/longevity`** — HJ only, or also an informational QS site for the
   therapy searchers?
3. **Budget**: a commercial IRB review and a privacy-lawyer hour before anything collects data.
4. Which other products sit on the shelf beside StemRegen — the shelf is only credible if it holds
   things with better evidence than the one we're testing, and grades them the same way.

## 8. Split of work once decided

- **HiveJournal**: `/longevity`, Tier 1 on Levers, consent flow, data custody, the trial's
  participant surface. Proposed by crosstalk (2026-10-21); HJ's repo, HJ's call.
- **QuickSites**: affiliate/practitioner sites (a product card with evidence grade + disclosure +
  study enrolment link, and a forbidden-claims check in the builder), the informational therapy
  page if chosen.
- **Shared contract** once both sides agree: the evidence-grade shape and the study enrolment link,
  in `crosstalk/contracts/`.

## 9. The therapy guide — page structure and the evidence grade (2026-10-21)

Owner widened the guide: his sister practises **red light therapy** and **sound therapy** and wants
to do affiliate marketing for both; he wants to know whether the new **mitochondria** supplements
work. One format grades all of them.

**The grade is derived, never typed** — `lib/evidence/grade.ts` (pure, `lib/evidence/__tests__/
grade.test.ts`), shared shape proposed as `crosstalk/contracts/evidence-grade.md`. Six grades:
Established · Promising · Tested — no effect found · Early evidence · Lab studies only · No real
evidence. Testimonials and company material never raise a grade; a blinded null on the primary
outcome outranks weaker positives; a positive secondary outcome is at most "early"; funding is
always printed and never changes the grade.

**Every topic page, in this order:**
1. The question in plain words, and the short answer with its grade.
2. A claims table: each claim → grade → one generated sentence per study.
3. What isn't known; safety (eye protection for red light; who shouldn't take what).
4. The commission line, then products — each product graded on its own evidence, not its
   ingredient's (a brand that never tested its own capsule doesn't inherit someone else's trial).
5. "Test it yourself": a measurable outcome and an HJ Levers protocol link.
6. A practitioner's view — labelled as her experience, with her affiliate disclosure.
7. Sources, and the date the evidence was last checked.

**Where the three topics stand (read 2026-10-21; the grades come from the function once entered):**

| topic | strongest | weakest |
|---|---|---|
| Red light (photobiomodulation) | chemo oral mucositis, clinical protocols (review of 10 trials, 759 patients); pattern hair loss with FDA-cleared devices (sham-controlled RCTs) | pain: mixed; most consumer panels have no clearance for anything |
| Sound | singing bowls: 2025 reviews of 14–19 small studies, possible short-term anxiety/sleep benefit, no meta-analysis possible | 528 Hz / solfeggio: no support (HJ's Frequencies spec already refuses the claim) |
| Mitochondria | urolithin A: one 66-person blinded RCT, hand/leg endurance improved (secondary) | urolithin A primary outcomes (6-minute walk, muscle ATP) null; NMN/NR raise NAD+, clinical results small and mixed, nothing on aging |

**The sister's affiliate work**, under the affiliate convention: disclosure on every post; no
disease or "healing frequency" claims (FTC applies to her personally as an endorser, and
practitioners are the endorsers regulators look at hardest). Her practice is a separate thing: a
QuickSites site with the one-provider booking mode built for Katie Bee (#1274). Search demand for
her trades is local and large — `red light therapy near me` 33,100/mo, `sound bath near me`
18,100 (re-run `scripts/urolithin-search-volume.mts`). Building it needs her own words (practice
name, city, services, whether she publishes prices, hours, photos) — the build-from-a-post rule:
nothing invented under a real person's business.

## 10. Urolithin A — affiliate, not resale (2026-10-21)

**Who sells it.** The ingredient (Mitopure) belongs to Amazentis; its own consumer brand is
**Timeline**; Nestlé Health Science holds rights and uses it in its brands (Pure Encapsulations,
Celltrient), while Amazentis kept co-exclusive rights for online supplement sales (2019–2023
press). In 2023 Timeline publicly questioned urolithin A products sold on Amazon (NutraIngredients).

**Affiliate routes found:** Timeline on **Awin** (merchant profile: 10% standard commission, 30-day
cookie); a **GRIN** discount-code programme (GRIN marks it "not brand verified"). Confirm terms
with Timeline directly. **Not resale:** Stripe restricts nutraceuticals and one bad merchant freezes
the platform (§4); the brand sells direct and through Nestlé; and the Amazon episode shows the
counterfeit/under-dosing risk a reseller would carry.

**Search demand (US, monthly, 2026-10-21, `scripts/urolithin-search-volume.mts`):**

| query | volume | CPC |
|---|---|---|
| urolithin a | 33,100 | $6.50 |
| urolithin a supplement | 22,200 | $6.50 |
| mitopure | 12,100 | $5.72 |
| urolithin a benefits | 3,600 | $3.56 |
| mitopure reviews | 2,900 | $5.71 |
| mitochondria supplement | 2,900 | $4.59 |
| best urolithin a supplement | 1,600 | $8.65 |
| urolithin a side effects | 1,600 | $7.03 |
| best supplements for mitochondria | 1,000 | $4.85 |
| *for scale:* nmn supplement / nad supplement / nr supplement | 165,000 / 90,500 / 40,500 | |

**Who ranks now** (three SERP reads, same date): every page opens with an AI overview; the organic
results are Amazon, iHerb, YouTube, Reddit, Wikipedia, a trade-news site, and **small independent
sites** (a clinic blog, a longevity-news site, a small reviewer). No dominant reviewer. A sourced,
graded review page has a real chance on `mitopure reviews`, `urolithin a side effects`,
`urolithin a benefits` and `best urolithin a supplement` — the questions where honesty is the
product. Head terms (`urolithin a`) are a long shot.

**SEO shape:** content on the guide's own domain (one topic page + a comparison of products that do
and don't use the trial-tested ingredient + a side-effects page), not exact-match domains — our
fleet's 92 domains earned 18 clicks. Affiliate terms ban paid search on the brand name; organic is
fine. The angle no competitor has: **the urolithin A page carries the open study** that re-tests the
trial's one positive finding (grip endurance — cheap to measure at home), with its result
published either way.

## 11. Sandon's own Timeline log — an affiliate who publishes his readings (2026-10-21)

Owner: "Timeline is who I'm taking (1 week in) … write it into the plan to be an affiliate logging
my experience." Started about **2026-10-14** (Mitopure, Timeline).

⚠️ **There is no pre-start baseline**, and nothing can create one after the fact. So the design is
on/off, not before/after:

| phase | length | what happens |
|---|---|---|
| A — on (now) | 6 weeks from the first measurement | weekly readings while taking it |
| B — off | 4 weeks | stop; keep measuring on the same schedule |
| A — on | 6 weeks | restart; same schedule |

- **Measures, chosen from the trial:** grip endurance (repetitions to fatigue at a fixed load on a
  hand dynamometer — the hand result the 66-person trial found), and a measured 6-minute walk
  monthly (the trial's primary outcome, which did NOT improve — include it anyway). Same time of
  day, no hard workout in the 24 h before.
- **Pre-registered in HJ Levers before the first reading:** measures, schedule, and the rule that
  every reading is published, off weeks included.
- **Honest labels:** open-label, one person, already taking it → "my log, not evidence". Never
  presented as a typical result; the guide's grade for urolithin A does not move because of it.
- **Affiliate:** join Timeline on Awin; every post and the log page carry: *"I take Timeline's
  Mitopure and earn a commission if you buy through my link. My readings, including the weeks I
  stopped, are here."* As an endorser he is personally bound by the FTC rules in §2.

## 12. Mullein, for smokers (2026-10-21)

Owner: "mullein gummies/drops is another one to do a study on … for smokers."

**Evidence:** no human trials for respiratory use. Drugs.com (May 2026): clinical trial data are
lacking to recommend it for any indication. The EU's herbal monograph lists only a *traditional*
use (sore throat with dry cough and cold) — traditional, not evidence-based. Grade: **No real
evidence** — which makes it a good candidate for a study that could be the first.

**Demand (US monthly, 2026-10-21):** mullein 135,000 · mullein tea 74,000 · mullein benefits
22,200 · mullein drops 9,900 · mullein tincture 5,400 · mullein gummies 2,900 · mullein
supplement 2,400 · mullein for lungs 1,300 · mullein for cough 880 · mullein side effects 880.

⚠️ **The smokers framing has one hard line: never "detox", "cleanse" or "repair" for smokers.**
That implies the product offsets smoking harm — a health claim with no support, and copy that can
talk someone out of quitting. The study can be *in* smokers; the page never sells to smokers.

**A study that could answer something:** adult smokers who already have a smoker's cough;
mullein drops or gummies vs a matched placebo; primary outcome a validated cough questionnaire
(e.g. the Leicester Cough Questionnaire) plus a morning cough/phlegm diary; 4–8 weeks;
pre-registered; IRB; people with a diagnosed lung disease excluded or routed through their doctor;
**every participant given quit-smoking help at enrolment** (1-800-QUIT-NOW). A placebo for drops or
gummies is easy to match, so this one can be blinded from the start.

**Pursued (owner: "pursue mullein SEO w/ trials", 2026-10-21).** The evidence is entered as data
(`lib/evidence/topics/mullein.ts` — cough and the smokers claim grade "No real evidence", pinned by
test); the study is drafted as a pre-registration (`docs/studies/MULLEIN_SMOKERS_PROTOCOL.md` —
capsule crossover, primary outcome the Leicester Cough Questionnaire, ~60 enrolled); the six search
pages and the hub copy are drafted (`docs/longevity/MULLEIN_PAGES.md`). Best first target:
**"mullein for smokers" — 3,600/mo with a weak page one** (a symptom checker, Instagram, eBay,
YouTube, Amazon). Blocked on the brand decision (§7.2) and, before recruiting, an IRB and a
privacy-lawyer read.

## 13. Sunset Escapes — Amy's two spec sites (2026-10-21)

Owner: "yes for amyjurowski … 2 spec websites both under a company name of 'Sunset Escapes' …
Laguna Beach but no address yet", and "yes to anything SEO". Built the same day as operator-owned
drafts with booking in preview (no real hours yet), only from what was said — no services list,
prices, bio, photos or benefit claims were invented:

- `sunset-escapes-red-light` — "Red light therapy in Laguna Beach"
- `sunset-escapes-sound` — "Sound therapy in Laguna Beach"

Both noindex until Amy claims and publishes. Page titles set for search ("Red Light Therapy in
Laguna Beach | Sunset Escapes", "Sound Therapy & Sound Baths in Laguna Beach | Sunset Escapes").
`sunsetescapes.com` has been registered by someone else since 2012 and serves nothing;
`sunsetescapeslaguna.com` and `sunsetescapes.co` were free on 2026-10-21.

**Local demand is small, and the clicks are in the map pack** (US monthly, 2026-10-21): laguna
beach spa 590 · sound bath orange county 140 · red light therapy orange county 70 · red light
therapy newport beach 50 · sound bath laguna beach 50. Both Laguna results pages show a local
map pack (Laguna Beach Energy Medicine appears in both; OC House of Healing, Dolce MD, Experience
Divine Vibes, Rana Nadar) above organic results from small studios, Yelp, ClassPass, Eventbrite,
Facebook and Instagram. The national "near me" demand (33,100 and 18,100) is served by proximity
in that pack, not by a website.

**SEO, in the order that moves anything:**
1. **Google Business Profile** — a service-area business needs no public address. One business,
   one profile, both services on it. This is where the local clicks are.
2. **Listings where the results pages already point:** Yelp, ClassPass, and Eventbrite for
   scheduled sound baths (Eventbrite ranks on "sound bath laguna beach").
3. **Real client reviews** on the profile, asked for after a session — never offered for anything.
4. **One domain, two pages,** once she's ready: one business splits its authority across two sites,
   and the profile can link only one. `sunsetescapeslaguna.com` with `/red-light` and `/sound` is
   the natural shape (owner's call; ~$11).
5. On publish: LocalBusiness schema (the readiness runner), the canonical nominated to the domain,
   and Search Console.
6. Her affiliate content (§9) lives on the guide, not the booking site — the booking site makes no
   benefit claims.

## Verified / assumed

**Verified:** StemRegen's white-paper and customer-story pages as read 2026-10-21 (counts above);
the Ads volumes (one paid task, re-runnable); Google's 2019 ad ban (press coverage, NBC/CNBC); the
FDA's approved-stem-cell statement (FDA consumer alert via secondary sources); HJ Levers' scope (its
own doc). **Assumed:** StemRegen's commission terms, and whether they would supply placebo or accept
a no-veto clause — unknown until asked. The FTC and MHMDA summaries come from law-firm write-ups,
not the statutes; a lawyer confirms them.
