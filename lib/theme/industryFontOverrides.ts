// lib/theme/industryFontOverrides.ts
//
// Superadmin-pinned typeface per industry, overriding the mood table.
//
// ⚠️ WHY AN OVERRIDE RATHER THAN EDITING THE TABLE. `INDUSTRY_FONT_MOOD` is taste expressed as
// code — changing it means a deploy, and the person with the taste is looking at a site in the
// editor, not at a TypeScript file. This lets them pin what they are already looking at. The
// table stays the sane default for every industry nobody has had an opinion about yet.
//
// ⚠️ A PIN IS A SET, NOT A SINGLE FACE. One pairing per industry makes every towing site in a
// town identical, which is the "obviously a template" tell we are trying to lose. An operator
// approves two or three faces that suit the trade and sites spread across them deterministically
// — varied to a visitor, repeatable for us. A set of one behaves exactly like a hard pin.
//
// ⚠️ PINNING DOES NOT RETHEME EXISTING SITES. It changes what NEW sites in that industry get,
// and what the backfill would assign. Rewriting the typeface of sites somebody already shipped
// is a separate, visible act and must stay a separate decision — see scripts/backfill-font-pairs.mts.

import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { FONT_PAIRINGS } from '@/lib/theme/fontPairings';

export const INDUSTRY_FONT_PINS_KEY = 'industry_font_pairs';

/** `{ towing: ['archivo-inter', 'oswald-inter'], author: ['playfair-source'] }` */
export type IndustryFontPins = Record<string, string[]>;

/**
 * ⚠️ Validated on READ, not only on write. A pairing can be renamed or removed in code while a
 * pin in the database still names it; serving an unknown id resolves to no font at all, which
 * is the system-stack bug this whole effort exists to fix. An unknown pin is dropped and the
 * mood table answers instead.
 */
export function sanitizePins(raw: unknown): IndustryFontPins {
  if (!raw || typeof raw !== 'object') return {};
  const out: IndustryFontPins = {};
  for (const [industry, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = typeof industry === 'string' ? industry.trim() : '';
    if (!key) continue;
    // ⚠️ Accepts a bare string as well as an array: the first version of this feature stored
    // one pairing per industry, and rows written then must keep working rather than silently
    // resolving to no font.
    const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const valid = [...new Set(list.filter((p): p is string => typeof p === 'string' && !!FONT_PAIRINGS[p]))];
    if (valid.length) out[key] = valid;
  }
  return out;
}

export async function getIndustryFontPins(): Promise<IndustryFontPins> {
  return sanitizePins(await getSiteSetting<unknown>(INDUSTRY_FONT_PINS_KEY, {}));
}

/**
 * Add or remove one pairing from an industry's approved set.
 *
 * `op: 'add'` grows the set, `'remove'` shrinks it, `'clear'` drops the industry entirely and
 * hands it back to the mood table. Removing the last member clears it, because an empty array
 * would mean "approved: nothing", which resolves to no font.
 */
export async function updateIndustryFontSet(
  industry: string,
  pair: string | null,
  op: 'add' | 'remove' | 'clear',
  actor?: string | null,
): Promise<IndustryFontPins> {
  const key = industry.trim();
  if (!key) throw new Error('industry is required');
  if (op !== 'clear') {
    if (!pair) throw new Error('a pairing is required');
    if (!FONT_PAIRINGS[pair]) throw new Error(`unknown pairing: ${pair}`);
  }

  const pins = await getIndustryFontPins();
  if (op === 'clear') {
    delete pins[key];
  } else {
    const cur = new Set(pins[key] ?? []);
    if (op === 'add') cur.add(pair!);
    else cur.delete(pair!);
    if (cur.size) pins[key] = [...cur];
    else delete pins[key];
  }

  await setSiteSetting(INDUSTRY_FONT_PINS_KEY, pins, actor ?? null);
  return pins;
}
