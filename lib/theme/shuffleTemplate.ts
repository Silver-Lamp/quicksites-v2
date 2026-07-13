// lib/theme/shuffleTemplate.ts
//
// The one-tap "Shuffle everything" transform, extracted pure so both the editor's
// action toolbar and the standalone /preview page apply the exact same restyle.
// It picks a fresh curated theme + matching hero/services layout and stamps it onto
// `data.meta.theme` + the relevant block style fields. CONTENT-SAFE: it only touches
// style/layout fields, never copy. (Randomness is Math.random via pickCuratedTheme;
// pass a pre-picked theme to make it deterministic in tests.)

import { pickCuratedTheme } from '@/lib/theme/pickTheme';
import { toStampedTheme, type CuratedTheme } from '@/lib/theme/curatedThemes';
import { heroModeFromLayout } from '@/lib/theme/shuffleOptions';

export type BlockStyleChange = { type: string; field: string; value: string };

/**
 * Set `content[field]` on every block of `type` across all pages (copy untouched).
 * Recurses into nested `blocks`. Pure — returns a new data object.
 */
export function withBlockStyles(data: any, changes: BlockStyleChange[]): any {
  const setOn = (blocks: any): any => {
    if (!Array.isArray(blocks)) return blocks;
    return blocks.map((b: any) => {
      let nb = b;
      for (const c of changes) {
        if (b?.type === c.type) nb = { ...nb, content: { ...(nb.content ?? {}), [c.field]: c.value } };
      }
      if (Array.isArray(nb?.blocks)) nb = { ...nb, blocks: setOn(nb.blocks) };
      return nb;
    });
  };
  const pages = Array.isArray(data?.pages)
    ? data.pages.map((p: any) => ({
        ...p,
        blocks: setOn(p.blocks),
        ...(Array.isArray(p.content_blocks) ? { content_blocks: setOn(p.content_blocks) } : {}),
      }))
    : data?.pages;
  return { ...data, pages };
}

export type ShuffleAllResult = {
  /** The new template `data` blob (meta.theme + block styles updated). */
  data: any;
  /** The theme's color mode — mirror onto the template's top-level color_mode. */
  colorMode: 'light' | 'dark';
  /** Display name of the picked theme (for a toast). */
  themeName: string;
};

/**
 * Produce a fully shuffled `data` blob: a new curated theme (avoiding the current
 * one) plus a matching hero layout + services variant. Pass `opts.theme` to skip
 * the random pick (tests / "apply this exact theme").
 */
export function shuffleAllData(
  data: any,
  opts: { industry?: string | null; theme?: CuratedTheme } = {},
): ShuffleAllResult {
  const cur = data ?? {};
  const industry = opts.industry ?? cur?.meta?.industry ?? null;
  const theme =
    opts.theme ??
    pickCuratedTheme({
      industry: industry ?? undefined,
      avoidId: cur?.meta?.theme?.id ?? null,
      avoidAccent: cur?.meta?.theme?.accentColor ?? null,
    });
  const stamped = toStampedTheme(theme);
  const colorMode = theme.darkMode;

  let next = {
    ...cur,
    color_mode: colorMode,
    meta: { ...(cur.meta ?? {}), theme: stamped },
  };
  next = withBlockStyles(next, [
    { type: 'hero', field: 'layout_mode', value: heroModeFromLayout(stamped?.layout?.heroLayout) },
    { type: 'services', field: 'variant', value: stamped?.layout?.featureVariant ?? 'grid' },
  ]);

  return { data: next, colorMode, themeName: theme.name };
}
