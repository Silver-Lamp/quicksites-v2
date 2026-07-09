// lib/theme/curatedThemes.ts
//
// A curated catalog of named site themes, applied industry-weighted-at-random at
// creation (see lib/theme/pickTheme.ts) and re-applyable from the editor. Each
// theme bundles accent + secondary + neutral tint + font pairing + radius +
// surface treatment + light/dark mode — enough independent variation that two
// generated sites read as different brands, not one template recolored.
//
// Phase A consumes: accentColor, borderRadius, fontPair, darkMode.
// Phase B (block refactor) additionally consumes: accent2Color, neutral, surface.
// See docs/THEME_SYSTEM_PLAN.md.

import type { IndustryKey } from '@/lib/industries';

export type ThemeCategory = 'rugged' | 'warm' | 'professional' | 'playful' | 'neon' | 'editorial';
export type NeutralTint = 'warm' | 'cool' | 'pure';
export type SurfaceTreatment = 'flat' | 'soft' | 'glow';

export type CuratedTheme = {
  id: string;
  name: string;
  category: ThemeCategory;
  /** Industries this theme suits best (drives the weighted picker). */
  industries: IndustryKey[];
  /** Tailwind accent token — must exist in lib/theme/accentHsl.ts ACCENT_HSL. */
  accentColor: string;
  /** Secondary accent (Phase B) — also in ACCENT_HSL. */
  accent2Color: string;
  /** Neutral tint for backgrounds/cards/borders (Phase B). */
  neutral: NeutralTint;
  /** Font pairing id — see lib/theme/fontPairings.ts. */
  fontPair: string;
  /** Legacy generic font family (back-compat for pre-pairing readers). */
  fontFamily: 'sans' | 'serif' | 'mono';
  borderRadius: 'sm' | 'md' | 'lg' | 'xl';
  /** Shadow/glow treatment (Phase B). */
  surface: SurfaceTreatment;
  darkMode: 'light' | 'dark';
};

export const CURATED_THEMES: CuratedTheme[] = [
  // --- rugged ---
  {
    id: 'ironworks', name: 'Ironworks', category: 'rugged',
    industries: ['auto_repair', 'general_contractor', 'towing', 'moving', 'hvac', 'electrical', 'plumbing', 'windshield_repair'],
    accentColor: 'amber-600', accent2Color: 'slate-700', neutral: 'cool',
    fontPair: 'oswald-inter', fontFamily: 'sans', borderRadius: 'sm', surface: 'flat', darkMode: 'dark',
  },
  {
    id: 'timberline', name: 'Timberline', category: 'rugged',
    industries: ['landscaping', 'roof_cleaning', 'pressure_washing', 'junk_removal', 'window_washing'],
    accentColor: 'emerald-700', accent2Color: 'amber-700', neutral: 'warm',
    fontPair: 'archivo-inter', fontFamily: 'sans', borderRadius: 'md', surface: 'soft', darkMode: 'dark',
  },

  // --- warm ---
  {
    id: 'hearth', name: 'Hearth', category: 'warm',
    industries: ['restaurant', 'farmers_market_vendor'],
    accentColor: 'orange-500', accent2Color: 'amber-500', neutral: 'warm',
    fontPair: 'dmserif-dmsans', fontFamily: 'serif', borderRadius: 'lg', surface: 'soft', darkMode: 'light',
  },
  {
    id: 'terracotta', name: 'Terracotta', category: 'warm',
    industries: ['restaurant'],
    accentColor: 'red-600', accent2Color: 'amber-600', neutral: 'warm',
    fontPair: 'fraunces-inter', fontFamily: 'serif', borderRadius: 'md', surface: 'soft', darkMode: 'light',
  },
  {
    id: 'bloom', name: 'Bloom', category: 'warm',
    industries: ['salon_spa', 'gifts_stationery', 'handmade'],
    accentColor: 'rose-500', accent2Color: 'pink-400', neutral: 'warm',
    fontPair: 'poppins-inter', fontFamily: 'sans', borderRadius: 'xl', surface: 'soft', darkMode: 'light',
  },

  // --- professional ---
  {
    id: 'meridian', name: 'Meridian', category: 'professional',
    industries: ['legal', 'real_estate'],
    accentColor: 'blue-600', accent2Color: 'slate-700', neutral: 'cool',
    fontPair: 'sora-inter', fontFamily: 'sans', borderRadius: 'sm', surface: 'flat', darkMode: 'light',
  },
  {
    id: 'slate-steel', name: 'Slate & Steel', category: 'professional',
    industries: ['real_estate', 'legal'],
    accentColor: 'slate-700', accent2Color: 'sky-500', neutral: 'cool',
    fontPair: 'space-inter', fontFamily: 'sans', borderRadius: 'md', surface: 'flat', darkMode: 'dark',
  },
  {
    id: 'evergreen', name: 'Evergreen', category: 'professional',
    industries: ['medical_dental', 'pest_control', 'carpet_cleaning'],
    accentColor: 'teal-600', accent2Color: 'emerald-600', neutral: 'cool',
    fontPair: 'lora-inter', fontFamily: 'sans', borderRadius: 'md', surface: 'soft', darkMode: 'light',
  },

  // --- playful ---
  {
    id: 'citrus', name: 'Citrus', category: 'playful',
    industries: ['fitness'],
    accentColor: 'lime-500', accent2Color: 'orange-500', neutral: 'pure',
    fontPair: 'bricolage-inter', fontFamily: 'sans', borderRadius: 'xl', surface: 'soft', darkMode: 'light',
  },
  {
    id: 'bubblegum', name: 'Bubblegum', category: 'playful',
    industries: ['retail_boutique', 'pop_up_shop', 'retail_thrift', 'pet_boutique'],
    accentColor: 'fuchsia-500', accent2Color: 'cyan-600', neutral: 'pure',
    fontPair: 'poppins-inter', fontFamily: 'sans', borderRadius: 'xl', surface: 'soft', darkMode: 'light',
  },

  // --- neon (leans on the neon-steampunk brand motif) ---
  {
    id: 'neon-dusk', name: 'Neon Dusk', category: 'neon',
    industries: [],
    accentColor: 'fuchsia-600', accent2Color: 'cyan-600', neutral: 'cool',
    fontPair: 'space-inter', fontFamily: 'sans', borderRadius: 'lg', surface: 'glow', darkMode: 'dark',
  },
  {
    id: 'voltage', name: 'Voltage', category: 'neon',
    industries: ['retail_electronics'],
    accentColor: 'violet-500', accent2Color: 'lime-500', neutral: 'pure',
    fontPair: 'jetbrains-inter', fontFamily: 'mono', borderRadius: 'md', surface: 'glow', darkMode: 'dark',
  },

  // --- editorial ---
  {
    id: 'broadsheet', name: 'Broadsheet', category: 'editorial',
    industries: ['author'],
    accentColor: 'gray-700', accent2Color: 'red-600', neutral: 'pure',
    fontPair: 'playfair-source', fontFamily: 'serif', borderRadius: 'sm', surface: 'flat', darkMode: 'light',
  },
  {
    id: 'gallery', name: 'Gallery', category: 'editorial',
    industries: ['photography', 'artisan_goods', 'art_supplies', 'antiques_vintage', 'collectibles'],
    accentColor: 'zinc-700', accent2Color: 'amber-600', neutral: 'warm',
    fontPair: 'fraunces-inter', fontFamily: 'sans', borderRadius: 'sm', surface: 'flat', darkMode: 'light',
  },
];

/** The object shape stamped into `data.meta.theme` for the render/editor layers. */
export type StampedTheme = {
  id: string;
  name: string;
  accentColor: string;
  accent2Color: string;
  neutral: NeutralTint;
  surface: SurfaceTreatment;
  fontPair: string;
  fontFamily: string;
  borderRadius: string;
  darkMode: 'light' | 'dark';
};

/** Flatten a CuratedTheme into the `data.meta.theme` bag. */
export function toStampedTheme(t: CuratedTheme): StampedTheme {
  return {
    id: t.id,
    name: t.name,
    accentColor: t.accentColor,
    accent2Color: t.accent2Color,
    neutral: t.neutral,
    surface: t.surface,
    fontPair: t.fontPair,
    fontFamily: t.fontFamily,
    borderRadius: t.borderRadius,
    darkMode: t.darkMode,
  };
}

export function getCuratedTheme(id?: string | null): CuratedTheme | null {
  if (!id) return null;
  return CURATED_THEMES.find((t) => t.id === id) ?? null;
}
