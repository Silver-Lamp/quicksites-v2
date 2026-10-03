// lib/blocks/pickerTypes.ts
//
// The block types the editor's "Add a block" picker offers, as data — so a test can assert that
// EVERY one of them has a default that validates. The picker renders a live preview tile per type
// by calling `createDefaultBlock(type)`, which normalizes through the zod schema and THROWS on a
// bad default. On 2026-10-02 `quote` had no default: pressing "Add a block below" anywhere in the
// editor threw during render and the whole page fell to "Application error". A type listed here
// without a valid default is a crash on a button, and `lib/blocks/__tests__/pickerDefaults.test.ts`
// fails the build on it.
import type { Block } from '@/types/blocks';

export type PickerGroup = { label: string; types: Block['type'][] };

export const PICKER_GROUPS: Record<string, PickerGroup> = {
  callToAction: { label: 'Calls to Action', types: ['hero', 'contact_form'] },
  services: { label: 'Business Features', types: ['services', 'service_areas', 'hours', 'scheduler'] },
  ecommerce: { label: 'E-commerce', types: ['products_grid', 'service_offer'] },
  content: { label: 'Content Blocks', types: ['text', 'quote', 'faq', 'testimonial', 'video', 'audio'] },
};

export const QUICK_PICKS: Array<{ type: Block['type']; label: string }> = [
  { type: 'text', label: 'Text' },
  { type: 'contact_form', label: 'Contact' },
  { type: 'hero', label: 'Hero' },
  { type: 'faq', label: 'FAQ' },
  { type: 'hours', label: 'Hours' },
  { type: 'products_grid', label: 'Products' },
  { type: 'scheduler', label: 'Scheduler' },
];

/** Every type the picker can show, deduplicated. */
export function allPickerTypes(): Block['type'][] {
  const out = new Set<Block['type']>();
  for (const g of Object.values(PICKER_GROUPS)) for (const t of g.types) out.add(t);
  for (const q of QUICK_PICKS) out.add(q.type);
  return [...out];
}
