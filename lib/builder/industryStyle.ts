// lib/builder/industryStyle.ts
//
// One classification of an industry's "personality," shared by the page-archetype
// bias (industryScaffold) and the hero/CTA copy picker (industryCopy) so both stay
// in sync from a single source of truth.

import type { IndustryKey } from '@/lib/industries';

export type IndustryStyle = 'urgency' | 'visual' | 'trust' | 'generic';

// Visual trades sell on results/portfolio; social proof + story read well.
const VISUAL = new Set<IndustryKey>([
  'landscaping', 'roof_cleaning', 'pressure_washing', 'window_washing', 'carpet_cleaning',
  'junk_removal', 'photography', 'salon_spa', 'artisan_goods', 'handmade', 'painting',
]);
// Trust-sensitive professionals — credibility and consultation lead.
const TRUST = new Set<IndustryKey>([
  'legal', 'real_estate', 'medical_dental',
]);
// Urgency trades — fast help / call-now framing converts.
const URGENCY = new Set<IndustryKey>([
  'towing', 'hvac', 'plumbing', 'electrical', 'auto_repair', 'pest_control', 'windshield_repair',
]);

export function industryStyle(key?: IndustryKey | null): IndustryStyle {
  if (!key) return 'generic';
  if (URGENCY.has(key)) return 'urgency';
  if (TRUST.has(key)) return 'trust';
  if (VISUAL.has(key)) return 'visual';
  return 'generic';
}
