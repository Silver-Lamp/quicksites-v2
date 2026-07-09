// lib/blocks/variants.ts
//
// Per-block layout variants surfaced as an inline control in the editor's block
// toolbar. Selecting one sets the given content field on the block (non-destructive,
// content-preserving). `services.variant` overrides the theme's featureVariant;
// `hero.layout_mode` switches the hero shape.

export type BlockVariantSpec = {
  /** content field to set on the block. */
  field: string;
  label: string;
  options: { value: string; label: string }[];
};

export const BLOCK_VARIANTS: Record<string, BlockVariantSpec> = {
  hero: {
    field: 'layout_mode',
    label: 'Hero layout',
    options: [
      { value: 'inline', label: 'Inline' },
      { value: 'full_bleed', label: 'Full bleed' },
      { value: 'background', label: 'Background' },
    ],
  },
  services: {
    field: 'variant',
    label: 'Services style',
    options: [
      { value: 'grid', label: 'Grid' },
      { value: 'cards', label: 'Cards' },
      { value: 'rows', label: 'Rows' },
    ],
  },
};
