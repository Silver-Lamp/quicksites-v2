// lib/theme/backdrops.ts
//
// Site backdrops — the layer that stops a site rendering as one flat color.
//
// A backdrop is a STYLE + some adjustable content, stored on the template at
// `data.meta.backdrop`. Most styles are pure CSS derived from the site's own theme vars
// (`--primary`, `--background`), so they cost nothing, need no storage, render at first
// paint, and follow the site's accent + light/dark automatically. One style — `painterly`
// — is a generated image and is the only one that spends money.
//
// WHY CSS-FIRST (this is the load-bearing decision, don't quietly reverse it):
// The mesh painterly-backdrop standard (crosstalk/contracts/painterly-backdrop.md) rule 2
// says generation is **owner/admin-triggered, never per-request**. A site created by a
// signup — or by an anonymous guest-build visitor — is not owner-triggered, so making
// image generation the DEFAULT would both violate rule 2 and put an unbounded ~$0.04/call
// spend behind an endpoint anonymous users can reach. CSS styles carry the default; the
// generated style is opt-in, per site, by an admin.
//
// Rule 7 (degrade to plain) is satisfied structurally: every style is a background layer
// UNDER the content. A missing painterly image 404s and the plain themed background shows
// through — a site with no backdrop is exactly today's site, never a broken one.
//
// Client-safe: pure data + pure functions, no server imports. The wrapper imports this.

import type { CSSProperties } from 'react';

/** Backdrop styles. `none` reproduces the pre-2026-07 flat look. */
export type BackdropStyle =
  | 'none'
  | 'wash'      // soft radial accent bloom — the quiet default
  | 'mesh'      // multi-point gradient mesh, most "designed"
  | 'aurora'    // angled ribbons of accent light
  | 'grid'      // blueprint line grid — trades, construction, technical
  | 'dots'      // dot matrix — clean/product
  | 'paper'     // warm tonal paper — editorial, personal, author, portfolio
  | 'topo'      // contour lines — tech/SaaS/product, feature pages
  | 'circuit'   // traces + nodes — engineering, electrical, IT, security
  | 'ledger'    // fine ruled columns — finance, legal, consulting, B2B
  | 'painterly'; // generated image (costs money; see paintBackdrop.ts)

export const BACKDROP_STYLES: BackdropStyle[] = [
  'none', 'wash', 'mesh', 'aurora', 'grid', 'dots', 'paper', 'topo', 'circuit', 'ledger', 'painterly',
];

/** Persisted shape at `template.data.meta.backdrop`. All fields optional but `style`. */
export type SiteBackdrop = {
  style: BackdropStyle;
  /** 0–100. How strongly the backdrop reads. Default 50. */
  intensity?: number;
  /** `painterly` only: the stored public URL, WITH its `?v=` cache-bust (standard rule 3). */
  url?: string | null;
  /** `painterly` only: the subject the owner asked for — kept so a repaint is reproducible. */
  subject?: string | null;
  /** Set when applied by the bulk upgrade, so a later pass can tell auto from hand-picked. */
  auto?: boolean;
};

/** Human labels for the editor picker. */
export const BACKDROP_LABELS: Record<BackdropStyle, string> = {
  none: 'None (flat)',
  wash: 'Soft wash',
  mesh: 'Gradient mesh',
  aurora: 'Aurora',
  grid: 'Blueprint grid',
  dots: 'Dot matrix',
  paper: 'Paper',
  topo: 'Contour',
  circuit: 'Circuit',
  ledger: 'Ledger',
  painterly: 'Painterly (AI image)',
};

export const BACKDROP_HINTS: Record<BackdropStyle, string> = {
  none: 'A single flat background color.',
  wash: 'A gentle bloom of your accent color. Safe on any site.',
  mesh: 'Several soft color pools that blend — the most designed-looking option.',
  aurora: 'Angled ribbons of light across the page.',
  grid: 'A faint technical grid. Suits trades, construction and engineering.',
  dots: 'An even dot field. Clean and product-like.',
  paper: 'Warm tonal paper. Suits writing, portfolios and personal sites.',
  topo: 'Soft contour lines. Modern and technical — good behind feature and product pages.',
  circuit: 'Fine traces and nodes. Suits engineering, electrical, IT and security.',
  ledger: 'Quiet ruled columns. Understated and corporate — finance, legal, consulting.',
  painterly: 'A generated painting behind the page. Costs money to create, one per site.',
};

/** Industry → the default that flatters it. Everything not listed gets `wash`. */
const INDUSTRY_DEFAULTS: Record<string, BackdropStyle> = {
  // Writing / personal / showing work — editorial paper reads as intentional, not corporate.
  personal: 'paper',
  author: 'paper',
  photography: 'paper',
  art: 'paper',
  // Technical + trades — a faint grid suggests drawings and precision.
  deck_builder: 'grid',
  construction: 'grid',
  contractor: 'grid',
  roofing: 'grid',
  plumbing: 'grid',
  hvac: 'grid',
  towing: 'grid',
  auto_repair: 'grid',
  // Hospitality + retail — warmth and depth.
  restaurant: 'mesh',
  // A stand should look sunny and hand-made, not like a chain. Aurora is the warmest of the
  // CSS backdrops and costs nothing, which matters for a site that might exist for one Saturday.
  lemonade_stand: 'aurora',
  bakery: 'mesh',
  cafe: 'mesh',
  salon: 'aurora',
  spa: 'aurora',
  // Considered professions — restraint.
  real_estate: 'mesh',
  medical: 'wash',
  // Corporate/B2B — ruled columns read as considered rather than decorative.
  legal: 'ledger',
  finance: 'ledger',
  accounting: 'ledger',
  insurance: 'ledger',
  consulting: 'ledger',
  // Tech + product — contour reads modern behind feature/product copy, which is
  // exactly where a warm painterly image would feel wrong.
  software: 'topo',
  saas: 'topo',
  technology: 'topo',
  it_services: 'circuit',
  web_design: 'topo',
  marketing: 'topo',
  // Engineering-adjacent — traces over a plain grid.
  electrical: 'circuit',
  security: 'circuit',
  solar: 'circuit',
};

/** The style a NEW site of this industry starts with. Never `none` — that's the point. */
export function defaultBackdropFor(industryKey?: string | null): SiteBackdrop {
  const style = (industryKey && INDUSTRY_DEFAULTS[industryKey]) || 'wash';
  return { style, intensity: 50, auto: true };
}

/** Read the persisted backdrop off a template, tolerating older/looser shapes. */
export function readBackdrop(template: any): SiteBackdrop | null {
  const raw = template?.data?.meta?.backdrop ?? template?.meta?.backdrop ?? null;
  if (!raw || typeof raw !== 'object') return null;
  const style = raw.style;
  if (!BACKDROP_STYLES.includes(style)) return null;
  return {
    style,
    intensity: typeof raw.intensity === 'number' ? clamp(raw.intensity, 0, 100) : 50,
    url: typeof raw.url === 'string' ? raw.url : null,
    subject: typeof raw.subject === 'string' ? raw.subject : null,
    auto: !!raw.auto,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Colour tokens a recipe is bound to. Each is an HSL triple ("H S% L%") — a CSS custom
 *  property that holds one on screen, or a literal for contexts with no cascade (print). */
export type BackdropColors = { accent: string; ink: string };

/** On a site the theme wrapper has already scoped these, so a backdrop tracks the accent
 *  and light/dark without knowing either. */
export const SCREEN_COLORS: BackdropColors = {
  accent: 'var(--primary)',
  ink: 'var(--foreground)',
};

/** Print/standalone HTML (outreach postcards): no cascade and no CSS vars, so the brand
 *  palette is bound literally. emerald-400 #34d399 / slate-50 #f8fafc. */
export const PRINT_COLORS: BackdropColors = {
  accent: '160 84% 52%',
  ink: '210 40% 98%',
};

/**
 * CSS for the backdrop layer. Returns null when there is nothing to paint — the caller
 * then renders no layer at all and the site looks exactly as it does today (rule 7).
 *
 * Everything is expressed against `--primary` / `--background`, which the theme wrapper
 * has already scoped, so a backdrop tracks the site's accent and its light/dark mode
 * without knowing either. `a` scales every alpha from the 0–100 intensity.
 */
export function backdropLayerStyle(
  b: SiteBackdrop | null,
  colors: BackdropColors = SCREEN_COLORS,
): CSSProperties | null {
  if (!b || b.style === 'none') return null;
  const t = clamp(b.intensity ?? 50, 0, 100) / 100;
  if (t <= 0) return null;
  const a = (base: number) => +(base * t).toFixed(3);
  const P = colors.accent;
  // Every recipe below writes `hsl(<token> / <alpha>)`, so a token is an HSL triple —
  // either a CSS var that holds one (screen) or a literal "H S% L%" (print).
  const FG = colors.ink;

  switch (b.style) {
    case 'wash':
      return {
        backgroundImage: [
          `radial-gradient(ellipse 80% 55% at 50% -10%, hsl(${P} / ${a(0.22)}) 0%, transparent 70%)`,
          `radial-gradient(ellipse 60% 40% at 85% 100%, hsl(${P} / ${a(0.12)}) 0%, transparent 72%)`,
        ].join(', '),
      };

    case 'mesh':
      return {
        backgroundImage: [
          `radial-gradient(at 12% 18%, hsl(${P} / ${a(0.26)}) 0px, transparent 55%)`,
          `radial-gradient(at 88% 12%, hsl(${P} / ${a(0.16)}) 0px, transparent 50%)`,
          `radial-gradient(at 72% 82%, hsl(${P} / ${a(0.22)}) 0px, transparent 55%)`,
          `radial-gradient(at 22% 92%, hsl(${P} / ${a(0.13)}) 0px, transparent 50%)`,
        ].join(', '),
      };

    case 'aurora':
      return {
        backgroundImage: [
          `linear-gradient(115deg, transparent 20%, hsl(${P} / ${a(0.20)}) 42%, transparent 58%)`,
          `linear-gradient(155deg, transparent 45%, hsl(${P} / ${a(0.14)}) 66%, transparent 80%)`,
          `radial-gradient(ellipse 90% 50% at 50% 0%, hsl(${P} / ${a(0.14)}) 0%, transparent 70%)`,
        ].join(', '),
      };

    case 'grid':
      // Lines in the foreground token so the grid reads on light AND dark without a swap.
      return {
        backgroundImage: [
          `linear-gradient(hsl(${FG} / ${a(0.07)}) 1px, transparent 1px)`,
          `linear-gradient(90deg, hsl(${FG} / ${a(0.07)}) 1px, transparent 1px)`,
          `radial-gradient(ellipse 70% 50% at 50% 0%, hsl(${P} / ${a(0.16)}) 0%, transparent 70%)`,
        ].join(', '),
        backgroundSize: '48px 48px, 48px 48px, 100% 100%',
      };

    case 'dots':
      return {
        backgroundImage: [
          `radial-gradient(hsl(${FG} / ${a(0.10)}) 1px, transparent 1px)`,
          `radial-gradient(ellipse 70% 50% at 50% 0%, hsl(${P} / ${a(0.14)}) 0%, transparent 70%)`,
        ].join(', '),
        backgroundSize: '22px 22px, 100% 100%',
      };

    case 'topo': {
      // Concentric contour rings, offset so they read as terrain rather than a target.
      const line = `hsl(${P} / ${a(0.16)})`;
      return {
        backgroundImage: [
          `repeating-radial-gradient(circle at 18% 22%, transparent 0 26px, ${line} 26px 27px)`,
          `repeating-radial-gradient(circle at 82% 78%, transparent 0 34px, hsl(${FG} / ${a(0.05)}) 34px 35px)`,
          `radial-gradient(ellipse 80% 55% at 50% 0%, hsl(${P} / ${a(0.14)}) 0%, transparent 72%)`,
        ].join(', '),
      };
    }

    case 'circuit': {
      // Orthogonal traces at two scales + nodes where they meet.
      const trace = `hsl(${P} / ${a(0.13)})`;
      const node = `hsl(${P} / ${a(0.30)})`;
      return {
        backgroundImage: [
          `radial-gradient(${node} 1.5px, transparent 1.6px)`,
          `linear-gradient(${trace} 1px, transparent 1px)`,
          `linear-gradient(90deg, ${trace} 1px, transparent 1px)`,
          `radial-gradient(ellipse 70% 50% at 50% 0%, hsl(${P} / ${a(0.12)}) 0%, transparent 70%)`,
        ].join(', '),
        backgroundSize: '64px 64px, 64px 64px, 64px 64px, 100% 100%',
      };
    }

    case 'ledger': {
      // Vertical rules with a heavier one every fourth column — quiet and corporate.
      const rule = `hsl(${FG} / ${a(0.055)})`;
      return {
        backgroundImage: [
          `repeating-linear-gradient(90deg, ${rule} 0 1px, transparent 1px 72px)`,
          `repeating-linear-gradient(90deg, hsl(${FG} / ${a(0.03)}) 0 1px, transparent 1px 18px)`,
          `linear-gradient(180deg, hsl(${P} / ${a(0.10)}) 0%, transparent 42%)`,
        ].join(', '),
      };
    }

    case 'paper':
      return {
        backgroundImage: [
          `radial-gradient(ellipse 100% 60% at 50% 0%, hsl(${FG} / ${a(0.05)}) 0%, transparent 70%)`,
          `linear-gradient(180deg, hsl(${P} / ${a(0.08)}) 0%, transparent 38%)`,
          `repeating-linear-gradient(90deg, hsl(${FG} / ${a(0.022)}) 0px, hsl(${FG} / ${a(0.022)}) 1px, transparent 1px, transparent 3px)`,
        ].join(', '),
      };

    case 'painterly': {
      // No image yet → render nothing rather than an empty box (rule 7: degrade to plain).
      if (!b.url) return null;
      return {
        backgroundImage: `url("${b.url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        // Standard rule 8: text contrast can't depend on what the model returned, so the
        // painting is held well back and a scrim goes over it (see the wrapper).
        opacity: +(0.10 + 0.35 * t).toFixed(3),
      };
    }

    default:
      return null;
  }
}

/**
 * Scrim over a painterly image so body text keeps its contrast guarantee regardless of
 * what came back from the model (standard rule 8 — enforce contrast, don't hope for it).
 * CSS styles need no scrim: they're already alpha-composited over `--background`.
 */
export function backdropScrimStyle(b: SiteBackdrop | null): CSSProperties | null {
  if (!b || b.style !== 'painterly' || !b.url) return null;
  return {
    backgroundImage:
      'linear-gradient(to bottom, hsl(var(--background) / 0.82) 0%, hsl(var(--background) / 0.68) 45%, hsl(var(--background) / 0.86) 100%)',
  };
}
