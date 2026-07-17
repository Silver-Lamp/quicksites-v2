// lib/theme/industryPresets.ts
//
// Per-industry visual presets (SiteTheme) consumed by IndustryThemeScope, the
// admin template preview cards, the useThemeContext industry fallback, and the
// builder first-run scaffold (lib/builder/industryScaffold.ts). Keyed by the
// canonical IndustryKey (lib/industries). Use getIndustryPreset() for safe,
// fallback-aware lookups.

import type { SiteTheme } from '@/hooks/useThemeContext';
import type { IndustryKey } from '@/lib/industries';

/** Light, professional, trustworthy — the home-services default. */
const homeService = (accentColor: string): SiteTheme => ({
  fontFamily: 'sans',
  accentColor,
  borderRadius: 'lg',
  glow: [],
  darkMode: 'dark',
});

/** Dark, rugged — automotive / after-hours / heavy trades. */
const rugged = (accentColor: string): SiteTheme => ({
  fontFamily: 'sans',
  accentColor,
  borderRadius: 'md',
  glow: [],
  darkMode: 'dark',
});

/** Clean, restrained — legal / medical / real estate. */
const professional = (accentColor: string): SiteTheme => ({
  fontFamily: 'serif',
  accentColor,
  borderRadius: 'sm',
  glow: [],
  darkMode: 'dark',
});

/** Warm, friendly — playful retail / maker / food / wellness. */
const warm = (accentColor: string, fontFamily: SiteTheme['fontFamily'] = 'sans'): SiteTheme => ({
  fontFamily,
  accentColor,
  borderRadius: 'xl',
  glow: [],
  darkMode: 'dark',
});

export const industryPresets: Record<string, SiteTheme> = {
  // --- Trades / automotive (dark, rugged) ---
  towing: rugged('amber-500'),
  auto_repair: rugged('red-600'),
  windshield_repair: rugged('sky-500'),
  junk_removal: rugged('lime-500'),
  general_contractor: rugged('orange-500'),
  deck_builder: rugged('amber-600'), // warm wood tone — decks, cedar, outdoor living
  moving: rugged('blue-500'),

  // --- Home services (light, trustworthy) ---
  window_washing: homeService('sky-500'),
  roof_cleaning: homeService('cyan-600'),
  pressure_washing: homeService('teal-500'),
  landscaping: homeService('emerald-600'),
  hvac: homeService('blue-600'),
  plumbing: homeService('blue-500'),
  electrical: homeService('amber-500'),
  carpet_cleaning: homeService('teal-600'),
  pest_control: homeService('green-600'),
  painting: homeService('violet-500'),

  // --- Professional services (clean, serif) ---
  real_estate: professional('emerald-700'),
  legal: professional('slate-700'),
  medical_dental: professional('teal-600'),

  // --- Food / wellness ---
  restaurant: warm('amber-600', 'serif'),
  salon_spa: warm('rose-500'),
  fitness: { fontFamily: 'sans', accentColor: 'lime-500', borderRadius: 'lg', glow: [], darkMode: 'dark' },
  photography: { fontFamily: 'sans', accentColor: 'zinc-300', borderRadius: 'sm', glow: [], darkMode: 'dark' },

  // --- Retail / maker / resale (warm, playful) ---
  retail_boutique: warm('fuchsia-500'),
  retail_home_goods: warm('amber-500'),
  retail_electronics: warm('indigo-500'),
  retail_thrift: warm('rose-500'),
  crafts: warm('pink-500', 'serif'),
  handmade: warm('rose-500', 'serif'),
  etsy_style: warm('orange-500', 'serif'),
  gifts_stationery: warm('pink-400'),
  artisan_goods: warm('amber-700', 'serif'),
  art_supplies: warm('violet-500'),
  antiques_vintage: warm('amber-800', 'serif'),
  collectibles: warm('indigo-500'),
  pet_boutique: warm('teal-500'),
  pop_up_shop: warm('fuchsia-600'),
  farmers_market_vendor: warm('green-600', 'serif'),
  online_reseller: warm('sky-500'),
  print_on_demand: warm('purple-500'),
  custom_apparel: warm('rose-600'),

  // --- Author / writer (literary, book-forward) ---
  author: { fontFamily: 'serif', accentColor: 'indigo-600', borderRadius: 'sm', glow: [], darkMode: 'dark' },

  // --- Fallback ---
  personal: warm('rose-500'), // a warm, human "about me" page
  other: homeService('indigo-600'),

  // --- Legacy aliases (kept for back-compat with older callers) ---
  bakery: warm('yellow-500', 'cursive'),
  agency: { fontFamily: 'sans', accentColor: 'sky-500', borderRadius: 'sm', glow: [], darkMode: 'dark' },
  default: homeService('indigo-600'),
};

/** Safe lookup: returns the industry preset, falling back to a neutral default. */
export function getIndustryPreset(key?: string | null): SiteTheme {
  const k = (key ?? '').toString().toLowerCase();
  return industryPresets[k] ?? industryPresets.other ?? industryPresets.default;
}

/** Typed convenience for callers that already hold an IndustryKey. */
export function presetForIndustryKey(key: IndustryKey): SiteTheme {
  return getIndustryPreset(key);
}
