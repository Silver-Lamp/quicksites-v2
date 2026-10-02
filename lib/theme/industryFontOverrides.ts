// lib/theme/industryFontOverrides.ts
//
// Superadmin-pinned typeface per industry, overriding the mood table.
//
// ⚠️ WHY AN OVERRIDE RATHER THAN EDITING THE TABLE. `INDUSTRY_FONT_MOOD` is taste expressed as
// code — changing it means a deploy, and the person with the taste is looking at a site in the
// editor, not at a TypeScript file. This lets them pin what they are already looking at. The
// table stays the sane default for every industry nobody has had an opinion about yet.
//
// ⚠️ PINNING DOES NOT RETHEME EXISTING SITES. It changes what NEW sites in that industry get,
// and what the backfill would assign. Rewriting the typeface of sites somebody already shipped
// is a separate, visible act and must stay a separate decision — see scripts/backfill-font-pairs.mts.

import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { FONT_PAIRINGS } from '@/lib/theme/fontPairings';

export const INDUSTRY_FONT_PINS_KEY = 'industry_font_pairs';

/** `{ towing: 'archivo-inter', author: 'playfair-source' }` */
export type IndustryFontPins = Record<string, string>;

/**
 * ⚠️ Validated on READ, not only on write. A pairing can be renamed or removed in code while a
 * pin in the database still names it; serving an unknown id resolves to no font at all, which
 * is the system-stack bug this whole effort exists to fix. An unknown pin is dropped and the
 * mood table answers instead.
 */
export function sanitizePins(raw: unknown): IndustryFontPins {
  if (!raw || typeof raw !== 'object') return {};
  const out: IndustryFontPins = {};
  for (const [industry, pair] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof industry !== 'string' || !industry.trim()) continue;
    if (typeof pair !== 'string' || !FONT_PAIRINGS[pair]) continue;
    out[industry.trim()] = pair;
  }
  return out;
}

export async function getIndustryFontPins(): Promise<IndustryFontPins> {
  return sanitizePins(await getSiteSetting<unknown>(INDUSTRY_FONT_PINS_KEY, {}));
}

/** Pin a pairing to an industry. Pass `null` to unpin and fall back to the mood table. */
export async function setIndustryFontPin(
  industry: string,
  pair: string | null,
  actor?: string | null,
): Promise<IndustryFontPins> {
  const key = industry.trim();
  if (!key) throw new Error('industry is required');
  if (pair !== null && !FONT_PAIRINGS[pair]) throw new Error(`unknown pairing: ${pair}`);

  const pins = await getIndustryFontPins();
  if (pair === null) delete pins[key];
  else pins[key] = pair;

  await setSiteSetting(INDUSTRY_FONT_PINS_KEY, pins, actor ?? null);
  return pins;
}
