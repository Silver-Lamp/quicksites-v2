// lib/home/showcase-helpers.ts
//
// Shared helpers + display-mode contract for the homepage "Built with QuickSites"
// showcase. Used by the JSON feed, the generated-thumbnail route, and the
// client component.

export type ShowcaseDisplayMode = 'thumbnail' | 'og' | 'hero' | 'logo';

export const SHOWCASE_DISPLAY_MODES: ShowcaseDisplayMode[] = ['thumbnail', 'og', 'hero', 'logo'];
export const DEFAULT_SHOWCASE_MODE: ShowcaseDisplayMode = 'thumbnail';

/** site_settings key holding the chosen showcase display mode. */
export const SHOWCASE_MODE_KEY = 'showcase_display_mode';

/** site_settings key holding the list of admin-hidden showcase slugs. */
export const SHOWCASE_HIDDEN_KEY = 'showcase_hidden_slugs';

/** site_settings key holding the admin-defined showcase order (array of slugs). */
export const SHOWCASE_ORDER_KEY = 'showcase_order';

export const SHOWCASE_MODE_LABELS: Record<ShowcaseDisplayMode, string> = {
  thumbnail: 'Thumbnail',
  og: 'OG image',
  hero: 'Hero',
  logo: 'Logo',
};

export function isShowcaseMode(x: unknown): x is ShowcaseDisplayMode {
  return typeof x === 'string' && (SHOWCASE_DISPLAY_MODES as string[]).includes(x);
}

/** Fallback display name from a slug, e.g. "graftontowing" → "Graftontowing". */
export function prettifySlug(slug: string): string {
  const s = (slug || '').replace(/[-_]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : slug;
}

/** First non-empty string, treating '' / whitespace as absent. */
export function firstNonEmpty(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) if (v && v.trim()) return v;
  return null;
}

/**
 * Pull a hero image from a site's `data` JSON (the real hero lives in the
 * content blocks, not the top-level hero_url column). Prefers a `/hero/` path.
 */
export function extractHeroImage(data: unknown): string | null {
  if (!data) return null;
  let text: string;
  try {
    text = typeof data === 'string' ? data : JSON.stringify(data);
  } catch {
    return null;
  }
  const urls = text.match(/https?:\/\/[^"'\\\s]+\.(?:png|jpe?g|webp)/gi);
  if (!urls?.length) return null;
  return urls.find((u) => /\/hero\//i.test(u)) || urls[0];
}
