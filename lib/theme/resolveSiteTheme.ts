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

export type ResolvedSiteTheme = {
  /** CSS custom properties to scope onto the site wrapper. */
  vars: Record<string, string>;
  /** font-family stack to apply (or undefined to leave inherited). */
  fontFamily?: string;
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
function metaTheme(template: any): { accentColor?: string; fontFamily?: string; borderRadius?: string } | null {
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

  const fontStack = fontFamily ? FONT_STACKS[fontFamily] : undefined;

  return { vars, fontFamily: fontStack };
}
