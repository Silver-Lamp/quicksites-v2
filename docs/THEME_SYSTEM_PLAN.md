# Curated Themes + Block Editor Theming — Plan

> Goal: give each generated/edited site a distinct look via a curated set of named
> themes, applied **industry-weighted at random** at creation and re-applyable
> (shuffle) from the editor. Fixes "every site is the same layout with a different
> button color."

Status: **planning** · Owner: Sandon · Drafted 2026-07-08

---

## 1. Why sites look alike today

A site's theme only moves three things at render time
([`lib/theme/resolveSiteTheme.ts`](../lib/theme/resolveSiteTheme.ts) L64–73):
`--primary`/`--ring` (accent), `--radius`, and `font-family`. Page background,
card/surface tint, heading font, button treatment, section rhythm and glow are
hard-coded in the blocks — so randomizing the accent only recolors buttons.

Two secondary gaps:
- **No apply-to-existing / randomizer.** `buildIndustryStarter` stamps
  `data.meta.theme` only at creation ([`industryScaffold.ts`](../lib/builder/industryScaffold.ts) L173–179).
- **Editor Theme panel drops accent/radius** — persists only font + color_mode
  ([`theme-panel.tsx`](../components/admin/templates/panels/theme-panel.tsx) L90–119).

## 2. Extended theme token model

`data.meta.theme` currently carries `{ accentColor, fontFamily, borderRadius, darkMode }`.
Extend it (backward-compatible — legacy sites omit the new fields and keep today's
thin behavior):

```ts
// lib/theme/curatedThemes.ts
export type CuratedTheme = {
  id: string;                          // 'ironworks'
  name: string;
  category: 'rugged' | 'warm' | 'professional' | 'playful' | 'neon' | 'editorial';
  industries?: IndustryKey[];          // for industry-weighting
  accentColor: string;                 // must exist in ACCENT_HSL
  accent2Color?: string;               // secondary accent, also in ACCENT_HSL
  neutral: 'warm' | 'cool' | 'pure';   // tints background/card/muted/border
  fontFamily: 'sans' | 'serif' | 'mono';
  headingFamily?: 'sans' | 'serif' | 'mono';
  borderRadius: 'sm' | 'md' | 'lg' | 'xl';
  surface: 'flat' | 'soft' | 'glow';   // shadow/glow treatment (brand motif)
  darkMode: 'light' | 'dark';
};
```

The **neutral tint** (warm/cool/pure) and the **font pairing** (§2b) are the two
highest-leverage new levers — each moves a site's whole feel more than the accent does.

## 2b. Font pairings (Canva-style)

Today "fonts" are generic system stacks (`FONT_STACKS`, resolveSiteTheme L21–26) — every
site renders in system-ui, a weak differentiator. Replace the thin `fontFamily`/`headingFamily`
generics with a reference to a curated pairing table:

```ts
// lib/theme/fontPairings.ts
export type FontPairing = {
  id: string;                    // 'fraunces-inter'
  name: string;                  // 'Fraunces · Inter'
  mood: 'editorial'|'modern'|'friendly'|'technical'|'elegant'|'bold';
  heading: { family: string; stack: string; weights: number[] };
  body:    { family: string; stack: string; weights: number[] };
};
```

`CuratedTheme` carries `fontPair: string` (keep legacy `fontFamily` as fallback). The
resolver emits `--font-heading` + `--font-body`; the site `<head>` loads just that
pairing's two families.

**Loading strategy: render-time Google Fonts `<link>` scoped per site** (each `<head>`
loads only its ~2 families, `display=swap` + `preconnect`). Keeps per-page payload tiny
and lets every site differ. (`SiteTheme.fontUrl` already exists — web fonts were
anticipated.) Rejected alt: `next/font` is build-time and can't vary per tenant without
bundling all pairings into every page.

### Draft pairings → themes

| pairing | mood | themes |
|---|---|---|
| Oswald · Inter | industrial | Ironworks |
| Archivo · Inter | bold | Timberline |
| DM Serif Display · DM Sans | elegant | Hearth |
| Fraunces · Inter | editorial | Terracotta, Gallery |
| Poppins · Inter | friendly | Bloom, Bubblegum |
| Sora · Inter | modern | Meridian |
| Space Grotesk · Inter | technical | Slate & Steel, Neon Dusk |
| Lora · Inter | approachable | Evergreen |
| Bricolage Grotesque · Inter | modern | Citrus |
| JetBrains Mono · Inter | technical | Voltage |
| Playfair Display · Source Sans 3 | editorial | Broadsheet |

## 3. Draft catalog (14 themes)

Every `accentColor`/`accent2Color` below is already in
[`ACCENT_HSL`](../lib/theme/accentHsl.ts) (no new tokens needed for this set).

| id | name | category | accent / accent2 | neutral | body / heading | radius | surface | mode | industries |
|---|---|---|---|---|---|---|---|---|---|
| `ironworks` | Ironworks | rugged | amber-600 / slate-700 | cool | sans / mono | sm | flat | dark | construction, auto, welding, hvac |
| `timberline` | Timberline | rugged | emerald-700 / amber-700 | warm | sans / sans | md | soft | dark | landscaping, outdoors, roofing |
| `hearth` | Hearth | warm | orange-500 / amber-500 | warm | sans / serif | lg | soft | light | bakery, cafe, restaurant |
| `terracotta` | Terracotta | warm | red-600 / amber-600 | warm | sans / serif | md | soft | light | restaurant, pizzeria, mediterranean |
| `bloom` | Bloom | warm | rose-500 / pink-400 | warm | sans / sans | xl | soft | light | salon, florist, spa |
| `meridian` | Meridian | professional | blue-600 / slate-700 | cool | sans / sans | sm | flat | light | legal, finance, consulting |
| `slate-steel` | Slate & Steel | professional | slate-700 / sky-500 | cool | sans / sans | md | flat | dark | b2b, tech, agency |
| `evergreen` | Evergreen | professional | teal-600 / emerald-600 | cool | sans / sans | md | soft | light | medical, dental, wellness |
| `citrus` | Citrus | playful | lime-500 / orange-500 | pure | sans / sans | xl | soft | light | fitness, juice, kids |
| `bubblegum` | Bubblegum | playful | fuchsia-500 / cyan-600 | pure | sans / sans | xl | soft | light | events, party, retail |
| `neon-dusk` | Neon Dusk | neon | fuchsia-600 / cyan-600 | cool | sans / sans | lg | glow | dark | nightlife, bar, music |
| `voltage` | Voltage | neon | violet-500 / lime-500 | pure | sans / mono | md | glow | dark | gaming, esports, tech |
| `broadsheet` | Broadsheet | editorial | gray-700 / red-600 | pure | serif / serif | sm | flat | light | author, blog, news |
| `gallery` | Gallery | editorial | zinc-700 / amber-600 | warm | sans / serif | sm | flat | light | photography, portfolio, art |

Split: 7 light / 7 dark; every category has ≥2; a `glow` pair leans on the existing
neon-steampunk brand motif.

## 4. Work plan

### Phase A — catalog + industry-weighted randomizer (low risk) — ✅ SHIPPED 2026-07-08

Built: `lib/theme/{fontPairings,curatedThemes,pickTheme}.ts`, `resolveSiteTheme` now emits
`--font-heading`/`--font-body` + a Google Fonts href, `TemplateThemeWrapper` loads the
pairing, `styles/globals.css` applies the heading font, `buildIndustryStarter` (the single
funnel for guest/admin-new/demo/listing-rebuild) stamps a curated theme, `theme-panel`
persistence gap fixed. Guard tests: `lib/theme/__tests__/curatedThemes.test.ts` (10),
scaffold test still green. `tsc --noEmit` clean. **Note:** scaffolded `color_mode` now
follows the chosen theme's mode (7 light / 7 dark) instead of always-dark — intentional
for variety.

Original scope:
- `lib/theme/curatedThemes.ts` (new) — the 14 themes above.
- `lib/theme/accentHsl.ts` — add tokens only if the catalog grows past the current set.
- `lib/theme/pickTheme.ts` (new) — `pickCuratedTheme({ industry, avoidAccent })`,
  industry-weighted, never repeats the last accent.
- `lib/builder/industryScaffold.ts` — `themeForIndustry` → `pickCuratedTheme`, stamp
  full object into `data.meta.theme`.
- `lib/builder/generateDemoSite.ts` + guest create — use `pickCuratedTheme` so
  generated/demo/guest sites diverge.
- `theme-panel.tsx` — write the complete `data.meta.theme` object (fix persistence gap).

### Phase B — richer render tokens (differentiation core)
1. Extend `resolveSiteTheme` to emit — **only when a curated theme is stamped**
   (preserve the `return null` fall-through for legacy sites): accent + secondary
   (`--primary`/`--primary-foreground`/`--secondary`/`--secondary-foreground`/`--accent`/
   `--ring`), the neutral palette (`--background`, `--foreground`, `--card`,
   `--card-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input` via a new
   `NEUTRAL_PALETTES[neutral][mode]` map), `--font-heading`/`--font-body`, and a surface
   shadow/glow token. **`color_mode` selects the light/dark variant of the neutral
   palette** (unifies the toolbar toggle with theming — see §5).
2. **Block refactor (the real cost — 0 of 12 blocks are theme-ready, see §5):** replace
   each block's `colorMode ? 'bg-white' : 'bg-neutral-950'` ternary with semantic tokens
   (`bg-background`/`bg-card`/`text-foreground`/…), deleting the `colorMode` plumbing.
   Neutralize `ThemeScope` + `SectionShell` so they stop toggling `.dark` globally.
   Block-by-block sweep with a visual check each.
3. Font pairings (§2b): `lib/theme/fontPairings.ts` + a per-site Google Fonts `<link>`
   injector in the site `<head>`; `--font-heading`/`--font-body` vars; a `font-heading`
   utility applied to headings in the audited blocks.

### Phase C — editor UX
- `TemplateActionToolbar.tsx` — theme group next to Light/Dark (L558): picker-popover
  trigger + 🎲 Shuffle, applied via the existing `apply()` + `qs:preview:*` bus.
- `theme-picker-popover.tsx` (new) — curated grid of live swatch thumbnails, reusing
  the [`work-background-picker.tsx`](../components/profile/work-background-picker.tsx)
  card/active-ring pattern.

### Order of execution
1. Block color audit (spike) — determines Phase B size.
2. Phase A (shippable alone).
3. Phase B resolver + neutral palettes + token swaps.
4. Phase C toolbar shuffle + picker.

Gates: `npm run typecheck` green throughout; `next build` before shipping render changes.

## 5. Block color audit — results

**Headline: the "free cascade" does NOT hold.** The Tailwind→var mapping is correct
(`tailwind.config.ts` L30-64 maps `bg-background`/`card`/`muted`/`primary`/`secondary`/
`border` → `hsl(var(--…))`, `rounded-*` → `var(--radius)`), **but the blocks don't use
those semantic tokens.** They take a `colorMode: 'light'|'dark'` prop and pick **hardcoded**
colors via ternary — e.g. `colorMode === 'light' ? 'bg-white' : 'bg-neutral-950'`
(`testimonial.tsx:68`) — and render inside `ThemeScope` (`components/ui/theme-scope.tsx`),
which toggles the global `.dark` class. Our var-on-a-wrapper approach sets neither
`colorMode` nor `.dark`, so those branches ignore our vars entirely. **0 of 12 blocks
are theme-ready today.**

| block | file | verdict | ~hardcoded | notes |
|---|---|---|---|---|
| hero | `hero.tsx` | HARDCODED | 22 | 5× colorMode ternaries |
| services | `services.tsx` | HARDCODED | 10 | colorMode |
| menu | `menu.tsx` | MIXED | 37 | only `text-muted-foreground`; 19 `dark:` variants (won't fire) |
| location | `location.tsx` | MIXED | 10 | `text-muted-foreground` + `dark:` variants |
| hours | `hours.tsx` | HARDCODED | 20 | colorMode |
| contact_form | `contact-form.tsx` | HARDCODED | 20 | colorMode + ThemeScope, 452 ln |
| faq | `faq.tsx` | HARDCODED | 6 | small, cheap |
| cta | `cta.tsx` | HARDCODED | 2 | button `bg-green-600`; wraps `SectionShell` (colorMode) |
| order_bar | `order-bar.tsx` | HARDCODED | 10 | `dark:` variants |
| testimonial | `testimonial.tsx` | HARDCODED | 17 | heaviest — 9 colorMode branches + ThemeScope |
| header | `header.tsx` | HARDCODED | 18 | colorMode |
| footer | `footer.tsx` | HARDCODED | 9 | colorMode, 516 ln |

**Consequences for the plan:**
- **Phase B is a 12-block refactor, not a map extension.** But it's mechanical and
  repeatable: replace each `colorMode ? 'bg-white' : 'bg-neutral-950'` with a single
  `bg-background`/`bg-card`/`text-foreground`/… token. This *also deletes* the `colorMode`
  ternaries and plumbing — a legacy-debt win, not just theming.
- **Reconcile light/dark with the toolbar toggle:** stop driving surfaces off the
  `colorMode` prop. Instead the toolbar Light/Dark toggle picks the **light vs dark
  variant of the theme's neutral palette** inside `resolveSiteTheme` (i.e. `color_mode`
  selects `NEUTRAL_PALETTES[neutral][mode]`). One code path, both levers flow through vars.
- **Neutralize `ThemeScope` + `SectionShell`'s colorMode** (`components/ui/theme-scope.tsx`,
  `components/ui/section-shell.tsx`) — they fight a var-based theme by toggling `.dark`
  globally.
- **Expand the emitted var set** beyond the first list: also set `--card-foreground`,
  `--primary-foreground`, `--secondary-foreground`, `--accent`/`--accent-foreground`,
  `--input`, `--ring` — or foreground text won't track the background changes.
- **Font swap needs zero per-block edits:** headings are real `<h1/h2/h3>` tags with no
  shared component, so scope it in wrapper CSS —
  `[data-qs-themed] h1, [data-qs-themed] h2, [data-qs-themed] h3 { font-family: var(--font-heading) }`.

**Effort tiers:** trivial (cta, faq, order_bar, location) · moderate (services, hours,
header, footer, hero, menu) · heavier (testimonial, contact_form). All 12 need edits;
none are hard, but it's real surface area — best done as a focused, block-by-block sweep
with a visual check per block.
