// lib/theme/resolveSiteTheme.ts
//
// Resolve a rendered site's accent/font/radius from its persisted theme
// (data.meta.theme, stamped by the industry scaffold) or, failing that, its
// industry preset. Returns null when nothing themable is found, so the renderer
// can leave the design-system defaults untouched (existing sites unchanged).
//
// NOTE: light/dark is intentionally NOT handled here — color_mode is already
// wired through the renderer separately.

import { getIndustryPreset } from '@/lib/theme/industryPresets';
import { accentToHsl, foregroundForHsl } from '@/lib/theme/accentHsl';
import { getFontPairing, fontPairHref } from '@/lib/theme/fontPairings';

export type ResolvedSiteTheme = {
  /** CSS custom properties to scope onto the site wrapper. */
  vars: Record<string, string>;
  /** font-family stack to apply as the body font (or undefined to leave inherited). */
  fontFamily?: string;
  /** Google Fonts stylesheet URL to load in the site <head>, if a pairing is set. */
  fontHref?: string | null;
};

const FONT_STACKS: Record<string, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  cursive: '"Brush Script MT", "Segoe Script", cursive',
};

const RADIUS_REM: Record<string, string> = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
};

// Neutral surface palettes (Phase B): a curated theme's `neutral` tint +
// light/dark mode select one of these bundles, scoped onto the site wrapper so
// semantic-token blocks (bg-background/card/muted, border-border, …) pick up the
// site's own palette instead of hardcoded grays. Values are "H S% L%" for the
// shadcn CSS vars. `pure` mirrors the globals.css defaults; `warm`/`cool` shift
// the neutral hue so two sites read as different brands.
type NeutralVars = {
  background: string; foreground: string;
  card: string; cardForeground: string;
  muted: string; mutedForeground: string;
  border: string; input: string;
};
const NEUTRAL_PALETTES: Record<string, { light: NeutralVars; dark: NeutralVars }> = {
  pure: {
    light: { background: '0 0% 100%', foreground: '222 47% 11%', card: '0 0% 100%', cardForeground: '222 47% 11%', muted: '240 5% 96%', mutedForeground: '240 4% 46%', border: '240 6% 90%', input: '240 6% 90%' },
    dark:  { background: '0 0% 6%', foreground: '210 40% 98%', card: '0 0% 9%', cardForeground: '210 40% 98%', muted: '240 4% 16%', mutedForeground: '240 5% 65%', border: '240 4% 18%', input: '240 4% 18%' },
  },
  warm: {
    light: { background: '40 30% 97%', foreground: '28 22% 12%', card: '40 33% 99%', cardForeground: '28 22% 12%', muted: '40 22% 92%', mutedForeground: '32 12% 40%', border: '38 20% 85%', input: '38 20% 85%' },
    dark:  { background: '28 14% 7%', foreground: '40 30% 96%', card: '28 13% 10%', cardForeground: '40 30% 96%', muted: '28 10% 16%', mutedForeground: '38 13% 66%', border: '28 10% 20%', input: '28 10% 20%' },
  },
  cool: {
    light: { background: '215 32% 97%', foreground: '222 42% 12%', card: '210 33% 99%', cardForeground: '222 42% 12%', muted: '215 25% 92%', mutedForeground: '215 15% 42%', border: '215 20% 85%', input: '215 20% 85%' },
    dark:  { background: '220 22% 8%', foreground: '210 40% 97%', card: '220 20% 11%', cardForeground: '210 40% 97%', muted: '220 15% 17%', mutedForeground: '215 15% 66%', border: '220 14% 21%', input: '220 14% 21%' },
  },
};

/** Read the theme bag a site carries (object form), if any. */
function metaTheme(
  template: any,
): {
  accentColor?: string; accent2Color?: string; fontFamily?: string;
  borderRadius?: string; fontPair?: string; neutral?: string; surface?: string;
  darkMode?: string;
} | null {
  const meta = template?.data?.meta ?? template?.meta ?? {};
  const t = meta?.theme;
  return t && typeof t === 'object' ? t : null;
}

/** Light/dark the site renders in — the neutral palette variant follows this. */
function colorModeOf(template: any, stamped: { darkMode?: string } | null): 'light' | 'dark' {
  const raw =
    template?.color_mode ?? template?.data?.color_mode ?? (stamped as any)?.darkMode ?? 'light';
  return raw === 'dark' ? 'dark' : 'light';
}

export function resolveSiteTheme(template: any): ResolvedSiteTheme | null {
  const meta = template?.data?.meta ?? template?.meta ?? {};
  const stamped = metaTheme(template);

  let accentColor = stamped?.accentColor;
  let fontFamily = stamped?.fontFamily;
  let borderRadius = stamped?.borderRadius;
  const fontPair = stamped?.fontPair;

  // Fall back to the industry preset when there's an industry but no stamped theme.
  if (!accentColor) {
    const industry = meta?.industry ?? template?.industry;
    if (industry) {
      const p = getIndustryPreset(String(industry));
      accentColor = p.accentColor;
      fontFamily = fontFamily ?? p.fontFamily;
      borderRadius = borderRadius ?? p.borderRadius;
    }
  }

  const accentHsl = accentToHsl(accentColor);
  if (!accentHsl) return null; // nothing themable → leave defaults

  const vars: Record<string, string> = {
    '--primary': accentHsl,
    '--primary-foreground': foregroundForHsl(accentHsl),
    '--ring': accentHsl,
  };
  if (borderRadius && RADIUS_REM[borderRadius]) vars['--radius'] = RADIUS_REM[borderRadius];

  // Secondary accent (Phase B) — used by blocks for alt buttons / gradients.
  const accent2Hsl = accentToHsl(stamped?.accent2Color);
  if (accent2Hsl) {
    vars['--secondary'] = accent2Hsl;
    vars['--secondary-foreground'] = foregroundForHsl(accent2Hsl);
  }

  // Neutral surface palette (Phase B) — only for curated themes that declare a
  // tint. color_mode selects the light/dark variant. This is what makes two
  // themed sites read as different brands beyond just the accent.
  const palette = stamped?.neutral ? NEUTRAL_PALETTES[stamped.neutral] : undefined;
  if (palette) {
    const mode = colorModeOf(template, stamped);
    const p = palette[mode];
    vars['--background'] = p.background;
    vars['--foreground'] = p.foreground;
    vars['--card'] = p.card;
    vars['--card-foreground'] = p.cardForeground;
    vars['--muted'] = p.muted;
    vars['--muted-foreground'] = p.mutedForeground;
    vars['--border'] = p.border;
    vars['--input'] = p.input;
    // Neutral accent surface tracks muted so hover/selected states stay on-palette.
    vars['--accent'] = p.muted;
    vars['--accent-foreground'] = p.foreground;
  }

  // Font: prefer a curated pairing (distinct heading + body faces, loaded from
  // Google Fonts); fall back to the legacy generic family → system stack.
  const pairing = getFontPairing(fontPair);
  let fontStack: string | undefined;
  let fontHref: string | null = null;
  if (pairing) {
    vars['--font-heading'] = pairing.heading.stack;
    vars['--font-body'] = pairing.body.stack;
    fontStack = pairing.body.stack;
    fontHref = fontPairHref(fontPair);
  } else if (fontFamily) {
    fontStack = FONT_STACKS[fontFamily];
    if (fontStack) vars['--font-body'] = fontStack;
  }

  return { vars, fontFamily: fontStack, fontHref };
}
