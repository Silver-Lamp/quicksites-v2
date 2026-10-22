# Tried & Graded — design case study: what we borrowed from timeline.com, and what we didn't

**2026-10-21.** Owner: "let's make triedandgraded.com a case study to borrow design elements from
https://www.timeline.com/ … not a blatant ripoff but similar styling."

## What timeline.com is doing (measured from the live page, desktop 1440px)

| element | timeline.com |
|---|---|
| page | warm off-white `#FFFFFC`, warm near-black text `#292923`, light grey bands |
| type | a neo-grotesk for headings (Suisse Intl, weight 450, tight tracking), a serif (Tool Serif) for quotes |
| labels | tiny uppercase, letter-spaced section labels ("COMPARE US TO OTHER") |
| numbers | a stats row: big numbers over hairline rules with small captions |
| cards | thin borders, soft radius, lots of whitespace |
| accent | one brand red, used sparingly (pills, chart bars) |
| trust | product photography, press logos, "#1 doctor recommended" badges, testimonial carousel, a comparison table |

## What we borrowed (the *grammar*, not the assets)

- **Warm light page, warm neutral, soft surfaces** — `GUIDE_THEME` in `lib/guide/triedAndGraded.ts`
  (`neutral: 'warm'`, `darkMode: 'light'`, `surface: 'soft'`, no backdrop layer).
- **A clean grotesk heading face** — our existing `sora-inter` pairing (a free font; not Suisse).
- **Uppercase section labels** — the `eyebrow()` helper; the evidence block's topic label.
- **A stats row over hairlines** — but every number is **derived from the evidence records** at
  build time (`guideStats()`: studies read, claims graded, claims tested and found to do nothing),
  so the row cannot drift from the data. Timeline's row is marketing; ours is the ledger.
- **Thin-bordered cards** for the guide index; **rows divided by hairlines** in the evidence block.
- **A serif pull quote** — one of our own grading rules, not a testimonial.
- **One restrained accent** — emerald, deliberately not their red.

## What we did not borrow, and why

- **Their name, logo, red, product photos, imagery or copy** — that would be the ripoff, and a
  site that grades Timeline's product must not look like Timeline's site.
- **"#1 doctor recommended" badges, press-logo strips, star ratings and testimonial carousels** —
  trust signals we cannot honestly carry; on a grading site they would be the exact thing the grades
  exist to replace (FTC: testimonials can't make claims the seller couldn't substantiate).
- **The comparison table that ticks only its own column** — our version is the graded claims list,
  where the product being sold can lose a row.

A test pins the line: the theme is light and warm with a non-red accent, and no page mentions
timeline.com's mark or "doctor recommended".
