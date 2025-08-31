export type BlockKey =
  | 'header'
  | 'hero'
  | 'services'
  | 'faq'
  | 'testimonial'
  | 'contact_form'
  | 'service_areas'
  | 'footer';

export type BlockPick = {
  /** enable this block on the Home page */
  enabled: boolean;
  /** optional per-block config (size, count, etc.) */
  config?: Record<string, any>;
};

export type SeedTemplateOptions = {
  /** order matters: blocks will be added in this order */
  order: BlockKey[];
  /** map of enabled blocks and per-block options */
  picks: Partial<Record<BlockKey, BlockPick>>;
  /** theme/layout for the template */
  layout?: 'standard' | 'onepage';
  theme?: 'light' | 'dark';
  /** used for services generator & industry label for DB */
  industryLabel?: string | null;
  /** friendly site/brand name for fallback copy */
  siteName?: string;
  /** services list (names) to use if provided */
  serviceNames?: string[];
};
