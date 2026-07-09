# Layout Variation Plan

> Goal: generated/edited sites shouldn't all be one full-width block stacked on
> another. Vary **page structure** (rhythm, side-by-side content, section shapes),
> tied to the curated theme so look + layout co-vary. Companion to
> [`THEME_SYSTEM_PLAN.md`](THEME_SYSTEM_PLAN.md).

Status: **planning → building** · Drafted 2026-07-08 · Decision: full scope
(incl. true multi-column sections), layout **tied to each curated theme**.

---

## 1. Where we start (architecture facts)

- A page renders as a **flat vertical `.map()`**, one full-width block per row
  ([`site-renderer.tsx:78`](../components/sites/site-renderer.tsx#L78)). Blocks get
  **no position/index**, so there's no rhythm.
- Existing cheap hooks: width presets (`resolveContainerClass`,
  [`render-block.tsx:434`](../components/admin/templates/render-block.tsx#L434)),
  `SectionShell` (`bg`/`compact`/`align`), and per-block variants already in
  `hero` (`layout_mode`), `grid`/`services`/`products` (`columns`), and `story`
  (auto image-left/right alternation, [`story.tsx:67`](../components/admin/templates/render-blocks/story.tsx#L67)).
- **Nesting is expensive**: the page model is flat everywhere (top-level DnD,
  `insertBlockAfter` index math, JSON-pointer autosave paths, renderer). The
  `grid` block is the *only* nesting primitive and hand-rolls its own DnD
  ([`grid.tsx`](../components/admin/templates/render-blocks/grid.tsx),
  special-cased at `render-block.tsx:545`). A general column/section container
  needs recursive versions of all of that.
- **Coupling to Theme Phase B:** banding only shows if blocks use **semantic
  surface tokens** (`bg-background`/`bg-card`) instead of hardcoded `bg-white`.
  Only `hero` is refactored so far. So the per-block token sweep (Theme Phase B)
  and layout work should happen in **one pass per block** — touch each block once
  for tokens + banding-awareness + layout variant.

## 2. Theme layout personality (the coupling)

Extend `CuratedTheme` with a `layout` bag so each theme carries a structure feel:

```ts
export type ThemeLayout = {
  rhythm: 'plain' | 'banded';                    // alternate section backgrounds
  density: 'tight' | 'normal' | 'airy';          // vertical padding scale
  sectionWidth: 'narrow' | 'default' | 'wide';   // default container width
  heroLayout: 'inline' | 'full_bleed' | 'split'; // preferred hero shape
  featureVariant: 'grid' | 'rows' | 'cards';     // services/features rendering
};
```

Rough per-category assignment: rugged → banded/tight/wide/full_bleed/rows ·
warm → banded/normal/default/split/cards · professional → plain/normal/default/
split/grid · playful → banded/airy/wide/full_bleed/grid · neon → banded/normal/
wide/full_bleed/cards · editorial → plain/airy/narrow/inline/rows.

Stamped into `data.meta.theme.layout`; resolved via a new `resolveSiteLayout(template)`.

## 3. Phases (ship value early, defer the expensive nesting)

### L1 — Section rhythm foundation (cheap, no schema/editor change)
- `resolveSiteLayout` + stamp `layout` in `buildIndustryStarter`.
- `site-renderer` passes **block index** into `RenderBlock`; a band wrapper
  alternates section surface (`--background`/`--muted`) + spacing per the theme's
  `rhythm`/`density`. (Visible only where blocks use semantic bg — see §1 coupling.)

### L2 — Per-block pass (combines Theme Phase B tokens + layout variants)
One pass per high-traffic block: swap hardcoded colors → semantic tokens (finishes
Theme Phase B), make it banding-aware, and add 1–2 layout variants — especially
**image-beside-text** (the `story` pattern) and **2-up / alternating rows** for
`services`/`features`/`testimonials`. Order: services → about/text → testimonials
→ faq → contact → menu/location/hours → header/footer.

### L3 — Curated page skeletons (tied to themes)
Replace the 3 fixed scaffolds ([`industryScaffold.ts:84`](../lib/builder/industryScaffold.ts#L84))
with several composition archetypes (split-hero, feature-led, gallery-led) that mix
width presets + L2 variants + banding. Theme's `layout` picks/weights the skeleton.
Structure itself varies per site — no nesting engine.

### L4 — True multi-column section engine (expensive, last)
A real nested section/column container you can drag blocks into side-by-side. Build
on the `grid` block's existing nesting plumbing rather than a fresh recursive type
where possible; otherwise add recursive reorder/insert/JSON-path/render. Editor DnD
across columns is the bulk of the work. Deferred until L1–L3 land.

## 4. Build order & gates
L1 foundation → L2 (services first, as the proof) → verify varied themed sites →
continue L2 sweep → L3 skeletons → L4 engine. `tsc --noEmit` + visual check per
increment; each block gets a look before moving on.

## Progress

- ✅ **L1 + L2** (commit `242b92a`): ThemeLayout personality, `resolveSiteLayout`,
  section banding in `site-renderer`, `services` in grid/cards/rows.
- ✅ **L3** (commit `82400d5`): composition archetypes (classic/story_led/proof_led/
  conversion) weighted by theme category; `faq`/`cta`/`story`/`testimonial` themed
  (semantic tokens, ThemeScope dropped from testimonial). Food/storefront unchanged.
- ⏳ **Backlog**: theme remaining blocks (contact_form, menu/location/hours,
  header/footer, products_grid); **L4** true nested multi-column section engine + editor DnD.
