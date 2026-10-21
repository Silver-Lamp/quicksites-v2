# Mullein and smoker's cough — a blinded crossover study (DRAFT pre-registration)

**Status: DRAFT, 2026-10-21. Not registered, not IRB-reviewed, nobody enrolled.** Owner asks: a study
on mullein "for smokers", pursued with SEO (`docs/LONGEVITY_PLAN.md` §12). This draft is what gets
handed to an IRB and a statistician; every number marked *assumption* is theirs to confirm.

## Why this study

No human trial has tested mullein for cough or lungs. PubMed (2026-10-21) returns two human trials
of mullein at all: a six-ingredient ear drop in children and a cream on episiotomy wounds. The EU
herbal monograph lists only a *traditional* use for sore throat with dry cough. Search demand says
people are already taking it for this ("mullein for smokers" 3,600/mo, "mullein lung detox"
1,600/mo, `scripts/mullein-search.mts`). The question is open, cheap to test, and nobody has.

## Question

In adults who smoke daily and have a chronic cough, does four weeks of mullein leaf improve
cough-specific quality of life compared with an identical placebo?

## Design

- **Randomized, double-blind, placebo-controlled, two-period crossover.** Period 1 (4 weeks) →
  washout (2 weeks) → period 2 (4 weeks), order randomized. Each person is their own control.
- **Form: capsules,** because a capsule is the easiest thing to match with a placebo (identical
  shell, inert filler). Drops and gummies are the most-searched forms; a later arm can test them
  once the capsule result exists.
- **Product:** a commercial mullein leaf capsule with a third-party certificate of analysis
  (identity, heavy metals, microbes), dosed per its label. Placebo made by a compounding pharmacy
  or the manufacturer. A third party holds the randomization key until the database locks.

## Outcomes (fixed now)

- **Primary:** Leicester Cough Questionnaire (LCQ) total score at the end of each period. The LCQ's
  minimal important difference is **1.3 points** (Raj, Pavord & Birring 2009, 52 chronic-cough
  patients; SD of change 3.2). ⚠️ The LCQ has licence terms — confirm before use.
- **Secondary:** daily cough and phlegm ratings (0–10 diary in HJ Levers); **cigarettes per day**
  (a safety check — a supplement that makes someone feel better about smoking and smoke more is a
  harm, and this study would see it); adverse events.
- **Not an outcome, and never claimed:** lung function, "detox", or any effect of smoking.

## Size

- *Assumption:* the within-person SD of the LCQ difference is about 3.2 (the SD of change in the MID
  study — a clinic chronic-cough population, not smokers).
- Crossover, two-sided α 0.05, power 80%, detecting 1.3 points:
  n ≈ (1.96 + 0.84)² × 3.2² / 1.3² ≈ **48 completers**; **about 60 enrolled** for 20% dropout.
- A statistician confirms the SD assumption and the carry-over risk of a 2-week washout before
  registration. If the SD turns out larger, the study gets bigger, not looser.

## Who can join

- Adults **21+** who smoke cigarettes daily and have had a cough for 8 weeks or more.
- **Excluded or routed through their own doctor:** diagnosed COPD, asthma or other lung disease;
  pregnancy or breastfeeding; coughing blood; recent chest infection; anyone told by a doctor to
  avoid herbal products.
- **Every participant gets quit-smoking help at enrolment** (1-800-QUIT-NOW, smokefree.gov), and
  quitting during the study is welcomed, recorded, and never penalised.

## Rules that make the result believable

- Registered (OSF; optionally ClinicalTrials.gov) **before the first participant.**
- A commercial IRB reviews the protocol, consent, and **every recruitment page and ad** — including
  the search pages in `docs/longevity/MULLEIN_PAGES.md`.
- **The result is published whatever it is**, null included, on the same pages that recruited.
  No sponsor can veto or edit it.
- We earn affiliate commission on mullein products; that conflict is disclosed in the consent and
  on every page.
- Data: HiveJournal holds it (Levers diary + questionnaire); Washington My Health My Data Act
  consents (separate collect / share), withdrawal and deletion. A privacy lawyer reads the consent
  flow first.
- Compensation, if any, is flat and never tied to the outcome.

## Open before registration

1. IRB choice and fee; privacy-lawyer review.
2. Capsule product + placebo source, with certificates.
3. Statistician sign-off on the SD and the washout.
4. LCQ licence.
5. Which brand's pages recruit (plan §7, decision 2).
