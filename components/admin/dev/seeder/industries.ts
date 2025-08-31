// components/admin/dev/seeder/industries.ts

// Single source of truth
import {
  INDUSTRY_LABELS,          // de-duped labels for selects
  INDUSTRY_HINTS,           // Partial<Record<label, hint>>
  getIndustryOptions,       // [{ value: label, label }]
  resolveIndustry,          // (label?, slug?) -> { key, label }
} from '@/lib/industries';

// Back-compat: keep the same name/shape the seeder expects.
export const INDUSTRIES = INDUSTRY_LABELS;

// Re-export the shared helpers so callers here don’t need to change imports.
export { INDUSTRY_HINTS, getIndustryOptions, resolveIndustry };

/**
 * Build an industry-guided prompt for ideation.
 * (keeps your original API but sources hints from the shared registry)
 */
export function buildIndustryPrompt(
  industry: string,
  base?: string,
  productType: 'meal'|'physical'|'digital'|'service'|'mixed' = 'physical'
): string {
  const hint =
    INDUSTRY_HINTS[industry] ||
    'Highlight trust, responsiveness, and clear pricing.';

  const isRestaurant = industry === 'Restaurant' || productType === 'meal';
  const typeLine = isRestaurant
    ? 'Product focus: meals, sides, desserts, and bundles.'
    : 'Product focus: service packages and physical goods with clear value tiers.';

  return [
    `Industry: ${industry}.`,
    hint,
    typeLine,
    (base || '').trim(),
    'Keep copy concise, conversion-oriented, and SEO-friendly for local search.',
  ]
    .filter(Boolean)
    .join(' ');
}
