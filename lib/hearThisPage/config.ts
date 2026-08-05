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
// PHASE 1: env-gated, summary-only, one platform embed.
// PHASE 2 (this file's settings types): a super-admin config in `site_settings` (loaded
// server-side by lib/hearThisPage/settings.ts) lets an admin enable/disable per surface and
// widen the registers per surface. `data-kinds` (HJ #1475) only ever NARROWS the embed's
// enabled_kinds, so exposing this is safe. The ENABLED env flag remains the master switch
// (and the billing gate) on top of the settings.
//
// Everything here is pure + client-safe. The DB load lives in ./settings.ts (server).

export type HearThisPageKind = 'summary' | 'eli10' | 'pitch_panel' | 'whats_new';

/** Public surface buckets a super-admin can configure independently. */
export type HearThisPageSurface = 'home' | 'sites' | 'marketing';

export const ALL_KINDS: HearThisPageKind[] = ['summary', 'eli10', 'pitch_panel', 'whats_new'];
export const ALL_SURFACES: HearThisPageSurface[] = ['home', 'sites', 'marketing'];

/** Master switch (build-time, client + server). Default OFF. Also the billing gate. */
export const HEAR_THIS_PAGE_ENABLED =
  process.env.NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED === '1' ||
  process.env.NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED === 'true';

/**
 * The platform house-narrator embed (HJ-minted: "QuickSites — Hear this page (platform
 * house)", voice_mode narrator, allowed quicksites.ai + delivered.menu, enabled_kinds
 * summary+pitch_panel+eli10). Baked in as the default (public id) so the single ENABLED
 * flag is the only switch to arm it. Env-overridable; still inert until the flag is on.
 */
export const HEAR_THIS_PAGE_EMBED_ID =
  process.env.NEXT_PUBLIC_HEAR_THIS_PAGE_EMBED_ID || '1cda57cc-23f0-4973-b49e-6620b60137ce';

/** Universal default: the short version only. */
export const DEFAULT_KINDS: HearThisPageKind[] = ['summary'];

/** Per-surface configuration a super-admin controls (site_settings key `hear_this_page`). */
export type HearThisPageSurfaceConfig = { enabled: boolean; kinds: HearThisPageKind[] };
export type HearThisPageSettings = {
  surfaces: Record<HearThisPageSurface, HearThisPageSurfaceConfig>;
};

/** Default: every surface on, short-version only. */
export const DEFAULT_SETTINGS: HearThisPageSettings = {
  surfaces: {
    home: { enabled: true, kinds: ['summary'] },
    sites: { enabled: true, kinds: ['summary'] },
    marketing: { enabled: true, kinds: ['summary'] },
  },
};

/** Coerce arbitrary jsonb into a valid settings object (drops unknown kinds/surfaces). */
export function normalizeSettings(raw: any): HearThisPageSettings {
  const out: HearThisPageSettings = {
    surfaces: {
      home: { ...DEFAULT_SETTINGS.surfaces.home },
      sites: { ...DEFAULT_SETTINGS.surfaces.sites },
      marketing: { ...DEFAULT_SETTINGS.surfaces.marketing },
    },
  };
  const s = raw?.surfaces;
  if (s && typeof s === 'object') {
    for (const surface of ALL_SURFACES) {
      const cfg = s[surface];
      if (cfg && typeof cfg === 'object') {
        out.surfaces[surface].enabled = cfg.enabled !== false;
        const kinds = Array.isArray(cfg.kinds)
          ? cfg.kinds.filter((k: any): k is HearThisPageKind => ALL_KINDS.includes(k))
          : [];
        // Always keep summary present as the baseline; de-dupe.
        out.surfaces[surface].kinds = Array.from(new Set<HearThisPageKind>(['summary', ...kinds]));
      }
    }
  }
  return out;
}

// Pathname prefixes where the launcher must NOT appear: auth, admin, and interactive
// commerce/dashboard flows. Everything else public gets it. A denylist beats an allowlist —
// there are far more public routes than private ones.
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
  '/jobs', // SecondSet service-job portal has its own "Hear this report" player
  '/service-jobs',
  // ⚠️ A CONTRACT PAGE, WHERE THE ONE THING THAT MATTERS IS THAT SOMEONE READS THE WORDS. The
  // launcher is fixed bottom-left and sat on top of the agreement text — found by screenshotting
  // the live page a real contributor was about to be sent to. Two reasons it must not be here,
  // and the second is the load-bearing one: it obscures the document, and a house narrator
  // offering to summarise ("the short version") a legal agreement someone is about to sign is
  // the wrong thing to offer at that moment, however good the summary is.
  '/sign',
];

/** Which configurable surface a pathname belongs to. */
export function surfaceForPathname(pathname: string | null | undefined): HearThisPageSurface {
  if (!pathname || pathname === '/') return 'home';
  if (pathname.startsWith('/sites/')) return 'sites';
  return 'marketing';
}

/**
 * Whether the launcher should show on a pathname. Excludes non-public routes; when
 * settings are provided, also respects the per-surface `enabled` toggle.
 */
export function hearThisPageVisibleFor(
  pathname: string | null | undefined,
  settings?: HearThisPageSettings | null,
): boolean {
  if (!pathname) return false;
  if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return false;
  if (settings && settings.surfaces[surfaceForPathname(pathname)]?.enabled === false) return false;
  return true;
}

/** Kinds to render for a pathname — from the per-surface config, else the summary default. */
export function resolveKinds(
  pathname: string | null | undefined,
  settings?: HearThisPageSettings | null,
): HearThisPageKind[] {
  if (!settings) return DEFAULT_KINDS;
  const cfg = settings.surfaces[surfaceForPathname(pathname)];
  return cfg?.kinds?.length ? cfg.kinds : DEFAULT_KINDS;
}

/** One-line honest label for the house-narrator voice (never "their own voice"). */
export const HEAR_THIS_PAGE_VOICE_LABEL = 'Narrated · the short version';
