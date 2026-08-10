// lib/sites/heroBackdrop.ts
//
// Which painting, if any, sits behind a site's hero.
//
// ⚠️ ONE PAINTING PER SURFACE CLASS, NEVER PER SITE. Each entry here is a committed build artifact
// shared by every site of that kind: bought once at ~$0.04, free thereafter, versioned with the
// copy on top of it. Per-site would multiply by an unbounded count (Verbatim generates portfolios;
// every city we enter gets an apex).
//
// ⚠️ AND THE CLASSES ARE DELIBERATELY OURS. A portfolio hero and a city-directory hero are pages
// WE own the framing of. A restaurant's own site is not in this map and must not be: a generated
// picture behind a real named business reads as a photograph of that business, which is rule 9's
// logic one layer up from people. The apex painting is an abstract still life for the same reason
// — a plated dish above a list of real restaurants would read as one of theirs.

import { isPersonTemplate } from './personSite';
import { PORTFOLIO_HERO_BACKDROP, PORTFOLIO_HERO_SCRIM } from './portfolioTheme';
import type { ScrimWeight } from '@/components/site/painterly-backdrop';

export const APEX_FOOD_BACKDROP = '/brand/apex-food.webp';

/** Restaurant-directory apex (`<city>-restaurant.com`). */
export const RESTAURANT_APEX_SITE_TYPE = 'restaurant_apex';

export type HeroBackdrop = { src: string; scrim: ScrimWeight; opacity: number } | null;

/**
 * ⚠️ Scrim direction is a property of the IMAGE, not a default (recipe rule 8). The apex still
 * life keeps its open negative space in the UPPER half, where the headline sits — so the scrim is
 * top-weighted. The portfolio room's light is centre-right against left-aligned copy, so that one
 * runs sideways. Neither is a house style; each was chosen by looking at the painting.
 */
export function heroBackdropFor(data: any): HeroBackdrop {
  const meta = data?.meta ?? {};

  // An explicit opt-out or override wins for any site.
  if (meta.hero_backdrop === false) return null;
  if (typeof meta.hero_backdrop === 'string' && meta.hero_backdrop.trim()) {
    return {
      src: meta.hero_backdrop.trim(),
      scrim: (meta.hero_backdrop_scrim as ScrimWeight) ?? 'even',
      opacity: 0.45,
    };
  }

  if (meta.site_type === RESTAURANT_APEX_SITE_TYPE) {
    return { src: APEX_FOOD_BACKDROP, scrim: 'top', opacity: 0.4 };
  }
  if (isPersonTemplate(data)) {
    return { src: PORTFOLIO_HERO_BACKDROP, scrim: PORTFOLIO_HERO_SCRIM, opacity: 0.45 };
  }
  return null;
}
