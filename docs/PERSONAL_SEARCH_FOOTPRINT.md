# The owner's personal pages — why there are three, and why they stay

> ⚠️ **Do not "consolidate" these. They are not an accident, and merging them destroys the thing
> they exist to do.** This document exists because a session recommended consolidating them,
> shipped a 301, and had to revert it a few minutes later once the query data was read properly.

## What the data shows

Three pages owned by the same person rank **simultaneously, for the same queries**, on three
different properties. Search Console, 28 days to 2026-09-19:

| page | impressions | avg position | clicks |
|---|---|---|---|
| `hivejournal.com/sandon-jurowski` | 3,057 | 3.5 | 0 |
| `quicksites.ai/sites/sandon` | 613 | 7.8 | 0 |
| `sandonjurowski.com` | 155 | 7.2 | 0 |

Per individual query, all three appear — e.g. for one name-and-location variant: HJ at 4.8, the
personal domain at 6.3, QuickSites at 9.0. **That is three of the ten first-page slots**, held by
pages the owner controls.

## Why that is the point

The pages exist to push court records off page one. The unit of success is **slots occupied**, not
the rank of any single page. Three owned results at positions ~3, ~7 and ~9 displace three
results that would otherwise be there. One strong result at position 1 displaces one.

So the ordinary SEO instinct — *"two near-duplicates split authority, consolidate them"* — gives
exactly the wrong answer here. It is good advice when the goal is to rank one page as high as
possible. It is bad advice when the goal is to own as much of the page as possible, and the
evidence that it does not even apply is that all three **already rank at once** rather than
cannibalising each other.

## The zero clicks are not a failure

Every one of those 3,825 impressions produced zero clicks because the searches are automated —
a scheduled script run against name and past-location variants, not people browsing. That is why
the pages must be excluded from any measurement of whether the *business's* SEO is working
(`lib/gsc/fleetScope.ts`), and equally why their ranking still matters: an automated searcher sees
the same first page a person would.

## Standing decisions

- **No 301 between these pages.** The one that was shipped (`/sites/sandon` →
  `sandonjurowski.com`, 2026-09-22) was reverted the same day.
- **No `noindex` on any of them.** It discards a slot.
- **They stay excluded from fleet aggregates** — by page and by host — so commercial numbers stay
  honest. Excluding them is about measurement, never about suppressing them.
- ⚠️ **`hivejournal.com/sandon-jurowski` and `sandonjurowski.com` both canonical to
  `sandonjurowski.com` today.** Google is currently ignoring that and ranking both, which is the
  outcome we want. If it ever honours it, one slot disappears. Changing it is HiveJournal's call
  and belongs in a crosstalk message, never an edit to their repo.
- **More distinct properties would help; more copies of the same page would not.** Separate
  entities (a company page, a profile, a project page) each earn their own slot. A fourth
  duplicate competes with the three that already work.

## If you are about to change something here

Read the current query data first — `npx tsx --env-file=.env.local scripts/gsc-query-harvest.mts --dry`
and look at what ranks for the name queries. Every recommendation above is downstream of that
table, and the table is the only thing that should update it.
