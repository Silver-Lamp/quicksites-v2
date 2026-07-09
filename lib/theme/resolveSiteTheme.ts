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

/** Read the theme bag a site carries (object form), if any. */
function metaTheme(
  template: any,
): { accentColor?: string; fontFamily?: string; borderRadius?: string; fontPair?: string } | null {
  const meta = template?.data?.meta ?? template?.meta ?? {};
  const t = meta?.theme;
  return t && typeof t === 'object' ? t : null;
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
