// lib/ab/homepage.ts
//
// The homepage A/B test, pure half (owner, 2026-10-16). One experiment — `homepage_hero` — with
// two variants: A is the homepage as it is; B swaps the hero's motif background for a short
// looping video (muted until the visitor asks for sound) and may override the headline/subhead.
//
// Assignment is a sticky cookie set the first time a visitor is EXPOSED (the beacon route sets
// it); the page itself never writes cookies. Counting is DB-backed (`ab_events`) with PostHog as
// a mirror — the CLAUDE.md rule, because an absent analytics key and "nobody converted" look the
// same from the inside.
export const AB_EXPERIMENT = 'homepage_hero';
export const AB_COOKIE = 'qs_ab_home';
export const AB_COOKIE_DAYS = 180;
export type AbVariant = 'A' | 'B';
export const AB_EVENTS = ['exposure', 'cta_click', 'guest_build_started', 'signup_click'] as const;
export type AbEventName = (typeof AB_EVENTS)[number];

export type HomepageAbB = {
  video_url: string;
  poster_url: string;
  headline?: string;
  subhead?: string;
  /** The video carries (or is overlaid with) an audio track the visitor may switch on. */
  has_audio?: boolean;
};
export type HomepageAbSettings = {
  enabled: boolean;
  /** Percent of NEW visitors who get B. */
  split_b: number;
  b: HomepageAbB | null;
  note?: string;
  started_at?: string | null;
};

const isHttps = (v: unknown): v is string => typeof v === 'string' && /^https:\/\//.test(v.trim());
const clampPct = (n: unknown) => (Number.isFinite(Number(n)) ? Math.min(100, Math.max(0, Math.round(Number(n)))) : 50);

/** `site_settings.homepage_ab` → a safe shape. Disabled when B has no https video + poster. */
export function parseHomepageAb(raw: unknown): HomepageAbSettings {
  const r = (raw ?? {}) as Record<string, any>;
  const b = r.b && typeof r.b === 'object' ? r.b : null;
  const parsedB: HomepageAbB | null =
    b && isHttps(b.video_url) && isHttps(b.poster_url)
      ? {
          video_url: b.video_url.trim(),
          poster_url: b.poster_url.trim(),
          headline: typeof b.headline === 'string' && b.headline.trim() ? b.headline.trim() : undefined,
          subhead: typeof b.subhead === 'string' && b.subhead.trim() ? b.subhead.trim() : undefined,
          has_audio: b.has_audio === true,
        }
      : null;
  return {
    enabled: r.enabled === true && !!parsedB,
    split_b: clampPct(r.split_b ?? 50),
    b: parsedB,
    note: typeof r.note === 'string' ? r.note : undefined,
    started_at: typeof r.started_at === 'string' ? r.started_at : null,
  };
}

/** The variant for this request: the cookie's when valid, else a fresh draw. `assigned` = the draw. */
export function pickVariant(settings: HomepageAbSettings, cookieValue: string | null | undefined, rng: () => number = Math.random): { variant: AbVariant; assigned: boolean } {
  if (!settings.enabled) return { variant: 'A', assigned: false };
  if (cookieValue === 'A' || cookieValue === 'B') return { variant: cookieValue, assigned: false };
  return { variant: rng() * 100 < settings.split_b ? 'B' : 'A', assigned: true };
}

export function isAbEventName(v: unknown): v is AbEventName {
  return typeof v === 'string' && (AB_EVENTS as readonly string[]).includes(v);
}

export type AbCount = { variant: AbVariant; event: string; visitors: number };
export type AbSummaryRow = { variant: AbVariant; exposures: number; cta_click: number; guest_build_started: number; signup_click: number; cta_rate: number | null; build_rate: number | null };

/** Per-variant unique-visitor counts → rates. A rate with no exposures is null, never 0. */
export function summarizeAb(counts: AbCount[]): AbSummaryRow[] {
  return (['A', 'B'] as AbVariant[]).map((variant) => {
    const n = (event: string) => counts.find((c) => c.variant === variant && c.event === event)?.visitors ?? 0;
    const exposures = n('exposure');
    const row: AbSummaryRow = { variant, exposures, cta_click: n('cta_click'), guest_build_started: n('guest_build_started'), signup_click: n('signup_click'), cta_rate: null, build_rate: null };
    if (exposures > 0) {
      row.cta_rate = row.cta_click / exposures;
      row.build_rate = row.guest_build_started / exposures;
    }
    return row;
  });
}
