// lib/theme/resolveSiteLayout.ts
//
// Resolve a site's layout personality (rhythm/density/width/hero/features) from
// its stamped curated theme (data.meta.theme.layout). Returns null when the site
// has no curated layout, so the renderer leaves the plain vertical stack untouched
// (legacy sites unchanged). See LAYOUT_VARIATION_PLAN.md.

import type { ThemeLayout } from '@/lib/theme/curatedThemes';

export function resolveSiteLayout(template: any): ThemeLayout | null {
  const meta = template?.data?.meta ?? template?.meta ?? {};
  const layout = meta?.theme?.layout;
  if (!layout || typeof layout !== 'object') return null;
  // Trust the stamped shape but guard the fields the renderer switches on.
  const rhythm = layout.rhythm === 'banded' ? 'banded' : 'plain';
  const density: ThemeLayout['density'] =
    layout.density === 'tight' || layout.density === 'airy' ? layout.density : 'normal';
  const sectionWidth: ThemeLayout['sectionWidth'] =
    layout.sectionWidth === 'narrow' || layout.sectionWidth === 'wide' ? layout.sectionWidth : 'default';
  const heroLayout: ThemeLayout['heroLayout'] =
    layout.heroLayout === 'full_bleed' || layout.heroLayout === 'split' ? layout.heroLayout : 'inline';
  const featureVariant: ThemeLayout['featureVariant'] =
    layout.featureVariant === 'rows' || layout.featureVariant === 'cards' ? layout.featureVariant : 'grid';
  return { rhythm, density, sectionWidth, heroLayout, featureVariant };
}
