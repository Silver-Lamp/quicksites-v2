// lib/ab/siteAb.ts
//
// A/B test on a SITE's home page (owner, 2026-10-16 — the caveman clip is B Hard's B, not the
// QuickSites homepage's). Pure half. A = the published page as it is. B = the same page with the
// first hero's content overridden by `b.hero` — typically a looping background video (muted,
// poster first) and optionally different words. Everything else on the page is untouched, so
// the test measures the hero and nothing else.
//
// Assignment: a sticky cookie per experiment (`qs_ab_<8 hex of the template id>`), set by the
// beacon route on first exposure; the page never writes cookies. Counting: `ab_events`, unique
// visitors, experiment = `site:<template_id>`.
import { pickVariant, type AbVariant, type HomepageAbSettings } from '@/lib/ab/homepage';

export type SiteAbHero = {
  video_url?: string;
  poster_url?: string;
  image_url?: string;
  headline?: string;
  subheadline?: string;
  cta_text?: string;
  layout_mode?: 'background' | 'full_bleed' | 'inline' | 'media_split';
  has_audio?: boolean;
};
export type SiteAbTest = { templateId: string; enabled: boolean; split_b: number; b: { hero: SiteAbHero } | null; note?: string; started_at?: string | null };

const isHttps = (v: unknown): v is string => typeof v === 'string' && /^https:\/\//.test(v.trim());
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export function siteExperimentId(templateId: string): string {
  return `site:${templateId}`;
}
export function siteAbCookie(templateId: string): string {
  return `qs_ab_${templateId.replace(/-/g, '').slice(0, 8)}`;
}
/** `site:<uuid>` → the template id; null for anything else. */
export function templateIdFromExperiment(experiment: string): string | null {
  const m = /^site:([0-9a-f-]{36})$/i.exec(experiment);
  return m ? m[1] : null;
}

/** A row → a safe test. Enabled only when B's hero has something to show (a video or an image). */
export function parseSiteAb(templateId: string, row: unknown): SiteAbTest {
  const r = (row ?? {}) as Record<string, any>;
  const h = r.b && typeof r.b === 'object' && r.b.hero && typeof r.b.hero === 'object' ? r.b.hero : null;
  const hero: SiteAbHero | null = h
    ? {
        video_url: isHttps(h.video_url) ? h.video_url.trim() : undefined,
        poster_url: isHttps(h.poster_url) ? h.poster_url.trim() : undefined,
        image_url: isHttps(h.image_url) ? h.image_url.trim() : undefined,
        headline: str(h.headline),
        subheadline: str(h.subheadline),
        cta_text: str(h.cta_text),
        layout_mode: ['background', 'full_bleed', 'inline', 'media_split'].includes(h.layout_mode) ? h.layout_mode : undefined,
        has_audio: h.has_audio === true,
      }
    : null;
  const usable = !!hero && (!!hero.video_url || !!hero.image_url);
  const split = Number(r.split_b);
  return {
    templateId,
    enabled: r.enabled === true && usable,
    split_b: Number.isFinite(split) ? Math.min(100, Math.max(0, Math.round(split))) : 50,
    b: usable ? { hero: hero! } : null,
    note: typeof r.note === 'string' ? r.note : undefined,
    started_at: typeof r.started_at === 'string' ? r.started_at : null,
  };
}

export function pickSiteVariant(test: SiteAbTest, cookieValue: string | null | undefined, rng?: () => number) {
  const asSettings: HomepageAbSettings = { enabled: test.enabled, split_b: test.split_b, b: null };
  // pickVariant gates on `enabled` only through the settings object; B's presence is in `enabled`.
  return pickVariant({ ...asSettings, enabled: test.enabled }, cookieValue, rng);
}

/**
 * The B page: the published data with the FIRST hero's content overridden. Walks both page
 * arrays and both content copies (CLAUDE.md §8: never edit template data by one path). Returns
 * a new object; the input is untouched. A page with no hero is returned unchanged.
 */
export function applySiteVariantB<T>(data: T, hero: SiteAbHero): T {
  const d: any = JSON.parse(JSON.stringify(data ?? {}));
  const pages = Array.isArray(d.pages) ? d.pages : [];
  const page = pages[0];
  if (!page) return d;
  const patch: Record<string, unknown> = {};
  if (hero.video_url) patch.video_url = hero.video_url;
  if (hero.poster_url) patch.image_url = hero.poster_url;
  if (hero.image_url) patch.image_url = hero.image_url;
  if (hero.headline) patch.headline = hero.headline;
  if (hero.subheadline) patch.subheadline = hero.subheadline;
  if (hero.cta_text) patch.cta_text = hero.cta_text;
  patch.layout_mode = hero.layout_mode ?? (hero.video_url ? 'background' : 'inline');
  if (hero.video_url) patch.video_has_audio = hero.has_audio === true;
  for (const key of ['blocks', 'content_blocks'] as const) {
    const list = Array.isArray(page[key]) ? page[key] : [];
    const b = list.find((x: any) => x?.type === 'hero');
    if (!b) continue;
    for (const c of [b.content, b.props]) if (c && typeof c === 'object') Object.assign(c, patch);
  }
  return d;
}

export type { AbVariant };
