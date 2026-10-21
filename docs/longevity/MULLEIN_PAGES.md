# Mullein — the search pages, and the hub draft

**Status: DRAFT, 2026-10-21.** The pages that answer what people search about mullein honestly, and
recruit for the study (`docs/studies/MULLEIN_SMOKERS_PROTOCOL.md`). Where they live is the open
brand decision (`docs/LONGEVITY_PLAN.md` §7). Grades come from `lib/evidence/topics/mullein.ts`,
never typed into copy.

## Which searches, and how winnable

US monthly, 2026-10-21 (`npx tsx --env-file=.env.local scripts/mullein-search.mts`):

| query | volume | who ranks now | our odds |
|---|---|---|---|
| mullein for smokers | 3,600 | a symptom-checker site, an herbal clinic, Instagram, eBay, COPD Foundation, YouTube, Amazon | **good** — weak page one, and nobody else has a study |
| mullein smoke | 3,600 | (not read) — mostly people asking about *smoking* the leaf | separate page; different intent |
| mullein lung detox | 1,600 | (not read) | good — the honest answer is the differentiator |
| does mullein work | 1,300 | Rupa Health, Drugs.com, YouTube, brands, PMC, iHerb + a forums block | fair |
| is mullein safe / mullein side effects | 720 / 880 | WebMD, Banner Health, Cleveland Clinic, Healthline, RxList | hard — big health publishers |
| how long does it take for mullein to work | 170 | (not read) | easy, small |
| mullein drops / gummies / capsules | 9,900 / 2,900 / 1,000 | Amazon, Walmart, GNC, brands | hard — retail |
| mullein benefits / for lungs | 22,200 / 1,300 | PeaceHealth, Cleveland Clinic, Banner Health, WebMD, PubMed | hard |
| mullein study / research / clinical trial | ~0 | — | no demand, but the page journalists and forums link to |

**The plan in one line:** win the smoker questions with honesty and a live study, and let the study
earn the links that lift the harder pages later. Don't chase "mullein benefits" first.

## The pages

1. **Hub — "Mullein for smokers: what the evidence says, and the study we're running."**
   Targets *mullein for smokers*. Draft below.
2. **"Does mullein detox your lungs?"** Targets *mullein lung detox*. Answer in the first line: no
   study has tested it; nothing undoes smoking damage except stopping. Then what people report, what
   is known, and the study.
3. **"Smoking mullein: is it safer than tobacco?"** Targets *mullein smoke*. Burning any leaf
   produces smoke the lungs have to deal with; no study supports it as a safe substitute; it is
   sometimes used to cut down — say what is and isn't known, link quit help.
4. **"Does mullein work? (and how long does it take)"** Targets *does mullein work* + *how long*.
   The graded claims table, plainly.
5. **"Mullein drops vs gummies vs capsules vs tea."** The commercial page: forms, what the label
   doses mean, third-party testing to look for, prices — the commission line above the first link,
   and every product graded on the same "no human evidence for cough" line.
6. **The study page.** Recruitment (IRB-approved copy only), the pre-registration link, and later
   the results, whatever they are.

**Copy rules (all six):** never "detox", "cleanse", "repair", "heal" or "protect" lungs; never imply
it offsets smoking; the grade label appears wherever a benefit is named; the commission line
appears before the first product link; quit-help link on every smokers page; the evidence date
printed (`MULLEIN_EVIDENCE_CHECKED`).

## Hub draft

> **Mullein for smokers: what the evidence says — and the study we're running**
>
> *Evidence checked 2026-10-21.*
>
> **Short answer:** nobody has tested whether mullein helps a smoker's cough. Not once. There are
> two human trials of mullein at all, and neither is about lungs. That's why we're running one.
>
> **What people use it for.** Mullein leaf has been used for coughs and sore throats for a long
> time, and the EU's herbal regulator lists that as a *traditional* use — meaning long-standing
> use, not trial results. Today it's sold as tea, drops, gummies and capsules, often with lung
> "detox" claims on the label.
>
> **What the research actually shows.**
>
> | claim | grade |
> |---|---|
> | Relieves cough | No real evidence — never tested in people |
> | Clears or "detoxes" a smoker's lungs | No real evidence — never tested; no study has measured lung function after mullein |
>
> **What it can't do.** No supplement undoes the damage smoke does. The one thing that does is
> stopping — and it's never too late to start. Free help: 1-800-QUIT-NOW · smokefree.gov.
>
> **The study.** Adults who smoke daily and have had a cough for two months or more take mullein
> capsules for four weeks and identical placebo capsules for four weeks, in random order, without
> knowing which is which. We measure cough with a standard questionnaire. The plan is registered
> before anyone joins, and we publish the result here whatever it shows — including "it did
> nothing". *[Join — opens when the study is approved.]*
>
> **If you want to try mullein anyway.** Look for a product with a third-party certificate of
> analysis, and talk to your doctor if you have a lung condition, are pregnant, or take other
> medicines. *We earn a commission if you buy through links on this site.* [products]
