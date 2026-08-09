// lib/sites/portfolioTheme.ts
//
// The one place that decides how a QuickSites portfolio/résumé site differs from every other site.
//
// ⚠️ BUILT AS THE TEMPLATE, NOT AS ONE PAGE. sandon.quicksites.ai is portfolio site #1, and
// Verbatim generates this whole class from a résumé — so the count is unbounded and the copy-then-
// fork moment is guaranteed to arrive. `crosstalk/contracts/painterly-backdrop.md` (rule 3, PH's
// redline) names that moment as the EXTRACT moment rather than the duplicate moment, which is why
// this exists before the second site does instead of after the third.
//
// ⚠️ ONE PAINTING, SHARED BY EVERY PORTFOLIO SITE. A per-site hero would be ~$0.04 × unbounded.
// The default is a committed build artifact (`public/brand/portfolio-hero.webp`, painted by
// scripts/paint-portfolio-hero.ts), so the class is bought once and costs nothing per site. A site
// that wants its own sets `data.meta.hero_backdrop` and overrides it — the pool pattern from
// lib/theme/backdropPool.ts, applied to a page-level asset.

import { isPersonTemplate } from './personSite';
import type { ScrimWeight } from '@/components/site/painterly-backdrop';

/** The shared painting behind every portfolio hero. */
export const PORTFOLIO_HERO_BACKDROP = '/brand/portfolio-hero.webp';

/**
 * ⚠️ SCRIM DIRECTION IS A PROPERTY OF THE IMAGE, NOT A DEFAULT. Rule 8: the scrim goes where THIS
 * painting's bright region actually lands. In the shared portfolio hero the light is a sunlit wall
 * on the centre-right while the headline sits left, so the gradient runs left-heavy — a top or
 * bottom scrim would either dim the only warm thing in the frame or leave the text fighting it.
 * A site supplying its own backdrop must say where its own light is.
 */
export const PORTFOLIO_HERO_SCRIM: ScrimWeight = 'left';

export type PortfolioHeroBackdrop = { src: string; scrim: ScrimWeight; opacity: number } | null;

/**
 * The backdrop for this site's hero, or null.
 *
 * ⚠️ NULL IS A FIRST-CLASS ANSWER (rule 7). The hero must read correctly with no painting at all —
 * an unpainted asset, a site that opted out, a business site that was never in scope. Callers
 * render nothing rather than a placeholder, and the null path is the one to test first.
 */
export function portfolioHeroBackdrop(data: any): PortfolioHeroBackdrop {
  if (!isPersonTemplate(data)) return null;
  const meta = data?.meta ?? {};
  if (meta.hero_backdrop === false) return null;

  const custom = typeof meta.hero_backdrop === 'string' ? meta.hero_backdrop.trim() : '';
  if (custom) {
    const scrim = (meta.hero_backdrop_scrim as ScrimWeight) ?? 'even';
    return { src: custom, scrim, opacity: 0.45 };
  }
  return { src: PORTFOLIO_HERO_BACKDROP, scrim: PORTFOLIO_HERO_SCRIM, opacity: 0.45 };
}
