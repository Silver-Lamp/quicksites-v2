// lib/hearThisPage/config.ts
//
// "Hear this page" — a platform-default About That launcher on every PUBLIC surface
// (published tenant sites + marketing pages + delivered.menu), narrating the page in a
// house narrator, defaulting to the SHORT VERSION (`summary`) only.
//
// This is distinct from the opt-in In Your Voice block (owner voice on a specific page):
// hear-this-page is a site-wide house-narrator affordance. Where an owner has added their
// own In Your Voice block, that owner-voice player is the richer experience; this launcher
// is the universal baseline.
//
// PHASE 1 (this file): env-gated, summary-only, one platform embed. Flag OFF until HJ
// delivers a platform house-narrator embed + the domain-allow model (see
// crosstalk/contracts/about-that-embed.md + the mesh "hear this page" thread).
// PHASE 2: a super-admin config in `site_settings` lets an admin enable extra registers
// (pitch_panel / eli10 / whats_new) per surface — gated on HJ supporting a per-instance
// kind allowlist (data-kinds). `resolveKinds()` is the seam that config will feed.

export type HearThisPageKind = 'summary' | 'eli10' | 'pitch_panel' | 'whats_new';

/** Master switch (build-time, client + server). Default OFF. */
export const HEAR_THIS_PAGE_ENABLED =
  process.env.NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED === '1' ||
  process.env.NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED === 'true';

/** The platform house-narrator embed (from HJ). Empty until minted → nothing renders. */
export const HEAR_THIS_PAGE_EMBED_ID = process.env.NEXT_PUBLIC_HEAR_THIS_PAGE_EMBED_ID || '';

/** Universal default: the short version only. Super-admin config can widen this later. */
export const DEFAULT_KINDS: HearThisPageKind[] = ['summary'];

// Pathname prefixes where the launcher must NOT appear: auth, admin, and interactive
// commerce/dashboard flows. Everything else public (/, /sites/*, marketing pages,
// delivered.menu) gets it. A denylist beats an allowlist here — there are far more
// public routes than private ones.
const EXCLUDED_PREFIXES = [
  '/admin',
  '/login',
  '/logout',
  '/auth',
  '/join',
  '/author-join',
  '/dashboard',
  '/merchant',
  '/checkout',
  '/cart',
  '/claim',
  '/claim-site',
  '/claim-success',
  '/preview',
  '/actions',
];

/** Whether the hear-this-page launcher should show on a given pathname. */
export function hearThisPageVisibleFor(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Kinds to render for a surface. Phase 1 always returns the summary-only default;
 * Phase 2 will override from the super-admin `site_settings` config per surface.
 */
export function resolveKinds(_surface?: string): HearThisPageKind[] {
  return DEFAULT_KINDS;
}

/** One-line honest label for the house-narrator voice (never "their own voice"). */
export const HEAR_THIS_PAGE_VOICE_LABEL = 'Narrated · the short version';
