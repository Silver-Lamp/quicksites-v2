// lib/theme/pickTheme.ts
//
// Industry-weighted random theme picker. Every curated theme keeps a non-zero
// weight (so the full catalog stays reachable / sites stay varied), but themes
// that explicitly suit the site's industry — or match its archetype category —
// are favored. Repeating the previous accent is dampened so consecutive
// generated sites diverge.

import type { IndustryKey } from '@/lib/industries';
import { CURATED_THEMES, type CuratedTheme, type ThemeCategory } from '@/lib/theme/curatedThemes';

/** Best archetype category per industry — the fallback weighting signal. */
const INDUSTRY_CATEGORY: Partial<Record<IndustryKey, ThemeCategory>> = {
  // trades / home services → rugged
  towing: 'rugged', auto_repair: 'rugged', windshield_repair: 'rugged', junk_removal: 'rugged',
  general_contractor: 'rugged', moving: 'rugged', window_washing: 'rugged', roof_cleaning: 'rugged',
  pressure_washing: 'rugged', landscaping: 'rugged', hvac: 'rugged', plumbing: 'rugged',
  electrical: 'rugged', carpet_cleaning: 'rugged', pest_control: 'rugged', painting: 'rugged',
  // professional
  real_estate: 'professional', real_estate_agency: 'professional', legal: 'professional', medical_dental: 'professional',
  // warm
  restaurant: 'warm', salon_spa: 'warm', farmers_market_vendor: 'warm', gifts_stationery: 'warm',
  handmade: 'warm', crafts: 'warm', artisan_goods: 'warm',
  // playful (retail / maker / resale / fitness)
  fitness: 'playful', retail_boutique: 'playful', retail_home_goods: 'playful', retail_thrift: 'playful',
  pop_up_shop: 'playful', pet_boutique: 'playful', custom_apparel: 'playful', print_on_demand: 'playful',
  retail_electronics: 'playful', online_reseller: 'playful', etsy_style: 'playful', collectibles: 'playful',
  art_supplies: 'playful', antiques_vintage: 'playful',
  // editorial
  photography: 'editorial', author: 'editorial',
};

const W_BASE = 1;
const W_INDUSTRY = 8; // explicit industry match
const W_CATEGORY = 3; // archetype match
const AVOID_ACCENT_FACTOR = 0.15; // dampen (not exclude) repeating the last accent

export type PickThemeOpts = {
  industry?: IndustryKey | string | null;
  /** Accent token of the previously generated site, to avoid repeating. */
  avoidAccent?: string | null;
  /** Theme id to exclude (e.g. the current one when reshuffling). */
  avoidId?: string | null;
  /** Injectable RNG in [0,1) for deterministic tests. */
  rng?: () => number;
};

function weightFor(theme: CuratedTheme, opts: PickThemeOpts): number {
  const industry = (opts.industry ?? '') as IndustryKey;
  let w = W_BASE;
  if (industry && theme.industries.includes(industry)) w += W_INDUSTRY;
  const cat = industry ? INDUSTRY_CATEGORY[industry] : undefined;
  if (cat && theme.category === cat) w += W_CATEGORY;
  if (opts.avoidAccent && theme.accentColor === opts.avoidAccent) w *= AVOID_ACCENT_FACTOR;
  return w;
}

/** Pick one curated theme, industry-weighted. Never throws; always returns a theme. */
export function pickCuratedTheme(opts: PickThemeOpts = {}): CuratedTheme {
  const rng = opts.rng ?? Math.random;
  let pool = CURATED_THEMES;
  if (opts.avoidId && pool.length > 1) {
    const filtered = pool.filter((t) => t.id !== opts.avoidId);
    if (filtered.length) pool = filtered;
  }

  const weights = pool.map((t) => weightFor(t, opts));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return pool[Math.floor(rng() * pool.length)] ?? CURATED_THEMES[0];

  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
