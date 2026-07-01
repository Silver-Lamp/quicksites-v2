// lib/org/theme.ts
//
// Pure helpers for reading an org's white-label accent color out of the freeform
// organizations.theme_json blob (now exposed via organizations_public). No
// canonical shape existed, so we define one: an accent hex under `primary`,
// `accent`, or `colors.primary`. Validated so a bad value never reaches the DOM.
// See docs/WHITE_LABEL_PLAN.md.

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** A validated 3/6-digit hex color, or null. */
export function normalizeHexColor(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return HEX.test(s) ? s : null;
}

/**
 * Pick an org's accent color from theme_json, checking `primary`, `accent`, then
 * `colors.primary`. Returns a validated hex or null (callers keep their default).
 */
export function pickAccentColor(themeJson: any): string | null {
  if (!themeJson || typeof themeJson !== 'object') return null;
  return (
    normalizeHexColor(themeJson.primary) ??
    normalizeHexColor(themeJson.accent) ??
    normalizeHexColor(themeJson.colors?.primary) ??
    null
  );
}
