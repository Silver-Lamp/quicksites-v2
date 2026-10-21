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

## Verified / assumed

**Verified:** StemRegen's white-paper and customer-story pages as read 2026-10-21 (counts above);
the Ads volumes (one paid task, re-runnable); Google's 2019 ad ban (press coverage, NBC/CNBC); the
FDA's approved-stem-cell statement (FDA consumer alert via secondary sources); HJ Levers' scope (its
own doc). **Assumed:** StemRegen's commission terms, and whether they would supply placebo or accept
a no-veto clause — unknown until asked. The FTC and MHMDA summaries come from law-firm write-ups,
not the statutes; a lawyer confirms them.
