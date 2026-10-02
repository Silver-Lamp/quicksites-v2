# Design parity — looking like a Framer template

> Why our sites read as generic next to a design-forward template, measured rather than felt,
> and the order in which to close it.
>
> Scope: the **presentation layer**. Block coverage is a separate, mostly-solved problem — see
> §0. Target verticals: **authors, photographers, creatives** (owner, 2026-10-02).

**Re-derive, never remember:**

```bash
# how much of the fleet has a typeface at all
psql "$SUPABASE_DB_URL" -c "select count(*) templates,
  count(*) filter (where data->'meta'->'theme'->>'fontPair' is not null) has_fontpair
  from templates;"
```

---

## 0. The thing that is NOT the problem

The instinct is "we are missing blocks". We measured: **32 of 67 block types are used on zero
sites**, including `video`, `image`, `audio`, `reviews` and `gallery` — exactly what creatives
need. Four of them rendered broken empty elements and two were invisible in the editor, which is
why nobody used them. All fixed 2026-10-02.

So: before adding a block, run the usage query. The vocabulary is large and mostly unreachable.

## 1. The measured gap

Same analyser, same viewport (1440×1000), run 2026-10-02.

| | starter-crafts | ws-asphalt | southhilltowing | reelio | louver | jonas |
|---|---|---|---|---|---|---|
| page height | 3k px | 2k | 3k | **9k** | **7k** | 2k |
| images | 6 | **0** | 7 | 38 | 56 | 1 |
| sections (h2) | 2 | 2 | 3 | 8 | 6 | 2 |
| **h1 size** | **48px** | **48px** | **48px** | 72px | **220px** | — |
| body size | 16px | 16px | 16px | 16px | 12px | — |
| **animated elements** | 0 | 0 | 0 | **226** | **213** | 7 |
| typeface | Bricolage + Inter | **`ui-sans-serif`** | **`ui-sans-serif`** | Inter + Bricolage | Geist Mono + Big Shoulders + Instrument Serif | Inter |

### ⚠️ The row that reframes the whole problem

**jonas is 2k px with ONE image and reads as premium.** Identical height to ours, a tenth of the
imagery. So the variable is **not** page length and **not** photo count.

This matters because the obvious plan — "make pages longer, add more images" — would cost a lot,
make every page slower, and not close the gap. What separates jonas from `ws-asphalt-paving` is
type, space and restraint.

### What the numbers actually say

1. **Three quarters of the fleet has no typeface.** 2,452 of 3,231 templates have no `fontPair`;
   they render in `ui-sans-serif`, the system stack. ⚠️ **The font system already exists** —
   `lib/theme/fontPairings.ts`, `--font-heading`/`--font-body`, `fontPairHref()`, a `fontPair` on
   every curated theme. It simply does not reach most sites. Same reachability failure as the
   blocks.
2. **Our h1 is 48px on every site measured** — regardless of theme, industry or content. Theirs
   is 72px and 220px. A headline at half the size reads as a document, not a design.
3. **We animate nothing.** They carry 200+ entry-animated elements. This is the largest single
   contributor to "feels designed" and the one with real accessibility obligations.

## 2. Phases, in cost-to-value order

### ✅ Phase 1 — DONE 2026-10-02. Every site has a typeface, and 170 of them nearly didn't.

785 → **2,034 paired**, 0 real sites unpaired, then **38 published sites republished** so the
change reached a visitor rather than a row.

⚠️ **Two things only came out by looking at a page.** (1) `resolveSiteTheme` opened with
`if (!accentHsl) return null`, thirty lines *above* where the pairing is read — so **170 paired
sites** had a typeface stored that produced no `--font-heading` and no font. (2) A site is
served from **two** snapshots: `published_sites → template_versions` for a platform slug, and
the legacy `sites.published_snapshot_id → snapshots` for a **custom domain**. `republishTemplate`
mints the second by **cloning the pinned snapshot and applying a transform**, so a no-op
transform re-pins a fresh copy of the STALE content and still reports `+domain snapshot`.
`graftontowing.com` was republished, reported ✓, and served no font.

Script: `scripts/republish-font-backfill.mjs` (dry-run by default).

### Phase 1 (original plan) — give every site a typeface (backfill, no new code)

76% of the fleet is one column write away from having a real pairing. The machinery, the loader
and eight curated pairings already exist and are in use on 779 sites.

- Pick a per-industry default pairing (creatives ≠ towing).
- Backfill `data.meta.theme.fontPair` where absent, **never overwriting an owner's choice** —
  the same rule `applyBackdropUpgrade` already follows.
- ⚠️ **Watch CLS and the font budget.** Each pairing is a webfont request; a late swap moves the
  headline. Measure before/after on a real page, not locally.
- ⚠️ **Bulk write to 2,452 live sites.** Owner approval required, and it should go out in
  batches with a revert path.

### ✅ Phase 2 — DONE 2026-10-02. `lib/theme/typeScale.ts`.

⚠️ **The plan below says to drive it off `ThemeCategory`. That field is stamped on ZERO of the
1,929 live templates** — checked before writing a line. Following this paragraph literally would
have shipped a scale that applied to nothing and looked finished, which is the exact failure the
document was written about. It is driven by the **industry** instead (`INDUSTRY_FONT_MOOD`),
falling back to the pairing's mood.

⚠️ **And keying it off the PAIRING's mood — the obvious second choice — was also wrong, which
only showed on a live page.** Most sites did not choose their pairing; `pickCuratedTheme`
assigned one at creation and knows nothing about mood. Measured after shipping:
`starter-photography` carried `space-inter` (**technical**) and got 56px — the ceiling meant for
HVAC, on a photographer, in one of the three verticals the work exists for. The scale answers
*how loudly may this business speak* (the trade); the pairing answers *in what typeface*.

Ceilings, all above the old 48px: editorial 96 · bold 76 · elegant 68 · friendly/modern 64 ·
technical 56. Minimums held at today's mobile size — the measured gap was a desktop gap.

### Phase 2 (original plan) — a type scale that is not one size

`h1: 48px` everywhere is the tell. Introduce a scale driven by the theme category that already
exists (`rugged | warm | professional | playful | neon | editorial`).

- Editorial/creative categories get a display scale (72–120px desktop); professional stays
  conservative.
- ⚠️ **Fluid with `clamp()`, not fixed** — 220px is magnificent at 1440 and unreadable at 390.
- ⚠️ **It must not break 2,800 live pages.** The scale belongs in the theme layer
  (`TemplateThemeWrapper`), the one chokepoint every site passes through — the same place the
  backdrop lives, and for the same reason.

### Phase 3 — motion, with the brake wired first

They have 200+ animated elements; we have none. Entry reveals on section scroll, and hover
states on cards.

- ⚠️ **`prefers-reduced-motion` is not optional and is implemented FIRST**, not retrofitted. A
  site that ignores it causes real harm to people with vestibular disorders.
- ⚠️ **Nothing may animate the FIRST paint.** A hero that fades in is a hero that is briefly
  absent — bad for the viewer and for anything measuring LCP.
- Implement once in the theme wrapper, never per block, or it will drift the way the three
  `SiteRenderer` background fills did.

### Phase 4 — vertical rhythm and image discipline

Section padding, consistent aspect ratios, a full-bleed option. Cheap once Phases 1–3 land, and
nearly invisible before them.

### Phase 5 — the long page, ONLY where it earns its place

reelio is 9k px because it has eight things to say. `ws-asphalt-paving` has zero images and
nothing to fill 9k px with; padding it out would produce a longer bad page. Treat length as an
*output* of having content, never a target.

## 3. What success looks like

Re-run the analyser and compare against this table — not against an opinion. A creative site
should show: a real pairing, h1 ≥ 72px desktop, non-zero animated elements with reduced-motion
honoured, and a median section gap in the 400–800px range.

## 4. Open questions for the owner

- ~~Which pairing per industry?~~ Answered: a per-industry **pool** an admin edits from the
  editor (`/api/admin/theme/industry-font-pin`), because one face per industry makes every
  towing site in a town identical.
- ~~Is a bulk font backfill acceptable?~~ **Yes** (2026-10-02), and the republish with it.
- ~~Motion on trades, or only creatives?~~ **"try trades"** (2026-10-02) — so the display scale
  reaches every vertical, trades with the most conservative ceilings. Motion (Phase 3) is still
  scoped creative-first, with the typewriter the owner liked as the minimal trade case.

## 5. What has NOT been verified

- Every measurement is **one page, desktop, one run**. No mobile numbers, no repeat sampling.
- The four benchmark templates are **Framer only** — no Squarespace, Wix or Webflow sample, so
  "Framer-class" is the bar being described, not "the web".
- Extraction on `nudge` and `jonas` was partial (my section-finder missed their DOM); their rows
  should be treated as indicative.
- No user has said our sites look generic. This plan is built from a comparison the owner asked
  for, not from reported complaints.
