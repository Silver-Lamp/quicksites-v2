// lib/theme/typeScale.ts
//
// A display scale, so the headline is not the same size on every site we have ever built.
//
// ⚠️ THE MEASURED TELL. `components/admin/templates/render-blocks/hero.tsx` hard-coded
// `text-4xl md:text-5xl` — **48px on every site in the fleet**, regardless of industry, theme
// or how much the headline has to say. The Framer templates benchmarked on 2026-10-02 run
// 72px (reelio) and 220px (louver). A headline at half the size reads as a document rather
// than a design, and it is the cheapest gap to close: no new asset, no network request, no
// accessibility surface. (`docs/DESIGN_PARITY_PLAN.md` Phase 2.)
//
// ⚠️ IT IS DRIVEN BY THE FONT PAIRING'S MOOD, NOT BY THE THEME CATEGORY — AND THAT CORRECTION
// IS THE WHOLE REASON THIS REACHES ANYTHING. The plan said to use the `ThemeCategory` that
// "already exists" (`rugged | warm | professional | playful | neon | editorial`). It does
// exist, in `curatedThemes.ts`. It is also stamped on **ZERO** of the 1,929 live templates —
// checked before writing a line, precisely because this repo keeps shipping systems that are
// built, correct and unreachable. `fontPair` is on all 1,929 after the 2026-10-02 backfill, so
// the mood it carries is the one identity every site actually has. Had the plan been followed
// literally, the scale would have applied to nothing and looked finished.
//
// ⚠️ FLUID, NOT FIXED. 220px is magnificent at 1440 and unreadable at 390. Every value is a
// `clamp()`, and the MINIMUM is held at or near today's mobile size (`text-3xl`, 30px) on
// purpose: the gap measured was a desktop gap, so mobile should barely move. A scale that
// doubles the mobile headline turns one wrapped line into four and calls it design.

import { FONT_PAIRINGS } from '@/lib/theme/fontPairings';
import { INDUSTRY_FONT_MOOD, type FontMood } from '@/lib/theme/industryFontMood';
import type { IndustryKey } from '@/lib/industries';

export type TypeScale = {
  /** The hero headline. */
  display: string;
  /** The line under it. */
  lead: string;
  /** Headline leading — large type needs tighter leading or it reads as separate lines. */
  displayLeading: string;
};

/**
 * Mood → scale. Read the right-hand numbers as "min at 390px → max at 1440px".
 *
 * ⚠️ Every maximum is ABOVE the 48px everything renders at today, including the most
 * conservative one. "Try trades" (owner, 2026-10-02) — so `technical` and `bold` move too,
 * `technical` least because a diagnostic trade's headline is usually a long sentence and
 * `bold` most because a towing headline is three words and can carry the weight.
 */
export const TYPE_SCALE: Record<FontMood, TypeScale> = {
  // The person IS the product — authors, photographers, portfolios. The display case.
  editorial: { display: 'clamp(2.25rem, 6.5vw, 6rem)', lead: 'clamp(1.0625rem, 1.5vw, 1.375rem)', displayLeading: '1.02' },
  // Weight and scale: towing, hauling, concrete. Short headlines, so they can go large.
  bold: { display: 'clamp(2rem, 5.5vw, 4.75rem)', lead: 'clamp(1rem, 1.3vw, 1.25rem)', displayLeading: '1.05' },
  // Restraint signals seriousness: legal, medical, salon. Large but never shouting.
  elegant: { display: 'clamp(2rem, 5vw, 4.25rem)', lead: 'clamp(1rem, 1.3vw, 1.25rem)', displayLeading: '1.1' },
  friendly: { display: 'clamp(1.875rem, 4.75vw, 4rem)', lead: 'clamp(1rem, 1.2vw, 1.1875rem)', displayLeading: '1.08' },
  modern: { display: 'clamp(1.875rem, 4.75vw, 4rem)', lead: 'clamp(1rem, 1.2vw, 1.1875rem)', displayLeading: '1.08' },
  // Competence is the pitch: HVAC, auto repair. Longest headlines, smallest ceiling.
  technical: { display: 'clamp(1.875rem, 4.25vw, 3.5rem)', lead: 'clamp(1rem, 1.2vw, 1.1875rem)', displayLeading: '1.12' },
};

/** Today's behaviour, named: `text-3xl` → `md:text-5xl`. Nothing resolves to this — it is
 *  the baseline the table above must beat, kept here so a test can assert that it does. */
export const LEGACY_DISPLAY_MAX_PX = 48;

/**
 * The scale for a site, from its font pairing id.
 *
 * ⚠️ Returns null for an unknown or absent pairing, and the caller must then emit NOTHING.
 * A site with no pairing keeps the Tailwind classes it has always had — the painterly-backdrop
 * rule 7 shape: a missing thing renders as the plain version, never as a broken one.
 */
export function typeScaleFor(
  fontPair: string | null | undefined,
  industry?: string | null,
): TypeScale | null {
  // ⚠️ THE INDUSTRY WINS OVER THE TYPEFACE, AND THE FIRST CUT HAD IT THE OTHER WAY ROUND.
  // Keying the scale off the pairing's mood is tidy and wrong, because most sites did not
  // choose their pairing — `pickCuratedTheme` assigned one at creation, and it knows nothing
  // about mood. Measured on the owner's own three target verticals after shipping it:
  //
  //   starter-author       playfair-source  editorial   96px  ✓
  //   starter-personal     sora-inter       modern      64px
  //   starter-photography  space-inter      TECHNICAL   56px  ← the HVAC ceiling, on a photographer
  //
  // Two of the three verticals this work exists for got the conservative scale, one of them
  // the smallest in the table. The scale expresses the TRADE ("how loudly may this business
  // speak"); the pairing expresses the typeface. They are different questions and the site's
  // industry answers the first one directly. The pairing stays as the fallback for a site
  // with no industry, which is better than nothing.
  const key = String(industry ?? '').trim();
  const byIndustry = key ? INDUSTRY_FONT_MOOD[key as IndustryKey] : undefined;
  if (byIndustry && TYPE_SCALE[byIndustry]) return TYPE_SCALE[byIndustry];

  const pairing = FONT_PAIRINGS[String(fontPair ?? '').trim()];
  if (!pairing) return null;
  return TYPE_SCALE[pairing.mood] ?? null;
}

/** The scale as CSS custom properties, to be merged into the theme wrapper's inline vars. */
export function typeScaleVars(
  fontPair: string | null | undefined,
  industry?: string | null,
): Record<string, string> {
  const scale = typeScaleFor(fontPair, industry);
  if (!scale) return {};
  return {
    '--qs-display': scale.display,
    '--qs-display-leading': scale.displayLeading,
    '--qs-lead': scale.lead,
  };
}
